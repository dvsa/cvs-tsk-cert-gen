import { Inject, Service } from 'typedi';
import { InvocationRequest, InvocationResponse } from '@aws-sdk/client-lambda';
import { toUint8Array } from '@smithy/util-utf8';
import moment from 'moment';
import {
  AVAILABLE_WELSH, CERTIFICATE_DATA, ERRORS, IVA_30, LOCATION_ENGLISH, LOCATION_WELSH, TEST_RESULTS, VEHICLE_TYPES,
} from '../models/Enums';
import { ITestResult } from '../models/ITestResult';
import { IDefectParent } from '../models/IDefectParent';
import { IFlatDefect } from '../models/IFlatDefect';
import { TechRecordType } from '../models/Types';
import { IRoadworthinessCertificateData } from '../models/IRoadworthinessCertificateData';
import { IItem } from '../models/IItem';
import { IDefectChild } from '../models/IDefectChild';
import { IInvokeConfig } from '../models/IInvokeConfig';
import { HTTPError } from '../models/HTTPError';
import { Configuration } from '../utils/Configuration';
import { LambdaService } from './LambdaService';
import { TestService } from './TestService';
import { ICustomDefect } from '../models/ICustomDefect';
import { TechRecordsRepository } from './TechRecordsRepository';
import { IWeightDetails } from '../models/IWeightDetails';
import { TechRecordsService } from './TechRecordsService';
import { DefectService } from './DefectService';

@Service()
export class CertificatePayloadGenerator {
  private readonly config: Configuration;

  private readonly lambdaClient: LambdaService;

  private readonly testService: TestService = new TestService();

  private readonly techRecordsRepository: TechRecordsRepository;

  private readonly techRecordsService: TechRecordsService;

  private readonly defectService: DefectService;

  constructor(@Inject() lambdaClient: LambdaService, @Inject() techRecordsRepository: TechRecordsRepository, @Inject() techRecordsService: TechRecordsService, @Inject() defectService: DefectService) {
    this.config = Configuration.getInstance();
    this.lambdaClient = lambdaClient;
    this.techRecordsRepository = techRecordsRepository;
    this.techRecordsService = techRecordsService;
    this.defectService = defectService;
  }

  /**
   * Generates certificate data for a given test result and certificate type
   * @param testResult - the source test result for certificate generation
   * @param type - the certificate type
   * @param isWelsh - the boolean value whether the atf where test was conducted resides in Wales
   */
  public async generateCertificateData(testResult: ITestResult, type: CERTIFICATE_DATA, isWelsh: boolean = false) {
    let defectListFromApi: IDefectParent[] = [];
    let flattenedDefects: IFlatDefect[] = [];
    if (isWelsh) {
      defectListFromApi = await this.getDefectTranslations();
      flattenedDefects = this.flattenDefectsFromApi(defectListFromApi);
    }
    const testType: any = testResult.testTypes;
    switch (type) {
      case CERTIFICATE_DATA.PASS_DATA:
      case CERTIFICATE_DATA.FAIL_DATA:
        return this.generatePassOrFailCertificateData(testResult, type, flattenedDefects, isWelsh, testType);
      case CERTIFICATE_DATA.RWT_DATA:
        return this.generateRwtCertificateData(testResult, testType);
      case CERTIFICATE_DATA.ADR_DATA:
        return this.generateAdrCertificateData(testResult);
      case CERTIFICATE_DATA.IVA_DATA:
        return this.generateIvaCertificateData(testResult);
      case CERTIFICATE_DATA.MSVA_DATA:
        return this.generateMsvaCertificateData(testResult);
      default:
        throw Error(`Certificate data request not found (${type as string})`);
    }
  }

