import { Service } from 'typedi';
import { ICertificatePayload } from '../../models';
import { ITestResult } from '../../models';
import { CERTIFICATE_DATA } from '../../models/Enums';
import { ICertificatePayloadCommand } from '../ICertificatePayloadCommand';

@Service()
export class WatermarkCommand implements ICertificatePayloadCommand {
	initialise(type: CERTIFICATE_DATA, isWelsh = false) {}

	public async generate(testResult: ITestResult): Promise<ICertificatePayload> {
		return {
			Watermark: process.env.BRANCH === 'prod' ? '' : 'NOT VALID',
		} as ICertificatePayload;
	}
}
