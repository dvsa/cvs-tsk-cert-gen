import { Inject, Service } from 'typedi';
import { CERTIFICATE_DATA } from '../models/Enums';
import { ITestResult } from '../models/ITestResult';
import { CertificatePayloadGeneratorIva } from './CertificatePayloadGeneratorIva';
import { CertificatePayloadGeneratorAdr } from './CertificatePayloadGeneratorAdr';
import { CertificatePayloadGeneratorRwt } from './CertificatePayloadGeneratorRwt';
import { CertificatePayloadGeneratorPassOrFail } from './CertificatePayloadGeneratorPassOrFail';
import { CertificatePayloadGeneratorMsva } from './certificate-payload/CertificatePayloadGeneratorMsva';

// This is a facade
@Service()
export class CertificatePayloadGenerator {
  private readonly passOrFailGenerator: CertificatePayloadGeneratorPassOrFail;

  private readonly rwtGenerator: CertificatePayloadGeneratorRwt;

  private readonly adrGenerator: CertificatePayloadGeneratorAdr;

  private readonly ivaGenerator: CertificatePayloadGeneratorIva;

  private readonly msvaGenerator: CertificatePayloadGeneratorMsva;

  constructor(@Inject() passOrFailGenerator: CertificatePayloadGeneratorPassOrFail, @Inject() rwtGenerator: CertificatePayloadGeneratorRwt, @Inject() adrGenerator: CertificatePayloadGeneratorAdr, @Inject() ivaGenerator: CertificatePayloadGeneratorIva, @Inject() msvaGenerator: CertificatePayloadGeneratorMsva) {
    this.passOrFailGenerator = passOrFailGenerator;
    this.rwtGenerator = rwtGenerator;
    this.adrGenerator = adrGenerator;
    this.ivaGenerator = ivaGenerator;
    this.msvaGenerator = msvaGenerator;
  }

  /**
   * Generates certificate data for a given test result and certificate type
   * @param testResult - the source test result for certificate generation
   * @param type - the certificate type
   * @param isWelsh - the boolean value whether the atf where test was conducted resides in Wales
   */
  public async generateCertificateData(testResult: ITestResult, type: CERTIFICATE_DATA, isWelsh: boolean = false) {
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
