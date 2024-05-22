import { ISignature } from './ISignature';
import { IReissue } from './IReissue';

export interface ICertificatePayload {
  Watermark: string;
  DATA?: any;
  FAIL_DATA?: any;
  RWT_DATA?: any;
  ADR_DATA?: any;
  IVA_DATA?: any;
  MSVA_DATA?: any;
  Signature: ISignature;
  Reissue?: IReissue;
}
