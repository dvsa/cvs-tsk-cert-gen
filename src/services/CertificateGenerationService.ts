import { Inject, Service } from 'typedi';
import { InvocationRequest, ServiceException, InvocationResponse } from '@aws-sdk/client-lambda';
import moment from 'moment';
import { getProfile, FeatureFlags } from '@dvsa/cvs-microservice-common/feature-flags/profiles/vtx';
import { toUint8Array } from '@smithy/util-utf8';
import { GetObjectCommandOutput } from '@aws-sdk/client-s3';
import axiosClient from '../client/AxiosClient';
import { IMakeAndModel } from '../models/IMakeAndModel';
import { ITestType } from '../models/ITestType';
import { ICertificatePayload } from '../models/ICertificatePayload';
import { IGeneratedCertificateResponse } from '../models/IGeneratedCertificateResponse';
import { IInvokeConfig } from '../models/IInvokeConfig';
import { IMOTConfig } from '../models/IMOTConfig';
import {
  CERTIFICATE_DATA,
  ERRORS,
  TEST_RESULTS,
  VEHICLE_TYPES,
} from '../models/Enums';
import { HTTPError } from '../models/HTTPError';
import { Configuration } from '../utils/Configuration';
import { LambdaService } from './LambdaService';
import { S3BucketService } from './S3BucketService';
import { ITestStation } from '../models/ITestStations';
import { TestService } from './TestService';
import { TechRecordsService } from './TechRecordsService';
import { TestStationRepository } from './TestStationRepository';
import { CertificatePayloadGenerator } from './CertificatePayloadGenerator';
import { TrailerRepository } from './TrailerRepository';
import { TestResultRepository } from './TestResultRepository';

/**
 * Service class for Certificate Generation
 */
@Service()
class CertificateGenerationService {
  private readonly s3Client: S3BucketService;

  private readonly config: Configuration;

  private readonly lambdaClient: LambdaService;

  private readonly testService: TestService = new TestService();

  private readonly techRecordsService: TechRecordsService;

  private readonly testStationRepository: TestStationRepository;

  private readonly certificatePayloadGenerator: CertificatePayloadGenerator;

  private readonly trailerRepository: TrailerRepository;

  private readonly testResultRepository: TestResultRepository;

  constructor(
  @Inject() s3Client: S3BucketService,
    @Inject() lambdaClient: LambdaService,
    @Inject() techRecordsService: TechRecordsService,
    @Inject() testStationRepository: TestStationRepository,
    @Inject() certificatePayloadGenerator: CertificatePayloadGenerator,
    @Inject() trailerRepository: TrailerRepository,
    @Inject() testResultRepository: TestResultRepository,
  ) {
    this.s3Client = s3Client;
    this.config = Configuration.getInstance();
    this.lambdaClient = lambdaClient;
    this.techRecordsService = techRecordsService;
    this.testStationRepository = testStationRepository;
    this.certificatePayloadGenerator = certificatePayloadGenerator;
    this.trailerRepository = trailerRepository;
    this.testResultRepository = testResultRepository;
  }

