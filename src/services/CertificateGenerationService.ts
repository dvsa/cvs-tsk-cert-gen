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
    ITestType,
} from "../models";
import {Configuration} from "../utils/Configuration";
import {S3BucketService} from "./S3BucketService";
import S3 from "aws-sdk/clients/s3";
import {AWSError, config as AWSConfig, Lambda} from "aws-sdk";
import moment from "moment";
import {PromiseResult} from "aws-sdk/lib/request";
import {Service} from "../models/injector/ServiceDecorator";
import {LambdaService} from "./LambdaService";
import {
    CERTIFICATE_DATA,
    ERRORS,
    HGV_TRL_ROADWORTHINESS_TEST_TYPES,
    TEST_RESULTS,
    VEHICLE_TYPES,
} from "../models/Enums";
import {HTTPError} from "../models/HTTPError";
import {NestedObject, SearchResult, TechRecordGet, TechRecordType} from "../models/Types";

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
        const payload: string = JSON.stringify(
            await this.generatePayload(testResult)
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
     */
    public async generatePayload(testResult: any) {
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

        const {testTypes, vehicleType, systemNumber, testHistory} = testResult;

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
            payload.RWT_DATA = {...rwtData};
        } else if (
            testResult.testTypes.testResult === TEST_RESULTS.PASS &&
            this.isTestTypeAdr(testResult.testTypes)
        ) {
            const adrData = await this.generateCertificateData(
                testResult,
                CERTIFICATE_DATA.ADR_DATA
            );
            payload.ADR_DATA = {...adrData, ...makeAndModel};
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
                    CERTIFICATE_DATA.PASS_DATA
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
     */
    public async generateCertificateData(testResult: ITestResult, type: string) {
        const testType: any = testResult.testTypes;
        switch (type) {
            case CERTIFICATE_DATA.PASS_DATA:
            case CERTIFICATE_DATA.FAIL_DATA:
                const defects: any = this.generateDefects(testResult.testTypes, type);
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
                        ? await this.unflattenFlatObject(adrDetails, "applicantDetails")
                        : undefined,
                    VehicleType:
                        adrDetails && adrDetails.techRecord_adrDetails_vehicleDetails_type
                            ? adrDetails.techRecord_adrDetails_vehicleDetails_type
                            : undefined,
                    PermittedDangerousGoods: adrDetails
                        ? adrDetails.techRecord_adrDetails_permittedDangerousGoods
                        : undefined,
                    BrakeEndurance: adrDetails ? adrDetails.techRecord_adrDetails_brakeEndurance : undefined,
                    Weight: adrDetails ? adrDetails.techRecord_adrDetails_weight : undefined,
                    TankManufacturer: await this.containsTankDetails(adrDetails)
                        ? adrDetails.techRecord_adrDetails_tank_tankDetails_tankManufacturer
                        : undefined,
                    Tc2InitApprovalNo:
                        await this.containsTankDetails(adrDetails) &&
                        !!await this.unflattenFlatObject(adrDetails, "tc2Details")
                            ? adrDetails.techRecord_adrDetails_tank_tankDetails_tc2Details_tc2IntermediateApprovalNo
                            : undefined,
                    TankManufactureSerialNo: await this.containsTankDetails(adrDetails)
                        ? adrDetails.techRecord_adrDetails_tank_tankDetails_tankManufacturerSerialNo
                        : undefined,
                    YearOfManufacture: await this.containsTankDetails(adrDetails)
                        ? adrDetails.techRecord_adrDetails_tank_tankDetails_yearOfManufacture
                        : undefined,
                    TankCode: await this.containsTankDetails(adrDetails)
                        ? adrDetails.techRecord_adrDetails_tank_tankDetails_tankCode
                        : undefined,
                    SpecialProvisions: await this.containsTankDetails(adrDetails)
                        ? adrDetails.techRecord_adrDetails_tank_tankDetails_specialProvisions
                        : undefined,
                    TankStatement:
                        adrDetails && !!await this.unflattenFlatObject(adrDetails, "tank")
                            ? adrDetails.techRecord_adrDetails_tank_tankDetails_tankStatement_statement
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
    public getAdrDetails = async (testResult: any) => {
        console.log('in adr details method');
        // todo change this to use other
        const searchRes = await this.callSearchTechRecords(testResult.vin);
        console.log(`searcg res: ${searchRes}`);
        return await this.processGetCurrentProvisionalRecords(searchRes) as TechRecordType<"hgv" | "trl" | undefined>;
    };

    /**
     * documentaiton todo
     * @param obj
     * @param keyFilter
     */
    public unflattenFlatObject<T extends { [key: string]: any }>(obj: T, keyFilter: string): Promise<NestedObject<T>> {
        return Object.entries(obj).reduce((result: any, [key, value]) => {
            const parts = key.split("_");
            return parts[0] === keyFilter ? parts.reduce((target: any, part: string, idx: number) => {
                return (target[part] = idx === parts.length - 1 ? value : target[part] ?? {}, target[part]);
            }, result) : result;
        }, {});
    }


    public processGetCurrentProvisionalRecords = async <T extends TechRecordGet["techRecord_vehicleType"]>(searchResult: SearchResult[]): Promise<TechRecordType<T> | undefined> => {
        console.log('in process current provisional records');
        if (searchResult) {
            const processRecordsRes = this.processRecords(searchResult);
            console.log(processRecordsRes);
            if (processRecordsRes.currentCount !== 0) {
                return this.callGetTechRecords(processRecordsRes.currentRecords[0].systemNumber,
                    processRecordsRes.currentRecords[0].createdTimestamp,
                    processRecordsRes.currentRecords[0].techRecord_vehicleType);
            }
            return processRecordsRes.provisionalCount === 1
                ? this.callGetTechRecords(processRecordsRes.provisionalRecords[0].systemNumber,
                    processRecordsRes.provisionalRecords[0].createdTimestamp, processRecordsRes.provisionalRecords[0].techRecord_vehicleType)
                : this.callGetTechRecords(processRecordsRes.provisionalRecords[1].systemNumber,
                    processRecordsRes.provisionalRecords[1].createdTimestamp,
                    processRecordsRes.provisionalRecords[1].techRecord_vehicleType);
        } else {
            throw new Error("Tech record Search returned nothing.");
        }
    };

    /**
     * helper function is used to process records and count provisional and current records
     * @param records
     */
    public processRecords = (records: SearchResult[]
    ): { currentRecords: SearchResult[]; provisionalRecords: SearchResult[]; currentCount: number; provisionalCount: number; } => {
        const currentRecords: SearchResult[] = [];
        const provisionalRecords: SearchResult[] = [];

        console.log(`PROCESS RECORDS METHOD: ${JSON.stringify(records)}`);
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
    };

    /**
     * Returns true if an adrDetails object contains a tankDetails object
     * @param testResult - testResult from which the VIN is used to search a tech-record
     */
    public async containsTankDetails(adrDetails: any) {
        return adrDetails && !!await this.unflattenFlatObject(adrDetails, "tank") && !!await this.unflattenFlatObject(adrDetails, "tankDetails");
    }

    /**
     * Retrieves the vehicle weight details for Roadworthisness certificates
     * @param testResult
     */
    public async getWeightDetails(testResult: any) {
        console.log('in get weight details');
        // TODO change here
        const searchRes = await this.callSearchTechRecords(testResult.vin);
        const techRecord = await this.processGetCurrentProvisionalRecords(searchRes) as TechRecordType<"hgv" | "psv" | "trl">;
        if (techRecord) {
            console.log("techRecord for weight details found");
            const weightDetails: IWeightDetails = {
                dgvw: techRecord.techRecord_grossDesignWeight ?? 0,
                weight2: 0,
            };
            if (testResult.vehicleType === VEHICLE_TYPES.HGV) {
                weightDetails.weight2 = (techRecord as TechRecordType<"hgv">).techRecord_trainDesignWeight ?? 0;
            } else {
                if (
                    techRecord.techRecord_noOfAxles ?? -1 > 0
                ) {
                    const initialValue: number = 0;
                    // const unflattenedAxles = await this.unflattenFlatObject(techRecord , "axles") ;
                    //
                    // console.log(unflattenedAxles);
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
                        .filter(({testTypes}) =>
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
        // TODO change here
        const searchRes = await this.callSearchTechRecords(testResult.vin);
        const techRecord = await this.processGetCurrentProvisionalRecords(searchRes);
        // Return bodyMake and bodyModel values for PSVs
        if (techRecord?.techRecord_vehicleType === VEHICLE_TYPES.PSV) {

            return {
                Make: (techRecord as TechRecordType<"psv">).techRecord_chassisMake,
                Model: (techRecord as TechRecordType<"psv">).techRecord_chassisModel
            };
        } else {
            // Return make and model values for HGV and TRL vehicle types
            return {
                Make: (techRecord as TechRecordType<"hgv" | "trl">).techRecord_make,
                Model: (techRecord as TechRecordType<"hgv" | "trl">).techRecord_model
            };
        }
    };

    public callSearchTechRecords = async (searchTerm: string): Promise<SearchResult[]> => {
        console.log('in call search tech records');
        const config: IInvokeConfig = this.config.getInvokeConfig();
        const invokeParams: any = {
            FunctionName: config.functions.techRecords.name,
            InvocationType: "RequestResponse",
            LogType: "Tail",
            Payload: JSON.stringify({
                httpMethod: "GET",
                path: `/v3/search/${searchTerm}`,
                pathParameters: {
                    proxy: `search/${searchTerm}`,
                }
            }),
        };

        return await this.lambdaClient.invoke(invokeParams)
            .then(async (response) => {
                try {
                    console.log(response);
                    return await this.lambdaClient.validateInvocationResponse(response);
                } catch (e) {
                    console.log('in search tech record catch block');
                    console.log(e);
                    return undefined;
                }
            });
    };

    public callGetTechRecords = async <T extends TechRecordGet["techRecord_vehicleType"]>(systemNumber: string, createdTimestamp: string, vehicleType: string): Promise<TechRecordType<T> | undefined> => {
        console.log('in call get tech records');

        const config: IInvokeConfig = this.config.getInvokeConfig();
        const invokeParams: any = {
            FunctionName: config.functions.techRecords.name,
            InvocationType: "RequestResponse",
            LogType: "Tail",
            Payload: JSON.stringify({
                httpMethod: "GET",
                path: `/v3/technical-records/${systemNumber}/${createdTimestamp}`,
                pathParameters: {
                    proxy: `technical-records/${systemNumber}/${createdTimestamp}`,
                }
            }),
        };

        return await this.lambdaClient.invoke(invokeParams)
            .then(async (response) => {
                try {
                    console.log(response);
                    const payload = await this.lambdaClient.validateInvocationResponse(response);
                    // The type of the parsed payload should be `TechRecordType<T>`
                    const parsedPayload: TechRecordType<T> = await payload;
                    return parsedPayload;
                } catch (e) {
                    console.log('in get tech record catch block');
                    console.log(e);
                    return undefined;
                }
            });
    };


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
                return {Trn: undefined, IsTrailer: true};
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
            return {Trn: trailerRegistration.trn, IsTrailer: true};
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
     * @param testTypes the test type
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
     * Generates an object containing defects for a given test type and certificate type
     * @param testTypes - the source test type for defect generation
     * @param type - the certificate type
     */
    private generateDefects(testTypes: any, type: string) {
        const rawDefects: any = testTypes.defects;
        const defects: any = {
            DangerousDefects: [],
            MajorDefects: [],
            PRSDefects: [],
            MinorDefects: [],
            AdvisoryDefects: [],
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
                    break;
                case "advisory":
                    defects.AdvisoryDefects.push(this.formatDefect(defect));
                    break;
            }
        });

        Object.entries(defects).forEach(([k, v]: [string, any]) => {
            if (v.length === 0) {
                Object.assign(defects, {[k]: undefined});
            }
        });

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

export {CertificateGenerationService, IGeneratedCertificateResponse};
