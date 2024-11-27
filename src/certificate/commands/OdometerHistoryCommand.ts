import { TestResults } from '@dvsa/cvs-type-definitions/types/v1/enums/testResult.enum.js';
import { TestResultSchema, TestTypeSchema } from '@dvsa/cvs-type-definitions/types/v1/test-result';
import { Service } from 'typedi';
import { ICertificatePayload } from '../../models';
import { CERTIFICATE_DATA, VEHICLE_TYPES } from '../../models/Enums';
import { TestResultRepository } from '../../test-result/TestResultRepository';
import { BasePayloadCommand } from '../ICertificatePayloadCommand';

@Service()
export class OdometerHistoryCommand extends BasePayloadCommand {
	constructor(private testResultRepository: TestResultRepository) {
		super();
	}

	private certificateIsAnPassOrFail = (): boolean =>
		this.state.type === CERTIFICATE_DATA.PASS_DATA || this.state.type === CERTIFICATE_DATA.FAIL_DATA;

	private vehicleIsTrailer = (testResult: TestResultSchema): boolean => testResult.vehicleType === VEHICLE_TYPES.TRL;

	public async generate(): Promise<ICertificatePayload> {
		const result = {} as ICertificatePayload;

		if (!this.certificateIsAnPassOrFail()) {
			return result;
		}

		const { testResult } = this.state;
		const testTypes = testResult.testTypes as unknown as TestTypeSchema;

		if (this.vehicleIsTrailer(testResult)) {
			return result;
		}

		const odometerHistory = await this.testResultRepository.getOdometerHistory(testResult.systemNumber);

		if (testTypes.testResult !== TestResults.FAIL) {
			result.DATA = {
				...odometerHistory,
			};
		}

		if (testTypes.testResult !== TestResults.PASS) {
			result.FAIL_DATA = {
				...odometerHistory,
			};
		}

		return result;
	}
}
