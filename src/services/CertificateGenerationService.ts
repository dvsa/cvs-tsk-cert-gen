import { InvocationRequest, InvocationResponse, ServiceException } from '@aws-sdk/client-lambda';
import { TestResults } from '@dvsa/cvs-type-definitions/types/v1/enums/testResult.enum.js';
import { toUint8Array } from '@smithy/util-utf8';
import moment from 'moment';
import { Inject, Service } from 'typedi';
import { CertificatePayloadGenerator } from '../certificate/CertificatePayloadGenerator';
import { CertificateTypes } from '../certificate/CertificateTypes';
import { CertificateRequestProcessor } from '../functions/CertificateRequestProcessor';
import { IGeneratedCertificateResponse, IInvokeConfig, IMOTConfig, TestResultSchemaTestTypesAsObject } from '../models';
import { CERTIFICATE_DATA, VEHICLE_TYPES } from '../models/Enums';
import { TestResultService } from '../test-result/TestResultService';
import { TestStationRepository } from '../test-station/TestStationRepository';
import { Configuration } from '../utils/Configuration';
import { LambdaService } from './LambdaService';

/**
 * Service class for Certificate Generation
 */
@Service()
class CertificateGenerationService {
	private readonly config: Configuration = Configuration.getInstance();

	constructor(
		@Inject() private lambdaClient: LambdaService,
		@Inject() private certificatePayloadGenerator: CertificatePayloadGenerator,
		@Inject() private testStationRepository: TestStationRepository,
		@Inject() private testResultService: TestResultService,
		@Inject() private certificateTypes: CertificateTypes
	) {}

	/**
	 * Generates MOT certificate for a given test result
	 * @param testResult - source test result for certificate generation
	 */
	public async generateCertificate(testResult: any): Promise<IGeneratedCertificateResponse> {
		const config: IMOTConfig = this.config.getMOTConfig();
		const iConfig: IInvokeConfig = this.config.getInvokeConfig();
		const testType: any = testResult.testTypes;
		let shouldTranslateTestResult = false;

		if (CertificateRequestProcessor.flags) {
			shouldTranslateTestResult = await this.shouldTranslateTestResult(testResult);
		}

		console.log('shouldTranslateTestResult: ', shouldTranslateTestResult);

		const payload: string = JSON.stringify(await this.generatePayload(testResult, shouldTranslateTestResult));

		let vehicleTestRes: string;
		if (testType.testResult === 'abandoned') {
			vehicleTestRes = `${testResult.vehicleType}_abandoned`;
		} else if (this.testResultService.isRoadworthinessTestType(testType.testTypeId)) {
			// CVSB-7677 is road-worthiness test
			vehicleTestRes = 'rwt';
		} else if (this.testResultService.isTestTypeAdr(testResult.testTypes)) {
			vehicleTestRes = 'adr_pass';
		} else if (this.testResultService.isIvaTest(testResult.testTypes.testTypeId) && testType.testResult === 'fail') {
			vehicleTestRes = 'iva_fail';
		} else if (this.testResultService.isMsvaTest(testResult.testTypes.testTypeId) && testType.testResult === 'fail') {
			vehicleTestRes = 'msva_fail';
		} else if (
			this.testResultService.isWelshCertificateAvailable(testResult.vehicleType, testType.testResult) &&
			shouldTranslateTestResult
		) {
			vehicleTestRes = testResult.vehicleType + '_' + testType.testResult + '_bilingual';
		} else {
			vehicleTestRes = testResult.vehicleType + '_' + testType.testResult;
		}

		const certificateType = this.certificateTypes.getCertificateType(vehicleTestRes);
		console.log(`vehicleTestRes: ${vehicleTestRes}`);

		const invokeParams: InvocationRequest = {
			FunctionName: iConfig.functions.certGen.name,
			InvocationType: 'RequestResponse',
			LogType: 'Tail',
			Payload: toUint8Array(
				JSON.stringify({
					httpMethod: 'POST',
					pathParameters: {
						documentName: certificateType,
						documentDirectory: config.documentDir,
					},
					json: true,
					body: payload,
				})
			),
		};
		return this.lambdaClient
			.invoke(invokeParams)
			.then(async (response: InvocationResponse) => {
				const documentPayload: any = await this.lambdaClient.validateInvocationResponse(response);
				const resBody: string = documentPayload.body;
				const responseBuffer: Buffer = Buffer.from(resBody, 'base64');
				console.log('return from doc gen!');
				return {
					vrm: testResult.vehicleType === VEHICLE_TYPES.TRL ? testResult.trailerId : testResult.vrm,
					testTypeName: testResult.testTypes.testTypeName,
					testTypeResult: testResult.testTypes.testResult,
					dateOfIssue: moment(testResult.testTypes.testTypeStartTimestamp).format('D MMMM YYYY'),
					certificateType: certificateType.split('.')[0],
					fileFormat: 'pdf',
					fileName: this.determineFileName(testResult),
					fileSize: responseBuffer.byteLength.toString(),
					certificate: responseBuffer,
					certificateOrder: testResult.order,
					email: testResult.createdByEmailAddress ?? testResult.testerEmailAddress,
					shouldEmailCertificate: testResult.shouldEmailCertificate ?? 'true',
				};
			})
			.catch((error: ServiceException | Error) => {
				console.log(error);
				throw error;
			});
	}

