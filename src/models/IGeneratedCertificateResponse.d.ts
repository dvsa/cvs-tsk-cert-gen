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
  certificateOrder: { current: number; total: number; };
  email: string;
  shouldEmailCertificate: string;
}
