import { Readable } from 'stream';
import { InvocationRequest, InvocationResponse, ServiceException } from '@aws-sdk/client-lambda';
import { GetObjectOutput } from '@aws-sdk/client-s3';
import { getProfile } from '@dvsa/cvs-feature-flags/profiles/vtx';
import { toUint8Array } from '@smithy/util-utf8';
import moment from 'moment';
import { Service } from 'typedi';
import { DefectRepository } from '../defect/DefectRepository';
import { DefectService } from '../defect/DefectService';
import {
	ICertificatePayload,
	IFeatureFlags,
	IGeneratedCertificateResponse,
	IInvokeConfig,
	IMOTConfig,
	IRequiredStandard,
	IRoadworthinessCertificateData,
	ITestResult,
} from '../models';
import { CERTIFICATE_DATA, IVA_30, TEST_RESULTS, VEHICLE_TYPES } from '../models/Enums';
import { IDefectParent } from '../models/IDefectParent';
import { IFlatDefect } from '../models/IFlatDefect';
import { TechRecordType } from '../models/Types';
import { TechRecordService } from '../tech-record/TechRecordService';
import { TestResultRepository } from '../test-result/TestResultRepository';
import { TestResultService } from '../test-result/TestResultService';
import { TestStationRepository } from '../test-station/TestStationRepository';
import { TrailerRepository } from '../trailer/TrailerRepository';
import { Configuration } from '../utils/Configuration';
import { LambdaService } from './LambdaService';
import { S3BucketService } from './S3BucketService';

/**
 * Service class for Certificate Generation
 */
@Service()
class CertificateGenerationService {
	private readonly config: Configuration = Configuration.getInstance();

	constructor(
		private s3Client: S3BucketService,
		private lambdaClient: LambdaService,
		private trailerRepository: TrailerRepository,
		private testStationRepository: TestStationRepository,
		private testResultRepository: TestResultRepository,
		private defectRepository: DefectRepository,
		private testResultService: TestResultService,
		private techRecordService: TechRecordService,
		private defectService: DefectService
	) {}

