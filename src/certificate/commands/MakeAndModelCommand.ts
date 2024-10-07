import { Service } from 'typedi';
import { ICertificatePayload } from '../../models';
import { ITestResult } from '../../models';
import { CERTIFICATE_DATA, TEST_RESULTS } from '../../models/Enums';
import { TechRecordService } from '../../tech-record/TechRecordService';
import { TestResultService } from '../../test-result/TestResultService';
import { TrailerRepository } from '../../trailer/TrailerRepository';
import { ICertificatePayloadCommand } from '../ICertificatePayloadCommand';

@Service()
export class MakeAndModelCommand implements ICertificatePayloadCommand {
	protected type?: CERTIFICATE_DATA;

	constructor(
		private techRecordService: TechRecordService,
		private trailerRepository: TrailerRepository,
		private testResultService: TestResultService
	) {}

	private certificateIsAnPassOrFail = (): boolean =>
		this.type === CERTIFICATE_DATA.PASS_DATA || this.type === CERTIFICATE_DATA.FAIL_DATA;

	initialise(type: CERTIFICATE_DATA, isWelsh = false) {
		this.type = type;
	}

	public async generate(testResult: ITestResult): Promise<ICertificatePayload> {
		const result = {} as ICertificatePayload;

		if (!this.certificateIsAnPassOrFail()) {
			return result;
		}

		const { testTypes, vehicleType } = testResult;

		const makeAndModel = await this.techRecordService.getVehicleMakeAndModel(testResult);

		const trnRegistration = this.testResultService.isValidForTrn(vehicleType, makeAndModel as any)
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
