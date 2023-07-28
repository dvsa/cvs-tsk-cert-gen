import {
  ICertificatePayload,
  IGeneratedCertificateResponse,
  IInvokeConfig,
  IMOTConfig,
  IRoadworthinessCertificateData,
  ITestResult,
  IWeightDetails,
  ITrailerRegistration,
  IMakeAndModel,
  ITestType
} from "../models";
import {ITestStation} from "../models/ITestStations";
import { Configuration } from "../utils/Configuration";
import { S3BucketService } from "./S3BucketService";
import S3 from "aws-sdk/clients/s3";
import { AWSError, config as AWSConfig, Lambda } from "aws-sdk";
import moment from "moment";
import { PromiseResult } from "aws-sdk/lib/request";
import { Service } from "../models/injector/ServiceDecorator";
import { LambdaService } from "./LambdaService";
import {
  ATF_COUNTRIES,
  CERTIFICATE_DATA,
  ERRORS,
  HGV_TRL_ROADWORTHINESS_TEST_TYPES,
  LOCATION_ENGLISH,
  LOCATION_WELSH,
  TEST_RESULTS,
  VEHICLE_TYPES,
} from "../models/Enums";
import { HTTPError } from "../models/HTTPError";
import { IFlatDefect } from "../models/IFlatDefect";
import { IDefectParent } from "../models/IDefectParent";
import { IItem } from "../models/IItem";
import { IDefectChild } from "../models/IDefectChild";

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

    // Find out if Welsh certificate is needed
    const testStations = await this.getTestStations();
    const welshTestStation = this.isTestStationWelsh(testStations, testResult.testStationPNumber);

    const payload: string = JSON.stringify(
      await this.generatePayload(testResult, welshTestStation)
    );

    const certificateTypes: any = {
      psv_pass: config.documentNames.vtp20,
      psv_fail: config.documentNames.vtp30,
      psv_prs: config.documentNames.psv_prs,
      hgv_pass: config.documentNames.vtg5,
      hgv_fail: config.documentNames.vtg30,
      hgv_prs: config.documentNames.hgv_prs,
      trl_pass: config.documentNames.vtg5a,
      trl_fail: config.documentNames.vtg30,
      trl_prs: config.documentNames.trl_prs,
      rwt: config.documentNames.rwt,
      adr_pass: config.documentNames.adr_pass,
    };

    let vehicleTestRes: string;
    if (
      CertificateGenerationService.isRoadworthinessTestType(testType.testTypeId)
    ) {
      // CVSB-7677 is roadworthisness test
      vehicleTestRes = "rwt";
    } else if (this.isTestTypeAdr(testResult.testTypes)) {
      vehicleTestRes = "adr_pass";
    } else {
      vehicleTestRes = testResult.vehicleType + "_" + testType.testResult;
    }
    const invokeParams: any = {
      FunctionName: iConfig.functions.certGen.name,
      InvocationType: "RequestResponse",
      LogType: "Tail",
      Payload: JSON.stringify({
        httpMethod: "POST",
        pathParameters: {
          documentName: certificateTypes[vehicleTestRes],
          documentDirectory: config.documentDir,
        },
        json: true,
        body: payload,
      }),
    };
    return this.lambdaClient
      .invoke(invokeParams)
      .then(
        (
          response: PromiseResult<Lambda.Types.InvocationResponse, AWSError>
        ) => {
          const documentPayload: any =
            this.lambdaClient.validateInvocationResponse(response);
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
   */
  public async getTestStations() {
    const config: IInvokeConfig = this.config.getInvokeConfig();
    const invokeParams: any = {
      FunctionName: config.functions.testStations.name,
      InvocationType: "RequestResponse",
      LogType: "Tail",
      Payload: JSON.stringify({
        httpMethod: "GET",
        path: `/test-stations/`,
      }),
    };
    let testStations: ITestStation[] = [];
    return this.lambdaClient
      .invoke(invokeParams)
      .then(
        (
          response: PromiseResult<Lambda.Types.InvocationResponse, AWSError>
        ) => {
          const payload: any =
            this.lambdaClient.validateInvocationResponse(response);
          testStations = JSON.parse(payload.body);

          if (!testStations || testStations.length === 0) {
            throw new HTTPError(
              400,
              `${ERRORS.LAMBDA_INVOCATION_BAD_DATA} ${JSON.stringify(payload)}.`
            );
          }
          return testStations;
        }
      )
      .catch((error: AWSError | Error) => {
        console.error(
          `There was an error retrieving the test stations: ${error}`
        );
        return testStations;
      });
  }

  /**
   * Check if the specific test station is in Wales
   * @param testStations list of all test stations
   * @param testStationPNumber pNumber from the test result
   * @returns boolean
   */
  public isTestStationWelsh(testStations: ITestStation[], testStationPNumber: string) {
    // default parameter value so that if test station cannot be determined, processing will continue
    let isWelsh = false;

    if (!testStations || testStations.length === 0) {
      console.log(`Test stations data is empty`);
      return isWelsh;
    }

    // find the specific test station by the PNumber used on the test result
    const pNumberTestStation = testStations.filter((x) => {
      return x.testStationPNumber === testStationPNumber;
    });

    if ((pNumberTestStation) && (pNumberTestStation.length > 0)) {
      const thisTestStation = pNumberTestStation[0];
      if ((thisTestStation.testStationCountry) && (thisTestStation.testStationCountry.toUpperCase() === ATF_COUNTRIES.WALES)) {
        isWelsh = true;
      }
      console.log(`Test station details: ${thisTestStation.testStationPNumber} ${thisTestStation.testStationName} in ${thisTestStation.testStationCountry}`);
    } else {
      console.log(`Test station details could not be found for ${testStationPNumber} `);
    }

    console.log(`Return value for isWelsh is ${isWelsh}`);
    return isWelsh;
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
    const defectListFromApi: IDefectParent[] = await this.getDefectTranslations();
    const testType: any = testResult.testTypes;
    switch (type) {
      case CERTIFICATE_DATA.PASS_DATA:
      case CERTIFICATE_DATA.FAIL_DATA:
        const defects: any = this.generateDefects(testResult.testTypes, type, testResult.vehicleType, defectListFromApi, isWelsh);
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
        const adrDetails = await this.getAdrDetails(testResult);

        const docGenPayloadAdr = {
          ChasisNumber: testResult.vin,
          RegistrationNumber: testResult.vrm,
          ApplicantDetails: adrDetails
            ? adrDetails.applicantDetails
            : undefined,
          VehicleType:
            adrDetails && adrDetails.vehicleDetails
              ? adrDetails.vehicleDetails.type
              : undefined,
          PermittedDangerousGoods: adrDetails
            ? adrDetails.permittedDangerousGoods
            : undefined,
          BrakeEndurance: adrDetails ? adrDetails.brakeEndurance : undefined,
          Weight: adrDetails ? adrDetails.weight : undefined,
          TankManufacturer: this.containsTankDetails(adrDetails)
            ? adrDetails.tank.tankDetails.tankManufacturer
            : undefined,
          Tc2InitApprovalNo:
            this.containsTankDetails(adrDetails) &&
            adrDetails.tank.tankDetails.tc2Details
              ? adrDetails.tank.tankDetails.tc2Details.tc2IntermediateApprovalNo
              : undefined,
          TankManufactureSerialNo: this.containsTankDetails(adrDetails)
            ? adrDetails.tank.tankDetails.tankManufacturerSerialNo
            : undefined,
          YearOfManufacture: this.containsTankDetails(adrDetails)
            ? adrDetails.tank.tankDetails.yearOfManufacture
            : undefined,
          TankCode: this.containsTankDetails(adrDetails)
            ? adrDetails.tank.tankDetails.tankCode
            : undefined,
          SpecialProvisions: this.containsTankDetails(adrDetails)
            ? adrDetails.tank.tankDetails.specialProvisions
            : undefined,
          TankStatement:
            adrDetails && adrDetails.tank
              ? adrDetails.tank.tankStatement
              : undefined,
          ExpiryDate: testResult.testTypes.testExpiryDate,
          AtfNameAtfPNumber:
            testResult.testStationName + " " + testResult.testStationPNumber,
          Notes: testResult.testTypes.additionalNotesRecorded,
          TestTypeDate: testResult.testTypes.testTypeStartTimestamp,
        };

        console.log("CHECK HERE DOCGENPAYLOAD -> ", docGenPayloadAdr);

        return docGenPayloadAdr;
    }
  }

  /**
   * Retrieves the adrDetails from a techRecord searched by vin
   * @param testResult - testResult from which the VIN is used to search a tech-record
   */
  public async getAdrDetails(testResult: any) {
    const techRecord = await this.getTechRecord(testResult);

    return techRecord.techRecord[0].adrDetails;
  }

  /**
   * Returns true if an adrDetails object contains a tankDetails object
   * @param adrDetails - adrDetails object to check
   */
  public containsTankDetails(adrDetails: any) {
    return adrDetails && adrDetails.tank && adrDetails.tank.tankDetails;
  }

  /**
   * Retrieves the vehicle weight details for Roadworthiness certificates
   * @param testResult
   */
  public async getWeightDetails(testResult: any) {
    const result = await this.getTechRecord(testResult);
    if (result) {
      console.log("techRecord for weight details found");
      const weightDetails: IWeightDetails = {
        dgvw: result.techRecord[0].grossDesignWeight,
        weight2: 0,
      };
      if (testResult.vehicleType === VEHICLE_TYPES.HGV) {
        weightDetails.weight2 = result.techRecord[0].trainDesignWeight;
      } else {
        if (
          result.techRecord[0].axles &&
          result.techRecord[0].axles.length > 0
        ) {
          const initialValue = 0;
          weightDetails.weight2 = result.techRecord[0].axles.reduce(
            (
              accumulator: number,
              currentValue: { weights: { designWeight: number } }
            ) => accumulator + currentValue.weights.designWeight,
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
    const invokeParams: any = {
      FunctionName: config.functions.testResults.name,
      InvocationType: "RequestResponse",
      LogType: "Tail",
      Payload: JSON.stringify({
        httpMethod: "GET",
        path: `/test-results/${systemNumber}`,
        pathParameters: {
          systemNumber,
        },
      }),
    };

    return this.lambdaClient
      .invoke(invokeParams)
      .then(
        (
          response: PromiseResult<Lambda.Types.InvocationResponse, AWSError>
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
  public async getVehicleMakeAndModel(testResult: any) {
    const techRecord = await this.getTechRecord(testResult);
    // Return bodyMake and bodyModel values for PSVs
    if (techRecord.techRecord[0].vehicleType === VEHICLE_TYPES.PSV) {
      return {
        Make: techRecord.techRecord[0].chassisMake,
        Model: techRecord.techRecord[0].chassisModel,
      };
    } else {
      // Return make and model values for HGV and TRL vehicle types
      return {
        Make: techRecord.techRecord[0].make,
        Model: techRecord.techRecord[0].model,
      };
    }
  }

  /**
   * Method for getting techRecord to which the test-results reffer to
   * @param testResult - the testResult for which the tech record search is done for
   */
  public async getTechRecord(testResult: any) {
    let techRecords: any | any[] = testResult.systemNumber
      ? await this.queryTechRecords(testResult.systemNumber, "systemNumber")
      : undefined;
    if (!isSingleRecord(techRecords) && testResult.vin) {
      console.log(
        "No unique Tech Record found for systemNumber ",
        testResult.systemNumber,
        ". Trying vin"
      );
      techRecords = await this.queryTechRecords(testResult.vin);
    }
    if (!isSingleRecord(techRecords) && testResult.partialVin) {
      console.log(
        "No unique Tech Record found for vin ",
        testResult.vin,
        ". Trying Partial Vin"
      );
      techRecords = await this.queryTechRecords(testResult.partialVin);
    }
    if (!isSingleRecord(techRecords) && testResult.vrm) {
      console.log(
        "No unique Tech Record found for partial vin ",
        testResult.partialVin,
        ". Trying VRM"
      );
      techRecords = await this.queryTechRecords(testResult.vrm);
    }
    if (!isSingleRecord(techRecords) && testResult.trailerId) {
      console.log(
        "No unique Tech Record found for vrm ",
        testResult.vrm,
        ". Trying TrailerID"
      );
      techRecords = await this.queryTechRecords(testResult.trailerId);
    }
    // @ts-ignore - already handled undefined case.
    if (!isSingleRecord(techRecords) || !techRecords[0].techRecord) {
      console.error(
        `Unable to retrieve unique Tech Record for Test Result:`,
        testResult
      );
      throw new Error(`Unable to retrieve unique Tech Record for Test Result`);
    }

    // @ts-ignore - already handled undefined case.
    const techRecord =
      techRecords instanceof Array ? techRecords[0] : techRecords;

    return techRecord;
  }

  /**
   * Helper method for Technical Records Lambda calls. Accepts any search term now, rather than just the VIN
   * Created as part of CVSB-8582
   * @param searchTerm - the value of your search term
   * @param searchType - the kind of value your searchTerm represents in camel case e.g. vin, vrm, systemNumber
   */
  public async queryTechRecords(
    searchTerm: string,
    searchType: string = "all"
  ) {
    const config: IInvokeConfig = this.config.getInvokeConfig();
    const invokeParams: any = {
      FunctionName: config.functions.techRecords.name,
      InvocationType: "RequestResponse",
      LogType: "Tail",
      Payload: JSON.stringify({
        httpMethod: "GET",
        path: `/vehicles/${searchTerm}/tech-records`,
        pathParameters: {
          proxy: `${searchTerm}/tech-records`,
        },
        queryStringParameters: {
          searchCriteria: searchType,
        },
      }),
    };

    return this.lambdaClient.invoke(invokeParams).then((response) => {
      try {
        const payload: any =
          this.lambdaClient.validateInvocationResponse(response);
        return JSON.parse(payload.body);
      } catch (e) {
        return undefined;
      }
    });
  }

  /**
   * To fetch trailer registration
   * @param vin The vin of the trailer
   * @param make The make of the trailer
   * @returns A payload containing the TRN of the trailer and a boolean.
   */
  public async getTrailerRegistrationObject(vin: string, make: string) {
    const config: IInvokeConfig = this.config.getInvokeConfig();
    const invokeParams: any = {
      FunctionName: config.functions.trailerRegistration.name,
      InvocationType: "RequestResponse",
      LogType: "Tail",
      Payload: JSON.stringify({
        httpMethod: "GET",
        path: `/v1/trailers/${vin}`,
        pathParameters: {
          proxy: `/v1/trailers`,
        },
        queryStringParameters: {
          make,
        },
      }),
    };
    const response = await this.lambdaClient.invoke(invokeParams);
    try {
      if (!response.Payload || response.Payload === "") {
        throw new HTTPError(
          500,
          `${ERRORS.LAMBDA_INVOCATION_ERROR} ${response.StatusCode} ${ERRORS.EMPTY_PAYLOAD}`
        );
      }
      const payload: any = JSON.parse(response.Payload as string);
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
   */
  public async getDefectTranslations() {
    const config: IInvokeConfig = this.config.getInvokeConfig();
    const invokeParams: any = {
      FunctionName: config.functions.defects.name,
      InvocationType: "RequestResponse",
      LogType: "Tail",
      Payload: JSON.stringify({
        httpMethod: "GET",
        path: `/defects/`,
      }),
    };
    let defects: any[] = [];
    return this.lambdaClient
        .invoke(invokeParams)
        .then(
            (response: PromiseResult<Lambda.Types.InvocationResponse, AWSError>) => {
              const payload: any = this.lambdaClient.validateInvocationResponse(response);
              defects = JSON.parse(payload.body);

              if (!defects || defects.length === 0) {
                throw new HTTPError(
                    400,
                    `${ERRORS.LAMBDA_INVOCATION_BAD_DATA} ${JSON.stringify(payload)}.`
                );
              }

              console.log(`Successfully retrieved ${defects.length} welsh defects translations.`);

              return defects;
            }
        ).catch((error: AWSError | Error) => {
          console.error(`There was an error retrieving the welsh defect translations: ${error}`);
          return defects;
        });
  }

  /**
   * Generates an object containing defects for a given test type and certificate type
   * @param testTypes - the source test type for defect generation
   * @param type - the certificate type
   * @param vehicleType - the vehicle type from the test result
   * @param defectListFromApi - the list of defects retrieved from the defect service
   * @param isWelsh - determines whether the atf in which the test result was conducted resides in Wales
   */
  private generateDefects(testTypes: any, type: string, vehicleType: string, defectListFromApi: IDefectParent[], isWelsh: boolean = false) {
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

    // TODO - look at complexity of this method
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
          if (type === CERTIFICATE_DATA.PASS_DATA && isWelsh) {
            // TODO - remove this once tested
            console.log(this.formatDefectWelsh(defect, vehicleType, defectListFromApi));
            // TODO - add logic to only push to array if not null
            defects.MinorDefectsWelsh.push(this.formatDefectWelsh(defect, vehicleType, defectListFromApi));
          }
          break;
        case "advisory":
          defects.AdvisoryDefects.push(this.formatDefect(defect));
          if (type === CERTIFICATE_DATA.PASS_DATA && isWelsh) {
            // TODO - remove this once tested
            console.log(this.formatDefectWelsh(defect, vehicleType, defectListFromApi));
            // TODO - add logic to only push to array if not null
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
   * @param defectListFromApi - the list of defects retrieved from the defect service
   */
  public formatDefectWelsh(defect: any, vehicleType: any, defectListFromApi: IDefectParent[]) {
    const toUpperFirstLetter: any = (word: string) =>
        word.charAt(0).toUpperCase() + word.slice(1);
    const flattenedDefects = this.flattenDefectsFromApi(defectListFromApi);

    const filteredFlatDefects: IFlatDefect[] = flattenedDefects.filter((x) => defect.deficiencyRef === x.ref);

    const filteredFlatDefect = this.filterFlatDefects(filteredFlatDefects, vehicleType);

    // TODO - handle if there are no matching defects and remove this if
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
                    const welshLocation = this.convertLocationWelsh(defect.additionalInformation.location[location]);
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
      // TODO - remove this once tested
      console.log(`Defect: ${JSON.stringify(defect)}`);
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
      case LOCATION_ENGLISH.FRONT : return LOCATION_WELSH.FRONT;
      case LOCATION_ENGLISH.REAR : return LOCATION_WELSH.REAR;
      case LOCATION_ENGLISH.UPPER : return LOCATION_WELSH.UPPER;
      case LOCATION_ENGLISH.LOWER : return LOCATION_WELSH.LOWER;
      case LOCATION_ENGLISH.NEARSIDE : return LOCATION_WELSH.NEARSIDE;
      case LOCATION_ENGLISH.OFFSIDE : return LOCATION_WELSH.OFFSIDE;
      case LOCATION_ENGLISH.CENTRE : return LOCATION_WELSH.CENTRE;
      case LOCATION_ENGLISH.INNER : return LOCATION_WELSH.INNER;
      case LOCATION_ENGLISH.OUTER : return LOCATION_WELSH.OUTER;
      default:
        return locationToTranslate;
    }
  }

  /**
   * Returns filtered welsh defects
   * @param filteredFlatDefects - the array of flattened defects
   * @param vehicleType - the vehicle type from the test result
   */
  public filterFlatDefects(filteredFlatDefects: IFlatDefect[], vehicleType: string): IFlatDefect | null {
    if (filteredFlatDefects.length === 0) {
      return null;
    } else if (filteredFlatDefects.length === 1) {
      // TODO - remove this once tested
      console.log(`Filtered to one defect on def ref id: ${filteredFlatDefects[0]}`);
      return  filteredFlatDefects[0];
    } else {
      const filteredWelshDefectsOnVehicleType = filteredFlatDefects.filter((flatDefect: IFlatDefect) => flatDefect.forVehicleType!.includes(vehicleType));
      // TODO - remove this once tested
      console.log(`Filtered to one defect on def ref id and vehicle type: ${filteredWelshDefectsOnVehicleType[0]}`);
      return filteredWelshDefectsOnVehicleType[0];
    }
  }

  /**
   * Returns a flattened array of every deficiency that only includes the key/value pairs required for certificate generation
   * @param defects - the array of defects from the api
   */
  public flattenDefectsFromApi(defects: IDefectParent[]): IFlatDefect[] {
    const flatDefects: IFlatDefect[] = [];

    // go through each defect in un-flattened array
    defects.forEach((defect: IDefectParent) => {
      const { imNumber, imDescription, imDescriptionWelsh, items } = defect;
      if (defect.items !== undefined && defect.items.length !== 0) {
        // go through each item of defect
        items.forEach((item: IItem) => {
          const { itemNumber, itemDescription, itemDescriptionWelsh, deficiencies } = item;
          if (item.deficiencies !== undefined && item.deficiencies.length !== 0) {
            // go through each deficiency and push to flatDefects array
            deficiencies.forEach((deficiency: IDefectChild) => {
              const { ref, deficiencyText, deficiencyTextWelsh, forVehicleType } = deficiency;
              const lowLevelDeficiency: IFlatDefect = {
                imNumber, imDescription, imDescriptionWelsh, itemNumber, itemDescription, itemDescriptionWelsh, ref, deficiencyText, deficiencyTextWelsh, forVehicleType
              };
              flatDefects.push(lowLevelDeficiency);
            });
          }
        });
      }
    });
    // TODO - remove this once tested
    console.log("Flattened defect array length: " + flatDefects.length);
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

/**
 * Checks a techRecord to  see if it's a single, valid record
 * @param techRecord
 */
const isSingleRecord = (techRecords: any): boolean => {
  if (!techRecords) {
    return false;
  }
  return techRecords && techRecords instanceof Array
    ? techRecords.length === 1
    : true;
};

export { CertificateGenerationService, IGeneratedCertificateResponse };