  /**
   * Method used to retrieve the Welsh translations for the certificates
   * @returns a list of defects
   */
  public async getDefectTranslations(): Promise<IDefectParent[]> {
    const config: IInvokeConfig = this.config.getInvokeConfig();
    const invokeParams: InvocationRequest = {
      FunctionName: config.functions.defects.name,
      InvocationType: 'RequestResponse',
      LogType: 'Tail',
      Payload: toUint8Array(JSON.stringify({
        httpMethod: 'GET',
        path: '/defects/',
      })),
    };
    let defects: IDefectParent[] = [];
    let retries = 0;
    while (retries < 3) {
      try {
        // eslint-disable-next-line
        const response: InvocationResponse = await this.lambdaClient.invoke(invokeParams);
        const payload: any = this.lambdaClient.validateInvocationResponse(response);
        const defectsParsed = JSON.parse(payload.body);

        if (!defectsParsed || defectsParsed.length === 0) {
          throw new HTTPError(400, `${ERRORS.LAMBDA_INVOCATION_BAD_DATA} ${JSON.stringify(payload)}.`);
        }
        defects = defectsParsed;
        return defects;
      } catch (error) {
        retries++;
        // eslint-disable-next-line
        console.error(`There was an error retrieving the welsh defect translations on attempt ${retries}: ${error}`);
      }
    }
    return defects;
  }

  /**
   * Returns a flattened array of every deficiency that only includes the key/value pairs required for certificate generation
   * @param defects - the array of defects from the api
   */
  public flattenDefectsFromApi(defects: IDefectParent[]): IFlatDefect[] {
    const flatDefects: IFlatDefect[] = [];
    try {
      // go through each defect in un-flattened array
      defects.forEach((defect: IDefectParent) => {
        const {
          imNumber, imDescription, imDescriptionWelsh, items,
        } = defect;
        if (defect.items !== undefined && defect.items.length !== 0) {
          // go through each item of defect
          items.forEach((item: IItem) => {
            const {
              itemNumber,
              itemDescription,
              itemDescriptionWelsh,
              deficiencies,
            } = item;
            if (
              item.deficiencies !== undefined
              && item.deficiencies.length !== 0
            ) {
              // go through each deficiency and push to flatDefects array
              deficiencies.forEach((deficiency: IDefectChild) => {
                const {
                  ref,
                  deficiencyText,
                  deficiencyTextWelsh,
                  forVehicleType,
                } = deficiency;
                const lowLevelDeficiency: IFlatDefect = {
                  imNumber,
                  imDescription,
                  imDescriptionWelsh,
                  itemNumber,
                  itemDescription,
                  itemDescriptionWelsh,
                  ref,
                  deficiencyText,
                  deficiencyTextWelsh,
                  forVehicleType,
                };
                flatDefects.push(lowLevelDeficiency);
              });
            }
          });
        }
      });
    } catch (e) {
      // eslint-disable-next-line
      console.error(`Error flattening defects: ${e}`);
    }
    return flatDefects;
  }

  private generateMsvaCertificateData(testResult: ITestResult) {
    const msvaFailDetailsForDocGen = {
      vin: testResult.vin,
      serialNumber: testResult.vrm,
      vehicleZNumber: testResult.vrm,
      make: testResult.make,
      model: testResult.model,
      type: testResult.vehicleType,
      testerName: testResult.testerName,
      date: moment(testResult.testTypes.testTypeStartTimestamp).format('DD/MM/YYYY'),
      retestDate: this.defectService.calculateVehicleApprovalRetestDate(testResult.testTypes.testTypeStartTimestamp),
      station: testResult.testStationName,
      additionalDefects: this.defectService.formatVehicleApprovalAdditionalDefects(testResult.testTypes.customDefects),
      requiredStandards: testResult.testTypes.requiredStandards,
    };
    return msvaFailDetailsForDocGen;
  }

