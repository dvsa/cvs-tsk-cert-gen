import { Inject, Service } from 'typedi';
import moment from 'moment';
import { ITestResult } from '../models/ITestResult';
import {
  CERTIFICATE_DATA,
  LOCATION_WELSH,
  TEST_RESULTS,
  VEHICLE_TYPES,
} from '../models/Enums';
import { DefectService } from './DefectService';
import { TestService } from './TestService';
import { DefectRepository } from './DefectRepository';
import { IDefectParent } from '../models/IDefectParent';
import { IFlatDefect } from '../models/IFlatDefect';
import { TranslationService } from './TranslationService';
import { ICertificatePayloadGenerator } from './ICertificatePayloadGenerator';

@Service()
export class CertificatePayloadGeneratorPassOrFail implements ICertificatePayloadGenerator {
  private readonly defectService: DefectService;

  private readonly defectRepository: DefectRepository;

  private readonly testService: TestService;

  private readonly translationService: TranslationService;

  protected type: CERTIFICATE_DATA = undefined as unknown as CERTIFICATE_DATA;

  protected isWelsh: boolean = false;

  constructor(@Inject() defectService: DefectService, @Inject() defectRepository: DefectRepository, @Inject() testService: TestService, @Inject() translationService: TranslationService) {
    this.defectService = defectService;
    this.defectRepository = defectRepository;
    this.testService = testService;
    this.translationService = translationService;
  }

  public initialise(type: CERTIFICATE_DATA, isWelsh: boolean) {
    this.type = type;
    this.isWelsh = isWelsh;
  }

  public async generate(testResult: ITestResult): Promise<any> {
    const testType: any = testResult.testTypes;

    let defectListFromApi: IDefectParent[] = [];
    let flattenedDefects: IFlatDefect[] = [];
    if (this.isWelsh) {
      defectListFromApi = await this.defectRepository.getDefectTranslations();
      flattenedDefects = this.defectService.flattenDefectsFromApi(defectListFromApi);
    }

    const defects: any = await this.generateDefects(testResult.testTypes, this.type, testResult.vehicleType, flattenedDefects, this.isWelsh);

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
          if ((testTypes.testResult === TEST_RESULTS.PRS || defect.prs)
            && type as CERTIFICATE_DATA === CERTIFICATE_DATA.FAIL_DATA) {
            defects.PRSDefects.push(this.defectService.formatDefect(defect));
            if (this.testService.isWelshCertificateAvailable(vehicleType, testTypes.testResult) && isWelsh) {
              defects.PRSDefectsWelsh.push(this.formatDefectWelsh(defect, vehicleType, flattenedDefects));
            }
          } else if (testTypes.testResult === 'fail') {
            defects.DangerousDefects.push(this.defectService.formatDefect(defect));
            // If the test was conducted in Wales and is valid vehicle type, format and add the welsh defects to the list
            if (this.testService.isWelshCertificateAvailable(vehicleType, testTypes.testResult) && isWelsh) {
              defects.DangerousDefectsWelsh.push(
                this.formatDefectWelsh(defect, vehicleType, flattenedDefects),
              );
            }
          }
          break;
        case 'major':
          if ((testTypes.testResult === TEST_RESULTS.PRS || defect.prs)
            && type as CERTIFICATE_DATA === CERTIFICATE_DATA.FAIL_DATA) {
            defects.PRSDefects.push(this.defectService.formatDefect(defect));
            if (this.testService.isWelshCertificateAvailable(vehicleType, testTypes.testResult) && isWelsh) {
              defects.PRSDefectsWelsh.push(this.formatDefectWelsh(defect, vehicleType, flattenedDefects));
            }
          } else if (testTypes.testResult === 'fail') {
            defects.MajorDefects.push(this.defectService.formatDefect(defect));
            // If the test was conducted in Wales and is valid vehicle type, format and add the welsh defects to the list
            if (this.testService.isWelshCertificateAvailable(vehicleType, testTypes.testResult) && isWelsh) {
              defects.MajorDefectsWelsh.push(
                this.formatDefectWelsh(defect, vehicleType, flattenedDefects),
              );
            }
          }
          break;
        case 'minor':
          defects.MinorDefects.push(this.defectService.formatDefect(defect));
          if (this.testService.isWelshCertificateAvailable(vehicleType, testTypes.testResult) && isWelsh) {
            defects.MinorDefectsWelsh.push(
              this.formatDefectWelsh(defect, vehicleType, flattenedDefects),
            );
          }
          break;
        case 'advisory':
          defects.AdvisoryDefects.push(this.defectService.formatDefect(defect));
          if (this.testService.isWelshCertificateAvailable(vehicleType, testTypes.testResult) && isWelsh) {
            defects.AdvisoryDefectsWelsh.push(this.defectService.formatDefect(defect));
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

    const filteredFlatDefect: IFlatDefect | null = this.defectService.filterFlatDefects(
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
              const welshLocation = this.translationService.convertLocationWelsh(
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
}
