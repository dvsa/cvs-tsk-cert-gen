import {Injector} from "../../src/models/injector/Injector";
import * as fs from "fs";
import * as path from "path";
import {CertificateGenerationService, IGeneratedCertificateResponse} from "../../src/services/CertificateGenerationService";
import {S3BucketMockService} from "../models/S3BucketMockService";
import {LambdaMockService} from "../models/LambdaMockService";
import {CertificateUploadService} from "../../src/services/CertificateUploadService";
import {ManagedUpload} from "aws-sdk/clients/s3";
import {certGen} from "../../src/functions/certGen";
import mockContext from "aws-lambda-mock-context";
import sinon from "sinon";
import {LambdaService} from "../../src/services/LambdaService";
import queueEventPass from "../resources/queue-event-pass.json";
import queueEventFail from "../resources/queue-event-fail.json";
import queueEventFailPRS from "../resources/queue-event-fail-prs.json";
import queueEvent from "../resources/queue-event.json";
import techRecordsRwt from "../resources/tech-records-response-rwt.json";
import docGenRwt from "../resources/doc-gen-payload-rwt.json";
const ctx = mockContext();
const sandbox = sinon.createSandbox();
import {cloneDeep} from "lodash";
import { ITestResult, ICertificatePayload } from "../../src/models";

