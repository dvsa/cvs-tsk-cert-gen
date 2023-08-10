import {Injector} from "../../src/models/injector/Injector";
import * as fs from "fs";
import * as path from "path";
import {
    CertificateGenerationService,
    IGeneratedCertificateResponse,
} from "../../src/services/CertificateGenerationService";
import {S3BucketMockService} from "../models/S3BucketMockService";
import {LambdaMockService} from "../models/LambdaMockService";
import {CertificateUploadService} from "../../src/services/CertificateUploadService";
import {ManagedUpload} from "aws-sdk/clients/s3";
import {certGen} from "../../src/functions/certGen";
import sinon from "sinon";
import queueEventPass from "../resources/queue-event-pass.json";
import queueEventFail from "../resources/queue-event-fail.json";
import queueEventFailPRS from "../resources/queue-event-fail-prs.json";
import techRecordsRwt from "../resources/tech-records-response-rwt.json";
import docGenRwt from "../resources/doc-gen-payload-rwt.json";

const sandbox = sinon.createSandbox();
import {cloneDeep} from "lodash";
import {ITestResult, ICertificatePayload} from "../../src/models";
import techRecordsRwtSearch from "../resources/tech-records-response-rwt-search.json";
import techRecordsRwtHgv from "../resources/tech-records-response-rwt-hgv.json";
import techRecordsRwtHgvSearch from "../resources/tech-records-response-rwt-hgv-search.json";
import techRecordsPsv from "../resources/tech-records-response-PSV.json";
import techRecordsSearchPsv from "../resources/tech-records-response-search-PSV.json";

