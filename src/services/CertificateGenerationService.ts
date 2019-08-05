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
import {TestResultType} from "../models/Enums";
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
        const payload: any = JSON.stringify(await this.generatePayload(testResult));
        const certificateTypes: any = {
            pass: config.documentNames.vtp20,
            fail: config.documentNames.vtp30,
            prs: config.documentNames.psv_prs
        };

        const invokeParams: any = {
            FunctionName: iConfig.functions.certGen.name,
            InvocationType: "RequestResponse",
            LogType: "Tail",
            Payload: JSON.stringify({
                httpMethod: "POST",
                pathParameters: {
                    documentName: certificateTypes[testType.testResult],
                    documentDirectory: config.documentDir
                },
                json: true,
                body: payload
            }),
        };

        return this.lambdaClient.invoke(invokeParams)
            .then((response: PromiseResult<Lambda.Types.InvocationResponse, AWSError>) => {
                const payload: any = this.lambdaClient.validateInvocationResponse(response);
                const resBody: string = payload.body;
                const responseBuffer: Buffer = Buffer.from(resBody, "base64");

                return {
                    vrm: testResult.vrm,
                    testTypeName: testResult.testTypes.testTypeName,
                    testTypeResult: testResult.testTypes.testResult,
                    dateOfIssue: moment().format("D MMMM YYYY"),
                    certificateType: certificateTypes[testType.testResult].split(".")[0],
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
        const makeAndModel: any = await this.getVehicleMakeAndModel(testResult.vin);
        const odometerHistory: any = await this.getOdometerHistory(testResult.vin);
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
    private async generateCertificateData(testResult: any, type: string) {
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
            RawVRM: testResult.vrm,
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
    private async getOdometerHistory(vin: string) {
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
     * Retrieves the vehicle make and model for a given VIN from the Technical Records microservice
     * @param vin - the VIN for which to fetch the vehicle make and model
     */
    private async getVehicleMakeAndModel(vin: string) {
        const config: IInvokeConfig = this.config.getInvokeConfig();
        const invokeParams: any = {
            FunctionName: config.functions.techRecords.name,
            InvocationType: "RequestResponse",
            LogType: "Tail",
            Payload: JSON.stringify({
                httpMethod: "GET",
                path: `/vehicles/${vin}/tech-records`,
                pathParameters: {
                    proxy: `${vin}/tech-records`
                }
            }),
        };

        return this.lambdaClient.invoke(invokeParams)
        .then((response: PromiseResult<Lambda.Types.InvocationResponse, AWSError>) => {
            const payload: any = this.lambdaClient.validateInvocationResponse(response);
            const techRecord: any = JSON.parse(payload.body);

            if (!techRecord || !techRecord.techRecord) {
                throw new Error(`Lambda invocation returned bad data: ${JSON.stringify(payload)}.`);
            }

            return {
                Make: techRecord.techRecord[0].bodyMake,
                Model: techRecord.techRecord[0].bodyModel
            };
        })
        .catch((error: AWSError | Error) => {
            console.log(error);
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
                    if (testTypes.testResult === TestResultType.PRS && type === "FAIL_DATA") {
                        defects.PRSDefects.push(this.formatDefect(defect));
                    } else if (testTypes.testResult === "fail") {
                        defects.DangerousDefects.push(this.formatDefect(defect));
                    }
                    break;
                case "major":
                    if (testTypes.testResult === TestResultType.PRS && type === "FAIL_DATA") {
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