describe("cert-gen", () => {
    const certificateGenerationService: CertificateGenerationService = Injector.resolve<CertificateGenerationService>(CertificateGenerationService, [S3BucketMockService, LambdaMockService]);
    afterAll(() => {
        sandbox.restore();
    });
    context("CertificateGenerationService", () => {
        LambdaMockService.populateFunctions();

        context("when a passing test result is read from the queue", () => {
            const event: any = {...queueEventPass};
            const testResult: any = JSON.parse(event.Records[0].body);

            context("and a payload is generated", () => {
                context("and no signatures were found in the bucket", () => {
                    it("should return a VTP20 payload without signature", () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres"
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
                                SeatBeltPreviousCheckDate:  "26.02.2019",
                                SeatBeltNumber: 2,
                                Make: "Mercedes",
                                Model: "632,01",
                                OdometerHistoryList: [
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    },
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    },
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    }
                                ]
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null
                            }
                        };

                        return certificateGenerationService.generatePayload(testResult)
                        .then((payload: any) => {
                            expect(payload).toEqual(expectedResult);
                        });
                    });
                });

                context("and lambda-to-lambda calls were unsuccessful", () => {
                    it("should return a VTP20 payload without bodyMake, bodyModel and odometer history", () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres"
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
                                SeatBeltPreviousCheckDate:  "26.02.2019",
                                SeatBeltNumber: 2
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null
                            }
                        };
                        // Make the functions return undefined
                        // Stub CertificateGenerationService getOdometerHistory method to return undefined value.
                        const getOdometerHistoryStub = sandbox.stub(CertificateGenerationService.prototype, "getOdometerHistory").resolves(undefined);
                        // Stub CertificateGenerationService getVehicleMakeAndModel method to return undefined value.
                        const getVehicleMakeAndModelStub = sandbox.stub(CertificateGenerationService.prototype, "getVehicleMakeAndModel").resolves(undefined);
                        return certificateGenerationService.generatePayload(testResult)
                        .then((payload: any) => {
                            expect(payload).toEqual(expectedResult);
                            getOdometerHistoryStub.restore();
                            getVehicleMakeAndModelStub.restore();
                        });
                    });
                });

                context("and signatures were found in the bucket", () => {
                    it("should return a VTP20 payload with signature", () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres"
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
                                SeatBeltPreviousCheckDate:  "26.02.2019",
                                SeatBeltNumber: 2,
                                Make: "Mercedes",
                                Model: "632,01",
                                OdometerHistoryList: [
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    },
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    },
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    }
                                ]
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: fs.readFileSync(path.resolve(__dirname, `../resources/signatures/1.base64`)).toString()
                            }
                        };
                        // Add a new signature
                        S3BucketMockService.buckets.push({
                            bucketName: `cvs-signature-${process.env.BUCKET}`,
                            files: ["1.base64"]
                        });

                        return certificateGenerationService.generatePayload(testResult)
                        .then((payload: any) => {
                            expect(payload).toEqual(expectedResult);

                            // Remove the signature
                            S3BucketMockService.buckets.pop();
                        });
                    });
                });


            });

            context("and the generated payload is used to call the MOT service", () => {
                it("successfully generate a certificate", () => {
                    expect.assertions(3);
                    return certificateGenerationService.generateCertificate(testResult)
                    .then((response: any) => {
                        expect(response.fileName).toEqual("W01A00310_XMGDE02FS0H012345_1.pdf");
                        expect(response.certificateType).toEqual("VTP20");
                        expect(response.certificateOrder).toEqual({ current: 1, total: 2 });
                    });
                });
            });

        });

        context("when a failing test result is read from the queue", () => {
            const event: any = {...queueEventFail};
            const testResult: any = JSON.parse(event.Records[0].body);

            context("and a payload is generated", () => {
                context("and no signatures were found in the bucket", () => {
                    it("should return a VTP30 payload without signature", () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            FAIL_DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres"
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
                                SeatBeltPreviousCheckDate:  "26.02.2019",
                                SeatBeltNumber: 2,
                                DangerousDefects: [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd"
                                ],
                                MinorDefects: [
                                    "54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside."
                                ],
                                AdvisoryDefects: [
                                    "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc"
                                ],
                                Make: "Mercedes",
                                Model: "632,01",
                                OdometerHistoryList: [
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    },
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    },
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    }
                                ]
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null
                            }
                        };

                        return certificateGenerationService.generatePayload(testResult)
                        .then((payload: any) => {
                            expect(payload).toEqual(expectedResult);
                        });
                    });
                });

                context("and lambda-to-lambda calls were unsuccessful", () => {
                    it("should return a VTP30 payload without bodyMake, bodyModel and odometer history", () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            FAIL_DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres"
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
                                SeatBeltPreviousCheckDate:  "26.02.2019",
                                SeatBeltNumber: 2,
                                DangerousDefects: [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd"
                                ],
                                MinorDefects: [
                                    "54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside."
                                ],
                                AdvisoryDefects: [
                                    "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc"
                                ],
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null
                            }
                        };
                        // Make the functions return undefined
                        // Stub CertificateGenerationService getOdometerHistory method to return undefined value.
                        const getOdometerHistoryStub = sandbox.stub(CertificateGenerationService.prototype, "getOdometerHistory").resolves(undefined);
                        // Stub CertificateGenerationService getVehicleMakeAndModel method to return undefined value.
                        const getVehicleMakeAndModelStub = sandbox.stub(CertificateGenerationService.prototype, "getVehicleMakeAndModel").resolves(undefined);

                        return certificateGenerationService.generatePayload(testResult)
                        .then((payload: any) => {
                            expect(payload).toEqual(expectedResult);
                            getOdometerHistoryStub.restore();
                            getVehicleMakeAndModelStub.restore();
                        });
                    });
                });

                context("and signatures were found in the bucket", () => {
                    it("should return a VTP30 payload with signature", () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            FAIL_DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres"
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
                                SeatBeltPreviousCheckDate:  "26.02.2019",
                                SeatBeltNumber: 2,
                                DangerousDefects: [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd"
                                ],
                                MinorDefects: [
                                    "54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside."
                                ],
                                AdvisoryDefects: [
                                    "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc"
                                ],
                                Make: "Mercedes",
                                Model: "632,01",
                                OdometerHistoryList: [
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    },
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    },
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    }
                                ]
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: fs.readFileSync(path.resolve(__dirname, `../resources/signatures/1.base64`)).toString()
                            }
                        };
                        // Add a new signature
                        S3BucketMockService.buckets.push({
                            bucketName: `cvs-signature-${process.env.BUCKET}`,
                            files: ["1.base64"]
                        });

                        return certificateGenerationService.generatePayload(testResult)
                        .then((payload: any) => {
                            expect(payload).toEqual(expectedResult);

                            // Remove the signature
                            S3BucketMockService.buckets.pop();
                        });
                    });
                });
            });

            context("and the generated payload is used to call the MOT service", () => {
                it("successfully generate a certificate", () => {
                    expect.assertions(3);
                    return certificateGenerationService.generateCertificate(testResult)
                    .then((response: any) => {
                        expect(response.fileName).toEqual("W01A00310_XMGDE02FS0H012345_2.pdf");
                        expect(response.certificateType).toEqual("VTP30");
                        expect(response.certificateOrder).toEqual({ current: 2, total: 2 });
                    });
                });
            });


        });

        context("when a prs test result is read from the queue", () => {
            const event: any = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../resources/queue-event-prs.json"), "utf8"));
            const testResult: any = JSON.parse(event.Records[0].body);
            let resBody: string = "";
            context("and a payload is generated", () => {
                context("and no signatures were found in the bucket", () => {
                    it("should return a PRS payload without signature", () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres"
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
                                SeatBeltPreviousCheckDate:  "26.02.2019",
                                SeatBeltNumber: 2,
                                Make: "Mercedes",
                                Model: "632,01",
                                OdometerHistoryList: [
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    },
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    },
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    }
                                ]
                            },
                            FAIL_DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres"
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
                                SeatBeltPreviousCheckDate:  "26.02.2019",
                                SeatBeltNumber: 2,
                                PRSDefects: [
                                    "1.1.a A registration plate: missing. Front."
                                ],
                                Make: "Mercedes",
                                Model: "632,01",
                                OdometerHistoryList: [
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    },
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    },
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    }
                                ]
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null
                            }
                        };

                        return certificateGenerationService.generatePayload(testResult)
                        .then((payload: any) => {
                            expect(payload).toEqual(expectedResult);
                        });
                    });
                });

                context("and lambda-to-lambda calls were unsuccessful", () => {
                    it("should return a PRS payload without bodyMake, bodyModel and odometer history", () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres"
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
                                SeatBeltPreviousCheckDate:  "26.02.2019",
                                SeatBeltNumber: 2
                            },
                            FAIL_DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres"
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
                                SeatBeltPreviousCheckDate:  "26.02.2019",
                                SeatBeltNumber: 2,
                                PRSDefects: [
                                    "1.1.a A registration plate: missing. Front."
                                ]
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null
                            }
                        };
                        // Make the functions return undefined
                        // Stub CertificateGenerationService getOdometerHistory method to return undefined value.
                        const getOdometerHistoryStub = sandbox.stub(CertificateGenerationService.prototype, "getOdometerHistory").resolves(undefined);
                        // Stub CertificateGenerationService getVehicleMakeAndModel method to return undefined value.
                        const getVehicleMakeAndModelStub = sandbox.stub(CertificateGenerationService.prototype, "getVehicleMakeAndModel").resolves(undefined);
                        return certificateGenerationService.generatePayload(testResult)
                        .then((payload: any) => {
                            expect(payload).toEqual(expectedResult);
                            getOdometerHistoryStub.restore();
                            getVehicleMakeAndModelStub.restore();
                        });
                    });
                });

                context("and signatures were found in the bucket", () => {
                    it("should return a PRS payload with signature", () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres"
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
                                SeatBeltPreviousCheckDate:  "26.02.2019",
                                SeatBeltNumber: 2,
                                Make: "Mercedes",
                                Model: "632,01",
                                OdometerHistoryList: [
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    },
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    },
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    }
                                ]
                            },
                            FAIL_DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres"
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
                                SeatBeltPreviousCheckDate:  "26.02.2019",
                                SeatBeltNumber: 2,
                                PRSDefects: [
                                    "1.1.a A registration plate: missing. Front."
                                ],
                                Make: "Mercedes",
                                Model: "632,01",
                                OdometerHistoryList: [
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    },
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    },
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    }
                                ]
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: fs.readFileSync(path.resolve(__dirname, `../resources/signatures/1.base64`)).toString()
                            }
                        };
                        // Add a new signature
                        S3BucketMockService.buckets.push({
                            bucketName: `cvs-signature-${process.env.BUCKET}`,
                            files: ["1.base64"]
                        });

                        return certificateGenerationService.generatePayload(testResult)
                        .then((payload: any) => {
                            expect(payload).toEqual(expectedResult);
                            resBody = payload.body;
                            // Remove the signature
                            S3BucketMockService.buckets.pop();
                        });
                    });
                });
            });

            context("and the generated payload is used to call the MOT service", () => {
                it("successfully generate a certificate", () => {
                    expect.assertions(3);
                    return certificateGenerationService.generateCertificate(testResult)
                    .then((response: any) => {
                        expect(response.fileName).toEqual("W01A00310_XMGDE02FS0H012345_1.pdf");
                        expect(response.certificateType).toEqual("PSV_PRS");
                        expect(response.certificateOrder).toEqual({ current: 1, total: 2 });
                    });
                });
            });
        });

        context("when a failing test result is read from the queue", () => {
            const event: any = {...queueEventFailPRS};
            const testResult: any = JSON.parse(event.Records[0].body);

            context("and certificate Data is generated", () => {
                context("and test-result contains a Dagerous Defect with Major defect rectified", () => {
                    it("should return Certificate Data with PRSDefects list in Fail data", () => {
                        const expectedResult: any = {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres"
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
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd"
                                ],
                                MajorDefects: undefined,
                                MinorDefects: [
                                    "54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside."
                                ],
                                AdvisoryDefects: [
                                    "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc"
                                ],
                                PRSDefects: [
                                    "1.1.a A registration plate: missing. Front."
                                ]
                        };

                        return certificateGenerationService.generateCertificateData(testResult, "FAIL_DATA")
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                            });
                    });
                });
            });

            const testResult2: any = JSON.parse(event.Records[1].body);
            context("and certificate Data is generated", () => {
                context("and test-result contains a Major Defect with Dangerous defect rectified", () => {
                    it("should return Certificate Data with PRSDefects list in Fail Data", () => {
                        const expectedResult: any = {
                            TestNumber: "W01A00310",
                            TestStationPNumber: "09-4129632",
                            TestStationName: "Abshire-Kub",
                            CurrentOdometer: {
                                value: 12312,
                                unit: "kilometres"
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
                            MajorDefects: [
                                "1.1.a A registration plate: missing. Front."
                            ],
                            MinorDefects: [
                                "54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside."
                            ],
                            AdvisoryDefects: [
                                "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc"
                            ],
                            PRSDefects: [
                                "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd"
                            ]
                        };

                        return certificateGenerationService.generateCertificateData(testResult2, "FAIL_DATA")
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);

                            });
                    });
                });
            });

            const testResult3: any = JSON.parse(event.Records[2].body);
            context("and certificate Data is generated", () => {
                context("and test-result contains a Major and Dagerous Defect with no Major or Dagerous defect rectified", () => {
                    it("should return Certificate Data with 0 PRSDefects list in Fail Data", () => {
                        const expectedResult: any = {
                            TestNumber: "W01A00310",
                            TestStationPNumber: "09-4129632",
                            TestStationName: "Abshire-Kub",
                            CurrentOdometer: {
                                value: 12312,
                                unit: "kilometres"
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
                                "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd"
                            ],
                            MajorDefects: [
                                "1.1.a A registration plate: missing. Front."
                            ],
                            MinorDefects: [
                                "54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside."
                            ],
                            AdvisoryDefects: [
                                "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc"
                            ],
                            PRSDefects: undefined
                        };

                        return certificateGenerationService.generateCertificateData(testResult3, "FAIL_DATA")
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);

                            });
                    });
                });
            });
        });

        // This needs to be fixed when we have proper jest stubs to use for this.
        //
        // context("generatePayload method", () => {
        //     context("when invoking getVehicleMakeAndModel, passes entire testResult object", () =>  {
        //         let stub = sandbox.stub().resolves({
        //             Make: "make",
        //             Model: "model"
        //         });
        //         certificateGenerationService.getVehicleMakeAndModel = stub;
        //         const event: any = {...queueEventPass};
        //         const testResult: any = JSON.parse(event.Records[0].body);
        //         certificateGenerationService.generatePayload(testResult);
        //         console.log("XXX stub", stub);
        //         expect(stub.getCall(0).args[0]).toEqual(testResult);
        //     })
        // });
    });

    context("CertGenService for HGV", () => {
        context("when a passing test result for HGV is read from the queue", () => {
            const event: any = {...queueEventPass};
            const testResult: any = JSON.parse(event.Records[1].body);

            context("and a payload is generated", () => {
                context("and no signatures were found in the bucket", () => {
                    it("should return a VTG5 payload without signature", () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres"
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
                                SeatBeltPreviousCheckDate:  "26.02.2019",
                                SeatBeltNumber: 2,
                                Make: "Mercedes",
                                Model: "632,01",
                                OdometerHistoryList: [
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    },
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    },
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    }
                                ]
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null
                            }
                        };

                        return certificateGenerationService.generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                            });
                    });
                });

                context("and lambda-to-lambda calls were unsuccessful", () => {
                    it("should return a VTG5 payload without bodyMake, bodyModel and odometer history", () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres"
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
                                SeatBeltPreviousCheckDate:  "26.02.2019",
                                SeatBeltNumber: 2
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null
                            }
                        };
                        // Make the functions return undefined
                        // Stub CertificateGenerationService getOdometerHistory method to return undefined value.
                        const getOdometerHistoryStub = sandbox.stub(CertificateGenerationService.prototype, "getOdometerHistory").resolves(undefined);
                        // Stub CertificateGenerationService getVehicleMakeAndModel method to return undefined value.
                        const getVehicleMakeAndModelStub = sandbox.stub(CertificateGenerationService.prototype, "getVehicleMakeAndModel").resolves(undefined);
                        return certificateGenerationService.generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getOdometerHistoryStub.restore();
                                getVehicleMakeAndModelStub.restore();
                            });
                    });
                });

                context("and signatures were found in the bucket", () => {
                    it("should return a VTG5 payload with signature", () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres"
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
                                SeatBeltPreviousCheckDate:  "26.02.2019",
                                SeatBeltNumber: 2,
                                Make: "Mercedes",
                                Model: "632,01",
                                OdometerHistoryList: [
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    },
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    },
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    }
                                ]
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: fs.readFileSync(path.resolve(__dirname, `../resources/signatures/1.base64`)).toString()
                            }
                        };
                        // Add a new signature
                        S3BucketMockService.buckets.push({
                            bucketName: `cvs-signature-${process.env.BUCKET}`,
                            files: ["1.base64"]
                        });

                        return certificateGenerationService.generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);

                                // Remove the signature
                                S3BucketMockService.buckets.pop();
                            });
                    });
                });

            });

            context("and the generated payload is used to call the MOT service", () => {
                it("successfully generate a certificate", () => {
                    expect.assertions(3);
                    return certificateGenerationService.generateCertificate(testResult)
                        .then((response: any) => {
                            expect(response.fileName).toEqual("W01A00310_P012301098765_1.pdf");
                            expect(response.certificateType).toEqual("VTG5");
                            expect(response.certificateOrder).toEqual({ current: 1, total: 2 });
                        });
                });
            });
        });

        context("when a prs test result is read from the queue", () => {
            const event: any = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../resources/queue-event-prs.json"), "utf8"));
            const testResult: any = JSON.parse(event.Records[1].body);
            let resBody: string = "";
            context("and a payload is generated", () => {
                context("and no signatures were found in the bucket", () => {
                    it("should return a PRS payload without signature", () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres"
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
                                SeatBeltPreviousCheckDate:  "26.02.2019",
                                SeatBeltNumber: 2,
                                Make: "Mercedes",
                                Model: "632,01",
                                OdometerHistoryList: [
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    },
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    },
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    }
                                ]
                            },
                            FAIL_DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres"
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
                                SeatBeltPreviousCheckDate:  "26.02.2019",
                                SeatBeltNumber: 2,
                                PRSDefects: [
                                    "1.1.a A registration plate: missing. Front."
                                ],
                                Make: "Mercedes",
                                Model: "632,01",
                                OdometerHistoryList: [
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    },
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    },
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    }
                                ]
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null
                            }
                        };

                        return certificateGenerationService.generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                            });
                    });
                });

                context("and lambda-to-lambda calls were unsuccessful", () => {
                    it("should return a PRS payload without bodyMake, bodyModel and odometer history", () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres"
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
                                SeatBeltPreviousCheckDate:  "26.02.2019",
                                SeatBeltNumber: 2
                            },
                            FAIL_DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres"
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
                                SeatBeltPreviousCheckDate:  "26.02.2019",
                                SeatBeltNumber: 2,
                                PRSDefects: [
                                    "1.1.a A registration plate: missing. Front."
                                ]
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null
                            }
                        };
                        // Make the functions return undefined
                        // Stub CertificateGenerationService getOdometerHistory method to return undefined value.
                        const getOdometerHistoryStub = sandbox.stub(CertificateGenerationService.prototype, "getOdometerHistory").resolves(undefined);
                        // Stub CertificateGenerationService getVehicleMakeAndModel method to return undefined value.
                        const getVehicleMakeAndModelStub = sandbox.stub(CertificateGenerationService.prototype, "getVehicleMakeAndModel").resolves(undefined);
                        return certificateGenerationService.generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getOdometerHistoryStub.restore();
                                getVehicleMakeAndModelStub.restore();
                            });
                    });
                });

                context("and signatures were found in the bucket", () => {
                    it("should return a PRS payload with signature", () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres"
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
                                SeatBeltPreviousCheckDate:  "26.02.2019",
                                SeatBeltNumber: 2,
                                Make: "Mercedes",
                                Model: "632,01",
                                OdometerHistoryList: [
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    },
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    },
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    }
                                ]
                            },
                            FAIL_DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres"
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
                                SeatBeltPreviousCheckDate:  "26.02.2019",
                                SeatBeltNumber: 2,
                                PRSDefects: [
                                    "1.1.a A registration plate: missing. Front."
                                ],
                                Make: "Mercedes",
                                Model: "632,01",
                                OdometerHistoryList: [
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    },
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    },
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    }
                                ]
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: fs.readFileSync(path.resolve(__dirname, `../resources/signatures/1.base64`)).toString()
                            }
                        };
                        // Add a new signature
                        S3BucketMockService.buckets.push({
                            bucketName: `cvs-signature-${process.env.BUCKET}`,
                            files: ["1.base64"]
                        });

                        return certificateGenerationService.generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                resBody = payload.body;
                                // Remove the signature
                                S3BucketMockService.buckets.pop();
                            });
                    });
                });
            });

            context("and the generated payload is used to call the MOT service", () => {
                it("successfully generate a certificate", () => {
                    expect.assertions(3);
                    return certificateGenerationService.generateCertificate(testResult)
                        .then((response: any) => {
                            expect(response.fileName).toEqual("W01A00310_P012301098765_1.pdf");
                            expect(response.certificateType).toEqual("HGV_PRS");
                            expect(response.certificateOrder).toEqual({ current: 1, total: 2 });
                        });
                });
            });
        });

        context("when a failing test result is read from the queue", () => {
            const event: any = {...queueEventFail};
            const testResult: any = JSON.parse(event.Records[1].body);

            context("and a payload is generated", () => {
                context("and no signatures were found in the bucket", () => {
                    it("should return a VTG30 payload without signature", () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            FAIL_DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres"
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
                                SeatBeltPreviousCheckDate:  "26.02.2019",
                                SeatBeltNumber: 2,
                                DangerousDefects: [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd"
                                ],
                                MinorDefects: [
                                    "54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside."
                                ],
                                AdvisoryDefects: [
                                    "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc"
                                ],
                                Make: "Mercedes",
                                Model: "632,01",
                                OdometerHistoryList: [
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    },
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    },
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    }
                                ]
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null
                            }
                        };

                        return certificateGenerationService.generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                            });
                    });
                });

                context("and lambda-to-lambda calls were unsuccessful", () => {
                    it("should return a VTG30 payload without bodyMake, bodyModel and odometer history", () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            FAIL_DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres"
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
                                SeatBeltPreviousCheckDate:  "26.02.2019",
                                SeatBeltNumber: 2,
                                DangerousDefects: [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd"
                                ],
                                MinorDefects: [
                                    "54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside."
                                ],
                                AdvisoryDefects: [
                                    "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc"
                                ],
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null
                            }
                        };
                        // Make the functions return undefined
                        // Stub CertificateGenerationService getOdometerHistory method to return undefined value.
                        const getOdometerHistoryStub = sandbox.stub(CertificateGenerationService.prototype, "getOdometerHistory").resolves(undefined);
                        // Stub CertificateGenerationService getVehicleMakeAndModel method to return undefined value.
                        const getVehicleMakeAndModelStub = sandbox.stub(CertificateGenerationService.prototype, "getVehicleMakeAndModel").resolves(undefined);

                        return certificateGenerationService.generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getOdometerHistoryStub.restore();
                                getVehicleMakeAndModelStub.restore();
                            });
                    });
                });

                context("and signatures were found in the bucket", () => {
                    it("should return a VTG30 payload with signature", () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            FAIL_DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres"
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
                                SeatBeltPreviousCheckDate:  "26.02.2019",
                                SeatBeltNumber: 2,
                                DangerousDefects: [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd"
                                ],
                                MinorDefects: [
                                    "54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside."
                                ],
                                AdvisoryDefects: [
                                    "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc"
                                ],
                                Make: "Mercedes",
                                Model: "632,01",
                                OdometerHistoryList: [
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    },
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    },
                                    {
                                        value: 350000,
                                        unit: "kilometres",
                                        date: "14.01.2019"
                                    }
                                ]
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: fs.readFileSync(path.resolve(__dirname, `../resources/signatures/1.base64`)).toString()
                            }
                        };
                        // Add a new signature
                        S3BucketMockService.buckets.push({
                            bucketName: `cvs-signature-${process.env.BUCKET}`,
                            files: ["1.base64"]
                        });

                        return certificateGenerationService.generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);

                                // Remove the signature
                                S3BucketMockService.buckets.pop();
                            });
                    });
                });
            });

            context("and the generated payload is used to call the MOT service", () => {
                it("successfully generate a certificate", () => {
                    expect.assertions(3);
                    return certificateGenerationService.generateCertificate(testResult)
                        .then((response: any) => {
                            expect(response.fileName).toEqual("W01A00310_P012301098765_2.pdf");
                            expect(response.certificateType).toEqual("VTG30");
                            expect(response.certificateOrder).toEqual({ current: 2, total: 2 });
                        });
                });
            });
        });
    });

    context("CertGenService for TRL", () => {
        context("when a passing test result for TRL is read from the queue", () => {
            const event: any = {...queueEventPass};
            const testResult: any = JSON.parse(event.Records[2].body);

            context("and a payload is generated", () => {
                context("and no signatures were found in the bucket", () => {
                    it("should return a VTG5A payload without signature", () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres"
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "T12876765",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "01.11.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate:  "26.02.2019",
                                SeatBeltNumber: 2,
                                Make: "Mercedes",
                                Model: "632,01"
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null
                            }
                        };

                        return certificateGenerationService.generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                            });
                    });
                });

                context("and lambda-to-lambda calls were unsuccessful", () => {
                    it("should return a VTG5A payload without bodyMake, bodyModel and odometer history", () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres"
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "T12876765",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "01.11.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate:  "26.02.2019",
                                SeatBeltNumber: 2
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null
                            }
                        };
                        // Make the functions return undefined
                        // Stub CertificateGenerationService getOdometerHistory method to return undefined value.
                        const getOdometerHistoryStub = sandbox.stub(CertificateGenerationService.prototype, "getOdometerHistory").resolves(undefined);
                        // Stub CertificateGenerationService getVehicleMakeAndModel method to return undefined value.
                        const getVehicleMakeAndModelStub = sandbox.stub(CertificateGenerationService.prototype, "getVehicleMakeAndModel").resolves(undefined);
                        return certificateGenerationService.generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getOdometerHistoryStub.restore();
                                getVehicleMakeAndModelStub.restore();
                            });
                    });
                });

                context("and signatures were found in the bucket", () => {
                    it("should return a VTG5A payload with signature", () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres"
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "T12876765",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "01.11.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate:  "26.02.2019",
                                SeatBeltNumber: 2,
                                Make: "Mercedes",
                                Model: "632,01"
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: fs.readFileSync(path.resolve(__dirname, `../resources/signatures/1.base64`)).toString()
                            }
                        };
                        // Add a new signature
                        S3BucketMockService.buckets.push({
                            bucketName: `cvs-signature-${process.env.BUCKET}`,
                            files: ["1.base64"]
                        });

                        return certificateGenerationService.generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);

                                // Remove the signature
                                S3BucketMockService.buckets.pop();
                            });
                    });
                });

            });

            context("and the generated payload is used to call the MOT service", () => {
                it("successfully generate a certificate", () => {
                    expect.assertions(3);
                    return certificateGenerationService.generateCertificate(testResult)
                        .then((response: any) => {
                            expect(response.fileName).toEqual("W01A00310_T12876765_1.pdf");
                            expect(response.certificateType).toEqual("VTG5A");
                            expect(response.certificateOrder).toEqual({ current: 1, total: 2 });
                        });
                });
            });
        });

        context("when a prs test result is read from the queue", () => {
            const event: any = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../resources/queue-event-prs.json"), "utf8"));
            const testResult: any = JSON.parse(event.Records[2].body);
            let resBody: string = "";
            context("and a payload is generated", () => {
                context("and no signatures were found in the bucket", () => {
                    it("should return a PRS payload without signature", () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres"
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "T12876765",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "01.11.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate:  "26.02.2019",
                                SeatBeltNumber: 2,
                                Make: "Mercedes",
                                Model: "632,01"
                            },
                            FAIL_DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres"
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "T12876765",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "01.11.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate:  "26.02.2019",
                                SeatBeltNumber: 2,
                                PRSDefects: [
                                    "1.1.a A registration plate: missing. Front."
                                ],
                                Make: "Mercedes",
                                Model: "632,01"
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null
                            }
                        };

                        return certificateGenerationService.generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                            });
                    });
                });

                context("and lambda-to-lambda calls were unsuccessful", () => {
                    it("should return a PRS payload without bodyMake, bodyModel and odometer history", () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres"
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "T12876765",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "01.11.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate:  "26.02.2019",
                                SeatBeltNumber: 2
                            },
                            FAIL_DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres"
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "T12876765",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "01.11.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate:  "26.02.2019",
                                SeatBeltNumber: 2,
                                PRSDefects: [
                                    "1.1.a A registration plate: missing. Front."
                                ]
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null
                            }
                        };
                        // Make the functions return undefined
                        // Stub CertificateGenerationService getOdometerHistory method to return undefined value.
                        const getOdometerHistoryStub = sandbox.stub(CertificateGenerationService.prototype, "getOdometerHistory").resolves(undefined);
                        // Stub CertificateGenerationService getVehicleMakeAndModel method to return undefined value.
                        const getVehicleMakeAndModelStub = sandbox.stub(CertificateGenerationService.prototype, "getVehicleMakeAndModel").resolves(undefined);
                        return certificateGenerationService.generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getOdometerHistoryStub.restore();
                                getVehicleMakeAndModelStub.restore();
                            });
                    });
                });

                context("and signatures were found in the bucket", () => {
                    it("should return a PRS payload with signature", () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres"
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "T12876765",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "01.11.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate:  "26.02.2019",
                                SeatBeltNumber: 2,
                                Make: "Mercedes",
                                Model: "632,01"
                            },
                            FAIL_DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres"
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "T12876765",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "01.11.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate:  "26.02.2019",
                                SeatBeltNumber: 2,
                                PRSDefects: [
                                    "1.1.a A registration plate: missing. Front."
                                ],
                                Make: "Mercedes",
                                Model: "632,01"
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: fs.readFileSync(path.resolve(__dirname, `../resources/signatures/1.base64`)).toString()
                            }
                        };
                        // Add a new signature
                        S3BucketMockService.buckets.push({
                            bucketName: `cvs-signature-${process.env.BUCKET}`,
                            files: ["1.base64"]
                        });

                        return certificateGenerationService.generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                resBody = payload.body;
                                // Remove the signature
                                S3BucketMockService.buckets.pop();
                            });
                    });
                });
            });

            context("and the generated payload is used to call the MOT service", () => {
                it("successfully generate a certificate", () => {
                    expect.assertions(3);
                    return certificateGenerationService.generateCertificate(testResult)
                        .then((response: any) => {
                            expect(response.fileName).toEqual("W01A00310_T12876765_1.pdf");
                            expect(response.certificateType).toEqual("TRL_PRS");
                            expect(response.certificateOrder).toEqual({ current: 1, total: 2 });
                        });
                });
            });
        });

        context("when a failing test result is read from the queue", () => {
            const event: any = {...queueEventFail};
            const testResult: any = JSON.parse(event.Records[2].body);

            context("and a payload is generated", () => {
                context("and no signatures were found in the bucket", () => {
                    it("should return a VTG30 payload without signature", () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            FAIL_DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres"
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "T12876765",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                ExpiryDate: "25.02.2020",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate:  "26.02.2019",
                                SeatBeltNumber: 2,
                                DangerousDefects: [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd"
                                ],
                                MinorDefects: [
                                    "54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside."
                                ],
                                AdvisoryDefects: [
                                    "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc"
                                ],
                                Make: "Mercedes",
                                Model: "632,01"
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null
                            }
                        };

                        return certificateGenerationService.generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                            });
                    });
                });

                context("and lambda-to-lambda calls were unsuccessful", () => {
                    it("should return a VTG30 payload without bodyMake, bodyModel and odometer history", () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            FAIL_DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres"
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "T12876765",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                ExpiryDate: "25.02.2020",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate:  "26.02.2019",
                                SeatBeltNumber: 2,
                                DangerousDefects: [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd"
                                ],
                                MinorDefects: [
                                    "54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside."
                                ],
                                AdvisoryDefects: [
                                    "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc"
                                ],
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null
                            }
                        };
                        // Make the functions return undefined
                        // Stub CertificateGenerationService getOdometerHistory method to return undefined value.
                        const getOdometerHistoryStub = sandbox.stub(CertificateGenerationService.prototype, "getOdometerHistory").resolves(undefined);
                        // Stub CertificateGenerationService getVehicleMakeAndModel method to return undefined value.
                        const getVehicleMakeAndModelStub = sandbox.stub(CertificateGenerationService.prototype, "getVehicleMakeAndModel").resolves(undefined);

                        return certificateGenerationService.generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getOdometerHistoryStub.restore();
                                getVehicleMakeAndModelStub.restore();
                            });
                    });
                });

                context("and signatures were found in the bucket", () => {
                    it("should return a VTG30 payload with signature", () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            FAIL_DATA: {
                                TestNumber: "W01A00310",
                                TestStationPNumber: "09-4129632",
                                TestStationName: "Abshire-Kub",
                                CurrentOdometer: {
                                    value: 12312,
                                    unit: "kilometres"
                                },
                                IssuersName: "CVS Dev1",
                                DateOfTheTest: "26.02.2019",
                                CountryOfRegistrationCode: "gb",
                                VehicleEuClassification: "M1",
                                RawVIN: "T12876765",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                ExpiryDate: "25.02.2020",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate:  "26.02.2019",
                                SeatBeltNumber: 2,
                                DangerousDefects: [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd"
                                ],
                                MinorDefects: [
                                    "54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside."
                                ],
                                AdvisoryDefects: [
                                    "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc"
                                ],
                                Make: "Mercedes",
                                Model: "632,01"
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: fs.readFileSync(path.resolve(__dirname, `../resources/signatures/1.base64`)).toString()
                            }
                        };
                        // Add a new signature
                        S3BucketMockService.buckets.push({
                            bucketName: `cvs-signature-${process.env.BUCKET}`,
                            files: ["1.base64"]
                        });

                        return certificateGenerationService.generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);

                                // Remove the signature
                                S3BucketMockService.buckets.pop();
                            });
                    });
                });
            });

            context("and the generated payload is used to call the MOT service", () => {
                it("successfully generate a certificate", () => {
                    expect.assertions(3);
                    return certificateGenerationService.generateCertificate(testResult)
                        .then((response: any) => {
                            expect(response.fileName).toEqual("W01A00310_T12876765_2.pdf");
                            expect(response.certificateType).toEqual("VTG30");
                            expect(response.certificateOrder).toEqual({ current: 2, total: 2 });
                        });
                });
            });
        });
    });

    context("CertGenService for ADR", () => {
        context("when a passing test result for ADR is read from the queue", () => {
            const event: any = cloneDeep(queueEventPass);
            const testResult: any = JSON.parse(event.Records[1].body);
            testResult.testTypes.testTypeId = "50";

            context("and a payload is generated", () => {
                context("and no signatures were found in the bucket", () => {
                    it("should return an ADR_PASS payload without signature", () => {
                        const expectedResult: any = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../resources/doc-gen-payload-adr.json"), "utf8"));

                        const techRecordResponseAdrMock = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../resources/tech-records-response-adr.json"), "utf8"));

                        const getVehicleMakeAndModelStub = sandbox.stub(CertificateGenerationService.prototype, "getVehicleMakeAndModel").resolves(undefined);
                        const getTechRecordStub = sandbox.stub(CertificateGenerationService.prototype, "getTechRecord").resolves(techRecordResponseAdrMock);

                        return certificateGenerationService.generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getTechRecordStub.restore();
                                getVehicleMakeAndModelStub.restore();
                            });
                    });
                });

                context("and signatures were found in the bucket", () => {
                    it("should return an ADR_PASS payload with signature", () => {
                        const expectedResult: any = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../resources/doc-gen-payload-adr.json"), "utf8"));
                        expectedResult.Signature.ImageType = "png";
                        expectedResult.Signature.ImageData = fs.readFileSync(path.resolve(__dirname, `../resources/signatures/1.base64`)).toString();

                        const techRecordResponseAdrMock = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../resources/tech-records-response-adr.json"), "utf8"));

                        // Add a new signature
                        S3BucketMockService.buckets.push({
                            bucketName: `cvs-signature-${process.env.BUCKET}`,
                            files: ["1.base64"]
                        });

                        const getVehicleMakeAndModelStub = sandbox.stub(CertificateGenerationService.prototype, "getVehicleMakeAndModel").resolves(undefined);
                        const getTechRecordStub = sandbox.stub(CertificateGenerationService.prototype, "getTechRecord").resolves(techRecordResponseAdrMock);

                        return certificateGenerationService.generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getTechRecordStub.restore();
                                getVehicleMakeAndModelStub.restore();
                                S3BucketMockService.buckets.pop();
                            });
                    });
                });
            });
        });
    });

    context("CertGenService for Roadworthiness test", () => {
        context("when a passing test result for Roadworthiness test for HGV or TRL is read from the queue", () => {
            const event: any = cloneDeep(queueEventPass);
            const testResult: ITestResult = JSON.parse(event.Records[1].body);
            testResult.testTypes.testTypeId = "122";
            testResult.vin = "GYFC26269R240355";
            testResult.vrm = "NKPILNCN";
            context("and a payload is generated", () => {
                context("and no signatures were found in the bucket", () => {
                    it("should return an RWT_DATA payload without signature", () => {
                        const expectedResult: ICertificatePayload = cloneDeep(docGenRwt[0]);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt[1]);

                        const getTechRecordStub = sandbox.stub(CertificateGenerationService.prototype, "getTechRecord").resolves(techRecordResponseRwtMock);

                        return certificateGenerationService.generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getTechRecordStub.restore();
                            });
                    });
                });

                context("and signatures were found in the bucket", () => {
                    it("should return an RWT_DATA payload with signature", () => {
                        const expectedResult: ICertificatePayload = cloneDeep(docGenRwt[1]);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt[1]);

                        const getTechRecordStub = sandbox.stub(CertificateGenerationService.prototype, "getTechRecord").resolves(techRecordResponseRwtMock);

                        // Add a new signature
                        S3BucketMockService.buckets.push({
                            bucketName: `cvs-signature-${process.env.BUCKET}`,
                            files: ["1.base64"]
                        });

                        return certificateGenerationService.generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getTechRecordStub.restore();
                                S3BucketMockService.buckets.pop();
                            });
                    });
                });
            });
        });
        context("and the generate certificate is used to call the doc generation service", () => {
            it("should pass certificateType as RWT", () => {
                const event: any = cloneDeep(queueEventPass);
                const testResult: ITestResult = JSON.parse(event.Records[1].body);
                testResult.testTypes.testTypeId = "122";
                testResult.vin = "GYFC26269R240355";
                testResult.vrm = "NKPILNCN";
                expect.assertions(1);
                return certificateGenerationService.generateCertificate(testResult)
                .then((response: any) => {
                    expect(response.certificateType).toEqual("RWT");
                });
            });
        });

        context("when a failing test result for Roadworthiness test for HGV or TRL is read from the queue", () => {
            const event: any = cloneDeep(queueEventFail);
            const testResult: ITestResult = JSON.parse(event.Records[2].body);
            testResult.testTypes.testTypeId = "91";
            testResult.vin = "T12768594";
            testResult.trailerId = "0285678";
            context("and a payload is generated", () => {
                context("and no signatures were found in the bucket", () => {
                    it("should return an RWT_DATA payload without signature", () => {
                        const expectedResult: ICertificatePayload = cloneDeep(docGenRwt[4]);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt[0]);

                        const getTechRecordStub = sandbox.stub(CertificateGenerationService.prototype, "getTechRecord").resolves(techRecordResponseRwtMock);

                        return certificateGenerationService.generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getTechRecordStub.restore();
                            });
                    });
                });

                context("and signatures were found in the bucket", () => {
                    it("should return an RWT_DATA payload with signature", () => {
                        const expectedResult: ICertificatePayload = cloneDeep(docGenRwt[3]);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt[0]);

                        const getTechRecordStub = sandbox.stub(CertificateGenerationService.prototype, "getTechRecord").resolves(techRecordResponseRwtMock);

                        // Add a new signature
                        S3BucketMockService.buckets.push({
                            bucketName: `cvs-signature-${process.env.BUCKET}`,
                            files: ["1.base64"]
                        });

                        return certificateGenerationService.generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                getTechRecordStub.restore();
                                S3BucketMockService.buckets.pop();
                            });
                    });
                });
            });
        });
    });

    context("CertificateUploadService", () => {
        context("when a valid event is received", () => {
            const event: any = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../resources/queue-event-prs.json"), "utf8"));
            const testResult: any = JSON.parse(event.Records[0].body);
            const certificateUploadService: CertificateUploadService = Injector.resolve<CertificateUploadService>(CertificateUploadService, [S3BucketMockService]);
            // tslint:disable-next-line:no-shadowed-variable
            const certificateGenerationService: CertificateGenerationService = Injector.resolve<CertificateGenerationService>(CertificateGenerationService, [S3BucketMockService, LambdaMockService]);

            context("when uploading a certificate", () => {
                context("and the S3 bucket exists and is accesible", () => {
                    it("should successfully upload the certificate", async () => {
                        const generatedCertificateResponse: IGeneratedCertificateResponse = await certificateGenerationService.generateCertificate(testResult);
                        S3BucketMockService.buckets.push({
                            bucketName: `cvs-cert-${process.env.BUCKET}`,
                            files: []
                        });

                        return certificateUploadService.uploadCertificate(generatedCertificateResponse)
                        .then((response: ManagedUpload.SendData) => {
                            expect(response.Key).toEqual(`${process.env.BRANCH}/${generatedCertificateResponse.fileName}`);

                            S3BucketMockService.buckets.pop();
                        });
                    });
                });

                context("and the S3 bucket does not exist or is not accesible", () => {
                    it("should throw an error", async () => {
                        const generatedCertificateResponse: IGeneratedCertificateResponse = await certificateGenerationService.generateCertificate(testResult);
                        expect.assertions(1);
                        return certificateUploadService.uploadCertificate(generatedCertificateResponse)
                        .catch((error: any) => {
                            expect(error).toBeInstanceOf(Error);
                        });
                    });
                });
            });
        });
    });

    context("CertGen function", () => {
        context("when a passing test result is read from the queue", () => {
            context("and the payload generation throws an error", () => {
                it("should bubble that error up", async () => {
                    const event: any = {Records: [{...queueEvent.Records[0]}]};

                    sandbox.stub(LambdaService.prototype, "invoke").throws(new Error("It broke"));
                    expect.assertions(1);
                    try {
                        await certGen(event, ctx, () => { return; });
                    } catch (err) {
                        expect(err.message).toEqual("It broke");
                    }
                    sandbox.restore();
                });
            });
        });


        context("when a failing test result is read from the queue", () => {
            const event: any = {...queueEventFail};
            context("and the testResultId is malformed", () => {
                it("should thrown an error", async () => {
                    expect.assertions(1);
                    try {
                        await certGen(event, ctx, () => { return; });
                    } catch (err) {
                        expect(err.message).toEqual("Bad Test Record: 1");
                    }
                });
            });
            context("and the event is empty", () => {
                it("should thrown an error", async () => {
                    expect.assertions(1);
                    try {
                        await certGen({}, ctx, () => { return; });
                    } catch (err) {
                        expect(err.message).toEqual("Event is empty");
                    }
                });
            });
            context("and the event has no records", () => {
                it("should thrown an error", async () => {
                    expect.assertions(1);
                    try {
                        await certGen({otherStuff: "hi", Records: []}, ctx, () => { return; });
                    } catch (err) {
                        expect(err.message).toEqual("Event is empty");
                    }
                });
            });
        });
    });
});
