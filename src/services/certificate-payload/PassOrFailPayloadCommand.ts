import { Service } from 'typedi';
import moment from 'moment';
import { ITestResult } from '../../models/ITestResult';
import { CERTIFICATE_DATA, TEST_RESULTS, VEHICLE_TYPES } from '../../models/Enums';
import { DefectService } from '../../defect/DefectService';
import { TestService } from '../TestService';
import { DefectRepository } from '../../defect/DefectRepository';
import { IDefectParent } from '../../models/IDefectParent';
import { IFlatDefect } from '../../models/IFlatDefect';
import { ICertificatePayloadCommand } from '../ICertificatePayloadCommand';
import { ICertificatePayload } from '../../models/ICertificatePayload';
import { TestResultRepository } from '../../repositories/TestResultRepository';
import { TechRecordsService } from '../TechRecordsService';
import { TrailerRepository } from '../../repositories/TrailerRepository';

@Service()
export class PassOrFailPayloadCommand implements ICertificatePayloadCommand {
  protected type?: CERTIFICATE_DATA;

  protected isWelsh: boolean = false;

  constructor(private defectService: DefectService, private testResultRepository: TestResultRepository, private defectRepository: DefectRepository, private techRecordsService: TechRecordsService, private trailerRepository: TrailerRepository, private testService: TestService) {
  }

  private certificateIsAnPassOrFail = (): boolean => this.type === CERTIFICATE_DATA.PASS_DATA || this.type === CERTIFICATE_DATA.FAIL_DATA;

  public initialise(type: CERTIFICATE_DATA, isWelsh: boolean) {
    this.type = type;
    this.isWelsh = isWelsh;
  }

  public async generate(testResult: ITestResult): Promise<ICertificatePayload> {
    if (!this.certificateIsAnPassOrFail()) {
      return {} as ICertificatePayload;
    }

    let defectListFromApi: IDefectParent[] = [];
    let flattenedDefects: IFlatDefect[] = [];

    if (this.isWelsh) {
      defectListFromApi = await this.defectRepository.getDefectTranslations();
      flattenedDefects = this.defectService.flattenDefectsFromApi(defectListFromApi);
    }

    const { testTypes, vehicleType, systemNumber } = testResult as any;

    const odometerHistory = vehicleType === VEHICLE_TYPES.TRL
      ? undefined
      : await this.testResultRepository.getOdometerHistory(systemNumber);

    const makeAndModel = await this.techRecordsService.getVehicleMakeAndModel(testResult);

    const TrnObj = this.testService.isValidForTrn(vehicleType, makeAndModel as any)
      ? await this.trailerRepository.getTrailerRegistrationObject(testResult.vin, makeAndModel.Make as any)
      : undefined;

    const result = {} as ICertificatePayload;

    if (testTypes.testResult !== TEST_RESULTS.FAIL) {
      result.DATA = {
        ...(await this.getPayloadData(testResult, CERTIFICATE_DATA.PASS_DATA)),
        ...makeAndModel,
        ...odometerHistory,
        ...TrnObj,
      };
    }

    if (testTypes.testResult !== TEST_RESULTS.PASS) {
      result.FAIL_DATA = {
        ...(await this.getPayloadData(testResult, CERTIFICATE_DATA.FAIL_DATA)),
        ...makeAndModel,
        ...odometerHistory,
        ...TrnObj,
      };
    }

    return result;
  }

