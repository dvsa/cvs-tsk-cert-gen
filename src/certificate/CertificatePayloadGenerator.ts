import merge from 'lodash.merge';
import { Service } from 'typedi';
import { ITestResult } from '../models';
import { ICertificatePayload } from '../models';
import { CERTIFICATE_DATA } from '../models/Enums';
import { ICertificatePayloadCommand } from './ICertificatePayloadCommand';
import { AdrCertificateCommand } from './commands/AdrCertificateCommand';
import { DefectsCommand } from './commands/DefectsCommand';
import { IvaCertificateCommand } from './commands/IvaCertificateCommand';
import { MakeAndModelCommand } from './commands/MakeAndModelCommand';
import { MsvaCertificateCommand } from './commands/MsvaCertificateCommand';
import { OdometerHistoryCommand } from './commands/OdometerHistoryCommand';
import { PassOrFailCertificateCommand } from './commands/PassOrFailCertificateCommand';
import { RoadworthinessCertificateCommand } from './commands/RoadworthinessCertificateCommand';
import { SignatureCommand } from './commands/SignatureCommand';
import { TestHistoryCommand } from './commands/TestHistoryCommand';
import { WatermarkCommand } from './commands/WatermarkCommand';

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
		this.defectsCommand,
		this.makeAndModelCommand,
		this.odometerHistoryCommand,
	];

	/**
	 * Creates a new instance of the certificate payload generator. Generates a payload
	 * that can be used for generating a certificate.
	 */
	constructor(
		private passOrFailGenerator: PassOrFailCertificateCommand,
		private rwtGenerator: RoadworthinessCertificateCommand,
		private adrGenerator: AdrCertificateCommand,
		private ivaGenerator: IvaCertificateCommand,
		private msvaGenerator: MsvaCertificateCommand,
		private signatureCommand: SignatureCommand,
		private watermarkCommand: WatermarkCommand,
		private testHistoryCommand: TestHistoryCommand,
		private defectsCommand: DefectsCommand,
		private makeAndModelCommand: MakeAndModelCommand,
		private odometerHistoryCommand: OdometerHistoryCommand
	) {}

	/**
	 * Generates certificate data for a given test result and certificate type
	 * @param testResult - the source test result for certificate generation
	 * @param type - the certificate type
	 * @param isWelsh - the boolean value whether the atf where test was conducted resides in Wales
	 */
	public async generateCertificateData(
		testResult: ITestResult,
		type: CERTIFICATE_DATA,
		isWelsh = false
	): Promise<ICertificatePayload> {
		this.initialise(type, isWelsh);
		return this.generate(testResult);
	}

	/**
	 * Initialises the certificate generation process.
	 * @param type The type of certificate to generate
	 * @param isWelsh True if a Welsh certificate should also be generated.
	 */
	public initialise(type: CERTIFICATE_DATA, isWelsh = false) {
		this.commands.forEach((cmd) => cmd.initialise(type, isWelsh));
	}

	/**
	 * Generates certificate data for a given test result and certificate type
	 * @param testResult the source test result for certificate generation
	 * @returns A generated certificate payload
	 */
	public async generate(testResult: ITestResult): Promise<ICertificatePayload> {
		// Map over all the commands and get their certificate data.
		const results = await Promise.all(this.commands.map((cmd) => cmd.generate(testResult)));

		// Flatten all the certificate data into our result payload.
		return Promise.resolve(merge({} as ICertificatePayload, ...results));
	}
}