  private generateIvaCertificateData(testResult: ITestResult) {
    const ivaFailDetailsForDocGen = {
      vin: testResult.vin,
      serialNumber: testResult.vehicleType === 'trl' ? testResult.trailerId : testResult.vrm,
      vehicleTrailerNrNo: testResult.vehicleType === 'trl' ? testResult.trailerId : testResult.vrm,
      testCategoryClass: testResult.euVehicleCategory,
      testCategoryBasicNormal: this.testService.isBasicIvaTest(testResult.testTypes.testTypeId) ? IVA_30.BASIC : IVA_30.NORMAL,
      make: testResult.make,
      model: testResult.model,
      bodyType: testResult.bodyType?.description,
      date: moment(testResult.testTypes.testTypeStartTimestamp).format('DD/MM/YYYY'),
      testerName: testResult.testerName,
      reapplicationDate: this.defectService.calculateVehicleApprovalRetestDate(testResult.testTypes.testTypeStartTimestamp),
      station: testResult.testStationName,
      additionalDefects: this.defectService.formatVehicleApprovalAdditionalDefects(testResult.testTypes.customDefects),
      requiredStandards: testResult.testTypes.requiredStandards,
    };
    return ivaFailDetailsForDocGen;
  }

  private async generateAdrCertificateData(testResult: ITestResult) {
    const adrDetails: TechRecordType<any> = await this.getAdrDetails(testResult);
    const docGenPayloadAdr = {
      ChasisNumber: testResult.vin,
      RegistrationNumber: testResult.vrm,
      ApplicantDetails: {
        name: adrDetails?.techRecord_applicantDetails_name,
        address1: adrDetails?.techRecord_applicantDetails_address1,
        address2: adrDetails?.techRecord_applicantDetails_address2,
        address3: adrDetails?.techRecord_applicantDetails_address1,
        postTown: adrDetails?.techRecord_applicantDetails_postTown,
        postCode: adrDetails?.techRecord_applicantDetails_postCode,
        telephoneNumber: adrDetails?.techRecord_applicantDetails_telephoneNumber,
        emailAddress: adrDetails?.techRecord_applicantDetails_emailAddress,
      },
      VehicleType: adrDetails?.techRecord_adrDetails_vehicleDetails_type,
      PermittedDangerousGoods: adrDetails?.techRecord_adrDetails_permittedDangerousGoods,
      BrakeEndurance: adrDetails?.techRecord_adrDetails_brakeEndurance,
      Weight: adrDetails?.techRecord_adrDetails_weight,
      TankManufacturer: adrDetails?.techRecord_adrDetails_tank_tankDetails_tankStatement_statement
        ? adrDetails.techRecord_adrDetails_tank_tankDetails_tankManufacturer
        : undefined,
      Tc2InitApprovalNo: adrDetails?.techRecord_adrDetails_tank_tankDetails_tc2Details_tc2IntermediateApprovalNo,
      TankManufactureSerialNo: adrDetails?.techRecord_adrDetails_tank_tankDetails_tankManufacturerSerialNo,
      YearOfManufacture: adrDetails?.techRecord_adrDetails_tank_tankDetails_yearOfManufacture,
      TankCode: adrDetails?.techRecord_adrDetails_tank_tankDetails_tankCode,
      SpecialProvisions: adrDetails?.techRecord_adrDetails_tank_tankDetails_specialProvisions,
      TankStatement: adrDetails?.techRecord_adrDetails_tank_tankDetails_tankStatement_statement,
      ExpiryDate: testResult.testTypes.testExpiryDate,
      AtfNameAtfPNumber: `${testResult.testStationName} ${testResult.testStationPNumber}`,
      Notes: testResult.testTypes.additionalNotesRecorded,
      TestTypeDate: testResult.testTypes.testTypeStartTimestamp,
    };
    console.log('CHECK HERE DOCGENPAYLOAD -> ', docGenPayloadAdr);
    return docGenPayloadAdr;
  }

