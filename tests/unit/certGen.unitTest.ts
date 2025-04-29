import "reflect-metadata";

/* eslint-disable import/first */
const mockGetProfile = jest.fn();

import * as fs from "fs";
import { cloneDeep } from "lodash";
import * as path from "path";
import sinon from "sinon";
import { Container } from "typedi";
import { CertificatePayloadStateBag } from "../../src/certificate/CertificatePayloadStateBag";
import { DefectsCommand } from "../../src/certificate/commands/DefectsCommand";
import { IvaCertificateCommand } from "../../src/certificate/commands/IvaCertificateCommand";
import { MsvaCertificateCommand } from "../../src/certificate/commands/MsvaCertificateCommand";
import { PassOrFailCertificateCommand } from "../../src/certificate/commands/PassOrFailCertificateCommand";
import { DefectRepository } from "../../src/defect/DefectRepository";
import { DefectService } from "../../src/defect/DefectService";
import { CertificateRequestProcessor } from "../../src/functions/CertificateRequestProcessor";
import { certGen } from "../../src/functions/certGen";
import { ICertificatePayload, IFeatureFlags, TestResultSchemaTestTypesAsObject } from "../../src/models";
import { CERTIFICATE_DATA } from "../../src/models/Enums";
import {
    CertificateGenerationService,
    IGeneratedCertificateResponse,
} from "../../src/services/CertificateGenerationService";
import { CertificateUploadService } from "../../src/services/CertificateUploadService";
import { LambdaService } from "../../src/services/LambdaService";
import { S3BucketService } from "../../src/services/S3BucketService";
import { TechRecordRepository } from "../../src/tech-record/TechRecordRepository";
import { TestResultRepository } from "../../src/test-result/TestResultRepository";
import { TrailerRepository } from "../../src/trailer/TrailerRepository";
import { LambdaMockService } from "../models/LambdaMockService";
import { S3BucketMockService } from "../models/S3BucketMockService";
import docGenIva30 from "../resources/doc-gen-payload-iva30.json";
import docGenMsva30 from "../resources/doc-gen-payload-msva30.json";
import docGenRwt from "../resources/doc-gen-payload-rwt.json";
import queueEventFailPRS from "../resources/queue-event-fail-prs.json";
import queueEventFail from "../resources/queue-event-fail.json";
import queueEventPass from "../resources/queue-event-pass.json";
import queueEventAbandon from "../resources/queue-event-abandon.json";
import techRecordsPsv from "../resources/tech-records-response-PSV.json";
import techRecordsRwtHgvSearch from "../resources/tech-records-response-rwt-hgv-search.json";
import techRecordsRwtHgv from "../resources/tech-records-response-rwt-hgv.json";
import techRecordsRwtSearch from "../resources/tech-records-response-rwt-search.json";
import techRecordsRwt from "../resources/tech-records-response-rwt.json";
import techRecordsSearchPsv from "../resources/tech-records-response-search-PSV.json";

const sandbox = sinon.createSandbox();

jest.mock("@dvsa/cvs-feature-flags/profiles/vtx", () => ({
    getProfile: mockGetProfile
}));

