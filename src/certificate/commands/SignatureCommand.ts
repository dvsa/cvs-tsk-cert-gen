import { Readable } from 'stream';
import { GetObjectOutput } from '@aws-sdk/client-s3';
import { Inject, Service } from 'typedi';
import { ICertificatePayload } from '../../models';
import { S3BucketService } from '../../services/S3BucketService';
import { BasePayloadCommand } from '../ICertificatePayloadCommand';

@Service()
export class SignatureCommand extends BasePayloadCommand {
	constructor(@Inject() private s3Client: S3BucketService) {
		super();
	}

	public async generate(): Promise<ICertificatePayload> {
		const { testResult } = this.state;

		const signature = await this.getSignature(testResult.createdById ?? testResult.testerStaffId);

		return {
			Signature: {
				ImageType: 'png',
				ImageData: signature,
			},
		} as ICertificatePayload;
	}

	/**
	 * Retrieves a signature from the cvs-signature S3 bucket
	 * @param staffId - staff ID of the signature you want to retrieve
	 * @returns the signature as a base64 encoded string
	 */
	private async getSignature(staffId: string): Promise<string | null> {
		try {
			const result: GetObjectOutput = await this.s3Client.download(
				`cvs-signature-${process.env.BUCKET}`,
				`${staffId}.base64`
			);

			if (result.Body instanceof Readable) {
				const chunks: Uint8Array[] = [];
				for await (const chunk of result.Body) {
					chunks.push(chunk);
				}
				const buffer = Buffer.concat(chunks);
				return buffer.toString('utf-8');
			} else {
				throw new Error(`Unexpected body type: ${typeof result.Body}`);
			}
		} catch (error) {
			console.error(`Unable to fetch signature for staff id ${staffId}. ${(error as Error).message}`);
		}
		return null;
	}
}