  private async generateRwtCertificateData(testResult: ITestResult, testType: any) {
    const weightDetails = await this.getWeightDetails(testResult);
    let defectRWTList: any;
    if (testResult.testTypes.testResult as TEST_RESULTS === TEST_RESULTS.FAIL) {
      defectRWTList = [];
      testResult.testTypes.defects.forEach((defect: any) => {
        defectRWTList.push(this.formatDefect(defect));
      });
    } else {
      defectRWTList = undefined;
    }

    const resultPass: IRoadworthinessCertificateData = {
      Dgvw: weightDetails.dgvw,
      Weight2: weightDetails.weight2,
      VehicleNumber: testResult.vehicleType as VEHICLE_TYPES === VEHICLE_TYPES.TRL
        ? testResult.trailerId
        : testResult.vrm,
      Vin: testResult.vin,
      IssuersName: testResult.testerName,
      DateOfInspection: moment(testType.testTypeStartTimestamp).format(
        'DD.MM.YYYY',
      ),
      TestStationPNumber: testResult.testStationPNumber,
      DocumentNumber: testType.certificateNumber,
      Date: moment(testType.testTypeStartTimestamp).format('DD.MM.YYYY'),
      Defects: defectRWTList,
      IsTrailer: testResult.vehicleType as VEHICLE_TYPES === VEHICLE_TYPES.TRL,
    };
    return resultPass;
  }

  /**
   * Returns a formatted string containing data about a given defect
   * @param defect - defect for which to generate the formatted string
   */
  private formatDefect(defect: any) {
    const toUpperFirstLetter: any = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

    let defectString = `${defect.deficiencyRef} ${defect.itemDescription}`;

    if (defect.deficiencyText) {
      defectString += ` ${defect.deficiencyText}`;
    }

    if (defect.additionalInformation.location) {
      Object.keys(defect.additionalInformation.location).forEach(
        (location: string, index: number, array: string[]) => {
          if (defect.additionalInformation.location[location]) {
            switch (location) {
              case 'rowNumber':
                defectString += ` Rows: ${defect.additionalInformation.location.rowNumber}.`;
                break;
              case 'seatNumber':
                defectString += ` Seats: ${defect.additionalInformation.location.seatNumber}.`;
                break;
              case 'axleNumber':
                defectString += ` Axles: ${defect.additionalInformation.location.axleNumber}.`;
                break;
              default:
                defectString += ` ${toUpperFirstLetter(
                  defect.additionalInformation.location[location],
                )}`;
                break;
            }
          }

          if (index === array.length - 1) {
            defectString += '.';
          }
        },
      );
    }

    if (defect.additionalInformation.notes) {
      defectString += ` ${defect.additionalInformation.notes}`;
    }

    return defectString;
  }

  /**
   * Retrieves the vehicle weight details for Roadworthisness certificates
   * @param testResult
   */
  public async getWeightDetails(testResult: any) {
    const searchRes = await this.techRecordsRepository.callSearchTechRecords(testResult.systemNumber);
    const techRecord = await this.techRecordsService.processGetCurrentProvisionalRecords(searchRes) as TechRecordType<'hgv' | 'psv' | 'trl'>;
    if (techRecord) {
      const weightDetails: IWeightDetails = {
        dgvw: techRecord.techRecord_grossDesignWeight ?? 0,
        weight2: 0,
      };
      if (testResult.vehicleType as VEHICLE_TYPES === VEHICLE_TYPES.HGV) {
        weightDetails.weight2 = (techRecord as TechRecordType<'hgv'>).techRecord_trainDesignWeight ?? 0;
      } else if (
        (techRecord.techRecord_noOfAxles ?? -1) > 0
      ) {
        const initialValue: number = 0;
        weightDetails.weight2 = (techRecord.techRecord_axles as any).reduce(
          (
            accumulator: number,
            currentValue: { weights_designWeight: number },
          ) => accumulator + currentValue.weights_designWeight,
          initialValue,
        );
      } else {
        throw new HTTPError(
          500,
          'No axle weights for Roadworthiness test certificates!',
        );
      }
      return weightDetails;
    }
    console.log('No techRecord found for weight details');
    throw new HTTPError(
      500,
      'No vehicle found for Roadworthiness test certificate!',
    );
  }

