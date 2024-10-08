import { Service } from 'typedi';
import { ICertificatePayload } from '../../models';
import { BasePayloadCommand } from '../ICertificatePayloadCommand';

@Service()
export class WatermarkCommand extends BasePayloadCommand {
	public async generate(): Promise<ICertificatePayload> {
		return {
			Watermark: process.env.BRANCH === 'prod' ? '' : 'NOT VALID',
		} as ICertificatePayload;
	}
}