  private async getPayloadData(testResult: ITestResult, type: CERTIFICATE_DATA): Promise<any> {
    const testType: any = testResult.testTypes;

    let defectListFromApi: IDefectParent[] = [];
    let flattenedDefects: IFlatDefect[] = [];
    if (this.isWelsh) {
      defectListFromApi = await this.defectRepository.getDefectTranslations();
      flattenedDefects = this.defectService.flattenDefectsFromApi(defectListFromApi);
    }

    const defects: any = await this.generateDefects(testResult.testTypes, type, testResult.vehicleType, flattenedDefects, this.isWelsh);

    return {
      TestNumber: testType.testNumber,
      TestStationPNumber: testResult.testStationPNumber,
      TestStationName: testResult.testStationName,
      CurrentOdometer: {
        value: testResult.odometerReading,
        unit: testResult.odometerReadingUnits,
      },
      IssuersName: testResult.testerName,
      DateOfTheTest: moment(testResult.testEndTimestamp).format('DD.MM.YYYY'),
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
        ? moment(testType.lastSeatbeltInstallationCheckDate).format('DD.MM.YYYY')
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
  private generateDefects(testTypes: any, type: CERTIFICATE_DATA, vehicleType: string, flattenedDefects: IFlatDefect[], isWelsh: boolean = false) {
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
          this.generateDangerousDefects(testTypes, defect, type, defects, vehicleType, isWelsh, flattenedDefects);
          break;
        case 'major':
          this.generateMajorDefects(testTypes, defect, type, defects, vehicleType, isWelsh, flattenedDefects);
          break;
        case 'minor':
          this.generateMinorDefects(defects, defect, vehicleType, testTypes, isWelsh, flattenedDefects);
          break;
        case 'advisory':
          this.generateAdvisoryDefects(defects, defect, vehicleType, testTypes, isWelsh);
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

    return defects;
  }

  private generateDangerousDefects(testTypes: any, defect: any, type: CERTIFICATE_DATA, defects: any, vehicleType: string, isWelsh: boolean, flattenedDefects: IFlatDefect[]) {
    if ((testTypes.testResult === TEST_RESULTS.PRS || defect.prs) && type === CERTIFICATE_DATA.FAIL_DATA) {
      defects.PRSDefects.push(this.defectService.formatDefect(defect));

      if (this.testService.isWelshCertificateAvailable(vehicleType, testTypes.testResult) && isWelsh) {
        defects.PRSDefectsWelsh.push(this.defectService.formatDefectWelsh(defect, vehicleType, flattenedDefects));
      }
    } else if (testTypes.testResult === TEST_RESULTS.FAIL) {
      defects.DangerousDefects.push(this.defectService.formatDefect(defect));

      // If the test was conducted in Wales and is valid vehicle type, format and add the welsh defects to the list
      if (this.testService.isWelshCertificateAvailable(vehicleType, testTypes.testResult) && isWelsh) {
        defects.DangerousDefectsWelsh.push(this.defectService.formatDefectWelsh(defect, vehicleType, flattenedDefects));
      }
    }
  }

  private generateMajorDefects(testTypes: any, defect: any, type: CERTIFICATE_DATA, defects: any, vehicleType: string, isWelsh: boolean, flattenedDefects: IFlatDefect[]) {
    if ((testTypes.testResult === TEST_RESULTS.PRS || defect.prs) && type === CERTIFICATE_DATA.FAIL_DATA) {
      defects.PRSDefects.push(this.defectService.formatDefect(defect));

      if (this.testService.isWelshCertificateAvailable(vehicleType, testTypes.testResult) && isWelsh) {
        defects.PRSDefectsWelsh.push(this.defectService.formatDefectWelsh(defect, vehicleType, flattenedDefects));
      }
    } else if (testTypes.testResult === TEST_RESULTS.FAIL) {
      defects.MajorDefects.push(this.defectService.formatDefect(defect));

      // If the test was conducted in Wales and is valid vehicle type, format and add the welsh defects to the list
      if (this.testService.isWelshCertificateAvailable(vehicleType, testTypes.testResult) && isWelsh) {
        defects.MajorDefectsWelsh.push(this.defectService.formatDefectWelsh(defect, vehicleType, flattenedDefects));
      }
    }
  }

  private generateMinorDefects(defects: any, defect: any, vehicleType: string, testTypes: any, isWelsh: boolean, flattenedDefects: IFlatDefect[]) {
    defects.MinorDefects.push(this.defectService.formatDefect(defect));

    if (this.testService.isWelshCertificateAvailable(vehicleType, testTypes.testResult) && isWelsh) {
      defects.MinorDefectsWelsh.push(this.defectService.formatDefectWelsh(defect, vehicleType, flattenedDefects));
    }
  }

  private generateAdvisoryDefects(defects: any, defect: any, vehicleType: string, testTypes: any, isWelsh: boolean) {
    defects.AdvisoryDefects.push(this.defectService.formatDefect(defect));

    if (this.testService.isWelshCertificateAvailable(vehicleType, testTypes.testResult) && isWelsh) {
      defects.AdvisoryDefectsWelsh.push(this.defectService.formatDefect(defect));
    }
  }
}
