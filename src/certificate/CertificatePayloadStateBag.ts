import { TestResultSchema } from '@dvsa/cvs-type-definitions/types/v1/test-result';
import { CERTIFICATE_DATA } from '../models/Enums';

export type CertificatePayloadStateBag = {
	type: CERTIFICATE_DATA;
	isWelsh: boolean;
	testResult: TestResultSchema;
};