	/**
	 * Determine if Welsh translation is required for the given test result
	 * @param testResult
	 * @returns Promise<boolean>
	 */
	public async shouldTranslateTestResult(testResult: any): Promise<boolean> {
		let shouldTranslateTestResult = false;

		if (this.isGlobalWelshFlagEnabled() && this.isTestResultFlagEnabled(testResult.testTypes.testResult)) {
			shouldTranslateTestResult = await this.isTestStationWelsh(testResult.testStationPNumber);
		}
		return shouldTranslateTestResult;
	}

	/**
	 * Method to check if Welsh translation is enabled.
	 * @returns boolean
	 */
	public isGlobalWelshFlagEnabled(): boolean {
		console.log('Welsh translation enabled: ', CertificateRequestProcessor.flags.welshTranslation?.enabled);
		if (!CertificateRequestProcessor.flags.welshTranslation?.enabled) {
			console.warn(`Unable to translate any test results: global Welsh flag disabled.`);
			return false;
		}
		return true;
	}

	/**
	 * Method to check if Welsh translation is enabled for the given test type.
	 * @param testResult string of result, PASS/PRS/FAIL
	 * @returns boolean
	 */
	public isTestResultFlagEnabled(testResult: string): boolean {
		let shouldTranslate = false;
		switch (testResult) {
			case TestResults.PRS:
				shouldTranslate = CertificateRequestProcessor.flags.welshTranslation?.translatePrsTestResult ?? false;
				break;
			case TestResults.PASS:
				shouldTranslate = CertificateRequestProcessor.flags.welshTranslation?.translatePassTestResult ?? false;
				break;
			case TestResults.FAIL:
				shouldTranslate = CertificateRequestProcessor.flags.welshTranslation?.translateFailTestResult ?? false;
				break;
			default:
				console.warn('Translation not available for this test result type.');
				return shouldTranslate;
		}
		if (!shouldTranslate) {
			console.warn(`Unable to translate for test result: ${testResult} flag disabled`);
		}
		return shouldTranslate;
	}

	/**
	 * Determines if a test station is located in Wales
	 * @param testStationPNumber The test station's P-number.
	 * @returns Promise<boolean> true if the test station country is set to Wales, false otherwise
	 */
	public async isTestStationWelsh(testStationPNumber: string): Promise<boolean> {
		const testStation = await this.testStationRepository.getTestStation(testStationPNumber);

		if (!testStation.testStationPNumber) {
			console.error(`Failed to retrieve test station details for ${testStationPNumber}`);
			return false;
		}

		const isWelshCountry = testStation.testStationCountry?.toString().toUpperCase() === `WALES`;
		console.log(`Test station country for ${testStationPNumber} is set to ${testStation.testStationCountry}`);
		return isWelshCountry;
	}

	private getTestType(testResult: TestResultSchemaTestTypesAsObject): CERTIFICATE_DATA {
		const testType = testResult.testTypes;
		if (testType.testResult === TestResults.ABANDONED) {
			return CERTIFICATE_DATA.ABANDONED_DATA;
		}

		if (this.testResultService.isHgvTrlRoadworthinessCertificate(testResult)) {
			return CERTIFICATE_DATA.RWT_DATA;
		}

		if (testType.testResult === TestResults.PASS && this.testResultService.isTestTypeAdr(testResult.testTypes)) {
			return CERTIFICATE_DATA.ADR_DATA;
		}

		if (testType.testResult === TestResults.FAIL && this.testResultService.isIvaTest(testType.testTypeId)) {
			return CERTIFICATE_DATA.IVA_DATA;
		}

		if (testType.testResult === TestResults.FAIL && this.testResultService.isMsvaTest(testType.testTypeId)) {
			return CERTIFICATE_DATA.MSVA_DATA;
		}

		if (testType.testResult !== TestResults.PASS) {
			return CERTIFICATE_DATA.FAIL_DATA;
		}

		return CERTIFICATE_DATA.PASS_DATA;
	}

	/**
	 * Generates the payload for the MOT certificate generation service
	 * @param testResult - source test result for certificate generation
	 * @param isWelsh - the boolean value whether the atf where test was conducted resides in Wales
	 */
	public async generatePayload(testResult: any, isWelsh = false) {
		let name = testResult.testerName;

		const nameArrayList: string[] = name.split(',');

		if (nameArrayList.length === 2) {
			name = name.split(', ').reverse().join(' ');
			testResult.testerName = name;
		}

		const testType = this.getTestType(testResult);
		let payload = await this.certificatePayloadGenerator.generateCertificateData(testResult, testType, isWelsh);

		// Purge undefined values
		payload = JSON.parse(JSON.stringify(payload));

		return payload;
	}

	/**
	 * Determines the file name for the generated certificate
	 * @param testResult - test result for certificate generation
	 * @private
	 */
	private determineFileName(testResult: any): string {
		if (testResult.testTypes.testResult === TestResults.ABANDONED) {
			return testResult.vehicleType === VEHICLE_TYPES.TRL || testResult.vehicleType === VEHICLE_TYPES.HGV
				? `VTG12_${testResult.testTypes.testNumber}.pdf`
				: `VTP12_${testResult.testTypes.testNumber}.pdf`;
		} else {
			return `${testResult.testTypes.testNumber}_${testResult.vin}.pdf`;
		}
	}
}

export { CertificateGenerationService, type IGeneratedCertificateResponse };
