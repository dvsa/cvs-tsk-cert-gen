import { Inject, Service } from 'typedi';
import { ICertificatePayload } from '../../models';
import { ITestResult } from '../../models';
import { CERTIFICATE_DATA, TEST_RESULTS, VEHICLE_TYPES } from '../../models/Enums';
import { TestResultRepository } from '../../test-result/TestResultRepository';
import { BasePayloadCommand } from '../ICertificatePayloadCommand';

@Service()
export class OdometerHistoryCommand extends BasePayloadCommand {
	constructor(@Inject() private testResultRepository: TestResultRepository) {
		super();
	}

	private certificateIsAnPassOrFail = (): boolean =>
		this.state.type === CERTIFICATE_DATA.PASS_DATA || this.state.type === CERTIFICATE_DATA.FAIL_DATA;

	private vehicleIsTrailer = (testResult: ITestResult): boolean => testResult.vehicleType === VEHICLE_TYPES.TRL;

	public async generate(): Promise<ICertificatePayload> {
		const result = {} as ICertificatePayload;

		if (!this.certificateIsAnPassOrFail()) {
			return result;
		}

		const {
			testResult,
			testResult: { testTypes, systemNumber },
		} = this.state;

		if (this.vehicleIsTrailer(testResult)) {
			return result;
		}

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
