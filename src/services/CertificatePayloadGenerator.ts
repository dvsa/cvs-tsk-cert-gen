import { Service } from 'typedi';
import { CERTIFICATE_DATA } from '../models/Enums';
import { ITestResult } from '../models/ITestResult';
import { CertificatePayloadGeneratorIva } from './certificate-payload/CertificatePayloadGeneratorIva';
import { CertificatePayloadGeneratorAdr } from './certificate-payload/CertificatePayloadGeneratorAdr';
import { CertificatePayloadGeneratorRwt } from './certificate-payload/CertificatePayloadGeneratorRwt';
import { CertificatePayloadGeneratorPassOrFail } from './certificate-payload/CertificatePayloadGeneratorPassOrFail';
import { CertificatePayloadGeneratorMsva } from './certificate-payload/CertificatePayloadGeneratorMsva';
import { ICertificatePayload } from '../models/ICertificatePayload';
import { ICertificatePayloadGenerator } from './ICertificatePayloadGenerator';
import { SignatureCommand } from './certificate-payload/SignatureCommand';
import { WatermarkCommand } from './certificate-payload/WatermarkCommand';

// This is a facade
@Service()
export class CertificatePayloadGenerator implements ICertificatePayloadGenerator {
  private commands: ICertificatePayloadGenerator[] = [];

  constructor(
    private passOrFailGenerator: CertificatePayloadGeneratorPassOrFail,
    private rwtGenerator: CertificatePayloadGeneratorRwt,
    private adrGenerator: CertificatePayloadGeneratorAdr,
    private ivaGenerator: CertificatePayloadGeneratorIva,
    private msvaGenerator: CertificatePayloadGeneratorMsva,
    private signatureCommand: SignatureCommand,
    private watermarkCommand: WatermarkCommand,
    private testHistoryCommand: TestHistoryCommand,
  ) {
  }

  /**
   * Generates certificate data for a given test result and certificate type
   * @param testResult - the source test result for certificate generation
   * @param type - the certificate type
   * @param isWelsh - the boolean value whether the atf where test was conducted resides in Wales
   */
  public async generateCertificateData(testResult: ITestResult, type: CERTIFICATE_DATA, isWelsh: boolean = false): Promise<ICertificatePayload> {
    this.initialise(type, isWelsh);
    return this.generate(testResult);
  }

  /**
   * Initialises the certificate generation process.
   * @param type The type of certificate to generate
   * @param isWelsh True if a Welsh certificate should also be generated.
   */
  initialise(type: CERTIFICATE_DATA, isWelsh: boolean = false) {
    this.commands = [];

    switch (type) {
      case CERTIFICATE_DATA.PASS_DATA:
      case CERTIFICATE_DATA.FAIL_DATA:
        this.commands.push(this.passOrFailGenerator);
        break;
      case CERTIFICATE_DATA.RWT_DATA:
        this.commands.push(this.rwtGenerator);
        break;
      case CERTIFICATE_DATA.ADR_DATA:
        this.commands.push(this.adrGenerator);
        break;
      case CERTIFICATE_DATA.IVA_DATA:
        this.commands.push(this.ivaGenerator);
        break;
      case CERTIFICATE_DATA.MSVA_DATA:
        this.commands.push(this.msvaGenerator);
        break;
      default:
        throw Error(`Certificate data request not found (${type as string})`);
    }

    this.commands.push(this.signatureCommand);
    this.commands.push(this.watermarkCommand);

    this.commands.forEach((cmd) => cmd.initialise(type, isWelsh));
  }

  /**
   * Generates certificate data for a given test result and certificate type
   * @param testResult the source test result for certificate generation
   * @returns A generated certificate payload
   */
  public async generate(testResult: ITestResult): Promise<ICertificatePayload> {
    // Map over all the commands and get their certificate data.
    const payloads = await Promise
      .all(this.commands
        .map((cmd) => cmd
          .generate(testResult)));

    // Flatten all the certificate data into our result payload.
    return payloads.reduce((acc, obj) => ({ ...acc, ...obj }), {});
  }
}
