import rp, {OptionsWithUri} from "request-promise";
import {IInvokeConfig, IMOTConfig} from "../models";
import {Configuration} from "../utils/Configuration";
import {S3BucketService} from "./S3BucketService";
import S3 from "aws-sdk/clients/s3";
import {AWSError, config as AWSConfig, Lambda} from "aws-sdk";
import moment from "moment";
import {PromiseResult} from "aws-sdk/lib/request";
import {Service} from "../models/injector/ServiceDecorator";
import {LambdaService} from "./LambdaService";
import {TestResultType, VehicleType} from "../models/Enums";
import {ERRORS} from "../assets/enum";
import {HTTPError} from "../models/HTTPError";

interface IGeneratedCertificateResponse {
    fileName: string;
    vrm: string;
    testTypeName: string;
    testTypeResult: string;
    dateOfIssue: string;
    certificateType: string;
    fileFormat: string;
    fileSize: string;
    certificate: Buffer;
    certificateOrder: { current: number; total: number; };
    email: string;
}

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
    public async generateCertificate(testResult: any): Promise<IGeneratedCertificateResponse> {
        const config: IMOTConfig = this.config.getMOTConfig();
        const iConfig: IInvokeConfig = this.config.getInvokeConfig();
        const testType: any = testResult.testTypes;
        const payload: string = JSON.stringify(await this.generatePayload(testResult));

        const certificateTypes: any = {
            psv_pass: config.documentNames.vtp20,
            psv_fail: config.documentNames.vtp30,
            psv_prs: config.documentNames.psv_prs,
            hgv_pass: config.documentNames.vtg5,
            hgv_fail: config.documentNames.vtg30,
            hgv_prs: config.documentNames.hgv_prs,
            trl_pass: config.documentNames.vtg5a,
            trl_fail: config.documentNames.vtg30,
            trl_prs: config.documentNames.trl_prs
        };

        const vehicleTestRes: string = testResult.vehicleType + "_" + testType.testResult;
        const invokeParams: any = {
            FunctionName: iConfig.functions.certGen.name,
            InvocationType: "RequestResponse",
            LogType: "Tail",
            Payload: JSON.stringify({
                httpMethod: "POST",
                pathParameters: {
                    documentName: certificateTypes[vehicleTestRes],
                    documentDirectory: config.documentDir
                },
                json: true,
                body: payload
            }),
        };

        return this.lambdaClient.invoke(invokeParams)
            .then((response: PromiseResult<Lambda.Types.InvocationResponse, AWSError>) => {
                // tslint:disable-next-line:no-shadowed-variable
                const payload: any = this.lambdaClient.validateInvocationResponse(response);
                const resBody: string = payload.body;
                const responseBuffer: Buffer = Buffer.from(resBody, "base64");

                // Assign trailerId to vrm for trl vehicle type
                const vrmId: any = testResult.vehicleType === VehicleType.TRL ? testResult.trailerId : testResult.vrm;
                return {
                    vrm: testResult.vehicleType === VehicleType.TRL ? testResult.trailerId : testResult.vrm,
                    testTypeName: testResult.testTypes.testTypeName,
                    testTypeResult: testResult.testTypes.testResult,
                    dateOfIssue: moment().format("D MMMM YYYY"),
                    certificateType: certificateTypes[vehicleTestRes].split(".")[0],
                    fileFormat: "pdf",
                    fileName: `${testResult.testResultId}_${testResult.vin}_${testResult.order.current}.pdf`,
                    fileSize: responseBuffer.byteLength.toString(),
                    certificate: responseBuffer,
                    certificateOrder: testResult.order,
                    email: testResult.testerEmailAddress
                };
            })
            .catch((error: AWSError | Error) => {
                console.log(error);
                throw error;
            });

    }

    /**
     * Retrieves a signature from the cvs-signature S3 bucket
     * @param testerStaffId - staff ID of the signature you want to retrieve
     * @returns the signature as a base64 encoded string
     */
    public async getSignature(testerStaffId: string): Promise<string | null> {
        return this.s3Client.download(`cvs-signature-${process.env.BUCKET}`, `${testerStaffId}.base64`)
        .then((result: S3.Types.GetObjectOutput) => {
            return result.Body!.toString();
        })
        .catch((error: AWSError) => {
            console.error(`Unable to fetch signature for staff id ${testerStaffId}. ${error.message}`);
            return null;
        });
    }

    /**
     * Generates the payload for the MOT certificate generation service
     * @param testResult - source test result for certificate generation
     */
    public async generatePayload(testResult: any) {
        const signature: string | null = await this.getSignature(testResult.testerStaffId);
        const passData: any = (testResult.testTypes.testResult === TestResultType.PRS || testResult.testTypes.testResult === TestResultType.PASS) ? await this.generateCertificateData(testResult, "DATA") : undefined;
        const failData: any = (testResult.testTypes.testResult === TestResultType.PRS || testResult.testTypes.testResult === TestResultType.FAIL) ? await this.generateCertificateData(testResult, "FAIL_DATA") : undefined;
        const makeAndModel: any = await this.getVehicleMakeAndModel(testResult);
        const odometerHistory: any = testResult.vehicleType === VehicleType.TRL ? undefined : await this.getOdometerHistory(testResult.vin);
        let payload: any = {
            Watermark: (process.env.BRANCH === "prod") ? "" : "NOT VALID",
            DATA: (passData) ? {...passData, ...makeAndModel, ...odometerHistory} : undefined,
            FAIL_DATA: (failData) ? {...failData, ...makeAndModel, ...odometerHistory} : undefined,
            Signature: {
                ImageType: "png",
                ImageData: signature
            }
        };

        // Purge undefined values
        payload = JSON.parse(JSON.stringify(payload));

        return payload;

    }

    /**
     * Generates certificate data for a given test result and certificate type
     * @param testResult - the source test result for certificate generation
     * @param type - the certificate type
     */
    public async generateCertificateData(testResult: any, type: string) {
        const testType: any = testResult.testTypes;
        const defects: any = this.generateDefects(testResult.testTypes, type);
        return {
            TestNumber: testType.testNumber,
            TestStationPNumber: testResult.testStationPNumber,
            TestStationName: testResult.testStationName,
            CurrentOdometer: {
                value: testResult.odometerReading,
                unit: testResult.odometerReadingUnits
            },
            IssuersName: testResult.testerName,
            DateOfTheTest: moment(testType.createdAt).format("DD.MM.YYYY"),
            CountryOfRegistrationCode: testResult.countryOfRegistration,
            VehicleEuClassification: testResult.euVehicleCategory.toUpperCase(),
            RawVIN: testResult.vin,
            RawVRM: testResult.vehicleType === VehicleType.TRL ? testResult.trailerId : testResult.vrm,
            ExpiryDate: (testType.testExpiryDate) ? moment(testType.testExpiryDate).format("DD.MM.YYYY") : undefined,
            EarliestDateOfTheNextTest: (testType.testAnniversaryDate) ? moment(testType.testAnniversaryDate).format("DD.MM.YYYY") : undefined,
            SeatBeltTested: (testType.seatbeltInstallationCheckDate) ? "Yes" : "No",
            SeatBeltPreviousCheckDate: (testType.lastSeatbeltInstallationCheckDate) ? moment(testType.lastSeatbeltInstallationCheckDate).format("DD.MM.YYYY") : "\u00A0",
            SeatBeltNumber: testType.numberOfSeatbeltsFitted,
            ...defects
        };
    }

    /**
     * Retrieves the odometer history for a given VIN from the Test Results microservice
     * @param vin - VIN for which to retrieve odometer history
     */
    public async getOdometerHistory(vin: string) {
        const config: IInvokeConfig = this.config.getInvokeConfig();
        const invokeParams: any = {
            FunctionName: config.functions.testResults.name,
            InvocationType: "RequestResponse",
            LogType: "Tail",
            Payload: JSON.stringify({
                httpMethod: "GET",
                path: `/test-results/${vin}`,
                pathParameters: {
                    vin
                }
            }),
        };

        return this.lambdaClient.invoke(invokeParams)
        .then((response: PromiseResult<Lambda.Types.InvocationResponse, AWSError>) => {
            const payload: any = this.lambdaClient.validateInvocationResponse(response);
            let testResults: any[] = JSON.parse(payload.body);

            if (!testResults || testResults.length === 0) {
                throw new HTTPError(400, `${ERRORS.LAMBDA_INVOCATION_BAD_DATA} ${JSON.stringify(payload)}.`);
            }
            // Sort results by testEndTimestamp
            testResults.sort((first: any, second: any): number => {
                if (moment(first.testEndTimestamp).isBefore(second.testEndTimestamp)) {
                    return 1;
                }

                if (moment(first.testEndTimestamp).isAfter(second.testEndTimestamp)) {
                    return -1;
                }

                return 0;
            });

            // Remove the first result as it should be the current one.
            testResults.shift();

            // Keep only last three entries (first three items of array)
            testResults = testResults.slice(0, 3);

            return {
                OdometerHistoryList: testResults.map((testResult) => {
                    return {
                        value: testResult.odometerReading,
                        unit: testResult.odometerReadingUnits,
                        date: moment(testResult.testEndTimestamp).format("DD.MM.YYYY")
                    };
                })
            };
        })
        .catch((error: AWSError | Error) => {
            console.log(error);
        });
    }

    /**
     * Retrieves the vehicle make and model for a given vehicle from the Technical Records microservice.
     * Dramatically altered in CVSB-8582, in order to manage failure of vin data to conform to agreed formats
     * @param testResult - the full test result record, from which vehicle attributes to search on can be obtained
     */
    public async getVehicleMakeAndModel(testResult: any) {
        let techRecord = await this.queryTechRecords(testResult.vin);
        if (!techRecord && testResult.partialVin) {
            console.log("No Tech Record found for vin ", testResult.vin, ". Trying Partial Vin");
            techRecord = await this.queryTechRecords(testResult.partialVin);
        }
        if (!techRecord && testResult.vrm) {
            console.log("No Tech Record found for partial vin ", testResult.partialVin, ". Trying VRM");
            techRecord = await this.queryTechRecords(testResult.vrm);
        }
        if (!techRecord && testResult.trailerId) {
            console.log("No Tech Record found for vrm ", testResult.vrm, ". Trying TrailerID");
            techRecord = await this.queryTechRecords(testResult.trailerId);
        }
        if (!techRecord || !techRecord.techRecord) {
            console.error(`Unable to retrieve Tech Record for Test Result:`, testResult);
            throw new Error(`Unable to retrieve Tech Record for Test Result`);
        }

        // Return bodyMake and bodyModel values for PSVs
        if (techRecord.techRecord[0].vehicleType === VehicleType.PSV) {
            return {
                Make: techRecord.techRecord[0].chassisMake,
                Model: techRecord.techRecord[0].chassisModel
            };
        } else {
            // Return make and model values for HGV and TRL vehicle types
            return {
                Make: techRecord.techRecord[0].make,
                Model: techRecord.techRecord[0].model
            };
        }
    }

    /**
     * Helper method for Technical Records Lambda calls. Accepts any search term now, rather than just the VIN
     * Created as part of CVSB-8582
     * @param searchTerm
     */
    public async queryTechRecords(searchTerm: string) {
        const config: IInvokeConfig = this.config.getInvokeConfig();
        const invokeParams: any = {
            FunctionName: config.functions.techRecords.name,
            InvocationType: "RequestResponse",
            LogType: "Tail",
            Payload: JSON.stringify({
                httpMethod: "GET",
                path: `/vehicles/${searchTerm}/tech-records`,
                pathParameters: {
                    proxy: `${searchTerm}/tech-records`
                }
            }),
        };

        return this.lambdaClient.invoke(invokeParams).then((response) => {
            try {
                const payload: any = this.lambdaClient.validateInvocationResponse(response);
                return JSON.parse(payload.body);
            } catch (e) {
                return undefined;
            }

        });
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
            AdvisoryDefects: []
        };

        rawDefects.forEach((defect: any) => {
            switch (defect.deficiencyCategory.toLowerCase()) {
                case "dangerous":
                    if ((testTypes.testResult === TestResultType.PRS || defect.prs)  && type === "FAIL_DATA") {
                        defects.PRSDefects.push(this.formatDefect(defect));
                    } else if (testTypes.testResult === "fail") {
                        defects.DangerousDefects.push(this.formatDefect(defect));
                    }
                    break;
                case "major":
                    if ((testTypes.testResult === TestResultType.PRS || defect.prs) && type === "FAIL_DATA") {
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
        const toUpperFirstLetter: any = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

        let defectString = `${defect.deficiencyRef} ${defect.itemDescription}`;

        if (defect.deficiencyText) {
            defectString += ` ${defect.deficiencyText}`;
        }

        if (defect.additionalInformation.location) {
            Object.keys(defect.additionalInformation.location).forEach((location: string, index: number, array: string[]) => {
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
                            defectString += ` ${toUpperFirstLetter(defect.additionalInformation.location[location])}`;
                            break;
                    }
                }

                if (index === array.length - 1) {
                    defectString += `.`;
                }
            });
        }

        if (defect.additionalInformation.notes) {
            defectString += ` ${defect.additionalInformation.notes}`;
        }

        return defectString;
    }

}

export { CertificateGenerationService, IGeneratedCertificateResponse };