  private async generatePassOrFailCertificateData(testResult: ITestResult, type: CERTIFICATE_DATA, flattenedDefects: IFlatDefect[], isWelsh: boolean, testType: any) {
    const defects: any = await this.generateDefects(testResult.testTypes, type, testResult.vehicleType, flattenedDefects, isWelsh);

    return {
      TestNumber: testType.testNumber,
      TestStationPNumber: testResult.testStationPNumber,
      TestStationName: testResult.testStationName,
      CurrentOdometer: {
        value: testResult.odometerReading,
        unit: testResult.odometerReadingUnits,
      },
      IssuersName: testResult.testerName,
      DateOfTheTest: moment(testResult.testEndTimestamp).format(
        'DD.MM.YYYY',
      ),
      CountryOfRegistrationCode: testResult.countryOfRegistration,
      VehicleEuClassification: testResult.euVehicleCategory.toUpperCase(),
      RawVIN: testResult.vin,
      RawVRM: testResult.vehicleType as VEHICLE_TYPES === VEHICLE_TYPES.TRL
        ? testResult.trailerId
        : testResult.vrm,
      ExpiryDate: testType.testExpiryDate
        ? moment(testType.testExpiryDate).format('DD.MM.YYYY')
        : undefined,
      EarliestDateOfTheNextTest: (testResult.vehicleType as VEHICLE_TYPES === VEHICLE_TYPES.HGV
        || testResult.vehicleType as VEHICLE_TYPES === VEHICLE_TYPES.TRL)
        && (testResult.testTypes.testResult as TEST_RESULTS === TEST_RESULTS.PASS
          || testResult.testTypes.testResult as TEST_RESULTS === TEST_RESULTS.PRS)
        ? moment(testType.testAnniversaryDate)
          .subtract(1, 'months')
          .startOf('month')
          .format('DD.MM.YYYY')
        : moment(testType.testAnniversaryDate).format('DD.MM.YYYY'),
      SeatBeltTested: testType.seatbeltInstallationCheckDate ? 'Yes' : 'No',
      SeatBeltPreviousCheckDate: testType.lastSeatbeltInstallationCheckDate
        ? moment(testType.lastSeatbeltInstallationCheckDate).format(
          'DD.MM.YYYY',
        )
        : '\u00A0',
      SeatBeltNumber: testType.numberOfSeatbeltsFitted,
      ...defects,
    };
  }

