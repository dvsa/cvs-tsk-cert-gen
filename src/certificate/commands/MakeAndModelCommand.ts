import { Inject, Service } from 'typedi';
import { ICertificatePayload, IMakeAndModel } from '../../models';
import { CERTIFICATE_DATA, TEST_RESULTS } from '../../models/Enums';
import { TechRecordService } from '../../tech-record/TechRecordService';
import { TestResultService } from '../../test-result/TestResultService';
import { IGetTrailerRegistrationResult } from '../../trailer/IGetTrailerRegistrationResult';
import { TrailerRepository } from '../../trailer/TrailerRepository';
import { BasePayloadCommand } from '../ICertificatePayloadCommand';

@Service()
export class MakeAndModelCommand extends BasePayloadCommand {
	constructor(
		@Inject() private techRecordService: TechRecordService,
		@Inject() private trailerRepository: TrailerRepository,
		@Inject() private testResultService: TestResultService
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
			testResult: { testTypes },
		} = this.state;

		const makeAndModel = (await this.techRecordService.getVehicleMakeAndModel(testResult)) as Required<IMakeAndModel>;
		const trnRegistration = await this.trailerRegistration(makeAndModel);

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

	private async trailerRegistration(makeAndModel: IMakeAndModel): Promise<IGetTrailerRegistrationResult | undefined> {
		const {
			testResult,
			testResult: { vehicleType },
		} = this.state;

		const isValidForTrn = this.testResultService.isValidForTrn(vehicleType, makeAndModel);
		if (isValidForTrn) {
			return await this.trailerRepository.getTrailerRegistrationObject(testResult.vin, makeAndModel.Make);
		} else {
			console.error('Vehicle is not valid for TRN.');
		}

		return undefined;
	}
}