  /**
   * Generates MOT certificate for a given test result
   * @param testResult - source test result for certificate generation
   */
  public async generateCertificate(
    testResult: any,
  ): Promise<IGeneratedCertificateResponse> {
    const config: IMOTConfig = this.config.getMOTConfig();
    const iConfig: IInvokeConfig = this.config.getInvokeConfig();
    const testType: any = testResult.testTypes;

    const shouldTranslateTestResult = await this.shouldTranslateTestResult(testResult);

    const payload: string = JSON.stringify(
      await this.generatePayload(testResult, shouldTranslateTestResult),
    );

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
    if (this.testService.isRoadworthinessTestType(testType.testTypeId)) {
      // CVSB-7677 is road-worthiness test
      vehicleTestRes = 'rwt';
    } else if (this.testService.isTestTypeAdr(testResult.testTypes)) {
      vehicleTestRes = 'adr_pass';
    } else if (this.testService.isIvaTest(testResult.testTypes.testTypeId) && testType.testResult === 'fail') {
      vehicleTestRes = 'iva_fail';
    } else if (this.testService.isMsvaTest(testResult.testTypes.testTypeId) && testType.testResult === 'fail') {
      vehicleTestRes = 'msva_fail';
    } else if (this.certificatePayloadGenerator.isWelshCertificateAvailable(testResult.vehicleType, testType.testResult) && shouldTranslateTestResult) {
      vehicleTestRes = `${testResult.vehicleType}_${testType.testResult}_bilingual`;
    } else {
      vehicleTestRes = `${testResult.vehicleType}_${testType.testResult}`;
    }

    const invokeParams: InvocationRequest = {
      FunctionName: iConfig.functions.certGen.name,
      InvocationType: 'RequestResponse',
      LogType: 'Tail',
      Payload: toUint8Array(JSON.stringify({
        httpMethod: 'POST',
        pathParameters: {
          documentName: certificateTypes[vehicleTestRes],
          documentDirectory: config.documentDir,
        },
        json: true,
        body: payload,
      })),
    };
    return this.lambdaClient
      .invoke(invokeParams)
      .then(
        async (response: InvocationResponse) => {
          const documentPayload: any = await this.lambdaClient.validateInvocationResponse(response);
          const resBody: string = documentPayload.body;
          const responseBuffer: Buffer = Buffer.from(resBody, 'base64');
          return {
            vrm:
              testResult.vehicleType === VEHICLE_TYPES.TRL
                ? testResult.trailerId
                : testResult.vrm,
            testTypeName: testResult.testTypes.testTypeName,
            testTypeResult: testResult.testTypes.testResult,
            dateOfIssue: moment(
              testResult.testTypes.testTypeStartTimestamp,
            ).format('D MMMM YYYY'),
            certificateType: certificateTypes[vehicleTestRes].split('.')[0],
            fileFormat: 'pdf',
            fileName: `${testResult.testTypes.testNumber}_${testResult.vin}.pdf`,
            fileSize: responseBuffer.byteLength.toString(),
            certificate: responseBuffer,
            certificateOrder: testResult.order,
            email:
              testResult.createdByEmailAddress ?? testResult.testerEmailAddress,
            shouldEmailCertificate: testResult.shouldEmailCertificate ?? 'true',
          };
        },
      )
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
      const featureFlags = await getProfile();
      console.log('Using feature flags ', featureFlags);

      if (this.isGlobalWelshFlagEnabled(featureFlags) && this.isTestResultFlagEnabled(testResult.testTypes.testResult, featureFlags)) {
        shouldTranslateTestResult = await this.isTestStationWelsh(testResult.testStationPNumber);
      }
    } catch (e) {
      // eslint-disable-next-line
      console.error(`Failed to retrieve feature flags`, e);
    }
    return shouldTranslateTestResult;
  }

  /**
   * Method to check if Welsh translation is enabled.
   * @param featureFlags FeatureFlags interface
   * @returns boolean
   */
  public isGlobalWelshFlagEnabled(featureFlags: FeatureFlags): boolean {
    if (!featureFlags.welshTranslation.enabled) {
      console.warn('Unable to translate any test results: global Welsh flag disabled.');
      return false;
    }
    return true;
  }

  /**
   * Method to check if Welsh translation is enabled for the given test type.
   * @param featureFlags FeatureFlags interface
   * @param testResult string of result, PASS/PRS/FAIL
   * @returns boolean
   */
  public isTestResultFlagEnabled(testResult: string, featureFlags: FeatureFlags): boolean {
    let shouldTranslate: boolean = false;
    switch (testResult as TEST_RESULTS) {
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
   * @returns Promise<boolean> true if the test station is Welsh, false otherwise
   */
  public async isTestStationWelsh(testStationPNumber: string): Promise<boolean> {
    const testStations = await this.testStationRepository.getTestStations();
    const testStationPostcode = this.getThisTestStation(testStations, testStationPNumber);
    return testStationPostcode ? this.lookupPostcode(testStationPostcode) : false;
  }

  /**
   * Find the details of the test station used on the test result
   * @param testStations list of all test stations
   * @param testStationPNumber pNumber from the test result
   * @returns string postcode of the pNumber test station
   */
  public getThisTestStation(
    testStations: ITestStation[],
    testStationPNumber: string,
  ) {
    if (!testStations || testStations.length === 0) {
      console.log('Test stations data is empty');
      return null;
    }

    // find the specific test station by the PNumber used on the test result
    const thisTestStation = testStations.filter((x) => x.testStationPNumber === testStationPNumber);

    if (thisTestStation && thisTestStation.length > 0) {
      return thisTestStation[0].testStationPostcode;
    }
    console.log(
      `Test station details could not be found for ${testStationPNumber}`,
    );
    return null;
  }

  /** Call SMC postcode lookup with test station postcode
   * @param postcode
   * @returns boolean true if Welsh
   */
  public async lookupPostcode(postcode: string): Promise<boolean> {
    const axiosInstance = await axiosClient(7000);

    if (!axiosInstance) {
      console.log(`SMC Postcode lookup details not found. Return value for isWelsh for ${postcode} is false`);
      return false;
    }

    let isWelsh: boolean = false;
    let retries = 0;
    while (retries < 3) {
      try {
        // eslint-disable-next-line
        const addressResponse = await axiosInstance.get("/" + postcode);

        if (typeof addressResponse.data.isWelshAddress !== 'boolean') {
          throw new HTTPError(400, `${ERRORS.ADDRESS_BOOLEAN_DOES_NOT_EXIST} ${JSON.stringify(addressResponse)}.`);
        }
        isWelsh = addressResponse.data.isWelshAddress;
        console.log(`Return value for isWelsh for ${postcode} is ${isWelsh}`);
        return isWelsh;
      } catch (error) {
        retries++;
        console.log(`Error looking up postcode ${postcode} on attempt ${retries}`);
        console.log(error);
      }
    }
    return false;
  }

  /**
   * Retrieves a signature from the cvs-signature S3 bucket
   * @param staffId - staff ID of the signature you want to retrieve
   * @returns the signature as a base64 encoded string
   */
  public async getSignature(staffId: string): Promise<string | null> {
    return this.s3Client
      .download(`cvs-signature-${process.env.BUCKET}`, `${staffId}.base64`)
      .then((result: GetObjectCommandOutput) => result.Body!.transformToString())
      .catch((error: ServiceException) => {
        console.error(
          `Unable to fetch signature for staff id ${staffId}. ${error.message}`,
        );
        return null;
      });
  }

  /**
   * Generates the payload for the MOT certificate generation service
   * @param testResult - source test result for certificate generation
   * @param isWelsh - the boolean value whether the atf where test was conducted resides in Wales
   */
  public async generatePayload(testResult: any, isWelsh: boolean = false) {
    let name = testResult.testerName;

    const nameArrayList: string[] = name.split(',');

    if (nameArrayList.length === 2) {
      name = name.split(', ').reverse().join(' ');
      testResult.testerName = name;
    }

    const signature: string | null = await this.getSignature(
      testResult.createdById ?? testResult.testerStaffId,
    );

    let makeAndModel: any = null;
    if (
      !this.testService.isRoadworthinessTestType(
        testResult.testTypes.testTypeId,
      )
    ) {
      makeAndModel = await this.techRecordsService.getVehicleMakeAndModel(testResult);
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

    const {
      testTypes, vehicleType, systemNumber, testHistory,
    } = testResult;

    if (testHistory) {
      // eslint-disable-next-line
      for (const history of testHistory) {
        // eslint-disable-next-line
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

    if (this.testService.isHgvTrlRoadworthinessCertificate(testResult)) {
      // CVSB-7677 for roadworthiness test for hgv or trl.
      const rwtData = await this.certificatePayloadGenerator.generateCertificateData(
        testResult,
        CERTIFICATE_DATA.RWT_DATA,
      );
      payload.RWT_DATA = { ...rwtData };
    } else if (
      testResult.testTypes.testResult === TEST_RESULTS.PASS
      && this.testService.isTestTypeAdr(testResult.testTypes)
    ) {
      const adrData = await this.certificatePayloadGenerator.generateCertificateData(
        testResult,
        CERTIFICATE_DATA.ADR_DATA,
      );
      payload.ADR_DATA = { ...adrData, ...makeAndModel };
    } else if (
      testResult.testTypes.testResult === TEST_RESULTS.FAIL
      && this.testService.isIvaTest(testResult.testTypes.testTypeId)
    ) {
      const ivaData = await this.certificatePayloadGenerator.generateCertificateData(
        testResult,
        CERTIFICATE_DATA.IVA_DATA,
      );
      payload.IVA_DATA = { ...ivaData };
    } else if (
      testResult.testTypes.testResult === TEST_RESULTS.FAIL
      && this.testService.isMsvaTest(testResult.testTypes.testTypeId)
    ) {
      const msvaData = await this.certificatePayloadGenerator.generateCertificateData(
        testResult,
        CERTIFICATE_DATA.MSVA_DATA,
      );
      payload.MSVA_DATA = { ...msvaData };
    } else {
      const odometerHistory = vehicleType === VEHICLE_TYPES.TRL
        ? undefined
        : await this.testResultRepository.getOdometerHistory(systemNumber);
      const TrnObj = this.testService.isValidForTrn(vehicleType, makeAndModel)
        ? await this.trailerRepository.getTrailerRegistrationObject(
          testResult.vin,
          makeAndModel.Make,
        )
        : undefined;
      if (testTypes.testResult !== TEST_RESULTS.FAIL) {
        const passData = await this.certificatePayloadGenerator.generateCertificateData(
          testResult,
          CERTIFICATE_DATA.PASS_DATA,
          isWelsh,
        );
        payload.DATA = {
          ...passData,
          ...makeAndModel,
          ...odometerHistory,
          ...TrnObj,
        };
      }
      if (testTypes.testResult !== TEST_RESULTS.PASS) {
        const failData = await this.certificatePayloadGenerator.generateCertificateData(
          testResult,
          CERTIFICATE_DATA.FAIL_DATA,
          isWelsh,
        );
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
}

export { CertificateGenerationService, IGeneratedCertificateResponse };
