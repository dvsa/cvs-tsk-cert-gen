import { Service } from 'typedi';
import { ICertificatePayload } from '../../models/ICertificatePayload';
import { ITestResult } from '../../models/ITestResult';
import { ICertificatePayloadCommand } from '../ICertificatePayloadCommand';
import { CERTIFICATE_DATA, TEST_RESULTS } from '../../models/Enums';
import { TechRecordsService } from '../../tech-record/TechRecordsService';
import { TrailerRepository } from '../../trailer/TrailerRepository';
import { TestService } from '../../test-result/TestService';

@Service()
export class MakeAndModelCommand implements ICertificatePayloadCommand {
  protected type?: CERTIFICATE_DATA;

  constructor(private techRecordsService: TechRecordsService, private trailerRepository: TrailerRepository, private testService: TestService) {
  }

  private certificateIsAnPassOrFail = (): boolean => this.type === CERTIFICATE_DATA.PASS_DATA || this.type === CERTIFICATE_DATA.FAIL_DATA;

  initialise(type: CERTIFICATE_DATA, isWelsh: boolean = false) {
    this.type = type;
  }

  public async generate(testResult: ITestResult): Promise<ICertificatePayload> {
    const result = {} as ICertificatePayload;

    if (!this.certificateIsAnPassOrFail()) {
      return result;
    }

    const { testTypes, vehicleType } = testResult;

    const makeAndModel = await this.techRecordsService.getVehicleMakeAndModel(testResult);

    const trnRegistration = this.testService.isValidForTrn(vehicleType, makeAndModel as any)
      ? await this.trailerRepository.getTrailerRegistrationObject(testResult.vin, makeAndModel.Make as any)
      : undefined;

    if (testTypes.testResult !== TEST_RESULTS.FAIL) {
      result.DATA = {
        ...makeAndModel,
        ...trnRegistration,
      };
    }

    if (testTypes.testResult !== TEST_RESULTS.PASS) {
      result.FAIL_DATA = {
        ...makeAndModel,
        ...trnRegistration,
      };
    }

    return result;
  }
}