describe("cert-gen", () => {
    it("should pass", () => {
        expect(true).toBe(true);
    });

  Container.set(S3BucketService, new S3BucketMockService());
  Container.set(LambdaService, new LambdaMockService());

  const techRecordRepository = Container.get(TechRecordRepository);
  const callGetTechRecordSpy = jest.spyOn(techRecordRepository, "callGetTechRecords");
  const callSearchTechRecordSpy = jest.spyOn(techRecordRepository, "callSearchTechRecords");
  Container.set(TechRecordRepository, techRecordRepository);

  const testResultRepository = Container.get(TestResultRepository);
  let callGetOdometerSpy = jest.spyOn(testResultRepository, 'getOdometerHistory');
  Container.set(TestResultRepository, testResultRepository);

  const certificateGenerationService = Container.get(CertificateGenerationService);

    beforeAll(() => {
        jest.setTimeout(10000);
    });
    afterAll(() => {
        sandbox.restore();
        jest.setTimeout(5000);
    });
    beforeEach(() => {
        const featureFlags: IFeatureFlags = {
            welshTranslation: {
                enabled: false,
                translatePassTestResult: false,
                translatePrsTestResult: false,
                translateFailTestResult: false,
            },
            abandonedCerts: {
                enabled: false,
            }
        };

        mockGetProfile.mockReturnValue(Promise.resolve(featureFlags));

        callGetOdometerSpy = jest.spyOn(testResultRepository, "getOdometerHistory");
    });
    afterEach(() => {
        sandbox.restore();
        callGetOdometerSpy.mockRestore();
        S3BucketMockService.buckets.pop();
    });
    context("CertificateGenerationService", () => {
        LambdaMockService.populateFunctions();

        context("when a passing test result is read from the queue", () => {
            const event: any = { ...queueEventPass };
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
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };
                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
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
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };
                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(testResult2)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                });
            });
        });

        context("when a passing test result is read from the queue", () => {
            const event: any = { ...queueEventPass };
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
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };
                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);


                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
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
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };
                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);

                        // @ts-ignore
                        techRecordResponseRwtMock.techRecord_make = undefined;
                        // @ts-ignore
                        techRecordResponseRwtMock.techRecord_model = undefined;
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        // Make the functions return undefined
                        // Stub CertificateGenerationService getOdometerHistory method to return undefined value.
                        callGetOdometerSpy.mockResolvedValue(undefined as any);
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
                                callGetOdometerSpy.mockClear();
                                // getVehicleMakeAndModelStub.restore();
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
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
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
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
                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
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
                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

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
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                }
            );
        });

        context("when a passing test result is read from the queue", () => {
            const event: any = { ...queueEventPass };
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
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
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
                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(testResultWithTestHistoryForResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
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
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            }
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(testResultWithTestHistoryForSomeotherResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                });
            });
        });

        context("when a passing test result is read from the queue", () => {
            const event: any = { ...queueEventPass };
            const hgvTestResultWithMinorDefect: any = JSON.parse(event.Records[7].body);
            const hgvTestResultWithAdvisoryDefect: any = JSON.parse(event.Records[8].body);

            const trlTestResultWithMinorDefect: any = JSON.parse(event.Records[9].body);
            const trlTestResultWithAdvisoryDefect: any = JSON.parse(event.Records[10].body);

            const psvTestResultWithMinorDefect: any = JSON.parse(event.Records[11].body);
            const psvTestResultWithAdvisoryDefect: any = JSON.parse(event.Records[12].body);

            context("and the hgv result has a minor defect", () => {
                context("and the test station location is not in Wales", () => {
                    it("should return a VTG5 payload without the MinorDefectsWelsh array populated", async () => {
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
                                MinorDefects: [
                                    "62.1.a.i Reflectors, conspicuity markings and/or rear markers: incorrectly positioned. Nearside Front."
                                ],
                                Model: "FM",
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtHgvSearch);
                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(hgvTestResultWithMinorDefect)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });

                    context("and the test station location is in Wales", () => {
                        it("should return a VTG5 payload with the MinorDefectsWelsh array populated", async () => {
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
                                    MinorDefects: [
                                        "62.1.a.i Reflectors, conspicuity markings and/or rear markers: incorrectly positioned. Nearside Front."
                                    ],
                                    MinorDefectsWelsh: [
                                        "62.1.a.i Adlewyrchwyr, marciau amlygrwydd a/neu farcwyr cefn: wedi'i leoli'n anghywir. Ochr mewnol Blaen."
                                    ],
                                    Model: "FM",
                                    OdometerHistoryList: [
                                        {
                                            value: 410000,
                                            unit: "kilometres",
                                            date: "20.01.2019"
                                        },
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
                                    ],
                                    Recalls: {
                                        manufacturer: null,
                                        hasRecall: false
                                    }
                                },
                                Signature: {
                                    ImageType: "png",
                                    ImageData: null,
                                },
                            };

                            callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtHgvSearch);

                            const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                            return await certificateGenerationService
                                .generatePayload(hgvTestResultWithMinorDefect, true)
                                .then((payload: any) => {
                                    expect(payload).toEqual(expectedResult);
                                    callGetTechRecordSpy.mockClear();
                                    callSearchTechRecordSpy.mockClear();
                                });
                        });
                    });
                });
            });

            context("and the hgv result has an advisory defect", () => {
                context("and the test station location is not in Wales", () => {
                    it("should return a VTG5 payload without the AdvisoryDefectsWelsh array populated", async () => {
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
                                AdvisoryDefects: [
                                    "1.1 A registration plate: Note one"
                                ],
                                Model: "FM",
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(hgvTestResultWithAdvisoryDefect)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                });
                context("and the test station location is in Wales", () => {
                    it("should return a VTG5 payload with the AdvisoryDefectsWelsh array populated", async () => {
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
                                AdvisoryDefects: [
                                    "1.1 A registration plate: Note one"
                                ],
                                AdvisoryDefectsWelsh: [
                                    "1.1 A registration plate: Note one"
                                ],
                                Model: "FM",
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return certificateGenerationService
                            .generatePayload(hgvTestResultWithAdvisoryDefect, true)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                });
            });

            context("and the trl result has a minor defect", () => {
                context("and the test station location is not in Wales", () => {
                    it("should return a VTG5A payload without the MinorDefectsWelsh array populated", async () => {
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
                                MinorDefects: [
                                    "62.1.a.i Reflectors, conspicuity markings and/or rear markers: incorrectly positioned. Nearside Front."
                                ],
                                Trn: "ABC123",
                                IsTrailer: true,
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(trlTestResultWithMinorDefect)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                });
                context("and the test station location is in Wales", () => {
                    it("should return a VTG5A payload with the MinorDefectsWelsh array populated", async () => {
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
                                MinorDefects: [
                                    "62.1.a.i Reflectors, conspicuity markings and/or rear markers: incorrectly positioned. Nearside Front."
                                ],
                                MinorDefectsWelsh: [
                                    "62.1.a.i Adlewyrchwyr, marciau amlygrwydd a/neu farcwyr cefn: wedi'i leoli'n anghywir. Ochr mewnol Blaen."
                                ],
                                Trn: "ABC123",
                                IsTrailer: true,
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

            callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(trlTestResultWithMinorDefect, true)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                });
            });

            context("and the trl result has an advisory defect", () => {
                context("and the test station location is not in Wales", () => {
                    it("should return a VTG5A payload without the AdvisoryDefectsWelsh array populated", async () => {
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
                                AdvisoryDefects: [
                                    "1.1 A registration plate: Note one"
                                ],
                                Trn: "ABC123",
                                IsTrailer: true,
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(trlTestResultWithAdvisoryDefect)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                });
                context("and the test station location is in Wales", () => {
                    it("should return a VTG5A payload with the AdvisoryDefectsWelsh array populated", async () => {
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
                                AdvisoryDefects: [
                                    "1.1 A registration plate: Note one"
                                ],
                                AdvisoryDefectsWelsh: [
                                    "1.1 A registration plate: Note one"
                                ],
                                Trn: "ABC123",
                                IsTrailer: true,
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return certificateGenerationService
                            .generatePayload(trlTestResultWithAdvisoryDefect, true)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                });
            });

            context("and the psv result has a minor defect", () => {
                context("and the test station location is not in Wales", () => {
                    it("should return a VTP20 payload without the MinorDefectsWelsh array populated", async () => {
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
                                Make: "AEC",
                                MinorDefects: [
                                    "62.1.a.i Reflectors, conspicuity markings and/or rear markers: incorrectly positioned. Nearside Front.",
                                ],
                                Model: "RELIANCE",
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            }
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsSearchPsv);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsPsv);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(psvTestResultWithMinorDefect)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                });
                context("and the test station location is in Wales", () => {
                    it("should return a VTP20 payload with the MinorDefectsWelsh array populated", async () => {
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
                                Make: "AEC",
                                MinorDefects: [
                                    "62.1.a.i Reflectors, conspicuity markings and/or rear markers: incorrectly positioned. Nearside Front.",
                                ],
                                MinorDefectsWelsh: [
                                    "62.1.a.i Adlewyrchwyr, marciau amlygrwydd a/neu farcwyr cefn: wedi'i leoli'n anghywir. Ochr mewnol Blaen.",
                                ],
                                Model: "RELIANCE",
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            }
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsSearchPsv);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsPsv);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return certificateGenerationService
                            .generatePayload(psvTestResultWithMinorDefect, true)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                });
            });

            context("and the psv result has an advisory defect", () => {
                context("and the test station location is not in Wales", () => {
                    it("should return a VTP20 payload without the AdvisoryDefectsWelsh array populated", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                AdvisoryDefects: [
                                    "1.1 A registration plate: Notes here",
                                    "6.3 A hub: Second advisory note"
                                ],
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
                                Make: "AEC",
                                Model: "RELIANCE",
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            }
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsSearchPsv);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsPsv);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(psvTestResultWithAdvisoryDefect)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                });
                context("and the test station location is in Wales", () => {
                    it("should return a VTP20 payload with the AdvisoryDefectsWelsh array populated", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            DATA: {
                                AdvisoryDefects: [
                                    "1.1 A registration plate: Notes here",
                                    "6.3 A hub: Second advisory note"
                                ],
                                AdvisoryDefectsWelsh: [
                                    "1.1 A registration plate: Notes here",
                                    "6.3 A hub: Second advisory note"
                                ],
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
                                Make: "AEC",
                                Model: "RELIANCE",
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            }
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsSearchPsv);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsPsv);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return certificateGenerationService
                            .generatePayload(psvTestResultWithAdvisoryDefect, true)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                });
            });

            context("and the test result has a defect", () => {
                context("and the test station location is not in Wales", () => {
                    it("should return a VTP20 without calling getDefect or flattenDefects methods", async () => {
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
                                Make: "AEC",
                                MinorDefects: [
                                    "62.1.a.i Reflectors, conspicuity markings and/or rear markers: incorrectly positioned. Nearside Front.",
                                ],
                                Model: "RELIANCE",
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            }
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsSearchPsv);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsPsv);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        const defectRepository = Container.get(DefectRepository);
                        const getDefectTranslationsSpy = jest.spyOn(defectRepository, "getDefectTranslations");
                        Container.set(DefectRepository, defectRepository);

                        const defectService = Container.get(DefectService);
                        const flattenSpy = jest.spyOn(defectService, "flattenDefectsFromApi");
                        Container.set(DefectService, defectService);

                        return await certificateGenerationService
                            .generatePayload(psvTestResultWithMinorDefect)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                expect(getDefectTranslationsSpy).not.toHaveBeenCalled();
                                expect(flattenSpy).not.toHaveBeenCalled();
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                                getDefectTranslationsSpy.mockRestore();
                            });
                    });
                });
            });
        });

        context("when a failing test result is read from the queue", () => {
            const event: any = { ...queueEventFail };
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
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
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
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };
                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        // @ts-ignore
                        techRecordResponseRwtMock.techRecord_make = undefined;
                        // @ts-ignore
                        techRecordResponseRwtMock.techRecord_model = undefined;
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        // Make the functions return undefined
                        // Stub CertificateGenerationService getOdometerHistory method to return undefined value.
                        callGetOdometerSpy.mockResolvedValue(undefined as any);
                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetOdometerSpy.mockClear();
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
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
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
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
                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);


                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
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
                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

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
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                }
            );
        });

        context("when a failing test result is read from the queue", () => {
            const event: any = { ...queueEventFail };
            const failWithPrsEvent: any = { ...queueEventFailPRS };

            const hgvFailWithDangerousDefect: any = JSON.parse(event.Records[11].body);
            const hgvFailWithMajorDefect: any = JSON.parse(event.Records[12].body);
            const hgvFailWithDangerousAndMajorDefect: any = JSON.parse(event.Records[13].body);
            const hgvFailWithAdvisoryMinorDangerousMajorDefect: any = JSON.parse(event.Records[14].body);
            const hgvFailWithDangerousDefectMajorRectified: any = JSON.parse(failWithPrsEvent.Records[3].body);
            const hgvFailWithMajorDefectDangerousRectified: any = JSON.parse(failWithPrsEvent.Records[4].body);
            const trlFailWithDangerousDefect: any = JSON.parse(event.Records[15].body);
            const trlFailWithMajorDefect: any = JSON.parse(event.Records[16].body);
            const trlFailWithDangerousAndMajorDefect: any = JSON.parse(event.Records[17].body);
            const trlFailWithAdvisoryMinorDangerousMajorDefect: any = JSON.parse(event.Records[18].body);
            const trlFailWithDangerousDefectMajorRectified: any = JSON.parse(failWithPrsEvent.Records[5].body);
            const trlFailWithMajorDefectDangerousRectified: any = JSON.parse(failWithPrsEvent.Records[6].body);
            const psvFailWithDangerousDefect: any = JSON.parse(event.Records[22].body);
            const psvFailWithMajorDefect: any = JSON.parse(event.Records[23].body);
            const psvFailWithDangerousAndMajorDefect: any = JSON.parse(event.Records[24].body);
            const psvFailWithAdvisoryMinorDangerousMajorDefect: any = JSON.parse(event.Records[19].body);
            const psvFailWithMajorDefectDangerousRectified: any = JSON.parse(event.Records[25].body);
            const psvFailWithDangerousDefectMajorRectified: any = JSON.parse(event.Records[26].body);

            context("and the hgv result has a dangerous defect", () => {
                context("and the test station location is not in Wales", () => {
                    it("should return a VTG30 payload without the DangerousDefectsWelsh array populated", async () => {
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
                                Make: "Isuzu",
                                Model: "FM",
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(hgvFailWithDangerousDefect)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                });

                context("and the test station location is in Wales", () => {
                    it("should return a VTG30W payload with the DangerousDefectsWelsh array populated", async () => {
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
                                DangerousDefectsWelsh: [
                                    "54.1.a.ii Llywio pŵer: ddim yn gweithio'n gywir ac yn amlwg yn effeithio ar reolaeth llywio. Echelau: 7. Mewnol Allanol. Asdasd"
                                ],
                                Make: "Isuzu",
                                Model: "FM",
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(hgvFailWithDangerousDefect, true)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                });
            });

            context("and the hgv result has a major defect", () => {
                context("and the test station location is not in Wales", () => {
                    it("should return a VTG30 payload without the MajorDefectsWelsh array populated", async () => {
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
                                MajorDefects: [
                                    "6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd"
                                ],
                                Make: "Isuzu",
                                Model: "FM",
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(hgvFailWithMajorDefect)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                });

                context("and the test station location is in Wales", () => {
                    it("should return a VTG30W payload with the MajorDefectsWelsh array populated", async () => {
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
                                MajorDefects: [
                                    "6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd"
                                ],
                                MajorDefectsWelsh: [
                                    "6.1.a Cylch cadw teiar: wedi torri neu heb ei ffitio'n iawn fel bod datgysylltiad yn debygol. Echelau: 1. Mewnol Allanol. Asdasd"
                                ],
                                Make: "Isuzu",
                                Model: "FM",
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(hgvFailWithMajorDefect, true)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                });
            });

            context("and the hgv result has a dangerous and major defect", () => {
                context("and the test station location is not in Wales", () => {
                    it("should return a VTG30 payload without the MajorDefectsWelsh array populated", async () => {
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
                                MajorDefects: [
                                    "6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd"
                                ],
                                DangerousDefects: [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd",
                                ],
                                Make: "Isuzu",
                                Model: "FM",
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(hgvFailWithDangerousAndMajorDefect)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                });

                context("and the test station location is in Wales", () => {
                    it("should return a VTG30W payload with the MajorDefectsWelsh array populated", async () => {
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
                                MajorDefects: [
                                    "6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd"
                                ],
                                MajorDefectsWelsh: [
                                    "6.1.a Cylch cadw teiar: wedi torri neu heb ei ffitio'n iawn fel bod datgysylltiad yn debygol. Echelau: 1. Mewnol Allanol. Asdasd"
                                ],
                                DangerousDefects: [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd",
                                ],
                                DangerousDefectsWelsh: [
                                    "54.1.a.ii Llywio pŵer: ddim yn gweithio'n gywir ac yn amlwg yn effeithio ar reolaeth llywio. Echelau: 7. Mewnol Allanol. Asdasd"
                                ],
                                Make: "Isuzu",
                                Model: "FM",
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(hgvFailWithDangerousAndMajorDefect, true)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                });
            });

            context("and the hgv result has advisory, minor, dangerous and major defects", () => {
                context("and the test station location is not in Wales", () => {
                    it("should return a VTG30 payload without any Welsh defect arrays populated", async () => {
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
                                MajorDefects: [
                                    "6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd"
                                ],
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
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(hgvFailWithAdvisoryMinorDangerousMajorDefect)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                });

                context("and the test station location is in Wales", () => {
                    it("should return a VTG30W payload with all Welsh defect arrays populated", async () => {
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
                                MajorDefects: [
                                    "6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd"
                                ],
                                MajorDefectsWelsh: [
                                    "6.1.a Cylch cadw teiar: wedi torri neu heb ei ffitio'n iawn fel bod datgysylltiad yn debygol. Echelau: 1. Mewnol Allanol. Asdasd"
                                ],
                                DangerousDefects: [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd",
                                ],
                                DangerousDefectsWelsh: [
                                    "54.1.a.ii Llywio pŵer: ddim yn gweithio'n gywir ac yn amlwg yn effeithio ar reolaeth llywio. Echelau: 7. Mewnol Allanol. Asdasd"
                                ],
                                MinorDefects: [
                                    "54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.",
                                ],
                                MinorDefectsWelsh: [
                                    "54.1.d.i Llywio pŵer: cronfa ddŵr yn is na'r lefel isaf. Echelau: 7. Allanol Ochr mewnol."
                                ],
                                AdvisoryDefects: [
                                    "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc",
                                ],
                                AdvisoryDefectsWelsh: [
                                    "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc",
                                ],
                                Make: "Isuzu",
                                Model: "FM",
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(hgvFailWithAdvisoryMinorDangerousMajorDefect, true)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                });
            });

            context("and the hgv result has a Dangerous Defect with Major defect rectified", () => {
                context("and the test station location is not in Wales", () => {
                    it("should return a VTG30 payload with PRSDefects list in fail data", async () => {
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
                                MajorDefects: undefined,
                                MinorDefects: undefined,
                                PRSDefects: ["6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd"],
                                Make: "Isuzu",
                                Model: "FM",
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(hgvFailWithDangerousDefectMajorRectified)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                });

                context("and the test station location is in Wales", () => {
                    it("should return a VTG30W payload with PRSDefectsWelsh list in fail data", async () => {
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
                                DangerousDefectsWelsh: [
                                    "54.1.a.ii Llywio pŵer: ddim yn gweithio'n gywir ac yn amlwg yn effeithio ar reolaeth llywio. Echelau: 7. Mewnol Allanol. Asdasd"
                                ],
                                MajorDefects: undefined,
                                MajorDefectsWelsh: undefined,
                                MinorDefects: undefined,
                                MinorDefectsWelsh: undefined,
                                PRSDefects: [
                                    "6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd"
                                ],
                                PRSDefectsWelsh: [
                                    "6.1.a Cylch cadw teiar: wedi torri neu heb ei ffitio'n iawn fel bod datgysylltiad yn debygol. Echelau: 1. Mewnol Allanol. Asdasd"
                                ],
                                Make: "Isuzu",
                                Model: "FM",
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(hgvFailWithDangerousDefectMajorRectified, true)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                });
            });

            context("and the hgv result has a Major Defect with Dangerous defect rectified", () => {
                context("and the test station location is not in Wales", () => {
                    it("should return a VTG30 payload with PRSDefects list in fail data", async () => {
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
                                DangerousDefects: undefined,
                                MajorDefects: [
                                    "6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd"
                                ],
                                MinorDefects: undefined,
                                PRSDefects: [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd"
                                ],
                                Make: "Isuzu",
                                Model: "FM",
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(hgvFailWithMajorDefectDangerousRectified)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                });

                context("and the test station location is in Wales", () => {
                    it("should return a VTG30W payload with PRSDefectsWelsh list in fail data", async () => {
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
                                DangerousDefects: undefined,
                                MajorDefects: [
                                    "6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd"
                                ],
                                MajorDefectsWelsh: [
                                    "6.1.a Cylch cadw teiar: wedi torri neu heb ei ffitio'n iawn fel bod datgysylltiad yn debygol. Echelau: 1. Mewnol Allanol. Asdasd"
                                ],
                                MinorDefects: undefined,
                                PRSDefects: [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd"
                                ],
                                PRSDefectsWelsh: [
                                    "54.1.a.ii Llywio pŵer: ddim yn gweithio'n gywir ac yn amlwg yn effeithio ar reolaeth llywio. Echelau: 7. Mewnol Allanol. Asdasd"
                                ],
                                Make: "Isuzu",
                                Model: "FM",
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(hgvFailWithMajorDefectDangerousRectified, true)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                });
            });

            context("and the trl result has a dangerous defect", () => {
                context("and the test station location is not in Wales", () => {
                    it("should return a VTG30 payload without the DangerousDefectsWelsh array populated", async () => {
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
                                Make: "STANLEY",
                                Model: "AUTOTRL",
                                Trn: "ABC123",
                                IsTrailer: true,
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            }
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(trlFailWithDangerousDefect)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                                // Remove the signature
                                S3BucketMockService.buckets.pop();
                            });
                    });
                });

                context("and the test station location is in Wales", () => {
                    it("should return a VTG30W payload with the DangerousDefectsWelsh array populated", async () => {
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
                                DangerousDefectsWelsh: [
                                    "54.1.a.ii Llywio pŵer: ddim yn gweithio'n gywir ac yn amlwg yn effeithio ar reolaeth llywio. Echelau: 7. Mewnol Allanol. Asdasd"
                                ],
                                Make: "STANLEY",
                                Model: "AUTOTRL",
                                Trn: "ABC123",
                                IsTrailer: true,
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(trlFailWithDangerousDefect, true)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                                // Remove the signature
                                S3BucketMockService.buckets.pop();
                            });
                    });
                });
            });

            context("and the trl result has a major defect", () => {
                context("and the test station location is not in Wales", () => {
                    it("should return a VTG30 payload without the MajorDefectsWelsh array populated", async () => {
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
                                MajorDefects: [
                                    "6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd"
                                ],
                                Make: "STANLEY",
                                Model: "AUTOTRL",
                                Trn: "ABC123",
                                IsTrailer: true,
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(trlFailWithMajorDefect)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                                // Remove the signature
                                S3BucketMockService.buckets.pop();
                            });
                    });
                });

                context("and the test station location is in Wales", () => {
                    it("should return a VTG30W payload with the MajorDefectsWelsh array populated", async () => {
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
                                MajorDefects: [
                                    "6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd"
                                ],
                                MajorDefectsWelsh: [
                                    "6.1.a Cylch cadw teiar: wedi torri neu heb ei ffitio'n iawn fel bod datgysylltiad yn debygol. Echelau: 1. Mewnol Allanol. Asdasd"
                                ],
                                Make: "STANLEY",
                                Model: "AUTOTRL",
                                Trn: "ABC123",
                                IsTrailer: true,
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(trlFailWithMajorDefect, true)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                                // Remove the signature
                                S3BucketMockService.buckets.pop();
                            });
                    });
                });
            });

            context("and the trl result has a dangerous and major defect", () => {
                context("and the test station location is not in Wales", () => {
                    it("should return a VTG30 payload without the DangerousDefectsWelsh array populated", async () => {
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
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd"
                                ],
                                MajorDefects: [
                                    "6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd"
                                ],
                                Make: "STANLEY",
                                Model: "AUTOTRL",
                                Trn: "ABC123",
                                IsTrailer: true,
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(trlFailWithDangerousAndMajorDefect)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                                // Remove the signature
                                S3BucketMockService.buckets.pop();
                            });
                    });
                });

                context("and the test station location is in Wales", () => {
                    it("should return a VTG30W payload with the DangerousDefectsWelsh array populated", async () => {
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
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd"
                                ],
                                DangerousDefectsWelsh: [
                                    "54.1.a.ii Llywio pŵer: ddim yn gweithio'n gywir ac yn amlwg yn effeithio ar reolaeth llywio. Echelau: 7. Mewnol Allanol. Asdasd"
                                ],
                                MajorDefects: [
                                    "6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd"
                                ],
                                MajorDefectsWelsh: [
                                    "6.1.a Cylch cadw teiar: wedi torri neu heb ei ffitio'n iawn fel bod datgysylltiad yn debygol. Echelau: 1. Mewnol Allanol. Asdasd"
                                ],
                                Make: "STANLEY",
                                Model: "AUTOTRL",
                                Trn: "ABC123",
                                IsTrailer: true,
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(trlFailWithDangerousAndMajorDefect, true)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                                // Remove the signature
                                S3BucketMockService.buckets.pop();
                            });
                    });
                });
            });

            context("and the trl result has advisory, minor, dangerous and major defects", () => {
                context("and the test station location is not in Wales", () => {
                    it("should return a VTG30 payload without any Welsh defect arrays populated", async () => {
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
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd"
                                ],
                                MajorDefects: [
                                    "6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd"
                                ],
                                AdvisoryDefects: [
                                    "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc"
                                ],
                                MinorDefects: [
                                    "54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside."
                                ],
                                Make: "STANLEY",
                                Model: "AUTOTRL",
                                Trn: "ABC123",
                                IsTrailer: true,
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(trlFailWithAdvisoryMinorDangerousMajorDefect)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                                // Remove the signature
                                S3BucketMockService.buckets.pop();
                            });
                    });
                });

                context("and the test station location is in Wales", () => {
                    it("should return a VTG30W payload with all Welsh defect arrays populated", async () => {
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
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd"
                                ],
                                DangerousDefectsWelsh: [
                                    "54.1.a.ii Llywio pŵer: ddim yn gweithio'n gywir ac yn amlwg yn effeithio ar reolaeth llywio. Echelau: 7. Mewnol Allanol. Asdasd"
                                ],
                                MajorDefects: [
                                    "6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd"
                                ],
                                MajorDefectsWelsh: [
                                    "6.1.a Cylch cadw teiar: wedi torri neu heb ei ffitio'n iawn fel bod datgysylltiad yn debygol. Echelau: 1. Mewnol Allanol. Asdasd"
                                ],
                                AdvisoryDefects: [
                                    "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc"
                                ],
                                AdvisoryDefectsWelsh: [
                                    "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc"
                                ],
                                MinorDefects: [
                                    "54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside."
                                ],
                                MinorDefectsWelsh: [
                                    "54.1.d.i Llywio pŵer: cronfa ddŵr yn is na'r lefel isaf. Echelau: 7. Allanol Ochr mewnol."
                                ],
                                Make: "STANLEY",
                                Model: "AUTOTRL",
                                Trn: "ABC123",
                                IsTrailer: true,
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(trlFailWithAdvisoryMinorDangerousMajorDefect, true)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                                // Remove the signature
                                S3BucketMockService.buckets.pop();
                            });
                    });
                });
            });

            context("and the trl result has a Dangerous Defect with Major defect rectified", () => {
                context("and the test station location is not in Wales", () => {
                    it("should return a VTG30 payload with PRSDefects list in fail data", async () => {
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
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd"
                                ],
                                MajorDefects: undefined,
                                AdvisoryDefects: [
                                    "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc"
                                ],
                                MinorDefects: [
                                    "54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside."
                                ],
                                PRSDefects: [
                                    "6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd"
                                ],
                                Make: "STANLEY",
                                Model: "AUTOTRL",
                                Trn: "ABC123",
                                IsTrailer: true,
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(trlFailWithDangerousDefectMajorRectified)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                });

                context("and the test station location is in Wales", () => {
                    it("should return a VTG30W payload with PRSDefectsWelsh list in fail data", async () => {
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
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd"
                                ],
                                DangerousDefectsWelsh: [
                                    "54.1.a.ii Llywio pŵer: ddim yn gweithio'n gywir ac yn amlwg yn effeithio ar reolaeth llywio. Echelau: 7. Mewnol Allanol. Asdasd"
                                ],
                                MajorDefects: undefined,
                                MajorDefectsWelsh: undefined,
                                AdvisoryDefects: [
                                    "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc"
                                ],
                                AdvisoryDefectsWelsh: [
                                    "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc"
                                ],
                                MinorDefects: [
                                    "54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside."
                                ],
                                MinorDefectsWelsh: [
                                    "54.1.d.i Llywio pŵer: cronfa ddŵr yn is na'r lefel isaf. Echelau: 7. Allanol Ochr mewnol."
                                ],
                                PRSDefects: [
                                    "6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd"
                                ],
                                PRSDefectsWelsh: [
                                    "6.1.a Cylch cadw teiar: wedi torri neu heb ei ffitio'n iawn fel bod datgysylltiad yn debygol. Echelau: 1. Mewnol Allanol. Asdasd"
                                ],
                                Make: "STANLEY",
                                Model: "AUTOTRL",
                                Trn: "ABC123",
                                IsTrailer: true,
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(trlFailWithDangerousDefectMajorRectified, true)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                });
            });

            context("and the trl result has a Major Defect with Dangerous defect rectified", () => {
                context("and the test station location is not in Wales", () => {
                    it("should return a VTG30 payload with PRSDefects list in fail data", async () => {
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
                                DangerousDefects: undefined,
                                MajorDefects: [
                                    "6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd"
                                ],
                                AdvisoryDefects: [
                                    "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc"
                                ],
                                MinorDefects: [
                                    "54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside."
                                ],
                                PRSDefects: [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd"
                                ],
                                Make: "STANLEY",
                                Model: "AUTOTRL",
                                Trn: "ABC123",
                                IsTrailer: true,
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(trlFailWithMajorDefectDangerousRectified)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                });

                context("and the test station location is in Wales", () => {
                    it("should return a VTG30W payload with PRSDefectsWelsh list in fail data", async () => {
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
                                DangerousDefects: undefined,
                                MajorDefects: [
                                    "6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd"
                                ],
                                MajorDefectsWelsh: [
                                    "6.1.a Cylch cadw teiar: wedi torri neu heb ei ffitio'n iawn fel bod datgysylltiad yn debygol. Echelau: 1. Mewnol Allanol. Asdasd"
                                ],
                                AdvisoryDefects: [
                                    "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc"
                                ],
                                AdvisoryDefectsWelsh: [
                                    "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc"
                                ],
                                MinorDefects: [
                                    "54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside."
                                ],
                                MinorDefectsWelsh: [
                                    "54.1.d.i Llywio pŵer: cronfa ddŵr yn is na'r lefel isaf. Echelau: 7. Allanol Ochr mewnol."
                                ],
                                PRSDefects: [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd"
                                ],
                                PRSDefectsWelsh: [
                                    "54.1.a.ii Llywio pŵer: ddim yn gweithio'n gywir ac yn amlwg yn effeithio ar reolaeth llywio. Echelau: 7. Mewnol Allanol. Asdasd"
                                ],
                                Make: "STANLEY",
                                Model: "AUTOTRL",
                                Trn: "ABC123",
                                IsTrailer: true,
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(trlFailWithMajorDefectDangerousRectified, true)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                });
            });

            context("and the psv result has a dangerous defect", () => {
                context("and the test station location is not in Wales", () => {
                    it('should return a VTP30 payload without the DangerousDefectsWelsh array populated', async () => {
                        const expectedResultEnglish: any = {
                            FAIL_DATA: {
                                CountryOfRegistrationCode: "gb",
                                CurrentOdometer: {
                                    unit: "kilometres",
                                    value: 12312
                                },
                                DangerousDefects: [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd"
                                ],

                                DateOfTheTest: "26.02.2019",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                ExpiryDate: "25.02.2020",
                                IssuersName: "Dev1 CVS",
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                RawVIN: "XMGDE02FS0H012345",
                                RawVRM: "BQ91YHQ",
                                SeatBeltNumber: 2,
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltTested: "Yes",
                                TestNumber: "W01A00310",
                                TestStationName: "Abshire-Kub",
                                TestStationPNumber: "09-4129632",
                                VehicleEuClassification: "M1",
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageData: null,
                                ImageType: "png"
                            },
                            Watermark: "NOT VALID"
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsSearchPsv);

                        const techRecordsPsvStub = cloneDeep(psvFailWithDangerousDefect);
                        callGetTechRecordSpy.mockResolvedValue(techRecordsPsvStub as any);

                        return await certificateGenerationService
                            .generatePayload(psvFailWithDangerousDefect)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResultEnglish);
                                expect(payload.FAIL_DATA.DangerousDefectsWelsh).toBeUndefined();
                            });
                    });
                })

                context("and the test station location is in Wales", () => {
                    it('should return a VTP30 payload with the DangerousDefectsWelsh array populated', async () => {
                        const expectedResultEnglish: any = {
                            FAIL_DATA: {
                                CountryOfRegistrationCode: "gb",
                                CurrentOdometer: {
                                    unit: "kilometres",
                                    value: 12312
                                },
                                DangerousDefects: [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd"
                                ],
                                "DangerousDefectsWelsh": [
                                    "54.1.a.ii Llywio pŵer: ddim yn gweithio'n gywir ac yn amlwg yn effeithio ar reolaeth llywio. Echelau: 7. Mewnol Allanol. Asdasd"
                                ],
                                DateOfTheTest: "26.02.2019",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                ExpiryDate: "25.02.2020",
                                IssuersName: "Dev1 CVS",
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                RawVIN: "XMGDE02FS0H012345",
                                RawVRM: "BQ91YHQ",
                                SeatBeltNumber: 2,
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltTested: "Yes",
                                TestNumber: "W01A00310",
                                TestStationName: "Abshire-Kub",
                                TestStationPNumber: "09-4129632",
                                VehicleEuClassification: "M1",
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageData: null,
                                ImageType: "png"
                            },
                            Watermark: "NOT VALID"
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsSearchPsv);

                        const techRecordsPsvStub = cloneDeep(psvFailWithDangerousDefect);
                        callGetTechRecordSpy.mockResolvedValue(techRecordsPsvStub as any);

                        return await certificateGenerationService
                            .generatePayload(psvFailWithDangerousDefect, true)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResultEnglish);
                            });
                    });
                })
            })

            context("and the psv result has a major defect", () => {
                context("and the test station location is not in Wales", () => {
                    it('should return a VTP30 payload without the MajorDefectsWelsh array populated', async () => {
                        const expectedResultEnglish: any = {
                            FAIL_DATA: {
                                CountryOfRegistrationCode: "gb",
                                CurrentOdometer: {
                                    unit: "kilometres",
                                    value: 12312
                                },
                                "MajorDefects": [
                                    "6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd"
                                ],
                                DateOfTheTest: "26.02.2019",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                ExpiryDate: "25.02.2020",
                                IssuersName: "Dev1 CVS",
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                RawVIN: "XMGDE02FS0H012345",
                                RawVRM: "BQ91YHQ",
                                SeatBeltNumber: 2,
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltTested: "Yes",
                                TestNumber: "W01A00310",
                                TestStationName: "Abshire-Kub",
                                TestStationPNumber: "09-4129632",
                                VehicleEuClassification: "M1",
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageData: null,
                                ImageType: "png"
                            },
                            Watermark: "NOT VALID"
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsSearchPsv);

                        const techRecordsPsvStub = cloneDeep(psvFailWithMajorDefect);
                        callGetTechRecordSpy.mockResolvedValue(techRecordsPsvStub as any);

                        return await certificateGenerationService
                            .generatePayload(psvFailWithMajorDefect)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResultEnglish);
                                expect(payload.FAIL_DATA.MajorDefectsWelsh).toBeUndefined();
                            });
                    });
                })

                context("and the test station location is in Wales", () => {
                    it('should return a VTP30 payload with the MajorDefectsWelsh array populated', async () => {
                        const expectedResultEnglish: any = {
                            FAIL_DATA: {
                                CountryOfRegistrationCode: "gb",
                                CurrentOdometer: {
                                    unit: "kilometres",
                                    value: 12312
                                },
                                "MajorDefects": [
                                    "6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd"
                                ],
                                "MajorDefectsWelsh": [
                                    "6.1.a Cylch cadw teiar: wedi torri neu heb ei ffitio'n iawn fel bod datgysylltiad yn debygol. Echelau: 1. Mewnol Allanol. Asdasd"
                                ],
                                DateOfTheTest: "26.02.2019",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                ExpiryDate: "25.02.2020",
                                IssuersName: "Dev1 CVS",
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                RawVIN: "XMGDE02FS0H012345",
                                RawVRM: "BQ91YHQ",
                                SeatBeltNumber: 2,
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltTested: "Yes",
                                TestNumber: "W01A00310",
                                TestStationName: "Abshire-Kub",
                                TestStationPNumber: "09-4129632",
                                VehicleEuClassification: "M1",
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageData: null,
                                ImageType: "png"
                            },
                            Watermark: "NOT VALID"
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsSearchPsv);

                        const techRecordsPsvStub = cloneDeep(psvFailWithMajorDefect);
                        callGetTechRecordSpy.mockResolvedValue(techRecordsPsvStub as any);

                        return await certificateGenerationService
                            .generatePayload(psvFailWithMajorDefect, true)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResultEnglish);
                            });
                    });
                })
            })

            context("and the psv result has a major and dangerous defect", () => {
                context("and the test station location is not in Wales", () => {
                    it('should return a VTP30 payload without the Major or DangerousDefectsWelsh arrays populated', async () => {
                        const expectedResultEnglish: any = {
                            FAIL_DATA: {
                                CountryOfRegistrationCode: "gb",
                                CurrentOdometer: {
                                    unit: "kilometres",
                                    value: 12312
                                },
                                "MajorDefects": [
                                    "6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd"
                                ],
                                "DangerousDefects": [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd"
                                ],
                                DateOfTheTest: "26.02.2019",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                ExpiryDate: "25.02.2020",
                                IssuersName: "Dev1 CVS",
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                RawVIN: "XMGDE02FS0H012345",
                                RawVRM: "BQ91YHQ",
                                SeatBeltNumber: 2,
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltTested: "Yes",
                                TestNumber: "W01A00310",
                                TestStationName: "Abshire-Kub",
                                TestStationPNumber: "09-4129632",
                                VehicleEuClassification: "M1",
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageData: null,
                                ImageType: "png"
                            },
                            Watermark: "NOT VALID"
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsSearchPsv);

                        const techRecordsPsvStub = cloneDeep(psvFailWithDangerousAndMajorDefect);
                        callGetTechRecordSpy.mockResolvedValue(techRecordsPsvStub as any);

                        return await certificateGenerationService
                            .generatePayload(psvFailWithDangerousAndMajorDefect)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResultEnglish);
                                expect(payload.FAIL_DATA.DangerousDefectsWelsh).toBeUndefined();
                                expect(payload.FAIL_DATA.MajorDefectsWelsh).toBeUndefined();
                            });
                    });
                })

                context("and the test station location is in Wales", () => {
                    it('should return a VTP30 payload with the Major and DangerousDefectsWelsh arrays populated', async () => {
                        const expectedResultEnglish: any = {
                            FAIL_DATA: {
                                CountryOfRegistrationCode: "gb",
                                CurrentOdometer: {
                                    unit: "kilometres",
                                    value: 12312
                                },
                                "MajorDefects": [
                                    "6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd"
                                ],
                                "MajorDefectsWelsh": [
                                    "6.1.a Cylch cadw teiar: wedi torri neu heb ei ffitio'n iawn fel bod datgysylltiad yn debygol. Echelau: 1. Mewnol Allanol. Asdasd"
                                ],
                                "DangerousDefects": [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd"
                                ],
                                "DangerousDefectsWelsh": [
                                    "54.1.a.ii Llywio pŵer: ddim yn gweithio'n gywir ac yn amlwg yn effeithio ar reolaeth llywio. Echelau: 7. Mewnol Allanol. Asdasd"
                                ],
                                DateOfTheTest: "26.02.2019",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                ExpiryDate: "25.02.2020",
                                IssuersName: "Dev1 CVS",
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                RawVIN: "XMGDE02FS0H012345",
                                RawVRM: "BQ91YHQ",
                                SeatBeltNumber: 2,
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltTested: "Yes",
                                TestNumber: "W01A00310",
                                TestStationName: "Abshire-Kub",
                                TestStationPNumber: "09-4129632",
                                VehicleEuClassification: "M1",
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageData: null,
                                ImageType: "png"
                            },
                            Watermark: "NOT VALID"
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsSearchPsv);

                        const techRecordsPsvStub = cloneDeep(psvFailWithDangerousAndMajorDefect);
                        callGetTechRecordSpy.mockResolvedValue(techRecordsPsvStub as any);

                        return await certificateGenerationService
                            .generatePayload(psvFailWithDangerousAndMajorDefect, true)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResultEnglish);
                            });
                    });
                })
            })

            context("and the psv result has a advisory, minor, dangerous and major defects", () => {
                context("and the test station location is not in Wales", () => {
                    it('should return a VTP30 payload without any Welsh defect arrays populated', async () => {
                        const expectedResultEnglish: any = {
                            FAIL_DATA: {
                                CountryOfRegistrationCode: "gb",
                                CurrentOdometer: {
                                    unit: "kilometres",
                                    value: 12312
                                },
                                "AdvisoryDefects": [
                                    "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc"
                                ],
                                "MajorDefects": [
                                    "6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd"
                                ],
                                "DangerousDefects": [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd"
                                ],
                                "MinorDefects": [
                                    "54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside."
                                ],
                                DateOfTheTest: "26.02.2019",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                ExpiryDate: "25.02.2020",
                                IssuersName: "Dev1 CVS",
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                RawVIN: "XMGDE02FS0H012345",
                                RawVRM: "BQ91YHQ",
                                SeatBeltNumber: 2,
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltTested: "Yes",
                                TestNumber: "W01A00310",
                                TestStationName: "Abshire-Kub",
                                TestStationPNumber: "09-4129632",
                                VehicleEuClassification: "M1",
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageData: null,
                                ImageType: "png"
                            },
                            Watermark: "NOT VALID"
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsSearchPsv);

                        const techRecordsPsvStub = cloneDeep(psvFailWithAdvisoryMinorDangerousMajorDefect);
                        callGetTechRecordSpy.mockResolvedValue(techRecordsPsvStub as any);

                        return await certificateGenerationService
                            .generatePayload(psvFailWithAdvisoryMinorDangerousMajorDefect)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResultEnglish);
                                expect(payload.FAIL_DATA.DangerousDefectsWelsh).toBeUndefined();
                                expect(payload.FAIL_DATA.MajorDefectsWelsh).toBeUndefined();
                                expect(payload.FAIL_DATA.AdvisoryDefectsWelsh).toBeUndefined();
                                expect(payload.FAIL_DATA.MinorDefectsWelsh).toBeUndefined();
                            });
                    });
                })

                context("and the test station location is in Wales", () => {
                    it('should return a VTP30 payload with all Welsh defect arrays populated', async () => {
                        const expectedResultEnglish: any = {
                            FAIL_DATA: {
                                CountryOfRegistrationCode: "gb",
                                CurrentOdometer: {
                                    unit: "kilometres",
                                    value: 12312
                                },
                                "MajorDefects": [
                                    "6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd"
                                ],
                                "MajorDefectsWelsh": [
                                    "6.1.a Cylch cadw teiar: wedi torri neu heb ei ffitio'n iawn fel bod datgysylltiad yn debygol. Echelau: 1. Mewnol Allanol. Asdasd"
                                ],
                                "DangerousDefects": [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd"
                                ],
                                "DangerousDefectsWelsh": [
                                    "54.1.a.ii Llywio pŵer: ddim yn gweithio'n gywir ac yn amlwg yn effeithio ar reolaeth llywio. Echelau: 7. Mewnol Allanol. Asdasd"
                                ],
                                "MinorDefects": [
                                    "54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside."
                                ],
                                "MinorDefectsWelsh": [
                                    "54.1.d.i Llywio pŵer: cronfa ddŵr yn is na'r lefel isaf. Echelau: 7. Allanol Ochr mewnol."
                                ],
                                "AdvisoryDefects": [
                                    "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc"
                                ],
                                "AdvisoryDefectsWelsh": [
                                    "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc"
                                ],
                                DateOfTheTest: "26.02.2019",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                ExpiryDate: "25.02.2020",
                                IssuersName: "Dev1 CVS",
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                RawVIN: "XMGDE02FS0H012345",
                                RawVRM: "BQ91YHQ",
                                SeatBeltNumber: 2,
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltTested: "Yes",
                                TestNumber: "W01A00310",
                                TestStationName: "Abshire-Kub",
                                TestStationPNumber: "09-4129632",
                                VehicleEuClassification: "M1",
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageData: null,
                                ImageType: "png"
                            },
                            Watermark: "NOT VALID"
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsSearchPsv);

                        const techRecordsPsvStub = cloneDeep(psvFailWithAdvisoryMinorDangerousMajorDefect);
                        callGetTechRecordSpy.mockResolvedValue(techRecordsPsvStub as any);

                        return await certificateGenerationService
                            .generatePayload(psvFailWithAdvisoryMinorDangerousMajorDefect, true)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResultEnglish);
                            });
                    });
                })
            })

            context("and the psv result has a dangerous defect with major rectified", () => {
                context("and the test station location is not in Wales", () => {
                    it('should return a VTP30 payload without PRSDefectsWelsh list in fail data', async () => {
                        const expectedResultEnglish: any = {
                            FAIL_DATA: {
                                CountryOfRegistrationCode: "gb",
                                CurrentOdometer: {
                                    unit: "kilometres",
                                    value: 12312
                                },
                                "PRSDefects": [
                                    "6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd"
                                ],
                                "DangerousDefects": [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd"
                                ],
                                DateOfTheTest: "26.02.2019",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                ExpiryDate: "25.02.2020",
                                IssuersName: "Dev1 CVS",
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                RawVIN: "XMGDE02FS0H012345",
                                RawVRM: "BQ91YHQ",
                                SeatBeltNumber: 2,
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltTested: "Yes",
                                TestNumber: "W01A00310",
                                TestStationName: "Abshire-Kub",
                                TestStationPNumber: "09-4129632",
                                VehicleEuClassification: "M1",
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageData: null,
                                ImageType: "png"
                            },
                            Watermark: "NOT VALID"
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsSearchPsv);

                        const techRecordsPsvStub = cloneDeep(psvFailWithDangerousDefectMajorRectified);
                        callGetTechRecordSpy.mockResolvedValue(techRecordsPsvStub as any);

                        return await certificateGenerationService
                            .generatePayload(psvFailWithDangerousDefectMajorRectified)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResultEnglish);
                                expect(payload.FAIL_DATA.PRSDefectsWelsh).toBeUndefined();
                                expect(payload.FAIL_DATA.MajorDefectsWelsh).toBeUndefined();
                            });
                    });
                })

                context("and the test station location is in Wales", () => {
                    it('should return a VTP30 payload with PRSDefectsWelsh list in fail data', async () => {
                        const expectedResultEnglish: any = {
                            FAIL_DATA: {
                                CountryOfRegistrationCode: "gb",
                                CurrentOdometer: {
                                    unit: "kilometres",
                                    value: 12312
                                },
                                "PRSDefects": [
                                    "6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd"
                                ],
                                "PRSDefectsWelsh": [
                                    "6.1.a Cylch cadw teiar: wedi torri neu heb ei ffitio'n iawn fel bod datgysylltiad yn debygol. Echelau: 1. Mewnol Allanol. Asdasd"
                                ],
                                "DangerousDefects": [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd"
                                ],
                                "DangerousDefectsWelsh": [
                                    "54.1.a.ii Llywio pŵer: ddim yn gweithio'n gywir ac yn amlwg yn effeithio ar reolaeth llywio. Echelau: 7. Mewnol Allanol. Asdasd"
                                ],
                                DateOfTheTest: "26.02.2019",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                ExpiryDate: "25.02.2020",
                                IssuersName: "Dev1 CVS",
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                RawVIN: "XMGDE02FS0H012345",
                                RawVRM: "BQ91YHQ",
                                SeatBeltNumber: 2,
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltTested: "Yes",
                                TestNumber: "W01A00310",
                                TestStationName: "Abshire-Kub",
                                TestStationPNumber: "09-4129632",
                                VehicleEuClassification: "M1",
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageData: null,
                                ImageType: "png"
                            },
                            Watermark: "NOT VALID"
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsSearchPsv);

                        const techRecordsPsvStub = cloneDeep(psvFailWithDangerousDefectMajorRectified);
                        callGetTechRecordSpy.mockResolvedValue(techRecordsPsvStub as any);

                        return await certificateGenerationService
                            .generatePayload(psvFailWithDangerousDefectMajorRectified, true)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResultEnglish);
                            });
                    });
                })
            })

            context("and the psv result has a major defect with dangerous rectified", () => {
                context("and the test station location is not in Wales", () => {
                    it('should return a VTP30 payload without PRSDefectsWelsh list in fail data', async () => {
                        const expectedResultEnglish: any = {
                            FAIL_DATA: {
                                CountryOfRegistrationCode: "gb",
                                CurrentOdometer: {
                                    unit: "kilometres",
                                    value: 12312
                                },
                                DateOfTheTest: "26.02.2019",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                ExpiryDate: "25.02.2020",
                                IssuersName: "Dev1 CVS",
                                "MajorDefects": [
                                    "6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd"
                                ],
                                "PRSDefects": [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd"
                                ],
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                RawVIN: "XMGDE02FS0H012345",
                                RawVRM: "BQ91YHQ",
                                SeatBeltNumber: 2,
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltTested: "Yes",
                                TestNumber: "W01A00310",
                                TestStationName: "Abshire-Kub",
                                TestStationPNumber: "09-4129632",
                                VehicleEuClassification: "M1",
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageData: null,
                                ImageType: "png"
                            },
                            Watermark: "NOT VALID"
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsSearchPsv);

                        const techRecordsPsvStub = cloneDeep(psvFailWithMajorDefectDangerousRectified);
                        callGetTechRecordSpy.mockResolvedValue(techRecordsPsvStub as any);

                        return await certificateGenerationService
                            .generatePayload(psvFailWithMajorDefectDangerousRectified)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResultEnglish);
                                expect(payload.FAIL_DATA.PRSDefectsWelsh).toBeUndefined();
                                expect(payload.FAIL_DATA.MajorDefectsWelsh).toBeUndefined();
                            });
                    });
                })

                context("and the test station location is in Wales", () => {
                    it('should return a VTP30 payload with PRSDefectsWelsh list in fail data', async () => {
                        const expectedResultEnglish: any = {
                            FAIL_DATA: {
                                CountryOfRegistrationCode: "gb",
                                CurrentOdometer: {
                                    unit: "kilometres",
                                    value: 12312
                                },
                                "MajorDefects": [
                                    "6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd"
                                ],
                                "MajorDefectsWelsh": [
                                    "6.1.a Cylch cadw teiar: wedi torri neu heb ei ffitio'n iawn fel bod datgysylltiad yn debygol. Echelau: 1. Mewnol Allanol. Asdasd"
                                ],
                                "PRSDefects": [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd"
                                ],
                                "PRSDefectsWelsh": [
                                    "54.1.a.ii Llywio pŵer: ddim yn gweithio'n gywir ac yn amlwg yn effeithio ar reolaeth llywio. Echelau: 7. Mewnol Allanol. Asdasd"
                                ],
                                DateOfTheTest: "26.02.2019",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                ExpiryDate: "25.02.2020",
                                IssuersName: "Dev1 CVS",
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                RawVIN: "XMGDE02FS0H012345",
                                RawVRM: "BQ91YHQ",
                                SeatBeltNumber: 2,
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltTested: "Yes",
                                TestNumber: "W01A00310",
                                TestStationName: "Abshire-Kub",
                                TestStationPNumber: "09-4129632",
                                VehicleEuClassification: "M1",
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageData: null,
                                ImageType: "png"
                            },
                            Watermark: "NOT VALID"
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsSearchPsv);

                        const techRecordsPsvStub = cloneDeep(psvFailWithMajorDefectDangerousRectified);
                        callGetTechRecordSpy.mockResolvedValue(techRecordsPsvStub as any);

                        return await certificateGenerationService
                            .generatePayload(psvFailWithMajorDefectDangerousRectified, true)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResultEnglish);
                            });
                    });
                })
            })
        });

        context("when a prs test result is read from the queue", () => {
            const event: any = JSON.parse(
                fs.readFileSync(
                    path.resolve(__dirname, "../resources/queue-event-prs.json"),
                    "utf8"
                )
            );
            context("and the TRL has defects that is rectified at the test", () => {
                const trlPRS = JSON.parse(event.Records[4].body);

                context("and the test station is not in wales", () => {
                    it("should return a TRL PRS certificate with the defects array populated", async () => {
                            const expectedResult = {
                                DATA: {
                                    CountryOfRegistrationCode: "gb",
                                    CurrentOdometer: {
                                        unit: "kilometres",
                                        value: 12312
                                    },
                                    DateOfTheTest: "26.02.2019",
                                    EarliestDateOfTheNextTest: "01.11.2019",
                                    ExpiryDate: "25.02.2020",
                                    IsTrailer: true,
                                    IssuersName: "CVS Dev1",
                                    Make: "Isuzu",
                                    Model: "FM",
                                    RawVIN: "T12876765",
                                    SeatBeltNumber: 2,
                                    SeatBeltPreviousCheckDate: "26.02.2019",
                                    SeatBeltTested: "Yes",
                                    TestNumber: "W01A00310",
                                    TestStationName: "Abshire-Kub",
                                    TestStationPNumber: "09-4129632",
                                    Trn: "ABC123",
                                    VehicleEuClassification: "M1",
                                    Recalls: {
                                        manufacturer: null,
                                        hasRecall: false
                                    }
                                },
                                FAIL_DATA: {
                                    CountryOfRegistrationCode: "gb",
                                    CurrentOdometer: {
                                        unit: "kilometres",
                                        value: 12312
                                    },
                                    DateOfTheTest: "26.02.2019",
                                    EarliestDateOfTheNextTest: "01.11.2019",
                                    ExpiryDate: "25.02.2020",
                                    IsTrailer: true,
                                    IssuersName: "CVS Dev1",
                                    Make: "Isuzu",
                                    Model: "FM",
                                    PRSDefects: [
                                        "6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd"
                                    ],
                                    RawVIN: "T12876765",
                                    SeatBeltNumber: 2,
                                    SeatBeltPreviousCheckDate: "26.02.2019",
                                    SeatBeltTested: "Yes",
                                    TestNumber: "W01A00310",
                                    TestStationName: "Abshire-Kub",
                                    TestStationPNumber: "09-4129632",
                                    Trn: "ABC123",
                                    VehicleEuClassification: "M1",
                                    Recalls: {
                                        manufacturer: null,
                                        hasRecall: false
                                    }
                                },
                                Signature: {
                                    ImageData: null,
                                    ImageType: "png"
                                },
                                Watermark: "NOT VALID"
                            };
                            callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtHgvSearch);

                            const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                            return await certificateGenerationService
                                .generatePayload(trlPRS)
                                .then((payload: any) => {
                                    expect(payload).toEqual(expectedResult);
                                    callGetTechRecordSpy.mockClear();
                                    callSearchTechRecordSpy.mockClear();
                                });
                        }
                    );
                    context(" and the test station is in wales", () => {
                        it("should return a TRL PRS bilingual certificate with the defects array populated", async () => {
                            const expectedResult = {
                                DATA: {
                                    CountryOfRegistrationCode: "gb",
                                    CurrentOdometer: {
                                        unit: "kilometres",
                                        value: 12312
                                    },
                                    DateOfTheTest: "26.02.2019",
                                    EarliestDateOfTheNextTest: "01.11.2019",
                                    ExpiryDate: "25.02.2020",
                                    IsTrailer: true,
                                    IssuersName: "CVS Dev1",
                                    Make: "Isuzu",
                                    Model: "FM",
                                    RawVIN: "T12876765",
                                    SeatBeltNumber: 2,
                                    SeatBeltPreviousCheckDate: "26.02.2019",
                                    SeatBeltTested: "Yes",
                                    TestNumber: "W01A00310",
                                    TestStationName: "Abshire-Kub",
                                    TestStationPNumber: "09-4129632",
                                    Trn: "ABC123",
                                    VehicleEuClassification: "M1",
                                    Recalls: {
                                        manufacturer: null,
                                        hasRecall: false
                                    }
                                },
                                FAIL_DATA: {
                                    CountryOfRegistrationCode: "gb",
                                    CurrentOdometer: {
                                        unit: "kilometres",
                                        value: 12312
                                    },
                                    DateOfTheTest: "26.02.2019",
                                    EarliestDateOfTheNextTest: "01.11.2019",
                                    ExpiryDate: "25.02.2020",
                                    IsTrailer: true,
                                    IssuersName: "CVS Dev1",
                                    Make: "Isuzu",
                                    Model: "FM",
                                    PRSDefects: [
                                        "6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd"
                                    ],
                                    PRSDefectsWelsh: [
                                        "6.1.a Cylch cadw teiar: wedi torri neu heb ei ffitio'n iawn fel bod datgysylltiad yn debygol. Echelau: 1. Mewnol Allanol. Asdasd"
                                    ],
                                    RawVIN: "T12876765",
                                    SeatBeltNumber: 2,
                                    SeatBeltPreviousCheckDate: "26.02.2019",
                                    SeatBeltTested: "Yes",
                                    TestNumber: "W01A00310",
                                    TestStationName: "Abshire-Kub",
                                    TestStationPNumber: "09-4129632",
                                    Trn: "ABC123",
                                    VehicleEuClassification: "M1",
                                    Recalls: {
                                        manufacturer: null,
                                        hasRecall: false
                                    }
                                },
                                Signature: {
                                    ImageData: null,
                                    ImageType: "png"
                                },
                                Watermark: "NOT VALID"
                            };
                            callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtHgvSearch);

                            const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                            return await certificateGenerationService
                                .generatePayload(trlPRS, true)
                                .then((payload: any) => {
                                    expect(payload).toEqual(expectedResult);
                                    callGetTechRecordSpy.mockClear();
                                    callSearchTechRecordSpy.mockClear();
                                });
                        });
                    });
                });
            });

            context("and the PSV has defects that are rectified at the test", () => {
                const psvPRS = JSON.parse(event.Records[5].body);

                context("and the test station is not in wales", () => {
                    it("should return a PSV certificate with the defects array", async () => {
                        const expectedResult = {
                            DATA: {
                                CountryOfRegistrationCode: "gb",
                                CurrentOdometer: {
                                    unit: "kilometres",
                                    value: 12312
                                },
                                DateOfTheTest: "26.02.2019",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                ExpiryDate: "25.02.2020",
                                IssuersName: "CVS Dev1",
                                Make: "AEC",
                                Model: "RELIANCE",
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                RawVIN: "XMGDE02FS0H012345",
                                RawVRM: "BQ91YHQ",
                                SeatBeltNumber: 2,
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltTested: "Yes",
                                TestNumber: "W01A00310",
                                TestStationName: "Abshire-Kub",
                                TestStationPNumber: "09-4129632",
                                VehicleEuClassification: "M1",
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            FAIL_DATA: {
                                CountryOfRegistrationCode: "gb",
                                CurrentOdometer: {
                                    unit: "kilometres",
                                    value: 12312
                                },
                                DateOfTheTest: "26.02.2019",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                ExpiryDate: "25.02.2020",
                                IssuersName: "CVS Dev1",
                                Make: "AEC",
                                Model: "RELIANCE",
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                PRSDefects: [
                                    "6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd"
                                ],
                                RawVIN: "XMGDE02FS0H012345",
                                RawVRM: "BQ91YHQ",
                                SeatBeltNumber: 2,
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltTested: "Yes",
                                TestNumber: "W01A00310",
                                TestStationName: "Abshire-Kub",
                                TestStationPNumber: "09-4129632",
                                VehicleEuClassification: "M1",
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageData: null,
                                ImageType: "png"
                            },
                            Watermark: "NOT VALID"
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsSearchPsv);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsPsv);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(psvPRS)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                });

                context("and the test station is in wales", () => {
                    it("should return a PSV bilingual certificate with the defects array populated", async () => {
                        const expectedResult = {
                            DATA: {
                                CountryOfRegistrationCode: "gb",
                                CurrentOdometer: {
                                    unit: "kilometres",
                                    value: 12312
                                },
                                DateOfTheTest: "26.02.2019",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                ExpiryDate: "25.02.2020",
                                IssuersName: "CVS Dev1",
                                Make: "AEC",
                                Model: "RELIANCE",
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                RawVIN: "XMGDE02FS0H012345",
                                RawVRM: "BQ91YHQ",
                                SeatBeltNumber: 2,
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltTested: "Yes",
                                TestNumber: "W01A00310",
                                TestStationName: "Abshire-Kub",
                                TestStationPNumber: "09-4129632",
                                VehicleEuClassification: "M1",
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            FAIL_DATA: {
                                CountryOfRegistrationCode: "gb",
                                CurrentOdometer: {
                                    unit: "kilometres",
                                    value: 12312
                                },
                                DateOfTheTest: "26.02.2019",
                                EarliestDateOfTheNextTest: "26.12.2019",
                                ExpiryDate: "25.02.2020",
                                IssuersName: "CVS Dev1",
                                Make: "AEC",
                                Model: "RELIANCE",
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                PRSDefects: [
                                    "6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd"
                                ],
                                PRSDefectsWelsh: [
                                    "6.1.a Cylch cadw teiar: wedi torri neu heb ei ffitio'n iawn fel bod datgysylltiad yn debygol. Echelau: 1. Mewnol Allanol. Asdasd"
                                ],
                                RawVIN: "XMGDE02FS0H012345",
                                RawVRM: "BQ91YHQ",
                                SeatBeltNumber: 2,
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltTested: "Yes",
                                TestNumber: "W01A00310",
                                TestStationName: "Abshire-Kub",
                                TestStationPNumber: "09-4129632",
                                VehicleEuClassification: "M1",
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageData: null,
                                ImageType: "png"
                            },
                            Watermark: "NOT VALID"
                        };
                        callSearchTechRecordSpy.mockResolvedValue(techRecordsSearchPsv);

                        const techRecordResponseMock = cloneDeep(techRecordsPsv);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseMock as any);

                        return await certificateGenerationService
                            .generatePayload(psvPRS, true)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                });
            });
            const testResult: any = JSON.parse(event.Records[0].body);
            let resBody = "";

            context("and the result has a defect that is rectified at test", () => {
                const hgvWithDefectRectifiedAtTest: any = JSON.parse(event.Records[3].body);
                context("and the test station location is not in Wales", () => {
                    it("should return a VTG5 payload without the DangerousDefectsWelsh array populated", async () => {
                        const expectedResult: any = {
                            DATA: {
                                CountryOfRegistrationCode: "gb",
                                CurrentOdometer: {
                                    unit: "kilometres",
                                    value: 12312
                                },
                                DateOfTheTest: "26.02.2019",
                                EarliestDateOfTheNextTest: "01.11.2019",
                                ExpiryDate: "25.02.2020",
                                IssuersName: "CVS Dev1",
                                Make: "Isuzu",
                                Model: "FM",
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                RawVIN: "P012301098765",
                                RawVRM: "VM14MDT",
                                SeatBeltNumber: 2,
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltTested: "Yes",
                                TestNumber: "W01A00310",
                                TestStationName: "Abshire-Kub",
                                TestStationPNumber: "09-4129632",
                                VehicleEuClassification: "M1",
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            FAIL_DATA: {
                                CountryOfRegistrationCode: "gb",
                                CurrentOdometer: {
                                    unit: "kilometres",
                                    value: 12312
                                },
                                DateOfTheTest: "26.02.2019",
                                EarliestDateOfTheNextTest: "01.11.2019",
                                ExpiryDate: "25.02.2020",
                                IssuersName: "CVS Dev1",
                                Make: "Isuzu",
                                Model: "FM",
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                PRSDefects: [
                                    "6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd"
                                ],
                                RawVIN: "P012301098765",
                                RawVRM: "VM14MDT",
                                SeatBeltNumber: 2,
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltTested: "Yes",
                                TestNumber: "W01A00310",
                                TestStationName: "Abshire-Kub",
                                TestStationPNumber: "09-4129632",
                                VehicleEuClassification: "M1",
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageData: null,
                                ImageType: "png"
                            },
                            Watermark: "NOT VALID"
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(hgvWithDefectRectifiedAtTest)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                });

                context("and the test station location is in Wales", () => {
                    it("should return a VTG5W payload with the DangerousDefectsWelsh array populated", async () => {
                        const expectedResult: any = {
                            DATA: {
                                CountryOfRegistrationCode: "gb",
                                CurrentOdometer: {
                                    unit: "kilometres",
                                    value: 12312
                                },
                                DateOfTheTest: "26.02.2019",
                                EarliestDateOfTheNextTest: "01.11.2019",
                                ExpiryDate: "25.02.2020",
                                IssuersName: "CVS Dev1",
                                Make: "Isuzu",
                                Model: "FM",
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                RawVIN: "P012301098765",
                                RawVRM: "VM14MDT",
                                SeatBeltNumber: 2,
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltTested: "Yes",
                                TestNumber: "W01A00310",
                                TestStationName: "Abshire-Kub",
                                TestStationPNumber: "09-4129632",
                                VehicleEuClassification: "M1",
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            FAIL_DATA: {
                                CountryOfRegistrationCode: "gb",
                                CurrentOdometer: {
                                    unit: "kilometres",
                                    value: 12312
                                },
                                DateOfTheTest: "26.02.2019",
                                EarliestDateOfTheNextTest: "01.11.2019",
                                ExpiryDate: "25.02.2020",
                                IssuersName: "CVS Dev1",
                                Make: "Isuzu",
                                Model: "FM",
                                OdometerHistoryList: [
                                    {
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                PRSDefects: [
                                    "6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd"
                                ],
                                PRSDefectsWelsh: [
                                    "6.1.a Cylch cadw teiar: wedi torri neu heb ei ffitio'n iawn fel bod datgysylltiad yn debygol. Echelau: 1. Mewnol Allanol. Asdasd"
                                ],
                                RawVIN: "P012301098765",
                                RawVRM: "VM14MDT",
                                SeatBeltNumber: 2,
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltTested: "Yes",
                                TestNumber: "W01A00310",
                                TestStationName: "Abshire-Kub",
                                TestStationPNumber: "09-4129632",
                                VehicleEuClassification: "M1",
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageData: null,
                                ImageType: "png"
                            },
                            Watermark: "NOT VALID"
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(hgvWithDefectRectifiedAtTest, true)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                });
            });

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
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
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
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };
                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
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
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
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
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };
                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        // @ts-ignore
                        techRecordResponseRwtMock.techRecord_model = undefined;
                        // @ts-ignore
                        techRecordResponseRwtMock.techRecord_make = undefined;
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        // Make the functions return undefined
                        // Stub CertificateGenerationService getOdometerHistory method to return undefined value.
                        callGetOdometerSpy.mockResolvedValue(undefined as any);
                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetOdometerSpy.mockClear();
                                // getVehicleMakeAndModelStub.restore();
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
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
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
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
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
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

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                resBody = payload.body;
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
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
                        callSearchTechRecordSpy.mockResolvedValue(techRecordsSearchPsv);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsPsv);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

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
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                }
            );
        });

        context("when a failing test result is read from the queue", () => {
            const event: any = { ...queueEventFailPRS };
            const testResult: any = JSON.parse(event.Records[0].body);

            context("and certificate Data is generated", () => {
                context(
                    "and test-result contains a Dagerous Defect with Major defect rectified",
                    () => {
                        it("should return Certificate Data with PRSDefects list in Fail data", async () => {
                            const expectedResult: any = {
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
                                    MajorDefects: undefined,
                                    MinorDefects: [
                                        "54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.",
                                    ],
                                    AdvisoryDefects: [
                                        "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc",
                                    ],
                                    PRSDefects: ["1.1.a A registration plate: missing. Front."],
                                    Recalls: {
                                        manufacturer: null,
                                        hasRecall: false
                                    }
                                }
                            };

                            const state = {
                                type: CERTIFICATE_DATA.FAIL_DATA,
                                testResult
                            } as CertificatePayloadStateBag;

                            const passOrFailCommand = Container.get(PassOrFailCertificateCommand);
                            passOrFailCommand.initialise(state);

                            const defectsCommand = Container.get(DefectsCommand);
                            defectsCommand.initialise(state);

                            const payload = {
                                FAIL_DATA: {
                                    ...(await passOrFailCommand.generate()).FAIL_DATA,
                                    ...(await defectsCommand.generate()).FAIL_DATA
                                }
                            };

                            expect(payload).toEqual(expectedResult);
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
                                    Recalls: {
                                        manufacturer: null,
                                        hasRecall: false
                                    }
                                }
                            };

                            const state = {
                                type: CERTIFICATE_DATA.FAIL_DATA,
                                testResult: testResult2
                            } as CertificatePayloadStateBag;

                            const passOrFailCommand = Container.get(PassOrFailCertificateCommand);
                            passOrFailCommand.initialise(state);

                            const defectsCommand = Container.get(DefectsCommand);
                            defectsCommand.initialise(state);

                            const payload = {
                                FAIL_DATA: {
                                    ...(await passOrFailCommand.generate()).FAIL_DATA,
                                    ...(await defectsCommand.generate()).FAIL_DATA
                                }
                            };

                            expect(payload).toEqual(expectedResult);
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
                                    MajorDefects: ["1.1.a A registration plate: missing. Front."],
                                    MinorDefects: [
                                        "54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.",
                                    ],
                                    AdvisoryDefects: [
                                        "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc",
                                    ],
                                    PRSDefects: undefined,
                                    Recalls: {
                                        manufacturer: null,
                                        hasRecall: false
                                    }
                                }
                            };

                            const state = {
                                type: CERTIFICATE_DATA.FAIL_DATA,
                                testResult: testResult3
                            } as CertificatePayloadStateBag;

                            const passOrFailCommand = Container.get(PassOrFailCertificateCommand);
                            passOrFailCommand.initialise(state);

                            const defectsCommand = Container.get(DefectsCommand);
                            defectsCommand.initialise(state);

                            const payload = {
                                FAIL_DATA: {
                                    ...(await passOrFailCommand.generate()).FAIL_DATA,
                                    ...(await defectsCommand.generate()).FAIL_DATA
                                }
                            };

                            expect(payload).toEqual(expectedResult);
                        });
                    }
                );
            });
        });

        context("when a failing test result is read from the queue", () => {
            const event: any = { ...queueEventFail };
            const testResult1: any = JSON.parse(event.Records[3].body);
            const testResult21: any = JSON.parse(event.Records[20].body);

            context("and certificate Data is generated", () => {
                context(
                    "and test-result is an IVA test with a required standard and a test status of fail",
                    () => {
                        it("should return Certificate Data with requiredStandards in IVA_DATA", async () => {
                            const expectedResult: any = {
                                IVA_DATA: {
                                    additionalDefects: [
                                        {
                                            defectName: "N/A",
                                            defectNotes: "",
                                            referenceNumber: ""
                                        }
                                    ],
                                    bodyType: "some bodyType",
                                    date: "28/11/2023",
                                    requiredStandards: [
                                        {
                                            additionalInfo: true,
                                            additionalNotes: "The exhaust was held on with blue tac",
                                            inspectionTypes: [
                                                "normal",
                                                "basic"
                                            ],
                                            prs: false,
                                            refCalculation: "1.1",
                                            requiredStandard: "The exhaust must be securely mounted",
                                            rsNumber: 1,
                                            sectionDescription: "Noise",
                                            sectionNumber: "01"
                                        }
                                    ],
                                    make: "some make",
                                    model: "some model",
                                    reapplicationDate: "",
                                    serialNumber: "C456789",
                                    station: "Abshire-Kub",
                                    testCategoryBasicNormal: "Basic",
                                    testCategoryClass: "m1",
                                    testerName: "CVS Dev1",
                                    vehicleTrailerNrNo: "C456789",
                                    vin: "T12876765",
                                }
                            };

                            const state = {
                                type: CERTIFICATE_DATA.IVA_DATA,
                                testResult: testResult1
                            } as CertificatePayloadStateBag;

                            const ivaCommand = Container.get(IvaCertificateCommand);
                            ivaCommand.initialise(state);
                            const payload = await ivaCommand.generate();
                            expect(payload).toEqual(expectedResult);
                        });

                        it("should return Certificate Data with sorted requiredStandards in IVA_DATA", async () => {
                            const expectedResult: any = {
                                IVA_DATA: {
                                    additionalDefects: [
                                        {
                                            defectName: "N/A",
                                            defectNotes: "",
                                            referenceNumber: ""
                                        }
                                    ],
                                    bodyType: null,
                                    date: "04/03/2024",
                                    requiredStandards: [
                                        {
                                            sectionNumber: "01",
                                            sectionDescription: "Noise",
                                            rsNumber: 1,
                                            requiredStandard: "The exhaust must be securely mounted",
                                            refCalculation: "1.1",
                                            additionalInfo: true,
                                            inspectionTypes: [
                                                "normal",
                                                "basic"
                                            ],
                                            prs: false,
                                            additionalNotes: "The exhaust was held on with blue tac"
                                        },
                                        {
                                            sectionNumber: "6a",
                                            sectionDescription: "Lighting",
                                            rsNumber: 2,
                                            requiredStandard: "An obligatory (or optional) lamp or reflector;  incorrect number fitted",
                                            refCalculation: "6.2a",
                                            additionalInfo: true,
                                            inspectionTypes: [
                                                "normal",
                                                "basic"
                                            ],
                                            prs: false,
                                            additionalNotes: "The bulbs were slightly worn"
                                        },
                                    ],
                                    make: null,
                                    model: null,
                                    reapplicationDate: "",
                                    serialNumber: "ZX345CV",
                                    station: "Abshire-Kub",
                                    testCategoryBasicNormal: "Basic",
                                    testCategoryClass: "l1e-a",
                                    testerName: "CVS Dev1",
                                    vehicleTrailerNrNo: "ZX345CV",
                                    vin: "P0123010956789",
                                }
                            };

                            const state = {
                                type: CERTIFICATE_DATA.IVA_DATA,
                                testResult: testResult21
                            } as CertificatePayloadStateBag;

                            const ivaCommand = Container.get(IvaCertificateCommand);
                            ivaCommand.initialise(state);
                            const payload = await ivaCommand.generate();
                            expect(payload).toEqual(expectedResult);
                        });
                    }
                );

                const testResult2: any = JSON.parse(event.Records[4].body);
                context(
                    "and test-result is an IVA test with multiple required standards and a test status of fail",
                    () => {
                        it("should return Certificate Data with requiredStandards in IVA_DATA", async () => {
                            const expectedResult: any = {
                                IVA_DATA: {
                                    additionalDefects: [
                                        {
                                            defectName: "N/A",
                                            defectNotes: "",
                                            referenceNumber: ""
                                        }
                                    ],
                                    bodyType: "some bodyType",
                                    date: "28/11/2023",
                                    requiredStandards: [
                                        {
                                            additionalInfo: true,
                                            additionalNotes: "The exhaust was held on with blue tac",
                                            inspectionTypes: [
                                                "normal",
                                                "basic"
                                            ],
                                            prs: false,
                                            refCalculation: "1.1",
                                            requiredStandard: "The exhaust must be securely mounted",
                                            rsNumber: 1,
                                            sectionDescription: "Noise",
                                            sectionNumber: "01"
                                        },
                                        {
                                            additionalInfo: false,
                                            additionalNotes: null,
                                            inspectionTypes: [
                                                "basic"
                                            ],
                                            prs: false,
                                            refCalculation: "1.5",
                                            requiredStandard: "The stationary noise must have a measured sound level not exceeding 99dbA. (see Notes 2 & 3).",
                                            rsNumber: 5,
                                            sectionDescription: "Noise",
                                            sectionNumber: "01"
                                        },
                                    ],
                                    make: "some make",
                                    model: "some model",
                                    reapplicationDate: "",
                                    serialNumber: "C456789",
                                    station: "Abshire-Kub",
                                    testCategoryBasicNormal: "Basic",
                                    testCategoryClass: "m1",
                                    testerName: "CVS Dev1",
                                    vehicleTrailerNrNo: "C456789",
                                    vin: "T12876765"
                                }
                            };

                            const state = {
                                type: CERTIFICATE_DATA.IVA_DATA,
                                testResult: testResult2
                            } as CertificatePayloadStateBag;

                            const ivaCommand = Container.get(IvaCertificateCommand);
                            ivaCommand.initialise(state);
                            const payload = await ivaCommand.generate();
                            expect(payload).toEqual(expectedResult);
                        });
                    }
                );

                const testResult3: any = JSON.parse(event.Records[5].body);
                context(
                    "and test-result is an IVA test with a required standard and custom defect, with a test status of fail",
                    () => {
                        it("should return Certificate Data with requiredStandards and additionalDefects in IVA_DATA", async () => {
                            const expectedResult: any = {
                                IVA_DATA: {
                                    additionalDefects: [
                                        "Some custom defect one",
                                        "Some other custom defect two"
                                    ],
                                    bodyType: "some bodyType",
                                    date: "28/11/2023",
                                    requiredStandards: [
                                        {
                                            additionalInfo: true,
                                            additionalNotes: "The exhaust was held on with blue tac",
                                            inspectionTypes: [
                                                "normal",
                                                "basic"
                                            ],
                                            prs: false,
                                            refCalculation: "1.1",
                                            requiredStandard: "The exhaust must be securely mounted",
                                            rsNumber: 1,
                                            sectionDescription: "Noise",
                                            sectionNumber: "01"
                                        }
                                    ],
                                    make: "some make",
                                    model: "some model",
                                    reapplicationDate: "",
                                    serialNumber: "C456789",
                                    station: "Abshire-Kub",
                                    testCategoryBasicNormal: "Basic",
                                    testCategoryClass: "m1",
                                    testerName: "CVS Dev1",
                                    vehicleTrailerNrNo: "C456789",
                                    vin: "T12876765"
                                }
                            };

                            const state = {
                                type: CERTIFICATE_DATA.IVA_DATA,
                                testResult: testResult3
                            } as CertificatePayloadStateBag;

                            const ivaCommand = Container.get(IvaCertificateCommand);
                            ivaCommand.initialise(state);
                            const payload = await ivaCommand.generate();
                            expect(payload).toEqual(expectedResult);
                        });
                    }
                );

                const testResult4: any = JSON.parse(event.Records[6].body);
                context(
                    "and trailer test-result is an IVA test with a required standard, with a test status of fail",
                    () => {
                        it("return Certificate Data with requiredStandards and additionalDefects in IVA_DATA", async () => {
                            const expectedResult: any = {
                                IVA_DATA: {
                                    additionalDefects: [
                                        {
                                            defectName: "N/A",
                                            defectNotes: "",
                                            referenceNumber: ""
                                        }
                                    ],
                                    bodyType: "some bodyType",
                                    date: "28/11/2023",
                                    requiredStandards: [
                                        {
                                            additionalInfo: false,
                                            additionalNotes: null,
                                            inspectionTypes: [
                                                "basic"
                                            ],
                                            prs: false,
                                            refCalculation: "1.5",
                                            requiredStandard: "The stationary noise must have a measured sound level not exceeding 99dbA. (see Notes 2 & 3).",
                                            rsNumber: 5,
                                            sectionDescription: "Noise",
                                            sectionNumber: "01"
                                        }
                                    ],
                                    make: "some make",
                                    model: "some model",
                                    reapplicationDate: "",
                                    serialNumber: "C456789",
                                    station: "Abshire-Kub",
                                    testCategoryBasicNormal: "Basic",
                                    testCategoryClass: "m1",
                                    testerName: "CVS Dev1",
                                    vehicleTrailerNrNo: "C456789",
                                    vin: "T12876765"
                                }
                            };

                            const state = {
                                type: CERTIFICATE_DATA.IVA_DATA,
                                testResult: testResult4
                            } as CertificatePayloadStateBag;

                            const ivaCommand = Container.get(IvaCertificateCommand);
                            ivaCommand.initialise(state);
                            const payload = await ivaCommand.generate();
                            expect(payload).toEqual(expectedResult);
                        });
                    }
                );

                const testResult5: any = JSON.parse(event.Records[7].body);
                context(
                    "and test-result is a Normal IVA test with a required standard and a test status of fail",
                    () => {
                        it("should return Certificate Data with requiredStandards in IVA_DATA", async () => {
                            const expectedResult: any = {
                                IVA_DATA: {
                                    additionalDefects: [
                                        {
                                            defectName: "N/A",
                                            defectNotes: "",
                                            referenceNumber: ""
                                        }
                                    ],
                                    bodyType: "some bodyType",
                                    date: "28/11/2023",
                                    requiredStandards: [
                                        {
                                            additionalInfo: true,
                                            additionalNotes: "The exhaust was held on with blue tac",
                                            inspectionTypes: [
                                                "normal",
                                                "basic"
                                            ],
                                            prs: false,
                                            refCalculation: "1.1",
                                            requiredStandard: "The exhaust must be securely mounted",
                                            rsNumber: 1,
                                            sectionDescription: "Noise",
                                            sectionNumber: "01"
                                        }
                                    ],
                                    make: "some make",
                                    model: "some model",
                                    reapplicationDate: "",
                                    serialNumber: "C456789",
                                    station: "Abshire-Kub",
                                    testCategoryBasicNormal: "Normal",
                                    testCategoryClass: "m1",
                                    testerName: "CVS Dev1",
                                    vehicleTrailerNrNo: "C456789",
                                    vin: "T12876765"
                                }
                            };

                            const state = {
                                type: CERTIFICATE_DATA.IVA_DATA,
                                testResult: testResult5
                            } as CertificatePayloadStateBag;

                            const ivaCommand = Container.get(IvaCertificateCommand);
                            ivaCommand.initialise(state);
                            const payload = await ivaCommand.generate();
                            expect(payload).toEqual(expectedResult);
                        });
                    }
                );

                const testResult6: any = JSON.parse(event.Records[8].body);
                context(
                    "and test-result is a MSVA test with a required standard and a test status of fail",
                    () => {
                        it("should return Certificate Data with requiredStandards in MSVA_DATA", async () => {
                            const expectedResult: any = {
                                MSVA_DATA: {
                                    vin: "P0123010956789",
                                    serialNumber: "ZX345CV",
                                    vehicleZNumber: "ZX345CV",
                                    make: null,
                                    model: null,
                                    type: "motorcycle",
                                    testerName: "CVS Dev1",
                                    date: "04/03/2024",
                                    station: "Abshire-Kub",
                                    reapplicationDate: "",
                                    additionalDefects: [
                                        {
                                            defectName: "N/A",
                                            defectNotes: "",
                                            referenceNumber: ""
                                        }
                                    ],
                                    requiredStandards: [
                                        {
                                            additionalInfo: true,
                                            additionalNotes: "The bulbs were slightly worn",
                                            inspectionTypes: [],
                                            prs: false,
                                            refCalculation: "6.2a",
                                            requiredStandard: "An obligatory (or optional) lamp or reflector;  incorrect number fitted",
                                            rsNumber: 2,
                                            sectionDescription: "Lighting",
                                            sectionNumber: "06"
                                        }
                                    ],
                                }
                            };

                            const state = {
                                type: CERTIFICATE_DATA.MSVA_DATA,
                                testResult: testResult6
                            } as CertificatePayloadStateBag;

                            const msvaCommand = Container.get(MsvaCertificateCommand);
                            msvaCommand.initialise(state);
                            const payload = await msvaCommand.generate();
                            expect(payload).toEqual(expectedResult);
                        });
                    }
                );

                const testResult7: any = JSON.parse(event.Records[9].body);
                context(
                    "and test-result is a MSVA test with multiple required standards and a test status of fail",
                    () => {
                        it("should return Certificate Data with requiredStandards in MSVA_DATA", async () => {
                            const expectedResult: any = {
                                MSVA_DATA: {
                                    vin: "P0123010956789",
                                    serialNumber: "ZX345CV",
                                    vehicleZNumber: "ZX345CV",
                                    make: null,
                                    model: null,
                                    type: "motorcycle",
                                    testerName: "CVS Dev1",
                                    date: "04/03/2024",
                                    reapplicationDate: "",
                                    station: "Abshire-Kub",
                                    additionalDefects: [
                                        {
                                            defectName: "N/A",
                                            defectNotes: "",
                                            referenceNumber: ""
                                        }
                                    ],
                                    requiredStandards: [
                                        {
                                            additionalInfo: true,
                                            additionalNotes: "The bulbs were slightly worn",
                                            inspectionTypes: [],
                                            prs: false,
                                            refCalculation: "6.2a",
                                            requiredStandard: "An obligatory (or optional) lamp or reflector;  incorrect number fitted",
                                            rsNumber: 2,
                                            sectionDescription: "Lighting",
                                            sectionNumber: "06"
                                        },
                                        {
                                            additionalInfo: true,
                                            additionalNotes: "Switch was missing",
                                            inspectionTypes: [],
                                            prs: false,
                                            refCalculation: "6.3a",
                                            requiredStandard: "Any light switch; missing",
                                            rsNumber: 3,
                                            sectionDescription: "Lighting",
                                            sectionNumber: "06"
                                        },
                                    ],
                                }
                            };

                            const state = {
                                type: CERTIFICATE_DATA.MSVA_DATA,
                                testResult: testResult7
                            } as CertificatePayloadStateBag;

                            const msvaCommand = Container.get(MsvaCertificateCommand);
                            msvaCommand.initialise(state);
                            const payload = await msvaCommand.generate();
                            expect(payload).toEqual(expectedResult);
                        });

                        it("should return Certificate Data with sorted requiredStandards in MSVA_DATA", async () => {
                            const expectedResult: any = {
                                MSVA_DATA: {
                                    vin: "P0123010956789",
                                    serialNumber: "ZX345CV",
                                    vehicleZNumber: "ZX345CV",
                                    make: null,
                                    model: null,
                                    type: "motorcycle",
                                    testerName: "CVS Dev1",
                                    date: "04/03/2024",
                                    reapplicationDate: "",
                                    station: "Abshire-Kub",
                                    additionalDefects: [
                                        {
                                            defectName: "N/A",
                                            defectNotes: "",
                                            referenceNumber: ""
                                        }
                                    ],
                                    requiredStandards: [
                                        {
                                            additionalInfo: true,
                                            additionalNotes: "The bulbs were slightly worn",
                                            inspectionTypes: [],
                                            prs: false,
                                            refCalculation: "6.2a",
                                            requiredStandard: "An obligatory (or optional) lamp or reflector;  incorrect number fitted",
                                            rsNumber: 2,
                                            sectionDescription: "Lighting",
                                            sectionNumber: "06"
                                        },
                                        {
                                            additionalInfo: true,
                                            additionalNotes: "Switch was missing",
                                            inspectionTypes: [],
                                            prs: false,
                                            refCalculation: "6.3a",
                                            requiredStandard: "Any light switch; missing",
                                            rsNumber: 3,
                                            sectionDescription: "Lighting",
                                            sectionNumber: "06"
                                        },
                                    ],
                                }
                            };

                            const state = {
                                type: CERTIFICATE_DATA.MSVA_DATA,
                                testResult: testResult7
                            } as CertificatePayloadStateBag;

                            const msvaCommand = Container.get(MsvaCertificateCommand);
                            msvaCommand.initialise(state);
                            const payload = await msvaCommand.generate();
                            expect(payload).toEqual(expectedResult);
                        });
                    }
                );

                const testResult8: any = JSON.parse(event.Records[10].body);
                context(
                    "and test-result is a MSVA test with a required standard and custom defect, with a test status of fail",
                    () => {
                        it("should return Certificate Data with requiredStandards and additionalDefects in IVA_DATA", async () => {
                            const expectedResult: any = {
                                MSVA_DATA: {
                                    vin: "P0123010956789",
                                    serialNumber: "ZX345CV",
                                    vehicleZNumber: "ZX345CV",
                                    make: null,
                                    model: null,
                                    type: "motorcycle",
                                    testerName: "CVS Dev1",
                                    date: "04/03/2024",
                                    reapplicationDate: "",
                                    station: "Abshire-Kub",
                                    additionalDefects: [
                                        {
                                            defectName: "Rust",
                                            defectNotes: "slight rust around the wheel arch"
                                        }
                                    ],
                                    requiredStandards: [
                                        {
                                            additionalInfo: true,
                                            additionalNotes: "The bulbs were slightly worn",
                                            inspectionTypes: [],
                                            prs: false,
                                            refCalculation: "6.2a",
                                            requiredStandard: "An obligatory (or optional) lamp or reflector;  incorrect number fitted",
                                            rsNumber: 2,
                                            sectionDescription: "Lighting",
                                            sectionNumber: "6"
                                        }
                                    ],
                                }
                            };

                            const state = {
                                type: CERTIFICATE_DATA.MSVA_DATA,
                                testResult: testResult8
                            } as CertificatePayloadStateBag;

                            const msvaCommand = Container.get(MsvaCertificateCommand);
                            msvaCommand.initialise(state);
                            const payload = await msvaCommand.generate();
                            expect(payload).toEqual(expectedResult);
                        });
                    }
                );
            });
        });

        context("when an abandoned test result is read from the queue", () => {
            const event: any = { ...queueEventAbandon };
            const testResult: any = JSON.parse(event.Records[0].body);
            const Defects = {};

            context("and a payload is generated", () => {
                context("and no signatures were found in the bucket", () => {
                    it("should return a VTG12 payload without signature", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            ABANDONED_DATA: {
                                AdditionalComments: "some additional",
                                DateOfTheTest: "06.08.2024",
                                IssuersName: "AN Other",
                                ReasonsForRefusal: [
                                    "A Ministry Plate has been issued and is not fitted to the vehicle or trailer",
                                    "Current Health and Safety legislation cannot be met in testing the vehicle",
                                    "No proof was given that the vehicle used for carrying dangerous/toxic/corrosive or inflammable goods had been cleaned or otherwise rendered safe for test",
                                    "The driver and/or presenter of the vehicle refused to or was unable to comply with the instructions of DVSA staff making it impractical or unsafe to continue the test",
                                    "The examiner could not open the tachograph",
                                    "The particulars of the motor vehicle or trailer (e.g. number of axles / axle weights) do not match the VTG6 Ministry Plate fitted to the vehicle."
                                ],
                                RegistrationNumber: "CT70VRL",
                                TestStationName: "Abshire-Kub",
                                TestStationPNumber: "09-4129632",
                                Defects
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null
                            },
                        };

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                });

                context("and signatures were found in the bucket", () => {
                    it("should return a VTG12 payload with signature", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            ABANDONED_DATA: {
                                AdditionalComments: "some additional",
                                DateOfTheTest: "06.08.2024",
                                IssuersName: "AN Other",
                                ReasonsForRefusal: [
                                    "A Ministry Plate has been issued and is not fitted to the vehicle or trailer",
                                    "Current Health and Safety legislation cannot be met in testing the vehicle",
                                    "No proof was given that the vehicle used for carrying dangerous/toxic/corrosive or inflammable goods had been cleaned or otherwise rendered safe for test",
                                    "The driver and/or presenter of the vehicle refused to or was unable to comply with the instructions of DVSA staff making it impractical or unsafe to continue the test",
                                    "The examiner could not open the tachograph",
                                    "The particulars of the motor vehicle or trailer (e.g. number of axles / axle weights) do not match the VTG6 Ministry Plate fitted to the vehicle."
                                ],
                                RegistrationNumber: "CT70VRL",
                                TestStationName: "Abshire-Kub",
                                TestStationPNumber: "09-4129632",
                                Defects
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
                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                                // Remove the signature
                                S3BucketMockService.buckets.pop();
                            });
                    });
                });
            });
        });

        context("when an abandoned test result is read from the queue", () => {
            const event: any = { ...queueEventAbandon };
            const hgvAnnualTest: any = JSON.parse(event.Records[0].body);
            const trlAnnualTest: any = JSON.parse(event.Records[1].body);
            const psvAnnualTest: any = JSON.parse(event.Records[2].body);
            const psvFirstTest: any = JSON.parse(event.Records[3].body);
            const psvCOIFTest: any = JSON.parse(event.Records[4].body);
            const Defects = {};

            context("and a payload is generated", () => {
                context("and the test is for a hgv or trailer", () => {
                    it("should return a VTG12 payload for an hgv annual test", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            ABANDONED_DATA: {
                                AdditionalComments: "some additional",
                                DateOfTheTest: "06.08.2024",
                                IssuersName: "AN Other",
                                ReasonsForRefusal: [
                                    "A Ministry Plate has been issued and is not fitted to the vehicle or trailer",
                                    "Current Health and Safety legislation cannot be met in testing the vehicle",
                                    "No proof was given that the vehicle used for carrying dangerous/toxic/corrosive or inflammable goods had been cleaned or otherwise rendered safe for test",
                                    "The driver and/or presenter of the vehicle refused to or was unable to comply with the instructions of DVSA staff making it impractical or unsafe to continue the test",
                                    "The examiner could not open the tachograph",
                                    "The particulars of the motor vehicle or trailer (e.g. number of axles / axle weights) do not match the VTG6 Ministry Plate fitted to the vehicle."
                                ],
                                RegistrationNumber: "CT70VRL",
                                TestStationName: "Abshire-Kub",
                                TestStationPNumber: "09-4129632",
                                Defects
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null
                            },
                        };

                        return await certificateGenerationService
                            .generatePayload(hgvAnnualTest)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                    it("should return a VTG12 payload for a trl annual test", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            ABANDONED_DATA: {
                                AdditionalComments: null,
                                DateOfTheTest: "06.04.2023",
                                IssuersName: "CVS FullAccess",
                                ReasonsForRefusal: [
                                    "The vehicle was not submitted for test at the appointed time."
                                ],
                                RegistrationNumber: "C456789",
                                TestStationName: "Larson, Nader and Okuneva",
                                TestStationPNumber: "84-926821",
                                Defects
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null
                            },
                        };

                        return await certificateGenerationService
                            .generatePayload(trlAnnualTest)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                });

                context("and the test is for a psv", () => {
                    it("should return a VTP12 payload for a psv annual test", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            ABANDONED_DATA: {
                                AdditionalComments: null,
                                DateOfTheTest: "03.04.2023",
                                IssuersName: "TST CVS PSVTester Dev 10",
                                ReasonsForRefusal: [
                                    "The vehicle was not submitted for test at the appointed time."
                                ],
                                RegistrationNumber: "AA56BCD",
                                TestStationName: "Larson, Nader and Okuneva",
                                TestStationPNumber: "84-926821",
                                Defects,
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null
                            },
                        };

                        return await certificateGenerationService
                            .generatePayload(psvAnnualTest)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                    it("should return a VTP12 payload for a psv first test", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            ABANDONED_DATA: {
                                AdditionalComments: null,
                                DateOfTheTest: "09.12.2024",
                                IssuersName: "AN Other",
                                ReasonsForRefusal: [
                                    "The vehicle exhaust outlet has been modified in such a way as to prevent a metered smoke check being conducted"
                                ],
                                RegistrationNumber: "QA09PSV",
                                TestStationName: "Abshire-Kub",
                                TestStationPNumber: "09-4129632",
                                Defects: {
                                  DangerousDefects: ['1.2.a A registration mark: missing..'],
                                  MajorDefects: ['1.2.a A registration mark: missing..'],
                                  MinorDefects: ['1.2.a A registration mark: missing..'],
                                  AdvisoryDefects: ['1.2.a A registration mark: missing..'],
                                  PRSDefects: ['1.2.a A registration mark: missing..']
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null
                            },
                        };

                        return await certificateGenerationService
                            .generatePayload(psvFirstTest)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                    it("should return a VTP12 payload for a psv COIF test", async () => {
                        const expectedResult: any = {
                            Watermark: "NOT VALID",
                            ABANDONED_DATA: {
                                AdditionalComments: null,
                                DateOfTheTest: "11.12.2024",
                                IssuersName: "AN Other",
                                ReasonsForRefusal: [
                                    "The vehicle/trailer was presented at an incorrect test location (see conditions specified on IVA 30)"
                                ],
                                RegistrationNumber: "QA06PSV",
                                TestStationName: "Abshire-Kub",
                                TestStationPNumber: "09-4129632",
                                Defects
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null
                            },
                        };

                        return await certificateGenerationService
                            .generatePayload(psvCOIFTest)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                });
            });
        });

        context("when an historical test result that has been updated is read from the queue", () => {
            const event: any = { ...queueEventPass };
            const testResult: any = JSON.parse(event.Records[3].body);
            testResult.testEndTimestamp = "2019-01-18T00:00:00Z";
            testResult.testExpiryDate = "2020-01-17";

            context("and a payload is generated", () => {
                it('should not include any odometer data from tests completed after test being updated', async () => {
                    callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                    const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                    callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

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
                            DateOfTheTest: "18.01.2019",
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
                                    value: 380000,
                                    unit: "kilometres",
                                    date: "17.01.2019"
                                },
                                {
                                    value: 370000,
                                    unit: "kilometres",
                                    date: "16.01.2019",
                                },
                                {
                                    value: 360000,
                                    unit: "kilometres",
                                    date: "15.01.2019",
                                },
                            ],
                            Recalls: {
                                manufacturer: null,
                                hasRecall: false
                            }
                        },
                        Signature: {
                            ImageType: "png",
                            ImageData: null,
                        },
                    };

                    return await certificateGenerationService
                        .generatePayload(testResult)
                        .then((payload: any) => {
                            expect(payload).toEqual(expectedResult);
                            callGetTechRecordSpy.mockClear();
                            callSearchTechRecordSpy.mockClear();
                        });
                });
            })
        });
    });

    context("CertGenService for HGV", () => {
        context("when a passing test result for HGV is read from the queue", () => {
            const event: any = { ...queueEventPass };
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
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);


                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });

                    it("should return a VTG5 payload without signature but with a recalls object populated", async () => {
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
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: 'manufacturer',
                                    hasRecall: true
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        const duplicatedTestResult = cloneDeep(testResult);

                        duplicatedTestResult.recalls = {
                            manufacturer: 'manufacturer',
                            hasRecall: true
                        }

                        return await certificateGenerationService
                            .generatePayload(duplicatedTestResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
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
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };
                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        // @ts-ignore
                        techRecordResponseRwtMock.techRecord_make = undefined;
                        // @ts-ignore
                        techRecordResponseRwtMock.techRecord_model = undefined;
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);
                        // Make the functions return undefined
                        // Stub CertificateGenerationService getOdometerHistory method to return undefined value.
                        callGetOdometerSpy.mockResolvedValue(undefined as any);
                        return await certificateGenerationService
                          .generatePayload(testResult)
                          .then((payload: any) => {
                            expect(payload).toEqual(expectedResult);
                            callGetOdometerSpy.mockClear();
                            // getVehicleMakeAndModelStub.restore();
                            callGetTechRecordSpy.mockClear();
                            callSearchTechRecordSpy.mockClear();
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
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
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

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);


                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
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
                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

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
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
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
            let resBody = "";
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
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
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
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
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
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
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
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };
                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        // @ts-ignore
                        techRecordResponseRwtMock.techRecord_make = undefined;
                        // @ts-ignore
                        techRecordResponseRwtMock.techRecord_model = undefined;
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);
                        // Make the functions return undefined
                        // Stub CertificateGenerationService getOdometerHistory method to return undefined value.
                        callGetOdometerSpy.mockResolvedValue(undefined as any);
                        return await certificateGenerationService
                          .generatePayload(testResult)
                          .then((payload: any) => {
                              expect(payload).toEqual(expectedResult);
                                callGetOdometerSpy.mockClear();
                                // getVehicleMakeAndModelStub.restore();
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
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
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
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
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
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
                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                resBody = payload.body;
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
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
                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

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
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                }
            );
        });

        context("when a failing test result is read from the queue", () => {
            const event: any = { ...queueEventFail };
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
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };
                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
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
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };
                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        // @ts-ignore
                        techRecordResponseRwtMock.techRecord_make = undefined;
                        // @ts-ignore
                        techRecordResponseRwtMock.techRecord_model = undefined;
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);
                        // Make the functions return undefined
                        // Stub CertificateGenerationService getOdometerHistory method to return undefined value.
                        callGetOdometerSpy.mockResolvedValue(undefined as any);
                        // Stub CertificateGenerationService getVehicleMakeAndModel method to return undefined value.
                        return await certificateGenerationService
                          .generatePayload(testResult)
                          .then((payload: any) => {
                              expect(payload).toEqual(expectedResult);
                                callGetOdometerSpy.mockClear();
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
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
                                        value: 410000,
                                        unit: "kilometres",
                                        date: "20.01.2019"
                                    },
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
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
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
                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
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
                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtHgvSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

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
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                }
            );
        });
    });

    context("CertGenService for TRL", () => {
        context("when a passing test result for TRL is read from the queue", () => {
            const event: any = { ...queueEventPass };
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
                                IsTrailer: true,
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };
                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                });

                context("and lambda-to-lambda calls were unsuccessful", () => {
                    it("should return a VTG5A payload without bodyModel and odometer history", async () => {
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
                                Make: "STANLEY",
                                ExpiryDate: "25.02.2020",
                                EarliestDateOfTheNextTest: "01.11.2019",
                                SeatBeltTested: "Yes",
                                SeatBeltPreviousCheckDate: "26.02.2019",
                                SeatBeltNumber: 2,
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };
                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        // @ts-ignore
                        techRecordResponseRwtMock.techRecord_model = undefined;
                        // @ts-ignore
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        // Make the functions return undefined
                        // Stub CertificateGenerationService getOdometerHistory method to return undefined value.
                        callGetOdometerSpy.mockResolvedValue(undefined as any);
                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetOdometerSpy.mockClear();
                                // getVehicleMakeAndModelStub.restore();
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
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
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
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

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);


                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
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

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

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
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
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
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
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
                                TrailerRepository.prototype,
                                "getTrailerRegistrationObject"
                            )
                            .resolves({ Trn: undefined, IsTrailer: true });

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
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

                        // Add a new signature
                        S3BucketMockService.buckets.push({
                            bucketName: `cvs-signature-${process.env.BUCKET}`,
                            files: ["1.base64"],
                        });

                        const getTrailerRegistrationStub = sandbox
                            .stub(
                                TrailerRepository.prototype,
                                "getTrailerRegistrationObject"
                            )
                            .rejects({ statusCode: 500, body: "an error occured" });

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .catch((err: any) => {
                                expect(err.statusCode).toEqual(500);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
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
            let resBody = "";
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
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
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
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                });

                context("and lambda-to-lambda calls were unsuccessful", () => {
                    it("should return a PRS payload without, bodyModel and odometer history", async () => {
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
                                Make: "STANLEY",
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
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
                                Make: "STANLEY",
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        // @ts-ignore
                        techRecordResponseRwtMock.techRecord_model = undefined;
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        // Make the functions return undefined
                        // Stub CertificateGenerationService getOdometerHistory method to return undefined value.
                        callGetOdometerSpy.mockResolvedValue(undefined as any);
                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetOdometerSpy.mockClear();
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
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
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
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
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
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

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                resBody = payload.body;
                                // Remove the signature
                                S3BucketMockService.buckets.pop();
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                });
            });

            context(
                "and the generated payload is used to call the MOT service",
                () => {
                    it("successfully generate a certificate", async () => {

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

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
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                            });
                    });
                }
            );
        });

        context("when a failing test result is read from the queue", () => {
            const event: any = { ...queueEventFail };
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
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
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
                                "Make": "STANLEY",
                                DangerousDefects: [
                                    "54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd",
                                ],
                                MinorDefects: [
                                    "54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.",
                                ],
                                AdvisoryDefects: [
                                    "5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc",
                                ],
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        // @ts-ignore
                        techRecordResponseRwtMock.techRecord_model = undefined;
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        // Make the functions return undefined
                        // Stub CertificateGenerationService getOdometerHistory method to return undefined value.
                        callGetOdometerSpy.mockResolvedValue(undefined as any);
                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetOdometerSpy.mockClear();
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
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
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
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

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
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

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

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
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
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
                                Recalls: {
                                    manufacturer: null,
                                    hasRecall: false
                                }
                            },
                            Signature: {
                                ImageType: "png",
                                ImageData: null,
                            },
                        };
                        const getTrailerRegistrationStub = sandbox
                            .stub(
                                TrailerRepository.prototype,
                                "getTrailerRegistrationObject"
                            )
                            .resolves({ Trn: undefined, IsTrailer: true });

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callSearchTechRecordSpy.mockClear();
                                callGetTechRecordSpy.mockClear();
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

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        expectedResult.techRecord_make = undefined;
                        expectedResult.techRecord_model = undefined;
                        expectedResult.ApplicantDetails = undefined;
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
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

                        callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                        return await certificateGenerationService
                            .generatePayload(testResult)
                            .then((payload: any) => {
                                expect(payload).toEqual(expectedResult);
                                // getTechRecordStub.restore();
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
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
                const testResult: TestResultSchemaTestTypesAsObject = JSON.parse(event.Records[1].body);
                testResult.testTypes.testTypeId = "122";
                testResult.vin = "GYFC26269R240355";
                testResult.vrm = "NKPILNCN";
                context("and a payload is generated", () => {
                    context("and no signatures were found in the bucket", () => {
                        it("should return an RWT_DATA payload without signature", async () => {
                            const expectedResult: ICertificatePayload = cloneDeep(
                                docGenRwt[0]
                            );

                            callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                            return await certificateGenerationService
                                .generatePayload(testResult)
                                .then((payload: any) => {
                                    expect(payload).toEqual(expectedResult);
                                    callGetTechRecordSpy.mockClear();
                                    callSearchTechRecordSpy.mockClear();
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

                            callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                            return await certificateGenerationService
                                .generatePayload(testResult)
                                .then((payload: any) => {
                                    expect(payload).toEqual(expectedResult);
                                    callGetTechRecordSpy.mockClear();
                                    S3BucketMockService.buckets.pop();
                                    callSearchTechRecordSpy.mockClear();
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
                    const testResult: TestResultSchemaTestTypesAsObject = JSON.parse(event.Records[1].body);
                    testResult.testTypes.testTypeId = "122";
                    testResult.vin = "GYFC26269R240355";
                    testResult.vrm = "NKPILNCN";

                    callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                    const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                    callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                    expect.assertions(1);
                    return await certificateGenerationService
                        .generateCertificate(testResult)
                        .then((response: any) => {
                            expect(response.certificateType).toEqual("RWT");
                            callGetTechRecordSpy.mockClear();
                            callSearchTechRecordSpy.mockClear();
                        });
                });
            }
        );

        context(
            "when a failing test result for Roadworthiness test for HGV or TRL is read from the queue",
            () => {
                const event: any = cloneDeep(queueEventFail);
                const testResult: TestResultSchemaTestTypesAsObject = JSON.parse(event.Records[2].body);
                testResult.testTypes.testTypeId = "91";
                testResult.vin = "T12768594";
                testResult.trailerId = "0285678";
                context("and a payload is generated", () => {
                    context("and no signatures were found in the bucket", () => {
                        it("should return an RWT_DATA payload without signature", async () => {
                            const expectedResult: ICertificatePayload = cloneDeep(
                                docGenRwt[4]
                            );
                            callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                            const payload = await certificateGenerationService
                              .generatePayload(testResult);
                            expect(payload).toEqual(expectedResult);
                            callGetTechRecordSpy.mockClear();
                            callSearchTechRecordSpy.mockClear();
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

                            callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                            const payload = await certificateGenerationService
                                .generatePayload(testResult);
                            expect(payload).toEqual(expectedResult);
                            S3BucketMockService.buckets.pop();
                            callGetTechRecordSpy.mockClear();
                            callSearchTechRecordSpy.mockClear();
                        });
                    });
                });
            }
        );
    });

    context("CertGenService for IVA 30 test", () => {
        context("when a failing test result for basic IVA test is read from the queue", () => {
            const event: any = cloneDeep(queueEventFail);
            const testResult: TestResultSchemaTestTypesAsObject = JSON.parse(event.Records[3].body);

            describe("reapplication date handling", () => {
                    testResult.testTypes.reapplicationDate = "2024-05-27T00:00:00.000Z";
                    context("and reapplication date is provided", () => {
                        const event: any = cloneDeep(queueEventFail);
                        const testResultReapplication: TestResultSchemaTestTypesAsObject = JSON.parse(event.Records[21].body);

                        it("should include reapplication date when provided", async () => {
                            testResult.testTypes.reapplicationDate = "2024-05-27T00:00:00.000Z";
                            const expectedResult: ICertificatePayload = {
                                "IVA_DATA": {
                                    "additionalDefects": [
                                        {
                                            "defectName": "N/A",
                                            "defectNotes": "",
                                            "referenceNumber": ""
                                        }
                                    ],
                                    "bodyType": "some bodyType",
                                    "date": "28/11/2023",
                                    "make": "some make",
                                    "model": "some model",
                                    "reapplicationDate": "27/05/2024",
                                    "requiredStandards": [
                                        {
                                            "additionalInfo": true,
                                            "additionalNotes": "The exhaust was held on with blue tac",
                                            "inspectionTypes": [
                                                "normal",
                                                "basic"
                                            ],
                                            "prs": false,
                                            "refCalculation": "1.1",
                                            "requiredStandard": "The exhaust must be securely mounted",
                                            "rsNumber": 1,
                                            "sectionDescription": "Noise",
                                            "sectionNumber": "01"
                                        },
                                        {
                                            "additionalInfo": false,
                                            "additionalNotes": null,
                                            "inspectionTypes": [
                                                "basic"
                                            ],
                                            "prs": false,
                                            "refCalculation": "1.5",
                                            "requiredStandard": "The stationary noise must have a measured sound level not exceeding 99dbA. (see Notes 2 & 3).",
                                            "rsNumber": 5,
                                            "sectionDescription": "Noise",
                                            "sectionNumber": "01"
                                        }
                                    ],
                                    "serialNumber": "C456789",
                                    "station": "Abshire-Kub",
                                    "testCategoryBasicNormal": "Basic",
                                    "testCategoryClass": "m1",
                                    "testerName": "CVS Dev1",
                                    "vehicleTrailerNrNo": "C456789",
                                    "vin": "T12876765"
                                },
                                "Signature": {
                                    "ImageData": null,
                                    "ImageType": "png"
                                },
                                "Watermark": "NOT VALID"
                            };

                            callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                            return await certificateGenerationService
                                .generatePayload(testResultReapplication)
                                .then((payload: any) => {
                                    expect(payload).toEqual(expectedResult);
                                    callGetTechRecordSpy.mockClear();
                                    callSearchTechRecordSpy.mockClear();
                                });
                        });
                    });
                    context("and reapplication date is NOT provided", () => {
                        const event: any = cloneDeep(queueEventFail);
                        const testResultReapplication: TestResultSchemaTestTypesAsObject = JSON.parse(event.Records[21].body);

                        it("should return the IVA_30 payload with the reapplication date in the payload", async () => {
                            testResultReapplication.testTypes.reapplicationDate = "";
                            const expectedResult: ICertificatePayload = {
                                "IVA_DATA": {
                                    "additionalDefects": [
                                        {
                                            "defectName": "N/A",
                                            "defectNotes": "",
                                            "referenceNumber": ""
                                        }
                                    ],
                                    "bodyType": "some bodyType",
                                    "date": "28/11/2023",
                                    "make": "some make",
                                    "model": "some model",
                                    "reapplicationDate": "",
                                    "requiredStandards": [
                                        {
                                            "additionalInfo": true,
                                            "additionalNotes": "The exhaust was held on with blue tac",
                                            "inspectionTypes": [
                                                "normal",
                                                "basic"
                                            ],
                                            "prs": false,
                                            "refCalculation": "1.1",
                                            "requiredStandard": "The exhaust must be securely mounted",
                                            "rsNumber": 1,
                                            "sectionDescription": "Noise",
                                            "sectionNumber": "01"
                                        },
                                        {
                                            "additionalInfo": false,
                                            "additionalNotes": null,
                                            "inspectionTypes": [
                                                "basic"
                                            ],
                                            "prs": false,
                                            "refCalculation": "1.5",
                                            "requiredStandard": "The stationary noise must have a measured sound level not exceeding 99dbA. (see Notes 2 & 3).",
                                            "rsNumber": 5,
                                            "sectionDescription": "Noise",
                                            "sectionNumber": "01"
                                        }
                                    ],
                                    "serialNumber": "C456789",
                                    "station": "Abshire-Kub",
                                    "testCategoryBasicNormal": "Basic",
                                    "testCategoryClass": "m1",
                                    "testerName": "CVS Dev1",
                                    "vehicleTrailerNrNo": "C456789",
                                    "vin": "T12876765"
                                },
                                "Signature": {
                                    "ImageData": null,
                                    "ImageType": "png"
                                },
                                "Watermark": "NOT VALID"
                            };

                            callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                            return await certificateGenerationService
                                .generatePayload(testResultReapplication)
                                .then((payload: any) => {
                                    expect(payload).toEqual(expectedResult);
                                    callGetTechRecordSpy.mockClear();
                                    callSearchTechRecordSpy.mockClear();
                                });
                        });
                    });
                    context("and a payload is generated", () => {
                        context("and no signatures were found in the bucket", () => {
                            it("should return an IVA_30 payload without signature", async () => {
                                const expectedResult: ICertificatePayload = cloneDeep(
                                    docGenIva30[0]
                                );

                                callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                                const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                                callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                                return await certificateGenerationService
                                    .generatePayload(testResult)
                                    .then((payload: any) => {
                                        expect(payload).toEqual(expectedResult);
                                        callGetTechRecordSpy.mockClear();
                                        callSearchTechRecordSpy.mockClear();
                                    });
                            });
                        });

                        context("and signatures were found in the bucket", () => {
                            it("should return an IVA 30 payload with signature", async () => {
                                const expectedResult: ICertificatePayload = cloneDeep(
                                    docGenIva30[1]
                                );

                                // Add a new signature
                                S3BucketMockService.buckets.push({
                                    bucketName: `cvs-signature-${process.env.BUCKET}`,
                                    files: ["1.base64"],
                                });

                                callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                                const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                                callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                                return await certificateGenerationService
                                    .generatePayload(testResult)
                                    .then((payload: any) => {
                                        expect(payload).toEqual(expectedResult);
                                        callGetTechRecordSpy.mockClear();
                                        S3BucketMockService.buckets.pop();
                                        callSearchTechRecordSpy.mockClear();
                                    });
                            });
                        });

                        context(
                            "and the generated payload is used to call the MOT service",
                            () => {
                                it("successfully generate a certificate", async () => {
                                    callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                                    const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                                    callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                                    expect.assertions(3);
                                    return await certificateGenerationService
                                        .generateCertificate(testResult)
                                        .then((response: any) => {
                                            expect(response.fileName).toEqual(
                                                "W01A00310_T12876765.pdf"
                                            );
                                            expect(response.certificateType).toEqual("IVA30");
                                            expect(response.certificateOrder).toEqual({
                                                current: 2,
                                                total: 2,
                                            });
                                            callGetTechRecordSpy.mockClear();
                                            callSearchTechRecordSpy.mockClear();
                                        });
                                });
                            }
                        );
                    });
                }
            );
        });

        context("CertGenService for MSVA 30 test", () => {
            context(
                "when a failing test result MSVA test is read from the queue",
                () => {
                    const event: any = cloneDeep(queueEventFail);
                    const testResult: TestResultSchemaTestTypesAsObject = JSON.parse(event.Records[8].body); // retrieve record

                    context("and a payload is generated", () => {
                        context("and reapplication date is provided", () => {
                            const event: any = cloneDeep(queueEventFail);
                            const testResultReapplication: TestResultSchemaTestTypesAsObject = JSON.parse(event.Records[21].body);

                            it("should return the IVA_30 payload with the reapplication date in the payload", async () => {
                                testResult.testTypes.reapplicationDate = "2024-05-27T00:00:00.000Z";
                                const expectedResult: ICertificatePayload = {
                                    "IVA_DATA": {
                                        "additionalDefects": [
                                            {
                                                "defectName": "N/A",
                                                "defectNotes": "",
                                                "referenceNumber": ""
                                            }
                                        ],
                                        "bodyType": "some bodyType",
                                        "date": "28/11/2023",
                                        "make": "some make",
                                        "model": "some model",
                                        "reapplicationDate": "27/05/2024",
                                        "requiredStandards": [
                                            {
                                                "additionalInfo": true,
                                                "additionalNotes": "The exhaust was held on with blue tac",
                                                "inspectionTypes": [
                                                    "normal",
                                                    "basic"
                                                ],
                                                "prs": false,
                                                "refCalculation": "1.1",
                                                "requiredStandard": "The exhaust must be securely mounted",
                                                "rsNumber": 1,
                                                "sectionDescription": "Noise",
                                                "sectionNumber": "01"
                                            },
                                            {
                                                "additionalInfo": false,
                                                "additionalNotes": null,
                                                "inspectionTypes": [
                                                    "basic"
                                                ],
                                                "prs": false,
                                                "refCalculation": "1.5",
                                                "requiredStandard": "The stationary noise must have a measured sound level not exceeding 99dbA. (see Notes 2 & 3).",
                                                "rsNumber": 5,
                                                "sectionDescription": "Noise",
                                                "sectionNumber": "01"
                                            }
                                        ],
                                        "serialNumber": "C456789",
                                        "station": "Abshire-Kub",
                                        "testCategoryBasicNormal": "Basic",
                                        "testCategoryClass": "m1",
                                        "testerName": "CVS Dev1",
                                        "vehicleTrailerNrNo": "C456789",
                                        "vin": "T12876765"
                                    },
                                    "Signature": {
                                        "ImageData": null,
                                        "ImageType": "png"
                                    },
                                    "Watermark": "NOT VALID"
                                };

                                callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                                const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                                callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                                return await certificateGenerationService
                                    .generatePayload(testResultReapplication)
                                    .then((payload: any) => {
                                        expect(payload).toEqual(expectedResult);
                                        callGetTechRecordSpy.mockClear();
                                        callSearchTechRecordSpy.mockClear();
                                    });
                            });
                        });
                        context("and reapplication date is NOT provided", () => {
                            const event: any = cloneDeep(queueEventFail);
                            const testResultReapplication: TestResultSchemaTestTypesAsObject = JSON.parse(event.Records[21].body);

                            it("should return the IVA_30 payload with the reapplication date in the payload", async () => {
                                testResultReapplication.testTypes.reapplicationDate = "";
                                const expectedResult: ICertificatePayload = {
                                    "IVA_DATA": {
                                        "additionalDefects": [
                                            {
                                                "defectName": "N/A",
                                                "defectNotes": "",
                                                "referenceNumber": ""
                                            }
                                        ],
                                        "bodyType": "some bodyType",
                                        "date": "28/11/2023",
                                        "make": "some make",
                                        "model": "some model",
                                        "reapplicationDate": "",
                                        "requiredStandards": [
                                            {
                                                "additionalInfo": true,
                                                "additionalNotes": "The exhaust was held on with blue tac",
                                                "inspectionTypes": [
                                                    "normal",
                                                    "basic"
                                                ],
                                                "prs": false,
                                                "refCalculation": "1.1",
                                                "requiredStandard": "The exhaust must be securely mounted",
                                                "rsNumber": 1,
                                                "sectionDescription": "Noise",
                                                "sectionNumber": "01"
                                            },
                                            {
                                                "additionalInfo": false,
                                                "additionalNotes": null,
                                                "inspectionTypes": [
                                                    "basic"
                                                ],
                                                "prs": false,
                                                "refCalculation": "1.5",
                                                "requiredStandard": "The stationary noise must have a measured sound level not exceeding 99dbA. (see Notes 2 & 3).",
                                                "rsNumber": 5,
                                                "sectionDescription": "Noise",
                                                "sectionNumber": "01"
                                            }
                                        ],
                                        "serialNumber": "C456789",
                                        "station": "Abshire-Kub",
                                        "testCategoryBasicNormal": "Basic",
                                        "testCategoryClass": "m1",
                                        "testerName": "CVS Dev1",
                                        "vehicleTrailerNrNo": "C456789",
                                        "vin": "T12876765"
                                    },
                                    "Signature": {
                                        "ImageData": null,
                                        "ImageType": "png"
                                    },
                                    "Watermark": "NOT VALID"
                                };

                                callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                                const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                                callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                                return await certificateGenerationService
                                    .generatePayload(testResultReapplication)
                                    .then((payload: any) => {
                                        expect(payload).toEqual(expectedResult);
                                        callGetTechRecordSpy.mockClear();
                                        callSearchTechRecordSpy.mockClear();
                                    });
                            });
                        });

                        context("and no signatures were found in the bucket", () => {
                            it("should return an MSVA_30 payload without signature", async () => {
                                const expectedResult: ICertificatePayload = cloneDeep(
                                    docGenMsva30[0]
                                );

                                callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                                const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                                callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                                return await certificateGenerationService
                                    .generatePayload(testResult)
                                    .then((payload: any) => {
                                        expect(payload).toEqual(expectedResult);
                                        callGetTechRecordSpy.mockClear();
                                        callSearchTechRecordSpy.mockClear();
                                    });
                            });
                        });

                        context("and signatures were found in the bucket", () => {
                            it("should return a MSVA 30 payload with signature", async () => {
                                const expectedResult: ICertificatePayload = cloneDeep(
                                    docGenMsva30[1]
                                );

                                // Add a new signature
                                S3BucketMockService.buckets.push({
                                    bucketName: `cvs-signature-${process.env.BUCKET}`,
                                    files: ["1.base64"],
                                });

                                callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                                const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                                callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                                return await certificateGenerationService
                                    .generatePayload(testResult)
                                    .then((payload: any) => {
                                        expect(payload).toEqual(expectedResult);
                                        callGetTechRecordSpy.mockClear();
                                        S3BucketMockService.buckets.pop();
                                        callSearchTechRecordSpy.mockClear();
                                    });
                            });
                        });

                        context(
                            "and the generated payload is used to call the MOT service",
                            () => {
                                it("successfully generate a certificate", async () => {
                                    callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                                    const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                                    callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                                    expect.assertions(3);
                                    return await certificateGenerationService
                                        .generateCertificate(testResult)
                                        .then((response: any) => {
                                            expect(response.fileName).toEqual(
                                                "W01A00128_P0123010956789.pdf"
                                            );
                                            expect(response.certificateType).toEqual("MSVA30");
                                            expect(response.certificateOrder).toEqual({
                                                current: 2,
                                                total: 2,
                                            });
                                            callGetTechRecordSpy.mockClear();
                                            callSearchTechRecordSpy.mockClear();
                                        });
                                });
                            }
                        );
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
                const certificateUploadService = Container.get(CertificateUploadService);

                context("when uploading a certificate", () => {
                    context("and the S3 bucket exists and is accesible", () => {
                        it("should successfully upload the certificate", async () => {
                            callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

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
                                .then((response: any) => {
                                    expect(response.Key).toEqual(
                                        `${process.env.BRANCH}/${generatedCertificateResponse.fileName}`
                                    );
                                    callGetTechRecordSpy.mockClear();
                                    callSearchTechRecordSpy.mockClear();
                                    S3BucketMockService.buckets.pop();
                                });
                        });
                    });

                    context("and the S3 bucket does not exist or is not accesible", () => {
                        it("should throw an error", async () => {
                            callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);

                            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                            const generatedCertificateResponse: IGeneratedCertificateResponse =
                                await certificateGenerationService.generateCertificate(
                                    testResult
                                );
                            expect.assertions(1);
                            return certificateUploadService
                                .uploadCertificate(generatedCertificateResponse)
                                .catch((error: any) => {
                                    expect(error).toBeInstanceOf(Error);
                                    callGetTechRecordSpy.mockClear();
                                    callSearchTechRecordSpy.mockClear();
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
                        jest.spyOn(CertificateRequestProcessor.prototype, 'preProcessPayload').mockImplementation(
                            () => {
                                return event[0]
                            }
                        )
                        const result = await certGen(event, undefined as any, () => {
                            return;
                        });

                        expect(result.batchItemFailures).toHaveLength(event.Records.length);
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
});
