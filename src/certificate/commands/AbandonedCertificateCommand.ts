import moment from 'moment';
import { Service } from 'typedi';
import { ICertificatePayload, TestResultSchemaTestTypesAsObject } from '../../models';
import { CERTIFICATE_DATA, VEHICLE_TYPES } from '../../models/Enums';
import { BasePayloadCommand } from '../ICertificatePayloadCommand';

@Service()
export class AbandonedCertificateCommand extends BasePayloadCommand {
	private certificateIsAbandoned = (): boolean => this.state.type === CERTIFICATE_DATA.ABANDONED_DATA;

	public async generate(): Promise<ICertificatePayload> {
		const result = {} as ICertificatePayload;
		if (!this.certificateIsAbandoned()) {
			return {} as ICertificatePayload;
		}

		const { testResult } = this.state;

		const payload = this.getPayloadData(testResult);

		result.ABANDONED_DATA = {
			...payload,
		};

		return result as ICertificatePayload;
	}

	private getPayloadData(testResult: TestResultSchemaTestTypesAsObject): any {
		const testType = testResult.testTypes;
		//Defects part of the payload is handled in the DefectsCommand for abandoned certs
		return {
			RegistrationNumber: this.determineIdentifier(testResult),
			ReasonsForRefusal: this.formatReasonsForRefusal(testType.reasonForAbandoning),
			AdditionalComments: testType.additionalCommentsForAbandon,
			IssuersName: testResult.testerName,
			TestStationName: testResult.testStationName,
			TestStationPNumber: testResult.testStationPNumber,
			DateOfTheTest: moment(testResult.testEndTimestamp).format('DD.MM.YYYY'),
		};
	}

	/**
	 * Determines the identifier to populate the RegistrationNumber field on the certificate
	 * @param testResult
	 * @private
	 */
	private determineIdentifier(testResult: TestResultSchemaTestTypesAsObject): string {
		if (testResult.vehicleType === VEHICLE_TYPES.TRL) {
			return testResult.trailerId ? testResult.trailerId : testResult.vin;
		} else {
			return testResult.vrm ? testResult.vrm : testResult.vin;
		}
	}

	/**
	 * Formats the reasons for refusal to an array of strings
	 * @param reasonsForAbandoning
	 * @private
	 */
	private formatReasonsForRefusal(reasonsForAbandoning: string | null): string[] {
		return reasonsForAbandoning!.split(/\. (?<!\..\. )/);
	}
}
