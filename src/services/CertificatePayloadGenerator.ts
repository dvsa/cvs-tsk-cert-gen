import { Service } from 'typedi';
import { CERTIFICATE_DATA } from '../models/Enums';
import { ITestResult } from '../models/ITestResult';
import { CertificatePayloadGeneratorIva } from './certificate-payload/CertificatePayloadGeneratorIva';
import { CertificatePayloadGeneratorAdr } from './certificate-payload/CertificatePayloadGeneratorAdr';
import { CertificatePayloadGeneratorRwt } from './certificate-payload/CertificatePayloadGeneratorRwt';
import { CertificatePayloadGeneratorPassOrFail } from './certificate-payload/CertificatePayloadGeneratorPassOrFail';
import { CertificatePayloadGeneratorMsva } from './certificate-payload/CertificatePayloadGeneratorMsva';
import { ICertificatePayload } from '../models/ICertificatePayload';

// This is a facade
@Service()
export class CertificatePayloadGenerator {
  constructor(private passOrFailGenerator: CertificatePayloadGeneratorPassOrFail, private rwtGenerator: CertificatePayloadGeneratorRwt, private adrGenerator: CertificatePayloadGeneratorAdr, private ivaGenerator: CertificatePayloadGeneratorIva, private msvaGenerator: CertificatePayloadGeneratorMsva) {
  }

  /**
   * Generates certificate data for a given test result and certificate type
   * @param testResult - the source test result for certificate generation
   * @param type - the certificate type
   * @param isWelsh - the boolean value whether the atf where test was conducted resides in Wales
   */
  public async generateCertificateData(testResult: ITestResult, type: CERTIFICATE_DATA, isWelsh: boolean = false): Promise<ICertificatePayload> {
    switch (type) {
      case CERTIFICATE_DATA.PASS_DATA:
      case CERTIFICATE_DATA.FAIL_DATA:
        this.passOrFailGenerator.initialise(type, isWelsh);
        return this.passOrFailGenerator.generate(testResult);
      case CERTIFICATE_DATA.RWT_DATA:
        return this.rwtGenerator.generate(testResult);
      case CERTIFICATE_DATA.ADR_DATA:
        return this.adrGenerator.generate(testResult);
      case CERTIFICATE_DATA.IVA_DATA:
        return this.ivaGenerator.generate(testResult);
      case CERTIFICATE_DATA.MSVA_DATA:
        return this.msvaGenerator.generate(testResult);
      default:
        throw Error(`Certificate data request not found (${type as string})`);
    }
  }
}
