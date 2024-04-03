import { AWSError, config as AWSConfig, Lambda } from "aws-sdk";
import { InvocationRequest } from "@aws-sdk/client-lambda";
import S3 from "aws-sdk/clients/s3";
import moment from "moment";
import {
  ICertificatePayload,
  ICustomDefect,
  IGeneratedCertificateResponse,
  IInvokeConfig,
  IMakeAndModel,
  IMOTConfig,
  IRoadworthinessCertificateData,
  ITestResult,
  ITestType,
  ITrailerRegistration,
  IWeightDetails
} from "../models";
import {
  CERTIFICATE_DATA,
  ERRORS,
  HGV_TRL_ROADWORTHINESS_TEST_TYPES,
  IVA_30,
  LOCATION_ENGLISH,
  LOCATION_WELSH,
  TEST_RESULTS,
  VEHICLE_TYPES,
  WELSH_CERT_VEHICLES
} from "../models/Enums";
import { HTTPError } from "../models/HTTPError";
import { ISearchResult, TechRecordGet, TechRecordType } from "../models/Types";
import { Service } from "../models/injector/ServiceDecorator";
import { Configuration } from "../utils/Configuration";
import { LambdaService } from "./LambdaService";
import { S3BucketService } from "./S3BucketService";
import { ITestStation } from "../models/ITestStations";
import { IFlatDefect } from "../models/IFlatDefect";
import { IDefectParent } from "../models/IDefectParent";
import { IItem } from "../models/IItem";
import { IDefectChild } from "../models/IDefectChild";
import axiosClient from "../client/AxiosClient";
import { InvocationResponse } from "@aws-sdk/client-lambda";
import { toUint8Array } from "@aws-sdk/util-utf8";

/**
 * Service class for Certificate Generation
 */
@Service()
class CertificateGenerationService {
  private readonly s3Client: S3BucketService;
  private readonly config: Configuration;
  private readonly lambdaClient: LambdaService;


  constructor(s3Client: S3BucketService, lambdaClient: LambdaService) {
    this.s3Client = s3Client;
    this.config = Configuration.getInstance();
    this.lambdaClient = lambdaClient;

    AWSConfig.lambda = this.config.getInvokeConfig().params;
  }