	/**
	 * Generates MOT certificate for a given test result
	 * @param testResult - source test result for certificate generation
	 */
	public async generateCertificate(testResult: any): Promise<IGeneratedCertificateResponse> {
		const config: IMOTConfig = this.config.getMOTConfig();
		const iConfig: IInvokeConfig = this.config.getInvokeConfig();
		const testType: any = testResult.testTypes;

		const shouldTranslateTestResult = await this.shouldTranslateTestResult(testResult);

		const payload: string = JSON.stringify(await this.generatePayload(testResult, shouldTranslateTestResult));

		const certificateTypes: any = {
			psv_pass: config.documentNames.vtp20,
			psv_pass_bilingual: config.documentNames.vtp20_bilingual,
			psv_fail: config.documentNames.vtp30,
			psv_fail_bilingual: config.documentNames.vtp30_bilingual,
			psv_prs: config.documentNames.psv_prs,
			psv_prs_bilingual: config.documentNames.psv_prs_bilingual,
			hgv_pass: config.documentNames.vtg5,
			hgv_pass_bilingual: config.documentNames.vtg5_bilingual,
			hgv_fail: config.documentNames.vtg30,
			hgv_fail_bilingual: config.documentNames.vtg30_bilingual,
			hgv_prs: config.documentNames.hgv_prs,
			hgv_prs_bilingual: config.documentNames.hgv_prs_bilingual,
			trl_pass: config.documentNames.vtg5a,
			trl_pass_bilingual: config.documentNames.vtg5a_bilingual,
			trl_fail: config.documentNames.vtg30,
			trl_fail_bilingual: config.documentNames.vtg30_bilingual,
			trl_prs: config.documentNames.trl_prs,
			trl_prs_bilingual: config.documentNames.trl_prs_bilingual,
			rwt: config.documentNames.rwt,
			adr_pass: config.documentNames.adr_pass,
			iva_fail: config.documentNames.iva_fail,
			msva_fail: config.documentNames.msva_fail,
		};

		let vehicleTestRes: string;
		if (this.testResultService.isRoadworthinessTestType(testType.testTypeId)) {
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

		console.log(`vehicleTestRes: ${vehicleTestRes}`);

		const invokeParams: InvocationRequest = {
			FunctionName: iConfig.functions.certGen.name,
			InvocationType: 'RequestResponse',
			LogType: 'Tail',
			Payload: toUint8Array(
				JSON.stringify({
					httpMethod: 'POST',
					pathParameters: {
						documentName: certificateTypes[vehicleTestRes],
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
					certificateType: certificateTypes[vehicleTestRes].split('.')[0],
					fileFormat: 'pdf',
					fileName: `${testResult.testTypes.testNumber}_${testResult.vin}.pdf`,
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
	 * Handler method for retrieving feature flags and checking if test station is in Wales
	 * @param testResult
	 * @returns Promise<boolean>
	 */
	public async shouldTranslateTestResult(testResult: any): Promise<boolean> {
		let shouldTranslateTestResult = false;
		try {
			const featureFlags: IFeatureFlags = await getProfile();
			console.log('Using feature flags ', featureFlags);

			if (
				this.isGlobalWelshFlagEnabled(featureFlags) &&
				this.isTestResultFlagEnabled(testResult.testTypes.testResult, featureFlags)
			) {
				shouldTranslateTestResult = await this.isTestStationWelsh(testResult.testStationPNumber);
			}
		} catch (e) {
			console.error(`Failed to retrieve feature flags - ${e}`);
		}
		return shouldTranslateTestResult;
	}

	/**
	 * Method to check if Welsh translation is enabled.
	 * @param featureFlags IFeatureFlags interface
	 * @returns boolean
	 */
	public isGlobalWelshFlagEnabled(featureFlags: IFeatureFlags): boolean {
		if (!featureFlags.welshTranslation.enabled) {
			console.warn(`Unable to translate any test results: global Welsh flag disabled.`);
			return false;
		}
		return true;
	}

	/**
	 * Method to check if Welsh translation is enabled for the given test type.
	 * @param featureFlags IFeatureFlags interface
	 * @param testResult string of result, PASS/PRS/FAIL
	 * @returns boolean
	 */
	public isTestResultFlagEnabled(testResult: string, featureFlags: IFeatureFlags): boolean {
		let shouldTranslate = false;
		switch (testResult) {
			case TEST_RESULTS.PRS:
				shouldTranslate = featureFlags.welshTranslation.translatePrsTestResult ?? false;
				break;
			case TEST_RESULTS.PASS:
				shouldTranslate = featureFlags.welshTranslation.translatePassTestResult ?? false;
				break;
			case TEST_RESULTS.FAIL:
				shouldTranslate = featureFlags.welshTranslation.translateFailTestResult ?? false;
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

	/**
	 * Retrieves a signature from the cvs-signature S3 bucket
	 * @param staffId - staff ID of the signature you want to retrieve
	 * @returns the signature as a base64 encoded string
	 */
	public async getSignature(staffId: string): Promise<string | null> {
		try {
			const result: GetObjectOutput = await this.s3Client.download(
				`cvs-signature-${process.env.BUCKET}`,
				`${staffId}.base64`
			);

			if (result.Body instanceof Readable) {
				const chunks: Uint8Array[] = [];
				for await (const chunk of result.Body) {
					chunks.push(chunk);
				}
				const buffer = Buffer.concat(chunks);
				return buffer.toString('utf-8');
			} else {
				throw new Error(`Unexpected body type: ${typeof result.Body}`);
			}
		} catch (error) {
			console.error(`Unable to fetch signature for staff id ${staffId}. ${(error as Error).message}`);
		}
		return null;
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

		const signature: string | null = await this.getSignature(testResult.createdById ?? testResult.testerStaffId);

		let makeAndModel: any = null;
		if (!this.testResultService.isRoadworthinessTestType(testResult.testTypes.testTypeId)) {
			makeAndModel = await this.techRecordService.getVehicleMakeAndModel(testResult);
		}

		let payload: ICertificatePayload = {
			Watermark: process.env.BRANCH === 'prod' ? '' : 'NOT VALID',
			DATA: undefined,
			FAIL_DATA: undefined,
			RWT_DATA: undefined,
			ADR_DATA: undefined,
			IVA_DATA: undefined,
			MSVA_DATA: undefined,
			Signature: {
				ImageType: 'png',
				ImageData: signature,
			},
		};

		const { testTypes, vehicleType, systemNumber, testHistory } = testResult;

		if (testHistory) {
			for (const history of testHistory) {
				for (const testType of history.testTypes) {
					if (testType.testCode === testTypes.testCode) {
						payload.Reissue = {
							Reason: 'Replacement',
							Issuer: testResult.createdByName,
							Date: moment(testResult.createdAt).format('DD.MM.YYYY'),
						};
						break;
					}
				}
			}
		}

		if (this.testResultService.isHgvTrlRoadworthinessCertificate(testResult)) {
			// CVSB-7677 for roadworthiness test for hgv or trl.
			const rwtData = await this.generateCertificateData(testResult, CERTIFICATE_DATA.RWT_DATA);
			payload.RWT_DATA = { ...rwtData };
		} else if (
			testResult.testTypes.testResult === TEST_RESULTS.PASS &&
			this.testResultService.isTestTypeAdr(testResult.testTypes)
		) {
			const adrData = await this.generateCertificateData(testResult, CERTIFICATE_DATA.ADR_DATA);
			payload.ADR_DATA = { ...adrData, ...makeAndModel };
		} else if (
			testResult.testTypes.testResult === TEST_RESULTS.FAIL &&
			this.testResultService.isIvaTest(testResult.testTypes.testTypeId)
		) {
			const ivaData = await this.generateCertificateData(testResult, CERTIFICATE_DATA.IVA_DATA);
			payload.IVA_DATA = { ...ivaData };
		} else if (
			testResult.testTypes.testResult === TEST_RESULTS.FAIL &&
			this.testResultService.isMsvaTest(testResult.testTypes.testTypeId)
		) {
			const msvaData = await this.generateCertificateData(testResult, CERTIFICATE_DATA.MSVA_DATA);
			payload.MSVA_DATA = { ...msvaData };
		} else {
			const odometerHistory =
				vehicleType === VEHICLE_TYPES.TRL
					? undefined
					: await this.testResultRepository.getOdometerHistory(systemNumber);
			const TrnObj = this.testResultService.isValidForTrn(vehicleType, makeAndModel)
				? await this.trailerRepository.getTrailerRegistrationObject(testResult.vin, makeAndModel.Make)
				: undefined;
			if (testTypes.testResult !== TEST_RESULTS.FAIL) {
				const passData = await this.generateCertificateData(testResult, CERTIFICATE_DATA.PASS_DATA, isWelsh);
				payload.DATA = {
					...passData,
					...makeAndModel,
					...odometerHistory,
					...TrnObj,
				};
			}
			if (testTypes.testResult !== TEST_RESULTS.PASS) {
				const failData = await this.generateCertificateData(testResult, CERTIFICATE_DATA.FAIL_DATA, isWelsh);
				payload.FAIL_DATA = {
					...failData,
					...makeAndModel,
					...odometerHistory,
					...TrnObj,
				};
			}
		}
		// Purge undefined values
		payload = JSON.parse(JSON.stringify(payload));

		return payload;
	}

	/**
	 * Generates certificate data for a given test result and certificate type
	 * @param testResult - the source test result for certificate generation
	 * @param type - the certificate type
	 * @param isWelsh - the boolean value whether the atf where test was conducted resides in Wales
	 */
	public async generateCertificateData(testResult: ITestResult, type: string, isWelsh = false) {
		let defectListFromApi: IDefectParent[] = [];
		let flattenedDefects: IFlatDefect[] = [];
		if (isWelsh) {
			defectListFromApi = await this.defectRepository.getDefectTranslations();
			flattenedDefects = this.defectService.flattenDefectsFromApi(defectListFromApi);
		}
		const testType: any = testResult.testTypes;
		switch (type) {
			case CERTIFICATE_DATA.PASS_DATA:
			case CERTIFICATE_DATA.FAIL_DATA:
				const defects: any = await this.generateDefects(
					testResult.testTypes,
					type,
					testResult.vehicleType,
					flattenedDefects,
					isWelsh
				);

				return {
					TestNumber: testType.testNumber,
					TestStationPNumber: testResult.testStationPNumber,
					TestStationName: testResult.testStationName,
					CurrentOdometer: {
						value: testResult.odometerReading,
						unit: testResult.odometerReadingUnits,
					},
					IssuersName: testResult.testerName,
					DateOfTheTest: moment(testResult.testEndTimestamp).format('DD.MM.YYYY'),
					CountryOfRegistrationCode: testResult.countryOfRegistration,
					VehicleEuClassification: testResult.euVehicleCategory.toUpperCase(),
					RawVIN: testResult.vin,
					RawVRM: testResult.vehicleType === VEHICLE_TYPES.TRL ? testResult.trailerId : testResult.vrm,
					ExpiryDate: testType.testExpiryDate ? moment(testType.testExpiryDate).format('DD.MM.YYYY') : undefined,
					EarliestDateOfTheNextTest:
						(testResult.vehicleType === VEHICLE_TYPES.HGV || testResult.vehicleType === VEHICLE_TYPES.TRL) &&
						(testResult.testTypes.testResult === TEST_RESULTS.PASS ||
							testResult.testTypes.testResult === TEST_RESULTS.PRS)
							? moment(testType.testAnniversaryDate).subtract(1, 'months').startOf('month').format('DD.MM.YYYY')
							: moment(testType.testAnniversaryDate).format('DD.MM.YYYY'),
					SeatBeltTested: testType.seatbeltInstallationCheckDate ? 'Yes' : 'No',
					SeatBeltPreviousCheckDate: testType.lastSeatbeltInstallationCheckDate
						? moment(testType.lastSeatbeltInstallationCheckDate).format('DD.MM.YYYY')
						: '\u00A0',
					SeatBeltNumber: testType.numberOfSeatbeltsFitted,
					...defects,
				};
			case CERTIFICATE_DATA.RWT_DATA:
				const weightDetails = await this.techRecordService.getWeightDetails(testResult);
				let defectRWTList: any;
				if (testResult.testTypes.testResult === TEST_RESULTS.FAIL) {
					defectRWTList = [];
					testResult.testTypes.defects.forEach((defect: any) => {
						defectRWTList.push(this.defectService.formatDefect(defect));
					});
				} else {
					defectRWTList = undefined;
				}

				const resultPass: IRoadworthinessCertificateData = {
					Dgvw: weightDetails.dgvw,
					Weight2: weightDetails.weight2,
					VehicleNumber: testResult.vehicleType === VEHICLE_TYPES.TRL ? testResult.trailerId : testResult.vrm,
					Vin: testResult.vin,
					IssuersName: testResult.testerName,
					DateOfInspection: moment(testType.testTypeStartTimestamp).format('DD.MM.YYYY'),
					TestStationPNumber: testResult.testStationPNumber,
					DocumentNumber: testType.certificateNumber,
					Date: moment(testType.testTypeStartTimestamp).format('DD.MM.YYYY'),
					Defects: defectRWTList,
					IsTrailer: testResult.vehicleType === VEHICLE_TYPES.TRL,
				};
				return resultPass;
			case CERTIFICATE_DATA.ADR_DATA:
				const adrDetails: TechRecordType<any> = await this.techRecordService.getAdrDetails(testResult);
				const docGenPayloadAdr = {
					ChasisNumber: testResult.vin,
					RegistrationNumber: testResult.vrm,
					ApplicantDetails: {
						name: adrDetails?.techRecord_applicantDetails_name,
						address1: adrDetails?.techRecord_applicantDetails_address1,
						address2: adrDetails?.techRecord_applicantDetails_address2,
						address3: adrDetails?.techRecord_applicantDetails_address1,
						postTown: adrDetails?.techRecord_applicantDetails_postTown,
						postCode: adrDetails?.techRecord_applicantDetails_postCode,
						telephoneNumber: adrDetails?.techRecord_applicantDetails_telephoneNumber,
						emailAddress: adrDetails?.techRecord_applicantDetails_emailAddress,
					},
					VehicleType: adrDetails?.techRecord_adrDetails_vehicleDetails_type,
					PermittedDangerousGoods: adrDetails?.techRecord_adrDetails_permittedDangerousGoods,
					BrakeEndurance: adrDetails?.techRecord_adrDetails_brakeEndurance,
					Weight: adrDetails?.techRecord_adrDetails_weight,
					TankManufacturer: adrDetails?.techRecord_adrDetails_tank_tankDetails_tankStatement_statement
						? adrDetails.techRecord_adrDetails_tank_tankDetails_tankManufacturer
						: undefined,
					Tc2InitApprovalNo: adrDetails?.techRecord_adrDetails_tank_tankDetails_tc2Details_tc2IntermediateApprovalNo,
					TankManufactureSerialNo: adrDetails?.techRecord_adrDetails_tank_tankDetails_tankManufacturerSerialNo,
					YearOfManufacture: adrDetails?.techRecord_adrDetails_tank_tankDetails_yearOfManufacture,
					TankCode: adrDetails?.techRecord_adrDetails_tank_tankDetails_tankCode,
					SpecialProvisions: adrDetails?.techRecord_adrDetails_tank_tankDetails_specialProvisions,
					TankStatement: adrDetails?.techRecord_adrDetails_tank_tankDetails_tankStatement_statement,
					ExpiryDate: testResult.testTypes.testExpiryDate,
					AtfNameAtfPNumber: testResult.testStationName + ' ' + testResult.testStationPNumber,
					Notes: testResult.testTypes.additionalNotesRecorded,
					TestTypeDate: testResult.testTypes.testTypeStartTimestamp,
				};
				console.log('CHECK HERE DOCGENPAYLOAD -> ', docGenPayloadAdr);
				return docGenPayloadAdr;
			case CERTIFICATE_DATA.IVA_DATA:
				const ivaFailDetailsForDocGen = {
					vin: testResult.vin,
					serialNumber: testResult.vehicleType === 'trl' ? testResult.trailerId : testResult.vrm,
					vehicleTrailerNrNo: testResult.vehicleType === 'trl' ? testResult.trailerId : testResult.vrm,
					testCategoryClass: testResult.euVehicleCategory,
					testCategoryBasicNormal: this.testResultService.isBasicIvaTest(testResult.testTypes.testTypeId)
						? IVA_30.BASIC
						: IVA_30.NORMAL,
					make: testResult.make,
					model: testResult.model,
					bodyType: testResult.bodyType?.description,
					date: moment(testResult.testTypes.testTypeStartTimestamp).format('DD/MM/YYYY'),
					testerName: testResult.testerName,
					reapplicationDate: testResult.testTypes?.reapplicationDate
						? moment(testResult.testTypes?.reapplicationDate).format('DD/MM/YYYY')
						: '',
					station: testResult.testStationName,
					additionalDefects: this.defectService.formatVehicleApprovalAdditionalDefects(
						testResult.testTypes.customDefects
					),
					requiredStandards: this.sortRequiredStandards(testResult.testTypes.requiredStandards),
				};
				return ivaFailDetailsForDocGen;
			case CERTIFICATE_DATA.MSVA_DATA:
				const msvaFailDetailsForDocGen = {
					vin: testResult.vin,
					serialNumber: testResult.vrm,
					vehicleZNumber: testResult.vrm,
					make: testResult.make,
					model: testResult.model,
					type: testResult.vehicleType,
					testerName: testResult.testerName,
					date: moment(testResult.testTypes.testTypeStartTimestamp).format('DD/MM/YYYY'),
					reapplicationDate: testResult.testTypes?.reapplicationDate
						? moment(testResult.testTypes?.reapplicationDate).format('DD/MM/YYYY')
						: '',
					station: testResult.testStationName,
					additionalDefects: this.defectService.formatVehicleApprovalAdditionalDefects(
						testResult.testTypes.customDefects
					),
					requiredStandards: this.sortRequiredStandards(testResult.testTypes.requiredStandards),
				};
				return msvaFailDetailsForDocGen;
		}
	}

	/**
	 * Generates an object containing defects for a given test type and certificate type
	 * @param testTypes - the source test type for defect generation
	 * @param type - the certificate type
	 * @param vehicleType - the vehicle type from the test result
	 * @param flattenedDefects - the list of flattened defects after being retrieved from the defect service
	 * @param isWelsh - determines whether the atf in which the test result was conducted resides in Wales
	 */
	private generateDefects(
		testTypes: any,
		type: string,
		vehicleType: string,
		flattenedDefects: IFlatDefect[],
		isWelsh = false
	) {
		const rawDefects: any = testTypes.defects;
		const defects: any = {
			DangerousDefects: [],
			MajorDefects: [],
			PRSDefects: [],
			MinorDefects: [],
			AdvisoryDefects: [],
			DangerousDefectsWelsh: [],
			MajorDefectsWelsh: [],
			PRSDefectsWelsh: [],
			MinorDefectsWelsh: [],
			AdvisoryDefectsWelsh: [],
		};

		rawDefects.forEach((defect: any) => {
			switch (defect.deficiencyCategory.toLowerCase()) {
				case 'dangerous':
					if ((testTypes.testResult === TEST_RESULTS.PRS || defect.prs) && type === CERTIFICATE_DATA.FAIL_DATA) {
						defects.PRSDefects.push(this.defectService.formatDefect(defect));
						if (this.testResultService.isWelshCertificateAvailable(vehicleType, testTypes.testResult) && isWelsh) {
							defects.PRSDefectsWelsh.push(this.defectService.formatDefectWelsh(defect, vehicleType, flattenedDefects));
						}
					} else if (testTypes.testResult === 'fail') {
						defects.DangerousDefects.push(this.defectService.formatDefect(defect));
						// If the test was conducted in Wales and is valid vehicle type, format and add the welsh defects to the list
						if (this.testResultService.isWelshCertificateAvailable(vehicleType, testTypes.testResult) && isWelsh) {
							defects.DangerousDefectsWelsh.push(
								this.defectService.formatDefectWelsh(defect, vehicleType, flattenedDefects)
							);
						}
					}
					break;
				case 'major':
					if ((testTypes.testResult === TEST_RESULTS.PRS || defect.prs) && type === CERTIFICATE_DATA.FAIL_DATA) {
						defects.PRSDefects.push(this.defectService.formatDefect(defect));
						if (this.testResultService.isWelshCertificateAvailable(vehicleType, testTypes.testResult) && isWelsh) {
							defects.PRSDefectsWelsh.push(this.defectService.formatDefectWelsh(defect, vehicleType, flattenedDefects));
						}
					} else if (testTypes.testResult === 'fail') {
						defects.MajorDefects.push(this.defectService.formatDefect(defect));
						// If the test was conducted in Wales and is valid vehicle type, format and add the welsh defects to the list
						if (this.testResultService.isWelshCertificateAvailable(vehicleType, testTypes.testResult) && isWelsh) {
							defects.MajorDefectsWelsh.push(
								this.defectService.formatDefectWelsh(defect, vehicleType, flattenedDefects)
							);
						}
					}
					break;
				case 'minor':
					defects.MinorDefects.push(this.defectService.formatDefect(defect));
					if (this.testResultService.isWelshCertificateAvailable(vehicleType, testTypes.testResult) && isWelsh) {
						defects.MinorDefectsWelsh.push(this.defectService.formatDefectWelsh(defect, vehicleType, flattenedDefects));
					}
					break;
				case 'advisory':
					defects.AdvisoryDefects.push(this.defectService.formatDefect(defect));
					if (this.testResultService.isWelshCertificateAvailable(vehicleType, testTypes.testResult) && isWelsh) {
						defects.AdvisoryDefectsWelsh.push(this.defectService.formatDefect(defect));
					}
					break;
			}
		});

		Object.entries(defects).forEach(([k, v]: [string, any]) => {
			if (v.length === 0) {
				Object.assign(defects, { [k]: undefined });
			}
		});
		console.log(JSON.stringify(defects));
		return defects;
	}

	/**
	 * Sorts required standards if present by refCalculation and then returns it
	 * @param requiredStandards - the requiredStandards array to sort
	 * @returns - the sorted requiredStandards array
	 */
	private sortRequiredStandards = (
		requiredStandards: IRequiredStandard[] | undefined
	): IRequiredStandard[] | undefined => {
		if (!requiredStandards) {
			return;
		}

		const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
		return requiredStandards.sort((a, b) => collator.compare(a.refCalculation, b.refCalculation));
	};
}

export { CertificateGenerationService, IGeneratedCertificateResponse };
