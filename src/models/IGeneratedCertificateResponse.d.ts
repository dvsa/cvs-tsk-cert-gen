import { ICertificateOrder } from './ICertificateOrder';

export interface IGeneratedCertificateResponse {
  fileName: string;
  vrm: string;
  testTypeName: string;
  testTypeResult: string;
  dateOfIssue: string;
  certificateType: string;
  fileFormat: string;
  fileSize: string;
  certificate: Buffer;
  certificateOrder: ICertificateOrder;
  email: string;
  shouldEmailCertificate: string;
}