describe("cert-gen", () => {
    it("should pass", () => {
        expect(true).toBe(true);
    });
    const certificateGenerationService: CertificateGenerationService =
        Injector.resolve<CertificateGenerationService>(
            CertificateGenerationService,
            [S3BucketMockService, LambdaMockService]
        );
    beforeAll(() => {
        jest.setTimeout(10000);
    });
    afterAll(() => {
        sandbox.restore();
        jest.setTimeout(5000);
    });
    afterEach(() => {
        sandbox.restore();
    });
    context("CertificateGenerationService", () => {
        LambdaMockService.populateFunctions();

        context("when a passing test result is read from the queue", () => {
            const event: any = {...queueEventPass};
            const testResult: any = JSON.parse(event.Records[3].body);
            const testResult2: any = JSON.parse(event.Records[4].body);

            context("and a payload is generated", () => {
                context("and no signatures were found in the bucket", () => {
                    it("should return a VTP20 payload without signature and the issuers name should have been swapped", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "Dev1 CVS",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "XMGDE02FS0H012345",
                                RawVRM: "BQ91YHQ",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                Make: "STANLEY",
                                Model: "AUTOTRL",
                                OdometerHistoryList: [
                                    {
                                        value: 400000,
                                        unit: "kilometres",
                                        date: "19.01.2019",
                                    },
                                    {
                                        value: 390000,
                                        unit: "kilometres",
                                        date: "18.01.2019",
                                    },
                                    {
                                        value: 380000,
                                        unit: "kilometres",
                                        date: "17.01.2019",
                                    },
                                ],
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };
                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                            });
                    });
                });
                context("and no signatures were found in the bucket", () => {
                    it("should return a VTP20 payload without signature and the issuers name should have not been swapped", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS, Test, Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "XMGDE02FS0H012345",
                                RawVRM: "BQ91YHQ",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                Make: "STANLEY",
                                Model: "AUTOTRL",
                                OdometerHistoryList: [
                                    {
                                        value: 400000,
                                        unit: "kilometres",
                                        date: "19.01.2019",
                                    },
                                    {
                                        value: 390000,
                                        unit: "kilometres",
                                        date: "18.01.2019",
                                    },
                                    {
                                        value: 380000,
                                        unit: "kilometres",
                                        date: "17.01.2019",
                                    },
                                ],
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        return await certificateGenerationService
                            .generatePayload(testResult2)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                            });
                    });
                });
            });
        });

        context("when a passing test result is read from the queue", () => {
            const event: any = {...queueEventPass};
            const testResult: any = JSON.parse(event.Records[0].body);

            context("and a payload is generated", () => {
                context("and no signatures were found in the bucket", () => {
                    it("should return a VTP20 payload without signature", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "XMGDE02FS0H012345",
                                RawVRM: "BQ91YHQ",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                Make: "STANLEY",
                                Model: "AUTOTRL",
                                OdometerHistoryList: [
                                    {
                                        value: 400000,
                                        unit: "kilometres",
                                        date: "19.01.2019",
                                    },
                                    {
                                        value: 390000,
                                        unit: "kilometres",
                                        date: "18.01.2019",
                                    },
                                    {
                                        value: 380000,
                                        unit: "kilometres",
                                        date: "17.01.2019",
                                    },
                                ],
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };
                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);


                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                            });
                    });
                });

                context("and lambda-to-lambda calls were unsuccessful", () => {
                    it("should return a VTP20 payload without bodyMake, bodyModel and odometer history", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "XMGDE02FS0H012345",
                                RawVRM: "BQ91YHQ",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };
                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);

                        // @ts-ignore
                        delete techRecordResponseRwtMock.techRecord_make;
                        // @ts-ignore
                        delete techRecordResponseRwtMock.techRecord_model;
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        // Make the functions return undefined
                        // Stub CertificateGenerationService getOdometerHistory method to return undefined value.
                        const getOdometerHistoryStub = sandbox
                            .stub(
                                CertificateGenerationService.prototype,
                                "getOdometerHistory"
                            )
                            .resolves(undefined);
                        // Stub CertificateGenerationService getVehicleMakeAndModel method to return undefined value.
                        // const getVehicleMakeAndModelStub = sandbox
                        //     .stub(
                        //         CertificateGenerationService.prototype,
                        //         "getVehicleMakeAndModel"
                        //     )
                        //     .resolves(undefined);
                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getOdometerHistoryStub.restore();
                                // getVehicleMakeAndModelStub.restore();
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                            });
                    });
                });

                context("and signatures were found in the bucket", () => {
                    it("should return a VTP20 payload with signature", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "XMGDE02FS0H012345",
                                RawVRM: "BQ91YHQ",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                Make: "STANLEY",
                                Model: "AUTOTRL",
                                OdometerHistoryList: [
                                    {
                                        value: 400000,
                                        unit: "kilometres",
                                        date: "19.01.2019",
                                    },
                                    {
                                        value: 390000,
                                        unit: "kilometres",
                                        date: "18.01.2019",
                                    },
                                    {
                                        value: 380000,
                                        unit: "kilometres",
                                        date: "17.01.2019",
                                    },
                                ],
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: fs
                                    .readFileSync(
                                        path.resolve(__dirname, `../resources/signatures/1.base64`)
                                    )
                                    .toString(),
                            },
                        };
                        // Add a new signature
                        S3BucketMockService.buckets.push({
                            bucketName: `cvs-signature-${process.env.BUCKET}`,
                            files: ["1.base64"],
                        });
                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                                // Remove the signature
                                S3BucketMockService.buckets.pop();
                            });
                    });
                });
            });

            context(
                "and the generated payload is used to call the MOT service",
                () => {
                    it("successfully generate a certificate", async () => {
                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        expect.assertions(3);
                        return await certificateGenerationService
                            .generateCertificate(testResult)
                            .then((response: any) => {
                                expect(response.fileName).toEqual(
                                    "W01A00310_XMGDE02FS0H012345.pdf"
                                );
                                expect(response.certificateType).toEqual("VTP20");
                                expect(response.certificateOrder).toEqual({
                                    current: 1,
                                    total: 2,
                                });
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                            });
                    });
                }
            );
        });

        context("when a passing test result is read from the queue", () => {
            const event: any = {...queueEventPass};
            const testResultWithTestHistoryForResult: any = JSON.parse(event.Records[5].body);
            const testResultWithTestHistoryForSomeotherResult: any = JSON.parse(event.Records[6].body);

            context("and the result has testHistory", () => {
                context("and the testHistory has history for the test result", () => {
                    it("should return a VTP20 payload with Reissue populated", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "XMGDE02FS0H012345",
                                RawVRM: "BQ91YHQ",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                Make: "STANLEY",
                                Model: "AUTOTRL",
                                OdometerHistoryList: [
                                    {
                                        value: 400000,
                                        unit: "kilometres",
                                        date: "19.01.2019",
                                    },
                                    {
                                        value: 390000,
                                        unit: "kilometres",
                                        date: "18.01.2019",
                                    },
                                    {
                                        value: 380000,
                                        unit: "kilometres",
                                        date: "17.01.2019",
                                    },
                                ],
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                            Reissue: {
                                Reason: "Replacement",
                                Issuer: "Joe Smith",
                                Date: "14.12.2022"
                            }
                        };
                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        return await certificateGenerationService
                            .generatePayload(testResultWithTestHistoryForResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                            });
                    });
                });

                context("and the testHistory has history for an unrelated test result", () => {
                    it("should return a VTP20 payload with no Reissue set", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "XMGDE02FS0H012345",
                                RawVRM: "BQ91YHQ",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                Make: "STANLEY",
                                Model: "AUTOTRL",
                                OdometerHistoryList: [
                                    {
                                        value: 400000,
                                        unit: "kilometres",
                                        date: "19.01.2019",
                                    },
                                    {
                                        value: 390000,
                                        unit: "kilometres",
                                        date: "18.01.2019",
                                    },
                                    {
                                        value: 380000,
                                        unit: "kilometres",
                                        date: "17.01.2019",
                                    },
                                ],
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            }
                        };

                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        return await certificateGenerationService
                            .generatePayload(testResultWithTestHistoryForSomeotherResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                            });
                    });
                });
            });
        });

        context("when a failing test result is read from the queue", () => {
            const event: any = {...queueEventFail};
            const testResult: any = JSON.parse(event.Records[0].body);

            context("and a payload is generated", () => {
                context("and no signatures were found in the bucket", () => {
                    it("should return a VTP30 payload without signature", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            FAIL_DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "XMGDE02FS0H012345",
                                RawVRM: "BQ91YHQ",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                ExpiryDate: "25.02.2020",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                DangerousDefects: [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd",
                                ],
                                MinorDefects: [
                                    "54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.",
                                ],
                                AdvisoryDefects: [
                                    "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc",
                                ],
                                Make: "STANLEY",
                                Model: "AUTOTRL",
                                OdometerHistoryList: [
                                    {
                                        value: 400000,
                                        unit: "kilometres",
                                        date: "19.01.2019",
                                    },
                                    {
                                        value: 390000,
                                        unit: "kilometres",
                                        date: "18.01.2019",
                                    },
                                    {
                                        value: 380000,
                                        unit: "kilometres",
                                        date: "17.01.2019",
                                    },
                                ],
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                            });
                    });
                });

                context("and lambda-to-lambda calls were unsuccessful", () => {
                    it("should return a VTP30 payload without bodyMake, bodyModel and odometer history", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            FAIL_DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "XMGDE02FS0H012345",
                                RawVRM: "BQ91YHQ",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                ExpiryDate: "25.02.2020",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                DangerousDefects: [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd",
                                ],
                                MinorDefects: [
                                    "54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.",
                                ],
                                AdvisoryDefects: [
                                    "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc",
                                ],
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };
                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        // @ts-ignore
                        delete techRecordResponseRwtMock.techRecord_make;
                        // @ts-ignore
                        delete techRecordResponseRwtMock.techRecord_model;
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        // Make the functions return undefined
                        // Stub CertificateGenerationService getOdometerHistory method to return undefined value.
                        const getOdometerHistoryStub = sandbox
                            .stub(
                                CertificateGenerationService.prototype,
                                "getOdometerHistory"
                            )
                            .resolves(undefined);
                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getOdometerHistoryStub.restore();
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                            });
                    });
                });

                context("and signatures were found in the bucket", () => {
                    it("should return a VTP30 payload with signature", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            FAIL_DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "XMGDE02FS0H012345",
                                RawVRM: "BQ91YHQ",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                ExpiryDate: "25.02.2020",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                DangerousDefects: [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd",
                                ],
                                MinorDefects: [
                                    "54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.",
                                ],
                                AdvisoryDefects: [
                                    "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc",
                                ],
                                Make: "STANLEY",
                                Model: "AUTOTRL",
                                OdometerHistoryList: [
                                    {
                                        value: 400000,
                                        unit: "kilometres",
                                        date: "19.01.2019",
                                    },
                                    {
                                        value: 390000,
                                        unit: "kilometres",
                                        date: "18.01.2019",
                                    },
                                    {
                                        value: 380000,
                                        unit: "kilometres",
                                        date: "17.01.2019",
                                    },
                                ],
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: fs
                                    .readFileSync(
                                        path.resolve(__dirname, `../resources/signatures/1.base64`)
                                    )
                                    .toString(),
                            },
                        };
                        // Add a new signature
                        S3BucketMockService.buckets.push({
                            bucketName: `cvs-signature-${process.env.BUCKET}`,
                            files: ["1.base64"],
                        });
                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);


                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                                // Remove the signature
                                S3BucketMockService.buckets.pop();
                            });
                    });
                });
            });

            context(
                "and the generated payload is used to call the MOT service",
                () => {
                    it("successfully generate a certificate", async () => {
                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        expect.assertions(3);
                        return await certificateGenerationService
                            .generateCertificate(testResult)
                            .then((response: any) => {
                                expect(response.fileName).toEqual(
                                    "W01A00310_XMGDE02FS0H012345.pdf"
                                );
                                expect(response.certificateType).toEqual("VTP30");
                                expect(response.certificateOrder).toEqual({
                                    current: 2,
                                    total: 2,
                                });
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                            });
                    });
                }
            );
        });

        context("when a prs test result is read from the queue", () => {
            const event: any = JSON.parse(
                fs.readFileSync(
                    path.resolve(__dirname, "../resources/queue-event-prs.json"),
                    "utf8"
                )
            );
            const testResult: any = JSON.parse(event.Records[0].body);
            let resBody: string = "";
            context("and a payload is generated", () => {
                context("and no signatures were found in the bucket", () => {
                    it("should return a PRS payload without signature", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "XMGDE02FS0H012345",
                                RawVRM: "BQ91YHQ",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                Make: "STANLEY",
                                Model: "AUTOTRL",
                                OdometerHistoryList: [
                                    {
                                        value: 400000,
                                        unit: "kilometres",
                                        date: "19.01.2019",
                                    },
                                    {
                                        value: 390000,
                                        unit: "kilometres",
                                        date: "18.01.2019",
                                    },
                                    {
                                        value: 380000,
                                        unit: "kilometres",
                                        date: "17.01.2019",
                                    },
                                ],
                            },
                            FAIL_DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "XMGDE02FS0H012345",
                                RawVRM: "BQ91YHQ",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                PRSDefects: ["1.1.a A registration plate: missing. Front."],
                                Make: "STANLEY",
                                Model: "AUTOTRL",
                                OdometerHistoryList: [
                                    {
                                        value: 400000,
                                        unit: "kilometres",
                                        date: "19.01.2019",
                                    },
                                    {
                                        value: 390000,
                                        unit: "kilometres",
                                        date: "18.01.2019",
                                    },
                                    {
                                        value: 380000,
                                        unit: "kilometres",
                                        date: "17.01.2019",
                                    },
                                ],
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };
                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                            });
                    });
                });

                context("and lambda-to-lambda calls were unsuccessful", () => {
                    it("should return a PRS payload without bodyMake, bodyModel and odometer history", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "XMGDE02FS0H012345",
                                RawVRM: "BQ91YHQ",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                            },
                            FAIL_DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "XMGDE02FS0H012345",
                                RawVRM: "BQ91YHQ",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                PRSDefects: ["1.1.a A registration plate: missing. Front."],
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };
                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        // @ts-ignore
                        delete techRecordResponseRwtMock.techRecord_model;
                        // @ts-ignore
                        delete techRecordResponseRwtMock.techRecord_make;
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        // Make the functions return undefined
                        // Stub CertificateGenerationService getOdometerHistory method to return undefined value.
                        const getOdometerHistoryStub = sandbox
                            .stub(
                                CertificateGenerationService.prototype,
                                "getOdometerHistory"
                            )
                            .resolves(undefined);
                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getOdometerHistoryStub.restore();
                                // getVehicleMakeAndModelStub.restore();
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                            });
                    });
                });

                context("and signatures were found in the bucket", () => {
                    it("should return a PRS payload with signature", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "XMGDE02FS0H012345",
                                RawVRM: "BQ91YHQ",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                Make: "STANLEY",
                                Model: "AUTOTRL",
                                OdometerHistoryList: [
                                    {
                                        value: 400000,
                                        unit: "kilometres",
                                        date: "19.01.2019",
                                    },
                                    {
                                        value: 390000,
                                        unit: "kilometres",
                                        date: "18.01.2019",
                                    },
                                    {
                                        value: 380000,
                                        unit: "kilometres",
                                        date: "17.01.2019",
                                    },
                                ],
                            },
                            FAIL_DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "XMGDE02FS0H012345",
                                RawVRM: "BQ91YHQ",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                PRSDefects: ["1.1.a A registration plate: missing. Front."],
                                Make: "STANLEY",
                                Model: "AUTOTRL",
                                OdometerHistoryList: [
                                    {
                                        value: 400000,
                                        unit: "kilometres",
                                        date: "19.01.2019",
                                    },
                                    {
                                        value: 390000,
                                        unit: "kilometres",
                                        date: "18.01.2019",
                                    },
                                    {
                                        value: 380000,
                                        unit: "kilometres",
                                        date: "17.01.2019",
                                    },
                                ],
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: fs
                                    .readFileSync(
                                        path.resolve(__dirname, `../resources/signatures/1.base64`)
                                    )
                                    .toString(),
                            },
                        };
                        // Add a new signature
                        S3BucketMockService.buckets.push({
                            bucketName: `cvs-signature-${process.env.BUCKET}`,
                            files: ["1.base64"],
                        });

                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                resBody = payload.body;
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                                // Remove the signature
                                S3BucketMockService.buckets.pop();
                            });
                    });
                });
            });

            context(
                "and the generated payload is used to call the MOT service",
                () => {
                    it("successfully generate a certificate", async () => {
                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsSearchPsv);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsPsv);
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        expect.assertions(3);
                        return await certificateGenerationService
                            .generateCertificate(testResult)
                            .then((response: any) => {
                                expect(response.fileName).toEqual(
                                    "W01A00310_XMGDE02FS0H012345.pdf"
                                );
                                expect(response.certificateType).toEqual("PSV_PRS");
                                expect(response.certificateOrder).toEqual({
                                    current: 1,
                                    total: 2,
                                });
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                            });
                    });
                }
            );
        });

        context("when a failing test result is read from the queue", () => {
            const event: any = {...queueEventFailPRS};
            const testResult: any = JSON.parse(event.Records[0].body);

            context("and certificate Data is generated", () => {
                context(
                    "and test-result contains a Dagerous Defect with Major defect rectified",
                    () => {
                        it("should return Certificate Data with PRSDefects list in Fail data", async () => {
                            const expectedResult: any = {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "XMGDE02FS0H012345",
                                RawVRM: "BQ91YHQ",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                ExpiryDate: "25.02.2020",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                DangerousDefects: [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd",
                                ],
                                MajorDefects: undefined,
                                MinorDefects: [
                                    "54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.",
                                ],
                                AdvisoryDefects: [
                                    "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc",
                                ],
                                PRSDefects: ["1.1.a A registration plate: missing. Front."],
                            };

                            return await certificateGenerationService
                                .generateCertificateData(testResult, "FAIL_DATA")
                                .then((payload: any) => {
                                    expect(payload).toEqual(expectedResult);
                                });
                        });
                    }
                );
            });

            const testResult2: any = JSON.parse(event.Records[1].body);
            context("and certificate Data is generated", () => {
                context(
                    "and test-result contains a Major Defect with Dangerous defect rectified",
                    () => {
                        it("should return Certificate Data with PRSDefects list in Fail Data", async () => {
                            const expectedResult: any = {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "XMGDE02FS0H012345",
                                RawVRM: "BQ91YHQ",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                ExpiryDate: "25.02.2020",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                DangerousDefects: undefined,
                                MajorDefects: ["1.1.a A registration plate: missing. Front."],
                                MinorDefects: [
                                    "54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.",
                                ],
                                AdvisoryDefects: [
                                    "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc",
                                ],
                                PRSDefects: [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd",
                                ],
                            };

                            return await certificateGenerationService
                                .generateCertificateData(testResult2, "FAIL_DATA")
                                .then((payload: any) => {
                                    expect(payload).toEqual(expectedResult);
                                });
                        });
                    }
                );
            });

            const testResult3: any = JSON.parse(event.Records[2].body);
            context("and certificate Data is generated", () => {
                context(
                    "and test-result contains a Major and Dagerous Defect with no Major or Dagerous defect rectified",
                    () => {
                        it("should return Certificate Data with 0 PRSDefects list in Fail Data", async () => {
                            const expectedResult: any = {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "XMGDE02FS0H012345",
                                RawVRM: "BQ91YHQ",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                ExpiryDate: "25.02.2020",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                DangerousDefects: [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd",
                                ],
                                MajorDefects: ["1.1.a A registration plate: missing. Front."],
                                MinorDefects: [
                                    "54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.",
                                ],
                                AdvisoryDefects: [
                                    "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc",
                                ],
                                PRSDefects: undefined,
                            };

                            return await certificateGenerationService
                                .generateCertificateData(testResult3, "FAIL_DATA")
                                .then((payload: any) => {
                                    expect(payload).toEqual(expectedResult);
                                });
                        });
                    }
                );
            });
        });
    });

    context("CertGenService for HGV", () => {
        context("when a passing test result for HGV is read from the queue", () => {
            const event: any = {...queueEventPass};
            const testResult: any = JSON.parse(event.Records[1].body);

            context("and a payload is generated", () => {
                context("and no signatures were found in the bucket", () => {
                    it("should return a VTG5 payload without signature", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "P012301098765",
                                RawVRM: "VM14MDT",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "01.11.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                Make: "Isuzu",
                                Model: "FM",
                                OdometerHistoryList: [
                                    {
                                        value: 400000,
                                        unit: "kilometres",
                                        date: "19.01.2019",
                                    },
                                    {
                                        value: 390000,
                                        unit: "kilometres",
                                        date: "18.01.2019",
                                    },
                                    {
                                        value: 380000,
                                        unit: "kilometres",
                                        date: "17.01.2019",
                                    },
                                ],
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);


                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                            });
                    });
                });

                context("and lambda-to-lambda calls were unsuccessful", () => {
                    it("should return a VTG5 payload without bodyMake, bodyModel and odometer history", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "P012301098765",
                                RawVRM: "VM14MDT",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "01.11.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };
                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        // @ts-ignore
                        delete techRecordResponseRwtMock.techRecord_make;
                        // @ts-ignore
                        delete techRecordResponseRwtMock.techRecord_model;
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);
                        // Make the functions return undefined
                        // Stub CertificateGenerationService getOdometerHistory method to return undefined value.
                        const getOdometerHistoryStub = sandbox
                            .stub(
                                CertificateGenerationService.prototype,
                                "getOdometerHistory"
                            )
                            .resolves(undefined);
                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getOdometerHistoryStub.restore();
                                // getVehicleMakeAndModelStub.restore();
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                            });
                    });
                });

                context("and signatures were found in the bucket", () => {
                    it("should return a VTG5 payload with signature", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "P012301098765",
                                RawVRM: "VM14MDT",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "01.11.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                Make: "Isuzu",
                                Model: "FM",
                                OdometerHistoryList: [
                                    {
                                        value: 400000,
                                        unit: "kilometres",
                                        date: "19.01.2019",
                                    },
                                    {
                                        value: 390000,
                                        unit: "kilometres",
                                        date: "18.01.2019",
                                    },
                                    {
                                        value: 380000,
                                        unit: "kilometres",
                                        date: "17.01.2019",
                                    },
                                ],
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: fs
                                    .readFileSync(
                                        path.resolve(__dirname, `../resources/signatures/1.base64`)
                                    )
                                    .toString(),
                            },
                        };
                        // Add a new signature
                        S3BucketMockService.buckets.push({
                            bucketName: `cvs-signature-${process.env.BUCKET}`,
                            files: ["1.base64"],
                        });

                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);


                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                                // Remove the signature
                                S3BucketMockService.buckets.pop();
                            });
                    });
                });
            });

            context(
                "and the generated payload is used to call the MOT service",
                () => {
                    it("successfully generate a certificate", async () => {
                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        expect.assertions(3);
                        return await certificateGenerationService
                            .generateCertificate(testResult)
                            .then((response: any) => {
                                expect(response.fileName).toEqual(
                                    "W01A00310_P012301098765.pdf"
                                );
                                expect(response.certificateType).toEqual("VTG5");
                                expect(response.certificateOrder).toEqual({
                                    current: 1,
                                    total: 2,
                                });
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                            });
                    });
                }
            );
        });

        context("when a prs test result is read from the queue", () => {
            const event: any = JSON.parse(
                fs.readFileSync(
                    path.resolve(__dirname, "../resources/queue-event-prs.json"),
                    "utf8"
                )
            );
            const testResult: any = JSON.parse(event.Records[1].body);
            let resBody: string = "";
            context("and a payload is generated", () => {
                context("and no signatures were found in the bucket", () => {
                    it("should return a PRS payload without signature", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "P012301098765",
                                RawVRM: "VM14MDT",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "01.11.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                Make: "Isuzu",
                                Model: "FM",
                                OdometerHistoryList: [
                                    {
                                        value: 400000,
                                        unit: "kilometres",
                                        date: "19.01.2019",
                                    },
                                    {
                                        value: 390000,
                                        unit: "kilometres",
                                        date: "18.01.2019",
                                    },
                                    {
                                        value: 380000,
                                        unit: "kilometres",
                                        date: "17.01.2019",
                                    },
                                ],
                            },
                            FAIL_DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "P012301098765",
                                RawVRM: "VM14MDT",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "01.11.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                PRSDefects: ["1.1.a A registration plate: missing. Front."],
                                Make: "Isuzu",
                                Model: "FM",
                                OdometerHistoryList: [
                                    {
                                        value: 400000,
                                        unit: "kilometres",
                                        date: "19.01.2019",
                                    },
                                    {
                                        value: 390000,
                                        unit: "kilometres",
                                        date: "18.01.2019",
                                    },
                                    {
                                        value: 380000,
                                        unit: "kilometres",
                                        date: "17.01.2019",
                                    },
                                ],
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                            });
                    });
                });

                context("and lambda-to-lambda calls were unsuccessful", () => {
                    it("should return a PRS payload without bodyMake, bodyModel and odometer history", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "P012301098765",
                                RawVRM: "VM14MDT",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "01.11.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                            },
                            FAIL_DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "P012301098765",
                                RawVRM: "VM14MDT",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "01.11.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                PRSDefects: ["1.1.a A registration plate: missing. Front."],
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };
                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        // @ts-ignore
                        delete techRecordResponseRwtMock.techRecord_make;
                        // @ts-ignore
                        delete techRecordResponseRwtMock.techRecord_model;
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);
                        // Make the functions return undefined
                        // Stub CertificateGenerationService getOdometerHistory method to return undefined value.
                        const getOdometerHistoryStub = sandbox
                            .stub(
                                CertificateGenerationService.prototype,
                                "getOdometerHistory"
                            )
                            .resolves(undefined);
                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getOdometerHistoryStub.restore();
                                // getVehicleMakeAndModelStub.restore();
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                            });
                    });
                });

                context("and signatures were found in the bucket", () => {
                    it("should return a PRS payload with signature", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "P012301098765",
                                RawVRM: "VM14MDT",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "01.11.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                Make: "Isuzu",
                                Model: "FM",
                                OdometerHistoryList: [
                                    {
                                        value: 400000,
                                        unit: "kilometres",
                                        date: "19.01.2019",
                                    },
                                    {
                                        value: 390000,
                                        unit: "kilometres",
                                        date: "18.01.2019",
                                    },
                                    {
                                        value: 380000,
                                        unit: "kilometres",
                                        date: "17.01.2019",
                                    },
                                ],
                            },
                            FAIL_DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "P012301098765",
                                RawVRM: "VM14MDT",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "01.11.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                PRSDefects: ["1.1.a A registration plate: missing. Front."],
                                Make: "Isuzu",
                                Model: "FM",
                                OdometerHistoryList: [
                                    {
                                        value: 400000,
                                        unit: "kilometres",
                                        date: "19.01.2019",
                                    },
                                    {
                                        value: 390000,
                                        unit: "kilometres",
                                        date: "18.01.2019",
                                    },
                                    {
                                        value: 380000,
                                        unit: "kilometres",
                                        date: "17.01.2019",
                                    },
                                ],
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: fs
                                    .readFileSync(
                                        path.resolve(__dirname, `../resources/signatures/1.base64`)
                                    )
                                    .toString(),
                            },
                        };
                        // Add a new signature
                        S3BucketMockService.buckets.push({
                            bucketName: `cvs-signature-${process.env.BUCKET}`,
                            files: ["1.base64"],
                        });
                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                resBody = payload.body;
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                                // Remove the signature
                                S3BucketMockService.buckets.pop();
                            });
                    });
                });
            });

            context(
                "and the generated payload is used to call the MOT service",
                () => {
                    it("successfully generate a certificate", async () => {
                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        expect.assertions(3);
                        return await certificateGenerationService
                            .generateCertificate(testResult)
                            .then((response: any) => {
                                expect(response.fileName).toEqual(
                                    "W01A00310_P012301098765.pdf"
                                );
                                expect(response.certificateType).toEqual("HGV_PRS");
                                expect(response.certificateOrder).toEqual({
                                    current: 1,
                                    total: 2,
                                });
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                            });
                    });
                }
            );
        });

        context("when a failing test result is read from the queue", () => {
            const event: any = {...queueEventFail};
            const testResult: any = JSON.parse(event.Records[1].body);

            context("and a payload is generated", () => {
                context("and no signatures were found in the bucket", () => {
                    it("should return a VTG30 payload without signature", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            FAIL_DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "P012301098765",
                                RawVRM: "VM14MDT",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                ExpiryDate: "25.02.2020",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                DangerousDefects: [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd",
                                ],
                                MinorDefects: [
                                    "54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.",
                                ],
                                AdvisoryDefects: [
                                    "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc",
                                ],
                                Make: "Isuzu",
                                Model: "FM",
                                OdometerHistoryList: [
                                    {
                                        value: 400000,
                                        unit: "kilometres",
                                        date: "19.01.2019",
                                    },
                                    {
                                        value: 390000,
                                        unit: "kilometres",
                                        date: "18.01.2019",
                                    },
                                    {
                                        value: 380000,
                                        unit: "kilometres",
                                        date: "17.01.2019",
                                    },
                                ],
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };
                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                            });
                    });
                });

                context("and lambda-to-lambda calls were unsuccessful", () => {
                    it("should return a VTG30 payload without bodyMake, bodyModel and odometer history", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            FAIL_DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "P012301098765",
                                RawVRM: "VM14MDT",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                ExpiryDate: "25.02.2020",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                DangerousDefects: [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd",
                                ],
                                MinorDefects: [
                                    "54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.",
                                ],
                                AdvisoryDefects: [
                                    "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc",
                                ],
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };
                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        // @ts-ignore
                        delete techRecordResponseRwtMock.techRecord_make;
                        // @ts-ignore
                        delete techRecordResponseRwtMock.techRecord_model;
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);
                        // Make the functions return undefined
                        // Stub CertificateGenerationService getOdometerHistory method to return undefined value.
                        const getOdometerHistoryStub = sandbox
                            .stub(
                                CertificateGenerationService.prototype,
                                "getOdometerHistory"
                            )
                            .resolves(undefined);
                        // Stub CertificateGenerationService getVehicleMakeAndModel method to return undefined value.
                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getOdometerHistoryStub.restore();
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                            });
                    });
                });

                context("and signatures were found in the bucket", () => {
                    it("should return a VTG30 payload with signature", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            FAIL_DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "P012301098765",
                                RawVRM: "VM14MDT",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                ExpiryDate: "25.02.2020",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                DangerousDefects: [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd",
                                ],
                                MinorDefects: [
                                    "54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.",
                                ],
                                AdvisoryDefects: [
                                    "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc",
                                ],
                                Make: "Isuzu",
                                Model: "FM",
                                OdometerHistoryList: [
                                    {
                                        value: 400000,
                                        unit: "kilometres",
                                        date: "19.01.2019",
                                    },
                                    {
                                        value: 390000,
                                        unit: "kilometres",
                                        date: "18.01.2019",
                                    },
                                    {
                                        value: 380000,
                                        unit: "kilometres",
                                        date: "17.01.2019",
                                    },
                                ],
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: fs
                                    .readFileSync(
                                        path.resolve(__dirname, `../resources/signatures/1.base64`)
                                    )
                                    .toString(),
                            },
                        };
                        // Add a new signature
                        S3BucketMockService.buckets.push({
                            bucketName: `cvs-signature-${process.env.BUCKET}`,
                            files: ["1.base64"],
                        });
                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                                // Remove the signature
                                S3BucketMockService.buckets.pop();
                            });
                    });
                });
            });

            context(
                "and the generated payload is used to call the MOT service",
                () => {
                    it("successfully generate a certificate", async () => {
                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        expect.assertions(3);
                        return await certificateGenerationService
                            .generateCertificate(testResult)
                            .then((response: any) => {
                                expect(response.fileName).toEqual(
                                    "W01A00310_P012301098765.pdf"
                                );
                                expect(response.certificateType).toEqual("VTG30");
                                expect(response.certificateOrder).toEqual({
                                    current: 2,
                                    total: 2,
                                });
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                            });
                    });
                }
            );
        });
    });

    context("CertGenService for TRL", () => {
        context("when a passing test result for TRL is read from the queue", () => {
            const event: any = {...queueEventPass};
            const testResult: any = JSON.parse(event.Records[2].body);

            context("and a payload is generated", () => {
                context("and no signatures were found in the bucket", () => {
                    it("should return a VTG5A payload without signature", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "T12876765",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "01.11.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                Make: "STANLEY",
                                Model: "AUTOTRL",
                                Trn: "ABC123",
                                IsTrailer: true
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };
                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                            });
                    });
                });

                context("and lambda-to-lambda calls were unsuccessful", () => {
                    it("should return a VTG5A payload without bodyMake, bodyModel and odometer history", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                IsTrailer: true,
                                Trn: "ABC123",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "T12876765",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "01.11.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };
                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        // @ts-ignore
                        delete techRecordResponseRwtMock.techRecord_model;
                        // @ts-ignore
                        delete techRecordResponseRwtMock.techRecord_make;
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        // Make the functions return undefined
                        // Stub CertificateGenerationService getOdometerHistory method to return undefined value.
                        const getOdometerHistoryStub = sandbox
                            .stub(
                                CertificateGenerationService.prototype,
                                "getOdometerHistory"
                            )
                            .resolves(undefined);
                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getOdometerHistoryStub.restore();
                                // getVehicleMakeAndModelStub.restore();
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                            });
                    });
                });

                context("and signatures were found in the bucket", () => {
                    it("should return a VTG5A payload with signature", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "T12876765",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "01.11.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                Make: "STANLEY",
                                Model: "AUTOTRL",
                                Trn: "ABC123",
                                IsTrailer: true,
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: fs
                                    .readFileSync(
                                        path.resolve(__dirname, `../resources/signatures/1.base64`)
                                    )
                                    .toString(),
                            },
                        };
                        // Add a new signature
                        S3BucketMockService.buckets.push({
                            bucketName: `cvs-signature-${process.env.BUCKET}`,
                            files: ["1.base64"],
                        });

                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);


                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                                // Remove the signature
                                S3BucketMockService.buckets.pop();
                            });
                    });
                });
            });

            context(
                "and the generated payload is used to call the MOT service",
                () => {
                    it("successfully generate a certificate", async () => {

                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        expect.assertions(3);
                        return await certificateGenerationService
                            .generateCertificate(testResult)
                            .then((response: any) => {
                                expect(response.fileName).toEqual("W01A00310_T12876765.pdf");
                                expect(response.certificateType).toEqual("VTG5A");
                                expect(response.certificateOrder).toEqual({
                                    current: 1,
                                    total: 2,
                                });
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                            });
                    });
                }
            );
            context(
                "and trailer registration lambda returns status code 404 not found",
                () => {
                    it("should return a VTG5A payload without Trn", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "T12876765",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "01.11.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                Make: "STANLEY",
                                Model: "AUTOTRL",
                                IsTrailer: true,
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: fs
                                    .readFileSync(
                                        path.resolve(__dirname, `../resources/signatures/1.base64`)
                                    )
                                    .toString(),
                            },
                        };
                        // Add a new signature
                        S3BucketMockService.buckets.push({
                            bucketName: `cvs-signature-${process.env.BUCKET}`,
                            files: ["1.base64"],
                        });

                        const getTrailerRegistrationStub = sandbox
                            .stub(
                                CertificateGenerationService.prototype,
                                "getTrailerRegistrationObject"
                            )
                            .resolves({Trn: undefined, IsTrailer: true});

                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                                // Remove the signature
                                S3BucketMockService.buckets.pop();
                                getTrailerRegistrationStub.restore();
                            });
                    });
                }
            );

            context(
                "and trailer registration lambda returns status code other than 200 or 404 not found",
                () => {
                    it("should throw an error", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "T12876765",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "01.11.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                Make: "STANLEY",
                                Model: "AUTOTRL",
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: fs
                                    .readFileSync(
                                        path.resolve(__dirname, `../resources/signatures/1.base64`)
                                    )
                                    .toString(),
                            },
                        };
                        // Add a new signature
                        S3BucketMockService.buckets.push({
                            bucketName: `cvs-signature-${process.env.BUCKET}`,
                            files: ["1.base64"],
                        });

                        const getTrailerRegistrationStub = sandbox
                            .stub(
                                CertificateGenerationService.prototype,
                                "getTrailerRegistrationObject"
                            )
                            .rejects({statusCode: 500, body: "an error occured"});

                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .catch((err: any) => {
                                expect(err.statusCode).toEqual(500);
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                                // Remove the signature
                                S3BucketMockService.buckets.pop();
                                getTrailerRegistrationStub.restore();
                            });
                    });
                }
            );
        });

        context("when a prs test result is read from the queue", () => {
            const event: any = JSON.parse(
                fs.readFileSync(
                    path.resolve(__dirname, "../resources/queue-event-prs.json"),
                    "utf8"
                )
            );
            const testResult: any = JSON.parse(event.Records[2].body);
            let resBody: string = "";
            context("and a payload is generated", () => {
                context("and no signatures were found in the bucket", () => {
                    it("should return a PRS payload without signature", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "T12876765",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "01.11.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                Make: "STANLEY",
                                Model: "AUTOTRL",
                                Trn: "ABC123",
                                IsTrailer: true,
                            },
                            FAIL_DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "T12876765",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "01.11.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                PRSDefects: ["1.1.a A registration plate: missing. Front."],
                                Make: "STANLEY",
                                Model: "AUTOTRL",
                                Trn: "ABC123",
                                IsTrailer: true,
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                            });
                    });
                });

                context("and lambda-to-lambda calls were unsuccessful", () => {
                    it("should return a PRS payload without bodyMake, bodyModel and odometer history", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                Trn: "ABC123",
                                IsTrailer: true,
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "T12876765",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "01.11.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                            },
                            FAIL_DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "T12876765",
                                IsTrailer: true,
                                Trn: "ABC123",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "01.11.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                PRSDefects: ["1.1.a A registration plate: missing. Front."],
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        // @ts-ignore
                        delete techRecordResponseRwtMock.techRecord_make;
                        // @ts-ignore
                        delete techRecordResponseRwtMock.techRecord_model;
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        // Make the functions return undefined
                        // Stub CertificateGenerationService getOdometerHistory method to return undefined value.
                        const getOdometerHistoryStub = sandbox
                            .stub(
                                CertificateGenerationService.prototype,
                                "getOdometerHistory"
                            )
                            .resolves(undefined);
                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getOdometerHistoryStub.restore();
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                            });
                    });
                });

                context("and signatures were found in the bucket", () => {
                    it("should return a PRS payload with signature", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "T12876765",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "01.11.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                Make: "STANLEY",
                                Model: "AUTOTRL",
                                Trn: "ABC123",
                                IsTrailer: true,
                            },
                            FAIL_DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "T12876765",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "01.11.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                PRSDefects: ["1.1.a A registration plate: missing. Front."],
                                Make: "STANLEY",
                                Model: "AUTOTRL",
                                Trn: "ABC123",
                                IsTrailer: true,
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: fs
                                    .readFileSync(
                                        path.resolve(__dirname, `../resources/signatures/1.base64`)
                                    )
                                    .toString(),
                            },
                        };
                        // Add a new signature
                        S3BucketMockService.buckets.push({
                            bucketName: `cvs-signature-${process.env.BUCKET}`,
                            files: ["1.base64"],
                        });

                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                resBody = payload.body;
                                // Remove the signature
                                S3BucketMockService.buckets.pop();
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                            });
                    });
                });
            });

            context(
                "and the generated payload is used to call the MOT service",
                () => {
                    it("successfully generate a certificate", async () => {

                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        expect.assertions(3);
                        return await certificateGenerationService
                            .generateCertificate(testResult)
                            .then((response: any) => {
                                expect(response.fileName).toEqual("W01A00310_T12876765.pdf");
                                expect(response.certificateType).toEqual("TRL_PRS");
                                expect(response.certificateOrder).toEqual({
                                    current: 1,
                                    total: 2,
                                });
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                            });
                    });
                }
            );
        });

        context("when a failing test result is read from the queue", () => {
            const event: any = {...queueEventFail};
            const testResult: any = JSON.parse(event.Records[2].body);

            context("and a payload is generated", () => {
                context("and no signatures were found in the bucket", () => {
                    it("should return a VTG30 payload without signature", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            FAIL_DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "T12876765",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                ExpiryDate: "25.02.2020",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                DangerousDefects: [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd",
                                ],
                                MinorDefects: [
                                    "54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.",
                                ],
                                AdvisoryDefects: [
                                    "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc",
                                ],
                                Make: "STANLEY",
                                Model: "AUTOTRL",
                                Trn: "ABC123",
                                IsTrailer: true,
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                            });

                    });
                });

                context("and lambda-to-lambda calls were unsuccessful", () => {
                    it("should return a VTG30 payload without bodyMake, bodyModel and odometer history", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            FAIL_DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                IsTrailer: true,
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                Trn: "ABC123",
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "T12876765",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                ExpiryDate: "25.02.2020",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                DangerousDefects: [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd",
                                ],
                                MinorDefects: [
                                    "54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.",
                                ],
                                AdvisoryDefects: [
                                    "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc",
                                ],
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        // @ts-ignore
                        delete techRecordResponseRwtMock.techRecord_make;
                        // @ts-ignore
                        delete techRecordResponseRwtMock.techRecord_model;
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        // Make the functions return undefined
                        // Stub CertificateGenerationService getOdometerHistory method to return undefined value.
                        const getOdometerHistoryStub = sandbox
                            .stub(
                                CertificateGenerationService.prototype,
                                "getOdometerHistory"
                            )
                            .resolves(undefined);
                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getOdometerHistoryStub.restore();
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                                // getVehicleMakeAndModelStub.restore();
                            });
                    });
                });

                context("and signatures were found in the bucket", () => {
                    it("should return a VTG30 payload with signature", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            FAIL_DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "T12876765",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                ExpiryDate: "25.02.2020",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                DangerousDefects: [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd",
                                ],
                                MinorDefects: [
                                    "54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.",
                                ],
                                AdvisoryDefects: [
                                    "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc",
                                ],
                                Make: "STANLEY",
                                Model: "AUTOTRL",
                                Trn: "ABC123",
                                IsTrailer: true,
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: fs
                                    .readFileSync(
                                        path.resolve(__dirname, `../resources/signatures/1.base64`)
                                    )
                                    .toString(),
                            },
                        };
                        // Add a new signature
                        S3BucketMockService.buckets.push({
                            bucketName: `cvs-signature-${process.env.BUCKET}`,
                            files: ["1.base64"],
                        });

                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                                // Remove the signature
                                S3BucketMockService.buckets.pop();
                            });
                    });
                });
            });

            context(
                "and the generated payload is used to call the MOT service",
                () => {
                    it("successfully generate a certificate", async () => {

                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        expect.assertions(3);
                        return await certificateGenerationService
                            .generateCertificate(testResult)
                            .then((response: any) => {
                                expect(response.fileName).toEqual("W01A00310_T12876765.pdf");
                                expect(response.certificateType).toEqual("VTG30");
                                expect(response.certificateOrder).toEqual({
                                    current: 2,
                                    total: 2,

                                });
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                            });
                    });
                }
            );

            context(
                "and trailer registration lambda returns status code 404 not found",
                () => {
                    it("should return a VTG30 payload without Trn", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            FAIL_DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres",
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "T12876765",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                ExpiryDate: "25.02.2020",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                DangerousDefects: [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd",
                                ],
                                MinorDefects: [
                                    "54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.",
                                ],
                                AdvisoryDefects: [
                                    "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc",
                                ],
                                Make: "STANLEY",
                                Model: "AUTOTRL",
                                IsTrailer: true,
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };
                        const getTrailerRegistrationStub = sandbox
                            .stub(
                                CertificateGenerationService.prototype,
                                "getTrailerRegistrationObject"
                            )
                            .resolves({Trn: undefined, IsTrailer: true});

                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getTechRecordSearchStub.restore();
                                getTechRecordStub.restore();
                                // Remove the signature
                                S3BucketMockService.buckets.pop();
                                getTrailerRegistrationStub.restore();
                            });
                    });
                }
            );
        });
    });

    context("CertGenService for ADR", () => {
        context("when a passing test result for ADR is read from the queue", () => {
            const event: any = cloneDeep(queueEventPass);
            const testResult: any = JSON.parse(event.Records[1].body);
            testResult.testTypes.testTypeId = "50";

            context("and a payload is generated", () => {
                context("and no signatures were found in the bucket", () => {
                    it("should return an ADR_PASS payload without signature", async () => {
                        const expectedResult: any = JSON.parse(
                            fs.readFileSync(
                                path.resolve(
                                    __dirname,
                                    "../resources/doc-gen-payload-adr.json"
                                ),
                                "utf8"
                            )
                        );

                        const techRecordResponseAdrMock = JSON.parse(
                            fs.readFileSync(
                                path.resolve(
                                    __dirname,
                                    "../resources/tech-records-response-adr.json"
                                ),
                                "utf8"
                            )
                        );

                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        delete expectedResult.techRecord_make;
                        delete expectedResult.techRecord_model;
                        delete expectedResult.ApplicantDetails;
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                            });
                    });
                });

                context("and signatures were found in the bucket", () => {
                    it("should return an ADR_PASS payload with signature", async () => {
                        const expectedResult: any = JSON.parse(
                            fs.readFileSync(
                                path.resolve(
                                    __dirname,
                                    "../resources/doc-gen-payload-adr.json"
                                ),
                                "utf8"
                            )
                        );
                        expectedResult.Signature.ImageType = "png";
                        expectedResult.Signature.ImageData = fs
                            .readFileSync(
                                path.resolve(__dirname, `../resources/signatures/1.base64`)
                            )
                            .toString();
                        JSON.parse(
                            fs.readFileSync(
                                path.resolve(
                                    __dirname,
                                    "../resources/tech-records-response-adr.json"
                                ),
                                "utf8"
                            )
                        );
// Add a new signature
                        S3BucketMockService.buckets.push({
                            bucketName: `cvs-signature-${process.env.BUCKET}`,
                            files: ["1.base64"],
                        });

                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                // getTechRecordStub.restore();
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                                S3BucketMockService.buckets.pop();
                            });
                    });
                });
            });
        });
    });

    context("CertGenService for Roadworthiness test", () => {
        context(
            "when a passing test result for Roadworthiness test for HGV or TRL is read from the queue",
            () => {
                const event: any = cloneDeep(queueEventPass);
                const testResult: ITestResult = JSON.parse(event.Records[1].body);
                testResult.testTypes.testTypeId = "122";
                testResult.vin = "GYFC26269R240355";
                testResult.vrm = "NKPILNCN";
                context("and a payload is generated", () => {
                    context("and no signatures were found in the bucket", () => {
                        it("should return an RWT_DATA payload without signature", async () => {
                            const expectedResult: ICertificatePayload = cloneDeep(
                                docGenRwt[0]
                            );

                            const getTechRecordSearchStub = sandbox
                                .stub(certificateGenerationService, "callSearchTechRecords")
                                .resolves(techRecordsRwtSearch);

                            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                            const getTechRecordStub = sandbox
                                .stub(certificateGenerationService, "callGetTechRecords")
                                .resolves((techRecordResponseRwtMock) as any);

                            return await certificateGenerationService
                                .generatePayload(testResult)
                                .then((payload: any) => {
                                    expect(payload).toEqual(expectedResult);
                                    getTechRecordStub.restore();
                                    getTechRecordSearchStub.restore();
                                });
                        });
                    });

                    context("and signatures were found in the bucket", () => {
                        it("should return an RWT_DATA payload with signature", async () => {
                            const expectedResult: ICertificatePayload = cloneDeep(
                                docGenRwt[1]
                            );

                            // Add a new signature
                            S3BucketMockService.buckets.push({
                                bucketName: `cvs-signature-${process.env.BUCKET}`,
                                files: ["1.base64"],
                            });

                            const getTechRecordSearchStub = sandbox
                                .stub(certificateGenerationService, "callSearchTechRecords")
                                .resolves(techRecordsRwtSearch);

                            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                            const getTechRecordStub = sandbox
                                .stub(certificateGenerationService, "callGetTechRecords")
                                .resolves((techRecordResponseRwtMock) as any);

                            return await certificateGenerationService
                                .generatePayload(testResult)
                                .then((payload: any) => {
                                    expect(payload).toEqual(expectedResult);
                                    getTechRecordStub.restore();
                                    S3BucketMockService.buckets.pop();
                                    getTechRecordStub.restore();
                                    getTechRecordSearchStub.restore();
                                });
                        });
                    });
                });
            }
        );
        context(
            "and the generate certificate is used to call the doc generation service",
            () => {
                it("should pass certificateType as RWT", async () => {
                    const event: any = cloneDeep(queueEventPass);
                    const testResult: ITestResult = JSON.parse(event.Records[1].body);
                    testResult.testTypes.testTypeId = "122";
                    testResult.vin = "GYFC26269R240355";
                    testResult.vrm = "NKPILNCN";

                    const getTechRecordSearchStub = sandbox
                        .stub(certificateGenerationService, "callSearchTechRecords")
                        .resolves(techRecordsRwtSearch);

                    const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                    const getTechRecordStub = sandbox
                        .stub(certificateGenerationService, "callGetTechRecords")
                        .resolves((techRecordResponseRwtMock) as any);

                    expect.assertions(1);
                    return await certificateGenerationService
                        .generateCertificate(testResult)
                        .then((response: any) => {
                            expect(response.certificateType).toEqual("RWT");
                            getTechRecordStub.restore();
                            getTechRecordSearchStub.restore();
                        });
                });
            }
        );

        context(
            "when a failing test result for Roadworthiness test for HGV or TRL is read from the queue",
            () => {
                const event: any = cloneDeep(queueEventFail);
                const testResult: ITestResult = JSON.parse(event.Records[2].body);
                testResult.testTypes.testTypeId = "91";
                testResult.vin = "T12768594";
                testResult.trailerId = "0285678";
                context("and a payload is generated", () => {
                    context("and no signatures were found in the bucket", () => {
                        it("should return an RWT_DATA payload without signature", async () => {
                            const expectedResult: ICertificatePayload = cloneDeep(
                                docGenRwt[4]
                            );
                            const getTechRecordSearchStub = sandbox
                                .stub(certificateGenerationService, "callSearchTechRecords")
                                .resolves(techRecordsRwtSearch);

                            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                            const getTechRecordStub = sandbox
                                .stub(certificateGenerationService, "callGetTechRecords")
                                .resolves((techRecordResponseRwtMock) as any);

                            const payload = await certificateGenerationService
                                .generatePayload(testResult);
                            expect(payload).toEqual(expectedResult);
                            getTechRecordStub.restore();
                            getTechRecordStub.restore();
                            getTechRecordSearchStub.restore();
                        });
                    });

                    context("and signatures were found in the bucket", () => {
                        it("should return an RWT_DATA payload with signature", async () => {
                            const expectedResult: ICertificatePayload = cloneDeep(
                                docGenRwt[3]
                            );

                            // Add a new signature
                            S3BucketMockService.buckets.push({
                                bucketName: `cvs-signature-${process.env.BUCKET}`,
                                files: ["1.base64"],
                            });

                            const getTechRecordSearchStub = sandbox
                                .stub(certificateGenerationService, "callSearchTechRecords")
                                .resolves(techRecordsRwtSearch);

                            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                            const getTechRecordStub = sandbox
                                .stub(certificateGenerationService, "callGetTechRecords")
                                .resolves((techRecordResponseRwtMock) as any);

                            const payload = await certificateGenerationService
                                .generatePayload(testResult);
                            expect(payload).toEqual(expectedResult);
                            S3BucketMockService.buckets.pop();
                            getTechRecordStub.restore();
                            getTechRecordSearchStub.restore();
                        });
                    });
                });
            }
        );
    });

    context("CertificateUploadService", () => {
        context("when a valid event is received", () => {
            const event: any = JSON.parse(
                fs.readFileSync(
                    path.resolve(__dirname, "../resources/queue-event-prs.json"),
                    "utf8"
                )
            );
            const testResult: any = JSON.parse(event.Records[0].body);
            const certificateUploadService: CertificateUploadService =
                Injector.resolve<CertificateUploadService>(CertificateUploadService, [
                    S3BucketMockService,
                ]);

            // tslint:disable-next-line:no-shadowed-variable
            const certificateGenerationService: CertificateGenerationService =
                Injector.resolve<CertificateGenerationService>(
                    CertificateGenerationService,
                    [S3BucketMockService, LambdaMockService]
                );

            context("when uploading a certificate", () => {
                context("and the S3 bucket exists and is accesible", () => {
                    it("should successfully upload the certificate", async () => {
                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        const generatedCertificateResponse: IGeneratedCertificateResponse =
                            await certificateGenerationService.generateCertificate(
                                testResult
                            );
                        S3BucketMockService.buckets.push({
                            bucketName: `cvs-cert-${process.env.BUCKET}`,
                            files: [],
                        });

                        return certificateUploadService
                            .uploadCertificate(generatedCertificateResponse)
                            .then((response: ManagedUpload.SendData) => {
                                expect(response.Key).toEqual(
                                    `${process.env.BRANCH}/${generatedCertificateResponse.fileName}`
                                );
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                                S3BucketMockService.buckets.pop();
                            });
                    });
                });

                context("and the S3 bucket does not exist or is not accesible", () => {
                    it("should throw an error", async () => {
                        const getTechRecordSearchStub = sandbox
                            .stub(certificateGenerationService, "callSearchTechRecords")
                            .resolves(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        const getTechRecordStub = sandbox
                            .stub(certificateGenerationService, "callGetTechRecords")
                            .resolves((techRecordResponseRwtMock) as any);

                        const generatedCertificateResponse: IGeneratedCertificateResponse =
                            await certificateGenerationService.generateCertificate(
                                testResult
                            );
                        expect.assertions(1);
                        return certificateUploadService
                            .uploadCertificate(generatedCertificateResponse)
                            .catch((error: any) => {
                                expect(error).toBeInstanceOf(Error);
                                getTechRecordStub.restore();
                                getTechRecordSearchStub.restore();
                            });
                    });
                });
            });
        });
    });

    context("CertGen function", () => {
        context("when a failing test result is read from the queue", () => {
            const event: any = {...queueEventFail};
            context("and the testResultId is malformed", () => {
                it("should thrown an error", async () => {
                    expect.assertions(1);
                    try {
                        await certGen(event, undefined as any, () => {
                            return;
                        });
                    } catch (err) {
                        expect((err as unknown as Error).message).toEqual("Bad Test Record: 1");
                    }
                });
            });
            context("and the event is empty", () => {
                it("should thrown an error", async () => {
                    expect.assertions(1);
                    try {
                        await certGen({}, undefined as any, () => {
                            return;
                        });
                    } catch (err) {
                        expect((err as unknown as Error).message).toEqual("Event is empty");
                    }
                });
            });
            context("and the event has no records", () => {
                it("should thrown an error", async () => {
                    expect.assertions(1);
                    try {
                        await certGen(
                            {otherStuff: "hi", Records: []},
                            undefined as any,
                            () => {
                                return;
                            }
                        );
                    } catch (err) {
                        expect((err as unknown as Error).message).toEqual("Event is empty");
                    }
                });
            });
        });
    });
});