  /**
   * Generates an object containing defects for a given test type and certificate type
   * @param testTypes - the source test type for defect generation
   * @param type - the certificate type
   * @param vehicleType - the vehicle type from the test result
   * @param flattenedDefects - the list of flattened defects after being retrieved from the defect service
   * @param isWelsh - determines whether the atf in which the test result was conducted resides in Wales
   */
  private generateDefects(testTypes: any, type: string, vehicleType: string, flattenedDefects: IFlatDefect[], isWelsh: boolean = false) {
    const rawDefects: any = testTypes.defects;
    const defects: any = {
      DangerousDefects: [],
      MajorDefects: [],
      PRSDefects: [],
      MinorDefects: [],
      AdvisoryDefects: [],
      DangerousDefectsWelsh: [],
      MajorDefectsWelsh: [],
      PRSDefectsWelsh: [],
      MinorDefectsWelsh: [],
      AdvisoryDefectsWelsh: [],
    };

    rawDefects.forEach((defect: any) => {
      switch (defect.deficiencyCategory.toLowerCase()) {
        case 'dangerous':
          if (
            (testTypes.testResult === TEST_RESULTS.PRS || defect.prs)
            && type as CERTIFICATE_DATA === CERTIFICATE_DATA.FAIL_DATA
          ) {
            defects.PRSDefects.push(this.formatDefect(defect));
            if (this.isWelshCertificateAvailable(vehicleType, testTypes.testResult) && isWelsh) {
              defects.PRSDefectsWelsh.push(this.formatDefectWelsh(defect, vehicleType, flattenedDefects));
            }
          } else if (testTypes.testResult === 'fail') {
            defects.DangerousDefects.push(this.formatDefect(defect));
            // If the test was conducted in Wales and is valid vehicle type, format and add the welsh defects to the list
            if (this.isWelshCertificateAvailable(vehicleType, testTypes.testResult) && isWelsh) {
              defects.DangerousDefectsWelsh.push(
                this.formatDefectWelsh(defect, vehicleType, flattenedDefects),
              );
            }
          }
          break;
        case 'major':
          if (
            (testTypes.testResult === TEST_RESULTS.PRS || defect.prs)
            && type as CERTIFICATE_DATA === CERTIFICATE_DATA.FAIL_DATA
          ) {
            defects.PRSDefects.push(this.formatDefect(defect));
            if (this.isWelshCertificateAvailable(vehicleType, testTypes.testResult) && isWelsh) {
              defects.PRSDefectsWelsh.push(this.formatDefectWelsh(defect, vehicleType, flattenedDefects));
            }
          } else if (testTypes.testResult === 'fail') {
            defects.MajorDefects.push(this.formatDefect(defect));
            // If the test was conducted in Wales and is valid vehicle type, format and add the welsh defects to the list
            if (this.isWelshCertificateAvailable(vehicleType, testTypes.testResult) && isWelsh) {
              defects.MajorDefectsWelsh.push(
                this.formatDefectWelsh(defect, vehicleType, flattenedDefects),
              );
            }
          }
          break;
        case 'minor':
          defects.MinorDefects.push(this.formatDefect(defect));
          if (this.isWelshCertificateAvailable(vehicleType, testTypes.testResult) && isWelsh) {
            defects.MinorDefectsWelsh.push(
              this.formatDefectWelsh(defect, vehicleType, flattenedDefects),
            );
          }
          break;
        case 'advisory':
          defects.AdvisoryDefects.push(this.formatDefect(defect));
          if (this.isWelshCertificateAvailable(vehicleType, testTypes.testResult) && isWelsh) {
            defects.AdvisoryDefectsWelsh.push(this.formatDefect(defect));
          }
          break;
        default:
          break;
      }
    });

    Object.entries(defects).forEach(([k, v]: [string, any]) => {
      if (v.length === 0) {
        Object.assign(defects, { [k]: undefined });
      }
    });
    console.log(JSON.stringify(defects));
    return defects;
  }

  /**
   * Check that the test result and vehicle type are a valid combination and bilingual certificate is available
   * @param vehicleType - the vehicle type from the test result
   * @param testResult - the result of the test
   */
  public isWelshCertificateAvailable = (vehicleType: string, testResult: string): boolean => AVAILABLE_WELSH.CERTIFICATES.includes(`${vehicleType}_${testResult}`);