  /**
   * Generates MOT certificate for a given test result
   * @param testResult - source test result for certificate generation
   */
  public async generateCertificate(
    testResult: any
  ): Promise<IGeneratedCertificateResponse> {
    const config: IMOTConfig = this.config.getMOTConfig();
    const iConfig: IInvokeConfig = this.config.getInvokeConfig();
    const testType: any = testResult.testTypes;
    const { STOP_WELSH_GEN } = process.env;

    let isTestStationWelsh = false;

    // Circumvent bilingual certificate generation and logic if EV set to TRUE
    if (STOP_WELSH_GEN === undefined || STOP_WELSH_GEN.toUpperCase() === "FALSE") {
      // Find out if Welsh certificate is needed
      const testStations = await this.getTestStations();
      const testStationPostcode = this.getThisTestStation(testStations, testResult.testStationPNumber);
      isTestStationWelsh = testStationPostcode ? await this.lookupPostcode(testStationPostcode) : false;
    } else {
      console.log(`Welsh certificate generation deactivated via environment variable set to ${STOP_WELSH_GEN}`);
    }
    const payload: string = JSON.stringify(
      await this.generatePayload(testResult, isTestStationWelsh)
    );

    const certificateTypes: any = {
      psv_pass: config.documentNames.vtp20,
      psv_pass_bilingual: config.documentNames.vtp20_bilingual,
      psv_fail: config.documentNames.vtp30,
      psv_prs: config.documentNames.psv_prs,
      hgv_pass: config.documentNames.vtg5,
      hgv_pass_bilingual: config.documentNames.vtg5_bilingual,
      hgv_fail: config.documentNames.vtg30,
      hgv_prs: config.documentNames.hgv_prs,
      trl_pass: config.documentNames.vtg5a,
      trl_pass_bilingual: config.documentNames.vtg5a_bilingual,
      trl_fail: config.documentNames.vtg30,
      trl_prs: config.documentNames.trl_prs,
      rwt: config.documentNames.rwt,
      adr_pass: config.documentNames.adr_pass,
      iva_fail: config.documentNames.iva_fail,
      msva_fail: config.documentNames.msva_fail,
    };

    let vehicleTestRes: string;
    if (
      CertificateGenerationService.isRoadworthinessTestType(testType.testTypeId)
    ) {
      // CVSB-7677 is road-worthiness test
      vehicleTestRes = "rwt";
    } else if (this.isTestTypeAdr(testResult.testTypes)) {
      vehicleTestRes = "adr_pass";
    } else if (this.isIvaTest(testResult.testTypes.testTypeId) && testType.testResult === "fail") {
      vehicleTestRes = "iva_fail";
    } else if (this.isMsvaTest(testResult.testTypes.testTypeId) && testType.testResult === "fail") {
      vehicleTestRes = "msva_fail";
    } else if (WELSH_CERT_VEHICLES.TYPES.includes(testResult.vehicleType) && testType.testResult === "pass" && isTestStationWelsh) {
      vehicleTestRes = testResult.vehicleType + "_" + testType.testResult + "_bilingual";
    } else {
      vehicleTestRes = testResult.vehicleType + "_" + testType.testResult;
    }

    const invokeParams: InvocationRequest = {
      FunctionName: iConfig.functions.certGen.name,
      InvocationType: "RequestResponse",
      LogType: "Tail",
      Payload: toUint8Array(JSON.stringify({
        httpMethod: "POST",
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
          const responseBuffer: Buffer = Buffer.from(resBody, "base64");
          return {
            vrm:
              testResult.vehicleType === VEHICLE_TYPES.TRL
                ? testResult.trailerId
                : testResult.vrm,
            testTypeName: testResult.testTypes.testTypeName,
            testTypeResult: testResult.testTypes.testResult,
            dateOfIssue: moment(
              testResult.testTypes.testTypeStartTimestamp
            ).format("D MMMM YYYY"),
            certificateType: certificateTypes[vehicleTestRes].split(".")[0],
            fileFormat: "pdf",
            fileName: `${testResult.testTypes.testNumber}_${testResult.vin}.pdf`,
            fileSize: responseBuffer.byteLength.toString(),
            certificate: responseBuffer,
            certificateOrder: testResult.order,
            email:
              testResult.createdByEmailAddress ?? testResult.testerEmailAddress,
            shouldEmailCertificate: testResult.shouldEmailCertificate ?? "true",
          };
        }
      )
      .catch((error: AWSError | Error) => {
        console.log(error);
        throw error;
      });
  }

  /**
   * Method to retrieve Test Station details from API
   * @returns list of test stations
   */
  public async getTestStations(): Promise<ITestStation[]> {
    const config: IInvokeConfig = this.config.getInvokeConfig();
    const invokeParams: InvocationRequest = {
      FunctionName: config.functions.testStations.name,
      InvocationType: "RequestResponse",
      LogType: "Tail",
      Payload: toUint8Array(JSON.stringify({
        httpMethod: "GET",
        path: `/test-stations/`,
      })),
    };
    let testStations: ITestStation[] = [];
    let retries = 0;

    while (retries < 3) {
      try {
        const response: InvocationResponse = await this.lambdaClient.invoke(invokeParams);
        const payload: any = this.lambdaClient.validateInvocationResponse(response);
        const testStationsParsed = JSON.parse(payload.body);

        if (!testStationsParsed || testStationsParsed.length === 0) {
          throw new HTTPError(400, `${ERRORS.LAMBDA_INVOCATION_BAD_DATA} ${JSON.stringify(payload)}.`
          );
        }
        testStations = testStationsParsed;
        return testStations;
      } catch (error) {
        retries++;
        console.error(`There was an error retrieving the test stations on attempt ${retries}: ${error}`);
      }
    }
    return testStations;
  }

  /**
   * Find the details of the test station used on the test result
   * @param testStations list of all test stations
   * @param testStationPNumber pNumber from the test result
   * @returns string postcode of the pNumber test station
   */
  public getThisTestStation(
    testStations: ITestStation[],
    testStationPNumber: string
  ) {
    if (!testStations || testStations.length === 0) {
      console.log(`Test stations data is empty`);
      return null;
    }

    // find the specific test station by the PNumber used on the test result
    const thisTestStation = testStations.filter((x) => {
      return x.testStationPNumber === testStationPNumber;
    });

    if (thisTestStation && thisTestStation.length > 0) {
      return thisTestStation[0].testStationPostcode;
    } else {
      console.log(
        `Test station details could not be found for ${testStationPNumber}`
      );
      return null;
    }
  }

  /** Call SMC postcode lookup with test station postcode
   * @param postcode
   * @returns boolean true if Welsh
   */
  public async lookupPostcode(postcode: string): Promise<boolean> {
    const axiosInstance = await axiosClient();

    if (axiosInstance) {
      let isWelsh: boolean = false;
      let retries = 0;
      while (retries < 3) {
        try {
          const addressResponse = await axiosInstance.get("/" + postcode);

          if (typeof addressResponse.data.isWelshAddress !== "boolean") {
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
    } else {
      console.log(`SMC Postcode lookup details not found. Return value for isWelsh for ${postcode} is false`);
      return false;
    }
  }

  /**
   * Retrieves a signature from the cvs-signature S3 bucket
   * @param staffId - staff ID of the signature you want to retrieve
   * @returns the signature as a base64 encoded string
   */
  public async getSignature(staffId: string): Promise<string | null> {
    return this.s3Client
      .download(`cvs-signature-${process.env.BUCKET}`, `${staffId}.base64`)
      .then((result: S3.Types.GetObjectOutput) => {
        return result.Body!.toString();
      })
      .catch((error: AWSError) => {
        console.error(
          `Unable to fetch signature for staff id ${staffId}. ${error.message}`
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

    const nameArrayList: string[] = name.split(",");

    if (nameArrayList.length === 2) {
      name = name.split(", ").reverse().join(" ");
      testResult.testerName = name;
    }

    const signature: string | null = await this.getSignature(
      testResult.createdById ?? testResult.testerStaffId
    );

    let makeAndModel: any = null;
    if (
      !CertificateGenerationService.isRoadworthinessTestType(
        testResult.testTypes.testTypeId
      )
    ) {
      makeAndModel = await this.getVehicleMakeAndModel(testResult);
    }

    let payload: ICertificatePayload = {
      Watermark: process.env.BRANCH === "prod" ? "" : "NOT VALID",
      DATA: undefined,
      FAIL_DATA: undefined,
      RWT_DATA: undefined,
      ADR_DATA: undefined,
      IVA_DATA: undefined,
      MSVA_DATA: undefined,
      Signature: {
        ImageType: "png",
        ImageData: signature,
      },
    };

    const { testTypes, vehicleType, systemNumber, testHistory } = testResult;

    if (testHistory) {
      for (const history of testHistory) {
        for (const testType of history.testTypes) {
          if (testType.testCode === testTypes.testCode) {
            payload.Reissue = {
              Reason: "Replacement",
              Issuer: testResult.createdByName,
              Date: moment(testResult.createdAt).format("DD.MM.YYYY"),
            };
            break;
          }
        }
      }
    }

    if (
      CertificateGenerationService.isHgvTrlRoadworthinessCertificate(testResult)
    ) {
      // CVSB-7677 for roadworthiness test for hgv or trl.
      const rwtData = await this.generateCertificateData(
        testResult,
        CERTIFICATE_DATA.RWT_DATA
      );
      payload.RWT_DATA = { ...rwtData };
    } else if (
      testResult.testTypes.testResult === TEST_RESULTS.PASS &&
      this.isTestTypeAdr(testResult.testTypes)
    ) {
      const adrData = await this.generateCertificateData(
        testResult,
        CERTIFICATE_DATA.ADR_DATA
      );
      payload.ADR_DATA = { ...adrData, ...makeAndModel };
    } else if (
      testResult.testTypes.testResult === TEST_RESULTS.FAIL &&
      this.isIvaTest(testResult.testTypes.testTypeId)
    ) {
      const ivaData = await this.generateCertificateData(
        testResult,
        CERTIFICATE_DATA.IVA_DATA
      );
      payload.IVA_DATA = { ...ivaData };
    } else if (
      testResult.testTypes.testResult === TEST_RESULTS.FAIL &&
      this.isMsvaTest(testResult.testTypes.testTypeId)
    ) {
      const msvaData = await this.generateCertificateData(
        testResult,
        CERTIFICATE_DATA.MSVA_DATA
      );
      payload.MSVA_DATA = { ...msvaData };
    } else {
      const odometerHistory =
        vehicleType === VEHICLE_TYPES.TRL
          ? undefined
          : await this.getOdometerHistory(systemNumber);
      const TrnObj = this.isValidForTrn(vehicleType, makeAndModel)
        ? await this.getTrailerRegistrationObject(
          testResult.vin,
          makeAndModel.Make
        )
        : undefined;
      if (testTypes.testResult !== TEST_RESULTS.FAIL) {
        const passData = await this.generateCertificateData(
          testResult,
          CERTIFICATE_DATA.PASS_DATA,
          isWelsh
        );
        payload.DATA = {
          ...passData,
          ...makeAndModel,
          ...odometerHistory,
          ...TrnObj,
        };
      }
      if (testTypes.testResult !== TEST_RESULTS.PASS) {
        const failData = await this.generateCertificateData(
          testResult,
          CERTIFICATE_DATA.FAIL_DATA
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

  /**
   * Generates certificate data for a given test result and certificate type
   * @param testResult - the source test result for certificate generation
   * @param type - the certificate type
   * @param isWelsh - the boolean value whether the atf where test was conducted resides in Wales
   */
  public async generateCertificateData(testResult: ITestResult, type: string, isWelsh: boolean = false) {
    let defectListFromApi: IDefectParent[] = [];
    let flattenedDefects: IFlatDefect[] = [];
    if (isWelsh) {
      defectListFromApi = await this.getDefectTranslations();
      flattenedDefects = this.flattenDefectsFromApi(defectListFromApi);
    }
    const testType: any = testResult.testTypes;
    switch (type) {
      case CERTIFICATE_DATA.PASS_DATA:
      case CERTIFICATE_DATA.FAIL_DATA:
        const defects: any = await this.generateDefects(testResult.testTypes, type, testResult.vehicleType, flattenedDefects, isWelsh);
        return {
          TestNumber: testType.testNumber,
          TestStationPNumber: testResult.testStationPNumber,
          TestStationName: testResult.testStationName,
          CurrentOdometer: {
            value: testResult.odometerReading,
            unit: testResult.odometerReadingUnits,
          },
          IssuersName: testResult.testerName,
          DateOfTheTest: moment(testResult.testEndTimestamp).format(
            "DD.MM.YYYY"
          ),
          CountryOfRegistrationCode: testResult.countryOfRegistration,
          VehicleEuClassification: testResult.euVehicleCategory.toUpperCase(),
          RawVIN: testResult.vin,
          RawVRM:
            testResult.vehicleType === VEHICLE_TYPES.TRL
              ? testResult.trailerId
              : testResult.vrm,
          ExpiryDate: testType.testExpiryDate
            ? moment(testType.testExpiryDate).format("DD.MM.YYYY")
            : undefined,
          EarliestDateOfTheNextTest:
            (testResult.vehicleType === VEHICLE_TYPES.HGV ||
              testResult.vehicleType === VEHICLE_TYPES.TRL) &&
              (testResult.testTypes.testResult === TEST_RESULTS.PASS ||
                testResult.testTypes.testResult === TEST_RESULTS.PRS)
              ? moment(testType.testAnniversaryDate)
                .subtract(1, "months")
                .startOf("month")
                .format("DD.MM.YYYY")
              : moment(testType.testAnniversaryDate).format("DD.MM.YYYY"),
          SeatBeltTested: testType.seatbeltInstallationCheckDate ? "Yes" : "No",
          SeatBeltPreviousCheckDate: testType.lastSeatbeltInstallationCheckDate
            ? moment(testType.lastSeatbeltInstallationCheckDate).format(
              "DD.MM.YYYY"
            )
            : "\u00A0",
          SeatBeltNumber: testType.numberOfSeatbeltsFitted,
          ...defects,
        };
      case CERTIFICATE_DATA.RWT_DATA:
        const weightDetails = await this.getWeightDetails(testResult);
        let defectRWTList: any;
        if (testResult.testTypes.testResult === TEST_RESULTS.FAIL) {
          defectRWTList = [];
          testResult.testTypes.defects.forEach((defect: any) => {
            defectRWTList.push(this.formatDefect(defect));
          });
        } else {
          defectRWTList = undefined;
        }

        const resultPass: IRoadworthinessCertificateData = {
          Dgvw: weightDetails.dgvw,
          Weight2: weightDetails.weight2,
          VehicleNumber:
            testResult.vehicleType === VEHICLE_TYPES.TRL
              ? testResult.trailerId
              : testResult.vrm,
          Vin: testResult.vin,
          IssuersName: testResult.testerName,
          DateOfInspection: moment(testType.testTypeStartTimestamp).format(
            "DD.MM.YYYY"
          ),
          TestStationPNumber: testResult.testStationPNumber,
          DocumentNumber: testType.certificateNumber,
          Date: moment(testType.testTypeStartTimestamp).format("DD.MM.YYYY"),
          Defects: defectRWTList,
          IsTrailer: testResult.vehicleType === VEHICLE_TYPES.TRL,
        };
        return resultPass;
      case CERTIFICATE_DATA.ADR_DATA:
        const adrDetails: TechRecordType<any> = await this.getAdrDetails(testResult);
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
          AtfNameAtfPNumber:
            testResult.testStationName + " " + testResult.testStationPNumber,
          Notes: testResult.testTypes.additionalNotesRecorded,
          TestTypeDate: testResult.testTypes.testTypeStartTimestamp,
        };
        console.log("CHECK HERE DOCGENPAYLOAD -> ", docGenPayloadAdr);
        return docGenPayloadAdr;
      case CERTIFICATE_DATA.IVA_DATA:
        const ivaFailDetailsForDocGen = {
          vin: testResult.vin,
          serialNumber: testResult.vehicleType === "trl" ? testResult.trailerId : testResult.vrm,
          vehicleTrailerNrNo: testResult.vehicleType === "trl" ? testResult.trailerId : testResult.vrm,
          testCategoryClass: testResult.euVehicleCategory,
          testCategoryBasicNormal: this.isBasicIvaTest(testResult.testTypes.testTypeId) ? IVA_30.BASIC : IVA_30.NORMAL,
          make: testResult.make,
          model: testResult.model,
          bodyType: testResult.bodyType?.description,
          date: moment(testResult.testTypes.testTypeStartTimestamp).format("DD/MM/YYYY"),
          testerName: testResult.testerName,
          reapplicationDate: this.calculateVehicleApprovalRetestDate(testResult.testTypes.testTypeStartTimestamp),
          station: testResult.testStationName,
          additionalDefects: this.formatVehicleApprovalAdditionalDefects(testResult.testTypes.customDefects),
          requiredStandards: testResult.testTypes.requiredStandards
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
          date: moment(testResult.testTypes.testTypeStartTimestamp).format("DD/MM/YYYY"),
          retestDate: this.calculateVehicleApprovalRetestDate(testResult.testTypes.testTypeStartTimestamp),
          station: testResult.testStationName,
          additionalDefects: this.formatVehicleApprovalAdditionalDefects(testResult.testTypes.customDefects),
          requiredStandards: testResult.testTypes.requiredStandards
        };
        return msvaFailDetailsForDocGen;
    }
  }

  /**
   * Formats the additional defects for IVA and MSVA test based on whether custom defects is populated
   * @param customDefects - the custom defects for the test
   */
  public formatVehicleApprovalAdditionalDefects = (customDefects: ICustomDefect[] | undefined): ICustomDefect[] | undefined => {
    const defaultCustomDefect: ICustomDefect = {
      defectName: IVA_30.EMPTY_CUSTOM_DEFECTS,
      defectNotes: ""
    };
    return (customDefects && customDefects.length > 0) ? customDefects : [defaultCustomDefect];
  }

  /**
   * Calculates the retest date for an IVA or MSVA test
   * @param testTypeStartTimestamp - the test start timestamp of the test
   */
  public calculateVehicleApprovalRetestDate = (testTypeStartTimestamp: string): string => {
    return moment(testTypeStartTimestamp)
      .add(6, "months")
      .subtract(1, "day")
      .format("DD/MM/YYYY");
  }

  /**
   * Returns a boolean value indicating whether the test type is a basic IVA test
   * @param testTypeId - the test type ID on the test result
   */
  public isBasicIvaTest = (testTypeId: string): boolean => {
    const basicIvaTests: string[] = [
      "125",
      "129",
      "154",
      "158",
      "159",
      "185"
    ];
    return basicIvaTests.includes(testTypeId);
  }

  /**
   * Retrieves the adrDetails from a techRecord searched by vin
   * @param testResult - testResult from which the VIN is used to search a tech-record
   */
  public getAdrDetails = async (testResult: any) => {
    const searchRes = await this.callSearchTechRecords(testResult.systemNumber);
    return await this.processGetCurrentProvisionalRecords(searchRes) as TechRecordType<"hgv" | "trl">;
  }


  public processGetCurrentProvisionalRecords = async <T extends TechRecordGet["techRecord_vehicleType"]>(searchResult: ISearchResult[]): Promise<TechRecordType<T> | undefined> => {
    if (searchResult) {
      const processRecordsRes = this.groupRecordsByStatusCode(searchResult);
      return processRecordsRes.currentCount !== 0
        ? this.callGetTechRecords(processRecordsRes.currentRecords[0].systemNumber,
          processRecordsRes.currentRecords[0].createdTimestamp)
        : processRecordsRes.provisionalCount === 1
          ? this.callGetTechRecords(processRecordsRes.provisionalRecords[0].systemNumber,
            processRecordsRes.provisionalRecords[0].createdTimestamp)
          : this.callGetTechRecords(processRecordsRes.provisionalRecords[1].systemNumber,
            processRecordsRes.provisionalRecords[1].createdTimestamp);
    } else {
      await Promise.reject("Tech record Search returned nothing.");
    }
  }

  /**
   * helper function is used to process records and count provisional and current records
   * @param records
   */
  public groupRecordsByStatusCode = (records: ISearchResult[]
  ): { currentRecords: ISearchResult[]; provisionalRecords: ISearchResult[]; currentCount: number; provisionalCount: number; } => {
    const currentRecords: ISearchResult[] = [];
    const provisionalRecords: ISearchResult[] = [];
    records.forEach((record) => {
      if (record.techRecord_statusCode === "current") {
        currentRecords.push(record);
      } else if (record.techRecord_statusCode === "provisional") {
        provisionalRecords.push(record);
      }
    });

    return {
      currentRecords,
      provisionalRecords,
      currentCount: currentRecords.length,
      provisionalCount: provisionalRecords.length
    };
  }
  /**
   * Retrieves the vehicle weight details for Roadworthisness certificates
   * @param testResult
   */
  public async getWeightDetails(testResult: any) {
    const searchRes = await this.callSearchTechRecords(testResult.systemNumber);
    const techRecord = await this.processGetCurrentProvisionalRecords(searchRes) as TechRecordType<"hgv" | "psv" | "trl">;
    if (techRecord) {
      const weightDetails: IWeightDetails = {
        dgvw: techRecord.techRecord_grossDesignWeight ?? 0,
        weight2: 0,
      };
      if (testResult.vehicleType === VEHICLE_TYPES.HGV) {
        weightDetails.weight2 = (techRecord as TechRecordType<"hgv">).techRecord_trainDesignWeight ?? 0;
      } else {
        if (
          (techRecord.techRecord_noOfAxles ?? -1) > 0
        ) {
          const initialValue: number = 0;
          weightDetails.weight2 = (techRecord.techRecord_axles as any).reduce(
            (
              accumulator: number,
              currentValue: { weights_designWeight: number }
            ) => accumulator + currentValue.weights_designWeight,
            initialValue
          );
        } else {
          throw new HTTPError(
            500,
            "No axle weights for Roadworthiness test certificates!"
          );
        }
      }
      return weightDetails;
    } else {
      console.log("No techRecord found for weight details");
      throw new HTTPError(
        500,
        "No vehicle found for Roadworthiness test certificate!"
      );
    }
  }

  /**
   * Retrieves the odometer history for a given VIN from the Test Results microservice
   * @param systemNumber - systemNumber for which to retrieve odometer history
   */
  public async getOdometerHistory(systemNumber: string) {
    const config: IInvokeConfig = this.config.getInvokeConfig();
    const invokeParams: InvocationRequest = {
      FunctionName: config.functions.testResults.name,
      InvocationType: "RequestResponse",
      LogType: "Tail",
      Payload: toUint8Array(JSON.stringify({
        httpMethod: "GET",
        path: `/test-results/${systemNumber}`,
        pathParameters: {
          systemNumber,
        },
      })),
    };

    return this.lambdaClient
      .invoke(invokeParams)
      .then(
        (
          response: InvocationResponse
        ) => {
          const payload: any =
            this.lambdaClient.validateInvocationResponse(response);
          // TODO: convert to correct type
          const testResults: any[] = JSON.parse(payload.body);

          if (!testResults || testResults.length === 0) {
            throw new HTTPError(
              400,
              `${ERRORS.LAMBDA_INVOCATION_BAD_DATA} ${JSON.stringify(payload)}.`
            );
          }
          // Sort results by testEndTimestamp
          testResults.sort((first: any, second: any): number => {
            if (
              moment(first.testEndTimestamp).isBefore(second.testEndTimestamp)
            ) {
              return 1;
            }

            if (
              moment(first.testEndTimestamp).isAfter(second.testEndTimestamp)
            ) {
              return -1;
            }

            return 0;
          });

          // Remove the first result as it should be the current one.
          testResults.shift();

          // Set the array to only submitted tests (exclude cancelled)
          const submittedTests = testResults.filter((testResult) => {
            return testResult.testStatus === "submitted";
          });

          const filteredTestResults = submittedTests
            .filter(({ testTypes }) =>
              testTypes?.some(
                (testType: ITestType) =>
                  testType.testTypeClassification ===
                  "Annual With Certificate" &&
                  (testType.testResult === "pass" ||
                    testType.testResult === "prs")
              )
            )
            .slice(0, 3); // Only last three entries are used for the history.

          return {
            OdometerHistoryList: filteredTestResults.map((testResult) => {
              return {
                value: testResult.odometerReading,
                unit: testResult.odometerReadingUnits,
                date: moment(testResult.testEndTimestamp).format("DD.MM.YYYY"),
              };
            }),
          };
        }
      )
      .catch((error: AWSError | Error) => {
        console.log(error);
      });
  }

  /**
   * Method for getting make and model based on the vehicle from a test-result
   * @param testResult - the testResult for which the tech record search is done for
   */
  public getVehicleMakeAndModel = async (testResult: any) => {
    const searchRes = await this.callSearchTechRecords(testResult.systemNumber);
    const techRecord = await this.processGetCurrentProvisionalRecords(searchRes);
    // Return bodyMake and bodyModel values for PSVs
    return techRecord?.techRecord_vehicleType === VEHICLE_TYPES.PSV ? {
      Make: (techRecord as TechRecordType<"psv">).techRecord_chassisMake,
      Model: (techRecord as TechRecordType<"psv">).techRecord_chassisModel
    } : {
      Make: (techRecord as TechRecordType<"hgv" | "trl">).techRecord_make,
      Model: (techRecord as TechRecordType<"hgv" | "trl">).techRecord_model
    };
  }

  /**
   * Used to return a subset of technical record information.
   * @param searchIdentifier
   */
  public callSearchTechRecords = async (searchIdentifier: string) => {
    const config: IInvokeConfig = this.config.getInvokeConfig();
    const invokeParams: InvocationRequest = {
      FunctionName: config.functions.techRecordsSearch.name,
      InvocationType: "RequestResponse",
      LogType: "Tail",
      Payload: toUint8Array(JSON.stringify({
        httpMethod: "GET",
        path: `/v3/technical-records/search/${searchIdentifier}?searchCriteria=systemNumber`,
        pathParameters: {
          searchIdentifier
        },
      })),
    };
    try {
      const lambdaResponse = await this.lambdaClient.invoke(invokeParams);
      const res = await this.lambdaClient.validateInvocationResponse(lambdaResponse);
      return JSON.parse(res.body);
    } catch (e) {
      console.log("Error searching technical records");
      console.log(JSON.stringify(e));
      return undefined;
    }
  }

  /**
   * Used to get a singular whole technical record.
   * @param systemNumber
   * @param createdTimestamp
   */
  public callGetTechRecords = async <T extends TechRecordGet["techRecord_vehicleType"]>(systemNumber: string, createdTimestamp: string): Promise<TechRecordType<T> | undefined> => {
    const config: IInvokeConfig = this.config.getInvokeConfig();
    const invokeParams: InvocationRequest = {
      FunctionName: config.functions.techRecords.name,
      InvocationType: "RequestResponse",
      LogType: "Tail",
      Payload: toUint8Array(JSON.stringify({
        httpMethod: "GET",
        path: `/v3/technical-records/${systemNumber}/${createdTimestamp}`,
        pathParameters: {
          systemNumber,
          createdTimestamp
        }
      })),
    };
    try {
      const lambdaResponse = await this.lambdaClient.invoke(invokeParams);
      const res = await this.lambdaClient.validateInvocationResponse(lambdaResponse);
      return JSON.parse(res.body);
    } catch (e) {
      console.log("Error in get technical record");
      console.log(JSON.stringify(e));
      return undefined;
    }
  }


  /**
   * To fetch trailer registration
   * @param vin The vin of the trailer
   * @param make The make of the trailer
   * @returns A payload containing the TRN of the trailer and a boolean.
   */
  public async getTrailerRegistrationObject(vin: string, make: string) {
    const config: IInvokeConfig = this.config.getInvokeConfig();
    const invokeParams: InvocationRequest = {
      FunctionName: config.functions.trailerRegistration.name,
      InvocationType: "RequestResponse",
      LogType: "Tail",
      Payload: toUint8Array(JSON.stringify({
        httpMethod: "GET",
        path: `/v1/trailers/${vin}`,
        pathParameters: {
          proxy: `/v1/trailers`,
        },
        queryStringParameters: {
          make,
        },
      })),
    };
    const response = await this.lambdaClient.invoke(invokeParams);
    try {
      if (!response.Payload || Buffer.from(response.Payload).toString() === "") {
        throw new HTTPError(
          500,
          `${ERRORS.LAMBDA_INVOCATION_ERROR} ${response.StatusCode} ${ERRORS.EMPTY_PAYLOAD}`
        );
      }
      const payload: any = JSON.parse(Buffer.from(response.Payload).toString());
      if (payload.statusCode === 404) {
        console.debug(`vinOrChassisWithMake not found ${vin + make}`);
        return { Trn: undefined, IsTrailer: true };
      }
      if (payload.statusCode >= 400) {
        throw new HTTPError(
          500,
          `${ERRORS.LAMBDA_INVOCATION_ERROR} ${payload.statusCode} ${payload.body}`
        );
      }
      const trailerRegistration = JSON.parse(
        payload.body
      ) as ITrailerRegistration;
      return { Trn: trailerRegistration.trn, IsTrailer: true };
    } catch (err) {
      console.error(
        `Error on fetching vinOrChassisWithMake ${vin + make}`,
        err
      );
      throw err;
    }
  }

  /**
   * To check if the testResult is valid for fetching Trn.
   * @param vehicleType the vehicle type
   * @param makeAndModel object containing Make and Model
   * @returns returns if the condition is satisfied else false
   */
  public isValidForTrn(
    vehicleType: string,
    makeAndModel: IMakeAndModel
  ): boolean {
    return makeAndModel && vehicleType === VEHICLE_TYPES.TRL;
  }

  /**
   * Method used to retrieve the Welsh translations for the certificates
   * @returns a list of defects
   */
  public async getDefectTranslations(): Promise<IDefectParent[]> {
    const config: IInvokeConfig = this.config.getInvokeConfig();
    const invokeParams: InvocationRequest = {
      FunctionName: config.functions.defects.name,
      InvocationType: "RequestResponse",
      LogType: "Tail",
      Payload: toUint8Array(JSON.stringify({
        httpMethod: "GET",
        path: `/defects/`,
      })),
    };
    let defects: IDefectParent[] = [];
    let retries = 0;
    while (retries < 3) {
      try {
        const response: InvocationResponse = await this.lambdaClient.invoke(invokeParams);
        const payload: any = this.lambdaClient.validateInvocationResponse(response);
        const defectsParsed = JSON.parse(payload.body);

        if (!defectsParsed || defectsParsed.length === 0) {
          throw new HTTPError(400, `${ERRORS.LAMBDA_INVOCATION_BAD_DATA} ${JSON.stringify(payload)}.`);
        }
        defects = defectsParsed;
        return defects;
      } catch (error) {
        retries++;
        console.error(`There was an error retrieving the welsh defect translations on attempt ${retries}: ${error}`);
      }
    }
    return defects;
  }

  /**
   * Generates an object containing defects for a given test type and certificate type
   * @param testTypes - the source test type for defect generation
   * @param type - the certificate type
   * @param vehicleType - the vehicle type from the test result
   * @param flattenedDefects - the list of flattened defects after being retrieved from the defect service
   * @param isWelsh - determines whether the atf in which the test result was conducted resides in Wales
   */
  private generateDefects(testTypes: any, type: string, vehicleType: string, flattenedDefects: IFlatDefect[], isWelsh: boolean = false) {
    const rawDefects: any = testTypes.defects;
    const defects: any = {
      DangerousDefects: [],
      MajorDefects: [],
      PRSDefects: [],
      MinorDefects: [],
      AdvisoryDefects: [],
      MinorDefectsWelsh: [],
      AdvisoryDefectsWelsh: [],
    };

    rawDefects.forEach((defect: any) => {
      switch (defect.deficiencyCategory.toLowerCase()) {
        case "dangerous":
          if (
            (testTypes.testResult === TEST_RESULTS.PRS || defect.prs) &&
            type === CERTIFICATE_DATA.FAIL_DATA
          ) {
            defects.PRSDefects.push(this.formatDefect(defect));
          } else if (testTypes.testResult === "fail") {
            defects.DangerousDefects.push(this.formatDefect(defect));
          }
          break;
        case "major":
          if (
            (testTypes.testResult === TEST_RESULTS.PRS || defect.prs) &&
            type === CERTIFICATE_DATA.FAIL_DATA
          ) {
            defects.PRSDefects.push(this.formatDefect(defect));
          } else if (testTypes.testResult === "fail") {
            defects.MajorDefects.push(this.formatDefect(defect));
          }
          break;
        case "minor":
          defects.MinorDefects.push(this.formatDefect(defect));
          if (testTypes.testResult === TEST_RESULTS.PASS && isWelsh && WELSH_CERT_VEHICLES.TYPES.includes(vehicleType)) {
            defects.MinorDefectsWelsh.push(
              this.formatDefectWelsh(defect, vehicleType, flattenedDefects)
            );
          }
          break;
        case "advisory":
          defects.AdvisoryDefects.push(this.formatDefect(defect));
          if (testTypes.testResult === TEST_RESULTS.PASS && isWelsh && WELSH_CERT_VEHICLES.TYPES.includes(vehicleType)) {
            defects.AdvisoryDefectsWelsh.push(this.formatDefect(defect));
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
   * Returns a formatted string containing data about a given defect
   * @param defect - defect for which to generate the formatted string
   */
  private formatDefect(defect: any) {
    const toUpperFirstLetter: any = (word: string) =>
      word.charAt(0).toUpperCase() + word.slice(1);

    let defectString = `${defect.deficiencyRef} ${defect.itemDescription}`;

    if (defect.deficiencyText) {
      defectString += ` ${defect.deficiencyText}`;
    }

    if (defect.additionalInformation.location) {
      Object.keys(defect.additionalInformation.location).forEach(
        (location: string, index: number, array: string[]) => {
          if (defect.additionalInformation.location[location]) {
            switch (location) {
              case "rowNumber":
                defectString += ` Rows: ${defect.additionalInformation.location.rowNumber}.`;
                break;
              case "seatNumber":
                defectString += ` Seats: ${defect.additionalInformation.location.seatNumber}.`;
                break;
              case "axleNumber":
                defectString += ` Axles: ${defect.additionalInformation.location.axleNumber}.`;
                break;
              default:
                defectString += ` ${toUpperFirstLetter(
                  defect.additionalInformation.location[location]
                )}`;
                break;
            }
          }

          if (index === array.length - 1) {
            defectString += `.`;
          }
        }
      );
    }

    if (defect.additionalInformation.notes) {
      defectString += ` ${defect.additionalInformation.notes}`;
    }

    return defectString;
  }

  /**
   * Returns a formatted welsh string containing data about a given defect
   * @param defect - the defect for which to generate the formatted welsh string
   * @param vehicleType - the vehicle type from the test result
   * @param flattenedDefects - the list of flattened defects
   */
  public formatDefectWelsh(
    defect: any,
    vehicleType: any,
    flattenedDefects: IFlatDefect[]
  ) {
    const toUpperFirstLetter: any = (word: string) =>
      word.charAt(0).toUpperCase() + word.slice(1);

    const filteredFlatDefects: IFlatDefect[] = flattenedDefects.filter(
      (x: IFlatDefect) => defect.deficiencyRef === x.ref
    );

    const filteredFlatDefect: IFlatDefect | null = this.filterFlatDefects(
      filteredFlatDefects,
      vehicleType
    );

    if (filteredFlatDefect !== null) {
      let defectString = `${defect.deficiencyRef} ${filteredFlatDefect.itemDescriptionWelsh}`;

      if (defect.deficiencyText) {
        defectString += ` ${filteredFlatDefect.deficiencyTextWelsh}`;
      }

      if (defect.additionalInformation.location) {
        Object.keys(defect.additionalInformation.location).forEach(
          (location: string, index: number, array: string[]) => {
            if (defect.additionalInformation.location[location]) {
              switch (location) {
                case "rowNumber":
                  defectString += ` ${LOCATION_WELSH.ROW_NUMBER}: ${defect.additionalInformation.location.rowNumber}.`;
                  break;
                case "seatNumber":
                  defectString += ` ${LOCATION_WELSH.SEAT_NUMBER}: ${defect.additionalInformation.location.seatNumber}.`;
                  break;
                case "axleNumber":
                  defectString += ` ${LOCATION_WELSH.AXLE_NUMBER}: ${defect.additionalInformation.location.axleNumber}.`;
                  break;
                default:
                  const welshLocation = this.convertLocationWelsh(
                    defect.additionalInformation.location[location]
                  );
                  defectString += ` ${toUpperFirstLetter(welshLocation)}`;
                  break;
              }
            }

            if (index === array.length - 1) {
              defectString += `.`;
            }
          }
        );
      }

      if (defect.additionalInformation.notes) {
        defectString += ` ${defect.additionalInformation.notes}`;
      }
      console.log(`Welsh Defect String Generated: ${defectString}`);
      return defectString;
    } else {
      console.log(`ERROR: Unable to find a filtered defect`);
      return null;
    }
  }

  /**
   * Returns welsh version of location
   * @param locationToTranslate
   */
  public convertLocationWelsh(locationToTranslate: string) {
    switch (locationToTranslate) {
      case LOCATION_ENGLISH.FRONT:
        return LOCATION_WELSH.FRONT;
      case LOCATION_ENGLISH.REAR:
        return LOCATION_WELSH.REAR;
      case LOCATION_ENGLISH.UPPER:
        return LOCATION_WELSH.UPPER;
      case LOCATION_ENGLISH.LOWER:
        return LOCATION_WELSH.LOWER;
      case LOCATION_ENGLISH.NEARSIDE:
        return LOCATION_WELSH.NEARSIDE;
      case LOCATION_ENGLISH.OFFSIDE:
        return LOCATION_WELSH.OFFSIDE;
      case LOCATION_ENGLISH.CENTRE:
        return LOCATION_WELSH.CENTRE;
      case LOCATION_ENGLISH.INNER:
        return LOCATION_WELSH.INNER;
      case LOCATION_ENGLISH.OUTER:
        return LOCATION_WELSH.OUTER;
      default:
        return locationToTranslate;
    }
  }

  /**
   * Returns filtered welsh defects
   * @param filteredFlatDefects - the array of flattened defects
   * @param vehicleType - the vehicle type from the test result
   */
  public filterFlatDefects(
    filteredFlatDefects: IFlatDefect[],
    vehicleType: string
  ): IFlatDefect | null {
    if (filteredFlatDefects.length === 0) {
      return null;
    } else if (filteredFlatDefects.length === 1) {
      return filteredFlatDefects[0];
    } else {
      const filteredWelshDefectsOnVehicleType = filteredFlatDefects.filter(
        (flatDefect: IFlatDefect) =>
          flatDefect.forVehicleType!.includes(vehicleType)
      );
      return filteredWelshDefectsOnVehicleType[0];
    }
  }

  /**
   * Returns a flattened array of every deficiency that only includes the key/value pairs required for certificate generation
   * @param defects - the array of defects from the api
   */
  public flattenDefectsFromApi(defects: IDefectParent[]): IFlatDefect[] {
    const flatDefects: IFlatDefect[] = [];
    try {
      // go through each defect in un-flattened array
      defects.forEach((defect: IDefectParent) => {
        const { imNumber, imDescription, imDescriptionWelsh, items } = defect;
        if (defect.items !== undefined && defect.items.length !== 0) {
          // go through each item of defect
          items.forEach((item: IItem) => {
            const {
              itemNumber,
              itemDescription,
              itemDescriptionWelsh,
              deficiencies,
            } = item;
            if (
              item.deficiencies !== undefined &&
              item.deficiencies.length !== 0
            ) {
              // go through each deficiency and push to flatDefects array
              deficiencies.forEach((deficiency: IDefectChild) => {
                const {
                  ref,
                  deficiencyText,
                  deficiencyTextWelsh,
                  forVehicleType,
                } = deficiency;
                const lowLevelDeficiency: IFlatDefect = {
                  imNumber,
                  imDescription,
                  imDescriptionWelsh,
                  itemNumber,
                  itemDescription,
                  itemDescriptionWelsh,
                  ref,
                  deficiencyText,
                  deficiencyTextWelsh,
                  forVehicleType,
                };
                flatDefects.push(lowLevelDeficiency);
              });
            }
          });
        }
      });
    } catch (e) {
      console.error(`Error flattening defects: ${e}`);
    }
    return flatDefects;
  }

  /**
   * Returns true if testType is adr and false if not
   * @param testType - testType which is tested
   */
  public isTestTypeAdr(testType: any): boolean {
    const adrTestTypeIds = ["50", "59", "60"];

    return adrTestTypeIds.includes(testType.testTypeId);
  }

  /**
   * Returns true if testType is iva and false if not
   * @param testTypeId - test type id which is being tested
   */
  public isIvaTest(testTypeId: string): boolean {
    const ivaTestTypeIds = [
      "125",
      "126",
      "128",
      "129",
      "130",
      "153",
      "154",
      "158",
      "159",
      "161",
      "162",
      "163",
      "184",
      "185",
      "186",
      "187",
      "188",
      "189",
      "190",
      "191",
      "192",
      "193",
      "194",
      "195",
      "196",
      "197",
    ];

    return ivaTestTypeIds.includes(testTypeId);
  }

  /**
   * Returns true if testType is msva and false if not
   * @param testTypeId - test type id which is being tested
   */
  public isMsvaTest(testTypeId: string): boolean {
    const msvaTestTypeIds = [
      "133",
      "134",
      "135",
      "136",
      "138",
      "139",
      "140",
      "166",
      "167",
      "169",
      "170",
      "172",
      "173"
    ];

    return msvaTestTypeIds.includes(testTypeId);
  }

  //#region Private Static Functions

  /**
   * Returns true if testType is roadworthiness test for HGV or TRL and false if not
   * @param testTypeId - testType which is tested
   */
  private static isRoadworthinessTestType(testTypeId: string): boolean {
    return HGV_TRL_ROADWORTHINESS_TEST_TYPES.IDS.includes(testTypeId);
  }

  /**
   * Returns true if provided testResult is HGV or TRL Roadworthiness test otherwise false
   * @param testResult - testResult of the vehicle
   */
  private static isHgvTrlRoadworthinessCertificate(testResult: any): boolean {
    return (
      (testResult.vehicleType === VEHICLE_TYPES.HGV ||
        testResult.vehicleType === VEHICLE_TYPES.TRL) &&
      CertificateGenerationService.isRoadworthinessTestType(
        testResult.testTypes.testTypeId
      )
    );
  }
  //#endregion
}

export { CertificateGenerationService, IGeneratedCertificateResponse };

