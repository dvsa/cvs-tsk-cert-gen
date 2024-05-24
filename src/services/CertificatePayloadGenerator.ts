import { Service } from 'typedi';
import { CERTIFICATE_DATA } from '../models/Enums';
import { ITestResult } from '../models/ITestResult';
import { IvaPayloadCommand } from './certificate-payload/IvaPayloadCommand';
import { AdrPayloadCommand } from './certificate-payload/AdrPayloadCommand';
import { RwtPayloadCommand } from './certificate-payload/RwtPayloadCommand';
import { PassOrFailPayloadCommand } from './certificate-payload/PassOrFailPayloadCommand';
import { MsvaPayloadCommand } from './certificate-payload/MsvaPayloadCommand';
import { ICertificatePayload } from '../models/ICertificatePayload';
import { ICertificatePayloadCommand } from './ICertificatePayloadCommand';
import { SignatureCommand } from './certificate-payload/SignatureCommand';
import { WatermarkCommand } from './certificate-payload/WatermarkCommand';
import { TestHistoryCommand } from './certificate-payload/TestHistoryCommand';

@Service()
export class CertificatePayloadGenerator implements ICertificatePayloadCommand {
  private commands: ICertificatePayloadCommand[] = [
    this.passOrFailGenerator,
    this.rwtGenerator,
    this.adrGenerator,
    this.ivaGenerator,
    this.msvaGenerator,
    this.signatureCommand,
    this.watermarkCommand,
    this.testHistoryCommand,
  ];

  /**
   * Creates a new instance of the certificate payload generator. Generates a payload
   * that can be used for generating a certificate.
   */
  constructor(
    private passOrFailGenerator: PassOrFailPayloadCommand,
    private rwtGenerator: RwtPayloadCommand,
    private adrGenerator: AdrPayloadCommand,
    private ivaGenerator: IvaPayloadCommand,
    private msvaGenerator: MsvaPayloadCommand,
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
