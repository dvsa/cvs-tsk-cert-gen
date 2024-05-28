import { Service } from 'typedi';
import { InvocationRequest } from '@aws-sdk/client-lambda';
import moment from 'moment';
import { toUint8Array } from '@smithy/util-utf8';
import axiosClient from '../client/AxiosClient';
import { IGeneratedCertificateResponse } from '../models/IGeneratedCertificateResponse';
import { IInvokeConfig } from '../models/IInvokeConfig';
import { IMOTConfig } from '../models/IMOTConfig';
import {
  CERTIFICATE_DATA, ERRORS, TEST_RESULTS, VEHICLE_TYPES,
} from '../models/Enums';
import { HTTPError } from '../models/HTTPError';
import { Configuration } from '../utils/Configuration';
import { LambdaService } from './LambdaService';
import { ITestStation } from '../models/ITestStations';
import { TestService } from '../test-result/TestService';
import { TestStationRepository } from '../test-station/TestStationRepository';
import { CertificatePayloadGenerator } from './CertificatePayloadGenerator';
import { TranslationService } from './TranslationService';
import { ITestResult } from '../models/ITestResult';
import { CertificateTypes } from './CertificateTypes';

/**
 * Service class for Certificate Generation
 */
@Service()
class CertificateGenerationService {
  private readonly config: Configuration = Configuration.getInstance();

  constructor(
    private lambdaClient: LambdaService,
    private testStationRepository: TestStationRepository,
    private certificatePayloadGenerator: CertificatePayloadGenerator,
    private translationService: TranslationService,
    private testService: TestService,
    private certificateTypes: CertificateTypes,
  ) {
  }

  /**
   * Generates MOT certificate for a given test result
   * @param testResult - source test result for certificate generation
   */
  public async generateCertificate(testResult: ITestResult): Promise<IGeneratedCertificateResponse> {
    const config: IMOTConfig = this.config.getMOTConfig();
    const iConfig: IInvokeConfig = this.config.getInvokeConfig();
    const testType = testResult.testTypes;

    const shouldTranslateTestResult = await this.translationService.shouldTranslateTestResult(testResult) && await this.isTestStationWelsh(testResult.testStationPNumber);

    const payload = JSON.stringify(await this.generatePayload(testResult, shouldTranslateTestResult));

    const vehicleTestRes = this.getVehicleTestRes(testType, testResult, shouldTranslateTestResult);
    const certificateType = this.certificateTypes.getCertificateType(vehicleTestRes);

    const invokeParams: InvocationRequest = {
      FunctionName: iConfig.functions.certGen.name,
      InvocationType: 'RequestResponse',
      LogType: 'Tail',
      Payload: toUint8Array(JSON.stringify({
        httpMethod: 'POST',
        pathParameters: {
          documentName: certificateType,
          documentDirectory: config.documentDir,
        },
        json: true,
        body: payload,
      })),
    };

    try {
      const response = await this.lambdaClient.invoke(invokeParams);
      const documentPayload = this.lambdaClient.validateInvocationResponse(response);
      const responseBuffer: Buffer = Buffer.from(documentPayload.body, 'base64');

      return {
        vrm:
          testResult.vehicleType === VEHICLE_TYPES.TRL
            ? testResult.trailerId
            : testResult.vrm,
        testTypeName: testResult.testTypes.testTypeName,
        testTypeResult: testResult.testTypes.testResult,
        dateOfIssue: moment(testResult.testTypes.testTypeStartTimestamp).format('D MMMM YYYY'),
        certificateType: certificateType.split('.')[0],
        fileFormat: 'pdf',
        fileName: `${testResult.testTypes.testNumber}_${testResult.vin}.pdf`,
        fileSize: responseBuffer.byteLength.toString(),
        certificate: responseBuffer,
        certificateOrder: testResult.order,
        email: testResult.createdByEmailAddress ?? testResult.testerEmailAddress,
        shouldEmailCertificate: testResult.shouldEmailCertificate ?? 'true',
      };
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  private getVehicleTestRes(testType: any, testResult: ITestResult, shouldTranslateTestResult: boolean): string {
    if (this.testService.isRoadworthinessTestType(testType.testTypeId)) {
      // CVSB-7677 is road-worthiness test
      return 'rwt';
    }

    if (this.testService.isTestTypeAdr(testResult.testTypes)) {
      return 'adr_pass';
    }

    if (this.testService.isIvaTest(testResult.testTypes.testTypeId) && testType.testResult === TEST_RESULTS.FAIL) {
      return 'iva_fail';
    }

    if (this.testService.isMsvaTest(testResult.testTypes.testTypeId) && testType.testResult === TEST_RESULTS.FAIL) {
      return 'msva_fail';
    }

    if (this.testService.isWelshCertificateAvailable(testResult.vehicleType, testType.testResult) && shouldTranslateTestResult) {
      return `${testResult.vehicleType}_${testType.testResult}_bilingual`;
    }

    return `${testResult.vehicleType}_${testType.testResult}`;
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
  public getThisTestStation(testStations: ITestStation[], testStationPNumber: string) {
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

  private getTestType(testResult: any): CERTIFICATE_DATA {
    if (this.testService.isHgvTrlRoadworthinessCertificate(testResult)) {
      return CERTIFICATE_DATA.RWT_DATA;
    }

    if (testResult.testTypes.testResult === TEST_RESULTS.PASS && this.testService.isTestTypeAdr(testResult.testTypes)) {
      return CERTIFICATE_DATA.ADR_DATA;
    }

    if (testResult.testTypes.testResult === TEST_RESULTS.FAIL && this.testService.isIvaTest(testResult.testTypes.testTypeId)) {
      return CERTIFICATE_DATA.IVA_DATA;
    }

    if (testResult.testTypes.testResult === TEST_RESULTS.FAIL && this.testService.isMsvaTest(testResult.testTypes.testTypeId)) {
      return CERTIFICATE_DATA.MSVA_DATA;
    }

    if (testResult.testTypes.testResult !== TEST_RESULTS.PASS) {
      return CERTIFICATE_DATA.FAIL_DATA;
    }

    return CERTIFICATE_DATA.PASS_DATA;
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

    const testType = this.getTestType(testResult);
    const response = await this.certificatePayloadGenerator.generateCertificateData(testResult, testType, isWelsh);

    return JSON.parse(JSON.stringify(response));
  }
}

export { CertificateGenerationService, IGeneratedCertificateResponse };
