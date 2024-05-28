import { Service } from 'typedi';
import moment from 'moment';
import { ITestResult } from '../../models/ITestResult';
import { CERTIFICATE_DATA, TEST_RESULTS, VEHICLE_TYPES } from '../../models/Enums';
import { TestService } from '../../test-result/TestService';
import { DefectRepository } from '../../defect/DefectRepository';
import { ICertificatePayloadCommand } from '../ICertificatePayloadCommand';
import { ICertificatePayload } from '../../models/ICertificatePayload';
import { TestResultRepository } from '../../test-result/TestResultRepository';
import { TechRecordsService } from '../../tech-record/TechRecordsService';
import { TrailerRepository } from '../../trailer/TrailerRepository';

@Service()
export class PassOrFailPayloadCommand implements ICertificatePayloadCommand {
  protected type?: CERTIFICATE_DATA;

  constructor(private testResultRepository: TestResultRepository, private defectRepository: DefectRepository, private techRecordsService: TechRecordsService, private trailerRepository: TrailerRepository, private testService: TestService) {
  }

  private certificateIsAnPassOrFail = (): boolean => this.type === CERTIFICATE_DATA.PASS_DATA || this.type === CERTIFICATE_DATA.FAIL_DATA;

  public initialise(type: CERTIFICATE_DATA, isWelsh: boolean) {
    this.type = type;
  }

  public async generate(testResult: ITestResult): Promise<ICertificatePayload> {
    if (!this.certificateIsAnPassOrFail()) {
      return {} as ICertificatePayload;
    }

    const { testTypes, vehicleType, systemNumber } = testResult;

    const odometerHistory = vehicleType === VEHICLE_TYPES.TRL
      ? undefined
      : await this.testResultRepository.getOdometerHistory(systemNumber);

    const makeAndModel = await this.techRecordsService.getVehicleMakeAndModel(testResult);

    const trnRegistration = this.testService.isValidForTrn(vehicleType, makeAndModel as any)
      ? await this.trailerRepository.getTrailerRegistrationObject(testResult.vin, makeAndModel.Make as any)
      : undefined;

    const result = {} as ICertificatePayload;

    if (testTypes.testResult !== TEST_RESULTS.FAIL) {
      result.DATA = {
        ...(await this.getPayloadData(testResult, CERTIFICATE_DATA.PASS_DATA)),
        ...makeAndModel,
        ...odometerHistory,
        ...trnRegistration,
      };
    }

    if (testTypes.testResult !== TEST_RESULTS.PASS) {
      result.FAIL_DATA = {
        ...(await this.getPayloadData(testResult, CERTIFICATE_DATA.FAIL_DATA)),
        ...makeAndModel,
        ...odometerHistory,
        ...trnRegistration,
      };
    }

    return result;
  }

  private async getPayloadData(testResult: ITestResult, type: CERTIFICATE_DATA): Promise<any> {
    const testType = testResult.testTypes;

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
    };
  }
}
