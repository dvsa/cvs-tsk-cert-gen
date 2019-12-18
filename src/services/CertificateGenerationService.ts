import {IInvokeConfig, IMOTConfig} from "../models";
import {Configuration} from "../utils/Configuration";
import {S3BucketService} from "./S3BucketService";
import S3 from "aws-sdk/clients/s3";
import {AWSError, config as AWSConfig, Lambda} from "aws-sdk";
import moment from "moment";
import {PromiseResult} from "aws-sdk/lib/request";
import {Service} from "../models/injector/ServiceDecorator";
import {LambdaService} from "./LambdaService";
import {ERRORS, TEST_RESULTS, VEHICLE_TYPES, CERTIFICATE_DATA} from "../models/Enums";
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
            trl_prs: config.documentNames.trl_prs,
            adr_pass: config.documentNames.adr_pass,
            lec_pass: config.documentNames.lec_pass,
            lec_fail: config.documentNames.lec_fail
        };

        let vehicleTestRes: string;
        if (this.isTestTypeAdr(testResult.testTypes)) {
            vehicleTestRes = "adr_pass";
        } else if (this.isTestTypeLec(testResult.testTypes)) {
            vehicleTestRes = "lec_" + testType.testResult;
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

                return {
                    vrm: testResult.vehicleType === VEHICLE_TYPES.TRL ? testResult.trailerId : testResult.vrm,
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
        let adrData;
        let lecData;
        let passData;
        let failData;

        if (testResult.testTypes.testResult === TEST_RESULTS.PASS && this.isTestTypeAdr(testResult.testTypes)) {
            adrData = await this.generateCertificateData(testResult, CERTIFICATE_DATA.ADR_DATA);
        } else if (this.isTestTypeLec(testResult.testTypes)) {
            lecData = await this.generateCertificateData(testResult, CERTIFICATE_DATA.LEC_DATA);
        } else {
            if (testResult.testTypes.testResult !== TEST_RESULTS.FAIL) {
                passData = await this.generateCertificateData(testResult, CERTIFICATE_DATA.PASS_DATA);
            }
            if (testResult.testTypes.testResult !== TEST_RESULTS.PASS) {
                failData = await this.generateCertificateData(testResult, CERTIFICATE_DATA.FAIL_DATA);
            }
        }

        const signature: string | null = await this.getSignature(testResult.testerStaffId);
        const makeAndModel: any = await this.getVehicleMakeAndModel(testResult);
        const odometerHistory: any = (testResult.vehicleType === VEHICLE_TYPES.TRL || this.isTestTypeAdr(testResult.testTypes)) ? undefined : await this.getOdometerHistory(testResult.vin);

        let payload: any = {
            Watermark: (process.env.BRANCH === "prod") ? "" : "NOT VALID",
            DATA: (passData) ? {...passData, ...makeAndModel, ...odometerHistory} : undefined,
            FAIL_DATA: (failData) ? {...failData, ...makeAndModel, ...odometerHistory} : undefined,
            ADR_DATA : (adrData) ? {...adrData, ...makeAndModel, } : undefined,
            LEC_DATA : (lecData) ? {...lecData, ...makeAndModel, } : undefined,
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

        if (type === CERTIFICATE_DATA.LEC_DATA) {
            return {
                SerialNumber: testType.certificateNumber,
                TestStationPNumber: testResult.testStationPNumber,
                TestStationName: testResult.testStationName,
                DateOfTheTest: moment(testType.createdAt).format("DD.MM.YYYY"),
                ExpiryDate: (testType.testExpiryDate) ? moment(testType.testExpiryDate).format("DD.MM.YYYY") : undefined,
                VRM: testResult.vrm,
                VIN: testResult.vin,
                PrescribedEmissionStandard: testType.emissionStandard,
                ParticulateTrapFitted: testType.particulateTrapFitted,
                ParticulateTrapSerialNumber: testType.particulateTrapSerialNumber,
                ModificationType: testType.modType?.code,
                ModificationTypeUsed: testType.modificationTypeUsed,
                SmokeTestLimit: testType.smokeTestKLimitApplied,
                AdditionalNotesRequired: testType.additionalNotesRecorded
            };
        }

        if (type === CERTIFICATE_DATA.ADR_DATA) {
            const adrDetails = await this.getAdrDetails(testResult);
            return {
                ChassisNumber: testResult.vin,
                RegistrationNumber: testResult.vrm,
                ApplicantDetails: adrDetails.applicantDetails,
                VehicleType: adrDetails.vehicleDetails.type,
                PermittedDangerousGoods: adrDetails.permittedDangerousGoods,
                BrakeEndurance: adrDetails.brakeEndurance,
                Weight: adrDetails.weight,
                TankManufacturer: adrDetails.tank.tankDetails.tankManufacturer,
                Tc2InitApprovalNo: adrDetails.tank.tankDetails.tc2IntermediateApprovalNo,
                TankManufactureSerialNo: adrDetails.tank.tankDetails.tankManufacturerSerialNo,
                YearOfManufacture: adrDetails.tank.tankDetails.yearOfManufacture,
                TankCode: adrDetails.tank.tankDetails.tankCode,
                SpecialProvisions: adrDetails.tank.tankDetails.specialProvisions,
                TankStatement: adrDetails.tank.tankStatement,
                ExpiryDate: testResult.testTypes.testExpiryDate,
                AtfNameAtfPNumber: testResult.testStationName + " " + testResult.testStationPNumber,
            };
        }

        // Otherwise
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
            RawVRM: testResult.vehicleType === VEHICLE_TYPES.TRL ? testResult.trailerId : testResult.vrm,
            ExpiryDate: (testType.testExpiryDate) ? moment(testType.testExpiryDate).format("DD.MM.YYYY") : undefined,
            EarliestDateOfTheNextTest: ((testResult.vehicleType === VEHICLE_TYPES.HGV || testResult.vehicleType === VEHICLE_TYPES.TRL) &&
                (testResult.testTypes.testResult === TEST_RESULTS.PASS || testResult.testTypes.testResult === TEST_RESULTS.PRS)) ?
                moment(testType.testAnniversaryDate).subtract(2, "months").add(1, "days").format("DD.MM.YYYY") :
                moment(testType.testAnniversaryDate).format("DD.MM.YYYY"),
            SeatBeltTested: (testType.seatbeltInstallationCheckDate) ? "Yes" : "No",
            SeatBeltPreviousCheckDate: (testType.lastSeatbeltInstallationCheckDate) ? moment(testType.lastSeatbeltInstallationCheckDate).format("DD.MM.YYYY") : "\u00A0",
            SeatBeltNumber: testType.numberOfSeatbeltsFitted,
            ...defects
        };
    }

    /**
     * Retrieves the adrDetails from a techRecord searched by vin
     * @param testResult - testResult from which the VIN is used to search a tech-record
     */
    public async getAdrDetails(testResult: any) {
        const techRecord = await this.getTechRecord(testResult);

        if (!techRecord.techRecord[0].adrDetails) {
            throw new HTTPError(500, "No adr details on vehicle");
        } else {
            return techRecord.techRecord[0].adrDetails;
        }
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
     * Method for getting make and model based on the vehicle from a test-result
     * @param testResult - the testResult for which the tech record search is done for
     */
    public async getVehicleMakeAndModel(testResult: any) {
        const techRecord = await this.getTechRecord(testResult);
        // Return bodyMake and bodyModel values for PSVs
        if (techRecord.techRecord[0].vehicleType === VEHICLE_TYPES.PSV) {
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
     * Method for getting techRecord to which the test-results reffer to
     * @param testResult - the testResult for which the tech record search is done for
     */
    public async getTechRecord(testResult: any) {
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

        return techRecord;
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
                    if ((testTypes.testResult === TEST_RESULTS.PRS || defect.prs)  && type === CERTIFICATE_DATA.FAIL_DATA) {
                        defects.PRSDefects.push(this.formatDefect(defect));
                    } else if (testTypes.testResult === "fail") {
                        defects.DangerousDefects.push(this.formatDefect(defect));
                    }
                    break;
                case "major":
                    if ((testTypes.testResult === TEST_RESULTS.PRS || defect.prs) && type === CERTIFICATE_DATA.FAIL_DATA) {
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

    /**
     * Returns true if testType is adr and false if not
     * @param testType - testType which is tested
     */
    public isTestTypeAdr(testType: any): boolean {
        const adrTestTypeIds = ["50", "59", "60"];
        return adrTestTypeIds.includes(testType.testTypeId);
    }

  /**
   * Returns true if the passed in test is an LEC type, otherwise false
   * @param testType
   */
  public isTestTypeLec(testType: {testTypeId: string}): boolean {
        const lecTestTypes = ["39", "44", "45"];
        return lecTestTypes.includes(testType.testTypeId);
    }
}

export { CertificateGenerationService, IGeneratedCertificateResponse };
