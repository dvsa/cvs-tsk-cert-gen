import { ICertificatePayload } from '../models';
import { CertificatePayloadStateBag } from './CertificatePayloadStateBag';

export interface ICertificatePayloadCommand {
	initialise(state: CertificatePayloadStateBag): void;
	generate(): Promise<ICertificatePayload>;
}

export abstract class BasePayloadCommand implements ICertificatePayloadCommand {
	protected state: CertificatePayloadStateBag = {} as CertificatePayloadStateBag;

	initialise(state: CertificatePayloadStateBag) {
		this.state = state;
	}

	abstract generate(): Promise<ICertificatePayload>;
}