  /**
   * Returns a formatted welsh string containing data about a given defect
   * @param defect - the defect for which to generate the formatted welsh string
   * @param vehicleType - the vehicle type from the test result
   * @param flattenedDefects - the list of flattened defects
   */
  public formatDefectWelsh(
    defect: any,
    vehicleType: any,
    flattenedDefects: IFlatDefect[],
  ) {
    const toUpperFirstLetter: any = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

    const filteredFlatDefects: IFlatDefect[] = flattenedDefects.filter(
      (x: IFlatDefect) => defect.deficiencyRef === x.ref,
    );

    const filteredFlatDefect: IFlatDefect | null = this.filterFlatDefects(
      filteredFlatDefects,
      vehicleType,
    );

    if (filteredFlatDefect !== null) {
      let defectString = `${defect.deficiencyRef} ${filteredFlatDefect.itemDescriptionWelsh}`;

      if (defect.deficiencyText) {
        defectString += ` ${filteredFlatDefect.deficiencyTextWelsh}`;
      }

      if (defect.additionalInformation.location) {
        Object.keys(defect.additionalInformation.location).forEach(
          (location: string, index: number, array: string[]) => {
            if (defect.additionalInformation.location[location]) {
              const welshLocation = this.convertLocationWelsh(
                defect.additionalInformation.location[location],
              );

              switch (location) {
                case 'rowNumber':
                  defectString += ` ${LOCATION_WELSH.ROW_NUMBER}: ${defect.additionalInformation.location.rowNumber}.`;
                  break;
                case 'seatNumber':
                  defectString += ` ${LOCATION_WELSH.SEAT_NUMBER}: ${defect.additionalInformation.location.seatNumber}.`;
                  break;
                case 'axleNumber':
                  defectString += ` ${LOCATION_WELSH.AXLE_NUMBER}: ${defect.additionalInformation.location.axleNumber}.`;
                  break;
                default:
                  defectString += ` ${toUpperFirstLetter(welshLocation)}`;
                  break;
              }
            }

            if (index === array.length - 1) {
              defectString += '.';
            }
          },
        );
      }

      if (defect.additionalInformation.notes) {
        defectString += ` ${defect.additionalInformation.notes}`;
      }
      console.log(`Welsh Defect String Generated: ${defectString}`);
      return defectString;
    }
    console.log('ERROR: Unable to find a filtered defect');
    return null;
  }

  /**
   * Returns welsh version of location
   * @param locationToTranslate
   */
  public convertLocationWelsh(locationToTranslate: string) {
    switch (locationToTranslate as LOCATION_ENGLISH) {
      case LOCATION_ENGLISH.FRONT:
        return LOCATION_WELSH.FRONT;
      case LOCATION_ENGLISH.REAR:
        return LOCATION_WELSH.REAR;
      case LOCATION_ENGLISH.UPPER:
        return LOCATION_WELSH.UPPER;
      case LOCATION_ENGLISH.LOWER:
        return LOCATION_WELSH.LOWER;
      case LOCATION_ENGLISH.NEARSIDE:
        return LOCATION_WELSH.NEARSIDE;
      case LOCATION_ENGLISH.OFFSIDE:
        return LOCATION_WELSH.OFFSIDE;
      case LOCATION_ENGLISH.CENTRE:
        return LOCATION_WELSH.CENTRE;
      case LOCATION_ENGLISH.INNER:
        return LOCATION_WELSH.INNER;
      case LOCATION_ENGLISH.OUTER:
        return LOCATION_WELSH.OUTER;
      default:
        return locationToTranslate;
    }
  }

  /**
   * Returns filtered welsh defects
   * @param filteredFlatDefects - the array of flattened defects
   * @param vehicleType - the vehicle type from the test result
   */
  public filterFlatDefects(
    filteredFlatDefects: IFlatDefect[],
    vehicleType: string,
  ): IFlatDefect | null {
    if (filteredFlatDefects.length === 0) {
      return null;
    } if (filteredFlatDefects.length === 1) {
      return filteredFlatDefects[0];
    }
    const filteredWelshDefectsOnVehicleType = filteredFlatDefects.filter(
      (flatDefect: IFlatDefect) => flatDefect.forVehicleType!.includes(vehicleType),
    );
    return filteredWelshDefectsOnVehicleType[0];
  }

  /**
   * Retrieves the adrDetails from a techRecord searched by vin
   * @param testResult - testResult from which the VIN is used to search a tech-record
   */
  public getAdrDetails = async (testResult: any) => {
    const searchRes = await this.techRecordsRepository.callSearchTechRecords(testResult.systemNumber);
    return await this.techRecordsService.processGetCurrentProvisionalRecords(searchRes) as TechRecordType<'hgv' | 'trl'>;
  };
}