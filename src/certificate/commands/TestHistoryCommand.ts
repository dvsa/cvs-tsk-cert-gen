import moment from 'moment';
import { Service } from 'typedi';
import { ICertificatePayload } from '../../models';
import { BasePayloadCommand } from '../ICertificatePayloadCommand';

@Service()
export class TestHistoryCommand extends BasePayloadCommand {
	public async generate(): Promise<ICertificatePayload> {
		const result = {} as ICertificatePayload;

		const {
			testResult: { testTypes, testHistory, createdByName, createdAt },
		} = this.state as any;

		if (testHistory) {
			// eslint-disable-next-line
			for (const history of testHistory) {
				// eslint-disable-next-line
				for (const testType of history.testTypes) {
					if (testType.testCode === testTypes.testCode) {
						result.Reissue = {
							Reason: 'Replacement',
							Issuer: createdByName,
							Date: moment(createdAt).format('DD.MM.YYYY'),
						};
						break;
					}
				}
			}
		}

		return result;
	}
}
