import {describe} from "mocha";
import {expect} from "chai";
import {Injector} from "../../src/models/injector/Injector";
import * as fs from "fs";
import * as path from "path";
import {CertificateGenerationService, IGeneratedCertificateResponse} from "../../src/services/CertificateGenerationService";
import {S3BucketMockService} from "../models/S3BucketMockService";
import {LambdaMockService} from "../models/LambdaMockService";
import {CertificateUploadService} from "../../src/services/CertificateUploadService";
import {ManagedUpload} from "aws-sdk/clients/s3";

describe("cert-gen-dev", () => {
    context("CertificateGenerationService", () => {
        const certificateGenerationService: CertificateGenerationService = Injector.resolve<CertificateGenerationService>(CertificateGenerationService, [S3BucketMockService, LambdaMockService]);
        LambdaMockService.populateFunctions();

        context("when a passing test result is read from the queue", () => {
            const event: any = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../resources/queue-event-pass.json"), "utf8"));
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
                                Make: "Plaxton",
                                Model: "Tourismo",
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
                            expect(payload).to.eql(expectedResult);
                        });
                    });
                });

                context("and lambda-to-lambda calls were unsuccessful", () => {
                    it("should return a VTP20 payload without bodyMake, bodyModel and odometer history", () => {
                        // Remove mock function definitions
                        LambdaMockService.purgeFunctions();
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

                        return certificateGenerationService.generatePayload(testResult)
                        .then((payload: any) => {
                            expect(payload).to.eql(expectedResult);

                            // Populate mock function definitions
                            LambdaMockService.populateFunctions();
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
                                Make: "Plaxton",
                                Model: "Tourismo",
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
                            expect(payload).to.eql(expectedResult);

                            // Remove the signature
                            S3BucketMockService.buckets.pop();
                        });
                    });
                });
            });

            context("and the generated payload is used to call the MOT service", () => {
                it("successfully generate a certificate", () => {
                    return certificateGenerationService.generateCertificate(testResult)
                    .then((response: any) => {
                        expect(response.fileName).to.equal("1_XMGDE02FS0H012345_1.pdf");
                        expect(response.certificateType).to.equal("VTP20");
                        expect(response.certificateOrder).to.eql({ current: 1, total: 2 });
                    })
                    .catch((error: any) => {
                        expect.fail(error);
                    });
                });
            });
        });

        context("when a failing test result is read from the queue", () => {
            const event: any = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../resources/queue-event-fail.json"), "utf8"));
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
                                Make: "Plaxton",
                                Model: "Tourismo",
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
                            expect(payload).to.eql(expectedResult);
                        });
                    });
                });

                context("and lambda-to-lambda calls were unsuccessful", () => {
                    it("should return a VTP30 payload without bodyMake, bodyModel and odometer history", () => {
                        // Remove mock function definitions
                        LambdaMockService.purgeFunctions();
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

                        return certificateGenerationService.generatePayload(testResult)
                        .then((payload: any) => {
                            expect(payload).to.eql(expectedResult);

                            // Populate mock function definitions
                            LambdaMockService.populateFunctions();
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
                                Make: "Plaxton",
                                Model: "Tourismo",
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
                            expect(payload).to.eql(expectedResult);

                            // Remove the signature
                            S3BucketMockService.buckets.pop();
                        });
                    });
                });
            });

            context("and the generated payload is used to call the MOT service", () => {
                it("successfully generate a certificate", () => {
                    return certificateGenerationService.generateCertificate(testResult)
                    .then((response: any) => {
                        expect(response.fileName).to.equal("1_XMGDE02FS0H012345_2.pdf");
                        expect(response.certificateType).to.equal("VTP30");
                        expect(response.certificateOrder).to.eql({ current: 2, total: 2 });
                    })
                    .catch((error: any) => {
                        expect.fail(error);
                    });
                });
            });
        });

        context("when a prs test result is read from the queue", () => {
            const event: any = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../resources/queue-event-prs.json"), "utf8"));
            const testResult: any = JSON.parse(event.Records[0].body);

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
                                Make: "Plaxton",
                                Model: "Tourismo",
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
                                Make: "Plaxton",
                                Model: "Tourismo",
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
                            expect(payload).to.eql(expectedResult);
                        });
                    });
                });

                context("and lambda-to-lambda calls were unsuccessful", () => {
                    it("should return a PRS payload without bodyMake, bodyModel and odometer history", () => {
                        // Remove mock function definitions
                        LambdaMockService.purgeFunctions();
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

                        return certificateGenerationService.generatePayload(testResult)
                        .then((payload: any) => {
                            expect(payload).to.eql(expectedResult);

                            // Populate mock function definitions
                            LambdaMockService.populateFunctions();
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
                                Make: "Plaxton",
                                Model: "Tourismo",
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
                                Make: "Plaxton",
                                Model: "Tourismo",
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
                            expect(payload).to.eql(expectedResult);

                            // Remove the signature
                            S3BucketMockService.buckets.pop();
                        });
                    });
                });
            });

            context("and the generated payload is used to call the MOT service", () => {
                it("successfully generate a certificate", () => {
                    return certificateGenerationService.generateCertificate(testResult)
                    .then((response: any) => {
                        expect(response.fileName).to.equal("1_XMGDE02FS0H012345_1.pdf");
                        expect(response.certificateType).to.equal("PSV_PRS");
                        expect(response.certificateOrder).to.eql({ current: 1, total: 2 });
                    })
                    .catch((error: any) => {
                        expect.fail(error);
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
                            expect(response.Key).to.equal(`${process.env.BRANCH}/${generatedCertificateResponse.fileName}`);

                            S3BucketMockService.buckets.pop();
                        });
                    });
                });

                context("and the S3 bucket does not exist or is not accesible", async () => {
                    it("should throw an error", async () => {
                        const generatedCertificateResponse: IGeneratedCertificateResponse = await certificateGenerationService.generateCertificate(testResult);
                        return certificateUploadService.uploadCertificate(generatedCertificateResponse)
                        .then(() => {
                            expect.fail();
                        })
                        .catch((error: any) => {
                            expect(error).to.be.instanceOf(Error);
                        });
                    });
                });
            });
        });
    });
});
