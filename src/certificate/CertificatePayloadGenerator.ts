import merge from 'lodash.merge';
import { Inject, Service } from 'typedi';
import { ITestResult } from '../models';
import { ICertificatePayload } from '../models';
import { CERTIFICATE_DATA } from '../models/Enums';
import { CertificatePayloadStateBag } from './CertificatePayloadStateBag';
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
		@Inject() private passOrFailGenerator: PassOrFailCertificateCommand,
		@Inject() private rwtGenerator: RoadworthinessCertificateCommand,
		@Inject() private adrGenerator: AdrCertificateCommand,
		@Inject() private ivaGenerator: IvaCertificateCommand,
		@Inject() private msvaGenerator: MsvaCertificateCommand,
		@Inject() private signatureCommand: SignatureCommand,
		@Inject() private watermarkCommand: WatermarkCommand,
		@Inject() private testHistoryCommand: TestHistoryCommand,
		@Inject() private defectsCommand: DefectsCommand,
		@Inject() private makeAndModelCommand: MakeAndModelCommand,
		@Inject() private odometerHistoryCommand: OdometerHistoryCommand
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
		this.initialise({
			type,
			isWelsh,
			testResult,
		});
		return this.generate();
	}

	/**
	 * Initialises the certificate generation process.
	 * @param type The type of certificate to generate
	 * @param isWelsh True if a Welsh certificate should also be generated.
	 */
	public initialise(state: CertificatePayloadStateBag) {
		this.commands.forEach((cmd) => cmd.initialise(state));
	}

	/**
	 * Generates certificate data for a given test result and certificate type
	 * @param testResult the source test result for certificate generation
	 * @returns A generated certificate payload
	 */
	public async generate(): Promise<ICertificatePayload> {
		// Map over all the commands and get their certificate data.
		const results = await Promise.all(this.commands.map((cmd) => cmd.generate()));

		// Flatten all the certificate data into our result payload.
		return Promise.resolve(merge({} as ICertificatePayload, ...results));
	}
}
