import {IInvokeConfig, IMOTConfig, IGeneratedCertificateResponse, ICertificatePayload, IRoadworthinessCertificateData, IWeightDetails, ITestResult} from "../models";
import {Configuration} from "../utils/Configuration";
import {S3BucketService} from "./S3BucketService";
import S3 from "aws-sdk/clients/s3";
import {AWSError, config as AWSConfig, Lambda} from "aws-sdk";
import moment from "moment";
import {PromiseResult} from "aws-sdk/lib/request";
import {Service} from "../models/injector/ServiceDecorator";
import {LambdaService} from "./LambdaService";
import {ERRORS, TEST_RESULTS, VEHICLE_TYPES, CERTIFICATE_DATA, HGV_TRL_ROADWORTHINESS_TEST_TYPES} from "../models/Enums";
import {HTTPError} from "../models/HTTPError";

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
            rwt: config.documentNames.rwt,
            adr_pass: config.documentNames.adr_pass
        };

        let vehicleTestRes: string;
        if (CertificateGenerationService.isRoadworthinessTestType(testType.testTypeId)) { // CVSB-7677 is roadworthisness test
            vehicleTestRes = "rwt";
        } else  if (this.isTestTypeAdr(testResult.testTypes)) {
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
                    email: testResult.testerEmailAddress,
                    shouldEmailCertificate: testResult.shouldEmailCertificate ? testResult.shouldEmailCertificate : "true"
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
        let makeAndModel: any = null;
        if (!CertificateGenerationService.isRoadworthinessTestType(testResult.testTypes.testTypeId)) {
            makeAndModel = await this.getVehicleMakeAndModel(testResult);
        }
        let payload: ICertificatePayload =  {
            Watermark: (process.env.BRANCH === "prod") ? "" : "NOT VALID",
            DATA: undefined,
            FAIL_DATA: undefined,
            RWT_DATA: undefined,
            ADR_DATA: undefined,
            Signature: {
                ImageType: "png",
                ImageData: signature
            }
        };
        if (CertificateGenerationService.isHgvTrlRoadworthinessCertificate(testResult)) {
            // CVSB-7677 for roadworthiness test for hgv or trl.
            const rwtData = await this.generateCertificateData(testResult, CERTIFICATE_DATA.RWT_DATA);
            payload.RWT_DATA = {...rwtData};
        } else if (testResult.testTypes.testResult === TEST_RESULTS.PASS && this.isTestTypeAdr(testResult.testTypes)) {
            const adrData = await this.generateCertificateData(testResult, CERTIFICATE_DATA.ADR_DATA);
            payload.ADR_DATA = {...adrData, ...makeAndModel};
        } else {
            const odometerHistory: any = (testResult.vehicleType === VEHICLE_TYPES.TRL) ? undefined : await this.getOdometerHistory(testResult.vin);
            if (testResult.testTypes.testResult !== TEST_RESULTS.FAIL) {
                const passData = await this.generateCertificateData(testResult, CERTIFICATE_DATA.PASS_DATA);
                payload.DATA =   {...passData, ...makeAndModel, ...odometerHistory};
            }
            if  (testResult.testTypes.testResult !== TEST_RESULTS.PASS) {
                const failData = await this.generateCertificateData(testResult, CERTIFICATE_DATA.FAIL_DATA);
                payload.FAIL_DATA =  {...failData, ...makeAndModel, ...odometerHistory};
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
                return  {
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
                        EarliestDateOfTheNextTest: (
                          (testResult.vehicleType === VEHICLE_TYPES.HGV || testResult.vehicleType === VEHICLE_TYPES.TRL)
                          && (testResult.testTypes.testResult === TEST_RESULTS.PASS || testResult.testTypes.testResult === TEST_RESULTS.PRS)
                        ) ?
                            moment(testType.testAnniversaryDate).subtract(1, "months").startOf("month").format("DD.MM.YYYY") :
                            moment(testType.testAnniversaryDate).format("DD.MM.YYYY"),
                        SeatBeltTested: (testType.seatbeltInstallationCheckDate) ? "Yes" : "No",
                        SeatBeltPreviousCheckDate: (testType.lastSeatbeltInstallationCheckDate) ? moment(testType.lastSeatbeltInstallationCheckDate).format("DD.MM.YYYY") : "\u00A0",
                        SeatBeltNumber: testType.numberOfSeatbeltsFitted,
                        ...defects
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
                    VehicleNumber:  testResult.vehicleType === VEHICLE_TYPES.TRL ? testResult.trailerId : testResult.vrm,
                    Vin:  testResult.vin,
                    IssuersName: testResult.testerName,
                    DateOfInspection: moment(testType.testTypeStartTimestamp).format("DD.MM.YYYY"),
                    TestStationPNumber: testResult.testStationPNumber,
                    DocumentNumber: testType.certificateNumber,
                    Date: moment(testType.testTypeStartTimestamp).format("DD.MM.YYYY"),
                    Defects: defectRWTList,
                    IsTrailer: testResult.vehicleType === VEHICLE_TYPES.TRL
                };
                return resultPass;
            case CERTIFICATE_DATA.ADR_DATA:
                const adrDetails = await this.getAdrDetails(testResult);

                const docGenPayloadAdr = {
                    ChasisNumber: testResult.vin,
                    RegistrationNumber: testResult.vrm,
                    ApplicantDetails: (adrDetails) ? adrDetails.applicantDetails : undefined,
                    VehicleType: (adrDetails && adrDetails.vehicleDetails) ? adrDetails.vehicleDetails.type : undefined,
                    PermittedDangerousGoods: (adrDetails) ? adrDetails.permittedDangerousGoods : undefined,
                    BrakeEndurance: (adrDetails) ? adrDetails.brakeEndurance : undefined,
                    Weight: (adrDetails) ? adrDetails.weight : undefined,
                    TankManufacturer: this.containsTankDetails(adrDetails) ? adrDetails.tank.tankDetails.tankManufacturer : undefined,
                    Tc2InitApprovalNo: (this.containsTankDetails(adrDetails) && adrDetails.tank.tankDetails.tc2Details)
                        ? adrDetails.tank.tankDetails.tc2Details.tc2IntermediateApprovalNo : undefined,
                    TankManufactureSerialNo: this.containsTankDetails(adrDetails) ? adrDetails.tank.tankDetails.tankManufacturerSerialNo : undefined,
                    YearOfManufacture: this.containsTankDetails(adrDetails) ? adrDetails.tank.tankDetails.yearOfManufacture : undefined,
                    TankCode: this.containsTankDetails(adrDetails) ? adrDetails.tank.tankDetails.tankCode : undefined,
                    SpecialProvisions: this.containsTankDetails(adrDetails) ? adrDetails.tank.tankDetails.specialProvisions : undefined,
                    TankStatement: (adrDetails && adrDetails.tank) ? adrDetails.tank.tankStatement : undefined,
                    ExpiryDate: testResult.testTypes.testExpiryDate,
                    AtfNameAtfPNumber: testResult.testStationName + " " + testResult.testStationPNumber,
                    Notes: testResult.testTypes.additionalNotesRecorded,
                    TestTypeDate: testResult.testTypes.testTypeStartTimestamp
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
     * @param testResult - testResult from which the VIN is used to search a tech-record
     */
    public containsTankDetails(adrDetails: any) {
        return adrDetails && adrDetails.tank && adrDetails.tank.tankDetails;
    }

    /**
     * Retrieves the vehicle weight details for Roadworthisness certificates
     * @param testResult
     */
    public async getWeightDetails(testResult: any) {
        const result = await this.getTechRecord(testResult);
        if (result ) {
            console.log("techRecord for weight details found");
            const weightDetails: IWeightDetails = {
                dgvw: result.techRecord[0].grossDesignWeight,
                weight2: 0
            };
            if (testResult.vehicleType === VEHICLE_TYPES.HGV) {
                weightDetails.weight2 = result.techRecord[0].trainDesignWeight;
            } else {
                if ( result.techRecord[0].axles && result.techRecord[0].axles.length > 0) {
                    const initialValue = 0;
                    weightDetails.weight2 = result.techRecord[0].axles.reduce(
                        (accumulator: number, currentValue: { weights: { designWeight: number; }; }) =>
                        accumulator + currentValue.weights.designWeight, initialValue);
             } else {
                throw new HTTPError(500, "No axle weights for Roadworthiness test certificates!");
             }
            }
            return weightDetails;
         } else {
             console.log("No techRecord found for weight details");
             throw new HTTPError(500, "No vehicle found for Roadworthiness test certificate!");
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
                    systemNumber
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
        let techRecords: any | any[] = testResult.systemNumber ? await this.queryTechRecords(testResult.systemNumber, "systemNumber") : undefined;
        if (!isSingleRecord(techRecords) && testResult.vin) {
            console.log("No unique Tech Record found for systemNumber ", testResult.systemNumber, ". Trying vin");
            techRecords = await this.queryTechRecords(testResult.vin);
        }
        if (!isSingleRecord(techRecords) && testResult.partialVin) {
            console.log("No unique Tech Record found for vin ", testResult.vin, ". Trying Partial Vin");
            techRecords = await this.queryTechRecords(testResult.partialVin);
        }
        if (!isSingleRecord(techRecords) && testResult.vrm) {
            console.log("No unique Tech Record found for partial vin ", testResult.partialVin, ". Trying VRM");
            techRecords = await this.queryTechRecords(testResult.vrm);
        }
        if (!isSingleRecord(techRecords) && testResult.trailerId) {
            console.log("No unique Tech Record found for vrm ", testResult.vrm, ". Trying TrailerID");
            techRecords = await this.queryTechRecords(testResult.trailerId);
        }
        // @ts-ignore - already handled undefined case.
        if (!isSingleRecord(techRecords) || !techRecords[0].techRecord) {
            console.error(`Unable to retrieve unique Tech Record for Test Result:`, testResult);
            throw new Error(`Unable to retrieve unique Tech Record for Test Result`);
        }

        // @ts-ignore - already handled undefined case.
        const techRecord = techRecords instanceof Array ? techRecords[0] : techRecords;

        return techRecord;
    }

    /**
     * Helper method for Technical Records Lambda calls. Accepts any search term now, rather than just the VIN
     * Created as part of CVSB-8582
     * @param searchTerm - the value of your search term
     * @param searchType - the kind of value your searchTerm represents in camel case e.g. vin, vrm, systemNumber
     */
    public async queryTechRecords(searchTerm: string, searchType: string = "all") {
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
                },
                queryStringParameters: {
                    searchCriteria: searchType
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
       return (testResult.vehicleType === VEHICLE_TYPES.HGV || testResult.vehicleType === VEHICLE_TYPES.TRL)
                &&
            CertificateGenerationService.isRoadworthinessTestType(testResult.testTypes.testTypeId);
    }
    //#endregion

}

/**
 * Checks a techRecord to  see if it's a single, valid record
 * @param techRecord
 */
const isSingleRecord = (techRecords: any): boolean => {
    if (!techRecords) { return false; }
    return (techRecords && techRecords instanceof Array) ? techRecords.length === 1 : true;
};

export { CertificateGenerationService, IGeneratedCertificateResponse };
