import { Service } from 'typedi';
import { ICertificatePayload } from '../../models';
import { CERTIFICATE_DATA, TEST_RESULTS } from '../../models/Enums';
import { TechRecordService } from '../../tech-record/TechRecordService';
import { TestResultService } from '../../test-result/TestResultService';
import { TrailerRepository } from '../../trailer/TrailerRepository';
import { BasePayloadCommand } from '../ICertificatePayloadCommand';

@Service()
export class MakeAndModelCommand extends BasePayloadCommand {
	constructor(
		private techRecordService: TechRecordService,
		private trailerRepository: TrailerRepository,
		private testResultService: TestResultService
	) {
		super();
	}

	private certificateIsAnPassOrFail = (): boolean =>
		this.state.type === CERTIFICATE_DATA.PASS_DATA || this.state.type === CERTIFICATE_DATA.FAIL_DATA;

	public async generate(): Promise<ICertificatePayload> {
		const result = {} as ICertificatePayload;

		if (!this.certificateIsAnPassOrFail()) {
			return result;
		}

		const {
			testResult,
			testResult: { testTypes, vehicleType },
		} = this.state;

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
