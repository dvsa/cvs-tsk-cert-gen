import { Service } from 'typedi';
import { ICertificatePayload } from '../../models/ICertificatePayload';
import { ITestResult } from '../../models/ITestResult';
import { ICertificatePayloadCommand } from '../ICertificatePayloadCommand';
import { CERTIFICATE_DATA, TEST_RESULTS, VEHICLE_TYPES } from '../../models/Enums';
import { TestResultRepository } from '../../test-result/TestResultRepository';

@Service()
export class OdometerHistoryCommand implements ICertificatePayloadCommand {
  protected type?: CERTIFICATE_DATA;

  constructor(private testResultRepository: TestResultRepository) {
  }

  private certificateIsAnPassOrFail = (): boolean => this.type === CERTIFICATE_DATA.PASS_DATA || this.type === CERTIFICATE_DATA.FAIL_DATA;

  private vehicleIsTrailer = (testResult: ITestResult): boolean => testResult.vehicleType === VEHICLE_TYPES.TRL;

  initialise(type: CERTIFICATE_DATA, isWelsh: boolean = false) {
    this.type = type;
  }

  public async generate(testResult: ITestResult): Promise<ICertificatePayload> {
    const result = {} as ICertificatePayload;

    if (!this.certificateIsAnPassOrFail()) {
      return result;
    }

    if (this.vehicleIsTrailer(testResult)) {
      return result;
    }

    const { testTypes, systemNumber } = testResult;

    const odometerHistory = await this.testResultRepository.getOdometerHistory(systemNumber);

    if (testTypes.testResult !== TEST_RESULTS.FAIL) {
      result.DATA = {
        ...odometerHistory,
      };
    }

    if (testTypes.testResult !== TEST_RESULTS.PASS) {
      result.FAIL_DATA = {
        ...odometerHistory,
      };
    }

    return result;
  }
}
