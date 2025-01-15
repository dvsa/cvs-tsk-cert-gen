import 'reflect-metadata';

import { cloneDeep } from "lodash";
import sinon from "sinon";
import { Container } from "typedi";
import { IWeightDetails, TestResultSchemaTestTypesAsObject } from "../../src/models";
import { HTTPError } from "../../src/models/HTTPError";
import { LambdaService } from "../../src/services/LambdaService";
import { S3BucketService } from "../../src/services/S3BucketService";
import { TechRecordRepository } from "../../src/tech-record/TechRecordRepository";
import { TechRecordService } from '../../src/tech-record/TechRecordService';
import { LambdaMockService } from "../models/LambdaMockService";
import { S3BucketMockService } from "../models/S3BucketMockService";
import queueEventPass from "../resources/queue-event-pass.json";
import techRecordsRwtSearch from "../resources/tech-records-response-rwt-search.json";
import techRecordsRwt from "../resources/tech-records-response-rwt.json";

const sandbox = sinon.createSandbox();

describe("cert-gen", () => {
    Container.set(S3BucketService, new S3BucketMockService());
    Container.set(LambdaService, new LambdaMockService());

    const techRecordRepository = Container.get(TechRecordRepository);
    const callGetTechRecordSpy = jest.spyOn(techRecordRepository, "callGetTechRecords");
    const callSearchTechRecordSpy = jest.spyOn(techRecordRepository, "callSearchTechRecords");
    Container.set(TechRecordRepository, techRecordRepository);

    const techRecordService = Container.get(TechRecordService);

    afterEach(() => {
        sandbox.restore();
    });
    context("CertificateGenerationService", () => {
        LambdaMockService.populateFunctions();
        context("CertGenService for Roadworthiness test", () => {
            context(
                "when a passing test result for Roadworthiness test for TRL is read from the queue",
                () => {
                    const event: any = cloneDeep(queueEventPass);
                    const testResult: TestResultSchemaTestTypesAsObject = JSON.parse(event.Records[2].body);
                    testResult.testTypes.testTypeId = "91";
                    testResult.vin = "T12768594";
                    testResult.trailerId = "0285678";
                    context("and weightDetails are fetched", () => {
                        it("should return dgvw as 'grossDesignWeight' and weight2 as sum of 'designWeight' of the axles", async () => {
                            const expectedWeightDetails: IWeightDetails = {
                                dgvw: 2000,
                                weight2: 0,
                            };

                            callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);
                            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                            // expect.assertions(1);
                            await techRecordService
                              .getWeightDetails(testResult)
                              .then((weightDetails) => {
                                expect(weightDetails).toEqual(expectedWeightDetails);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                              });
                        });
                    });
                }
            );
        });

        context("CertGenService for Roadworthiness test", () => {
            context(
                "when a passing test result for Roadworthiness test for HGV is read from the queue",
                () => {
                    const event: any = cloneDeep(queueEventPass);
                    const testResult: TestResultSchemaTestTypesAsObject = JSON.parse(event.Records[1].body);
                    context("and weightDetails are fetched", () => {
                        it("should return dgvw as 'grossDesignWeight' and weight2 and 'trainDesignWeight' of the vehicle", async () => {
                            const expectedWeightDetails: IWeightDetails = {
                                dgvw: 2000,
                                weight2: 0,
                            };

                            callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);
                            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                            // expect.assertions(1);
                            await techRecordService
                              .getWeightDetails(testResult)
                              .then((weightDetails) => {
                                expect(weightDetails).toEqual(expectedWeightDetails);
                                callGetTechRecordSpy.mockClear();
                                callSearchTechRecordSpy.mockClear();
                              });
                        });
                    });
                }
            );
        });

        context("CertGenService for Roadworthiness test", () => {
            context(
                "when a passing test result for Roadworthiness test for HGV is read from the queue",
                () => {
                    const event: any = cloneDeep(queueEventPass);
                    const testResult: TestResultSchemaTestTypesAsObject = JSON.parse(event.Records[1].body);
                    context("and tech record for vehicle is not found", () => {
                        it("should throw error", async () => {
                            const techRecordResponseRwtMock = undefined;

                            callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);
                            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                            // expect.assertions(1);
                            const expectedError = new HTTPError(
                                500,
                                "No vehicle found for Roadworthiness test certificate!"
                            );
                            await techRecordService
                                .getWeightDetails(testResult)
                                .catch((err) => {
                                    expect(err).toEqual(expectedError);
                                    callGetTechRecordSpy.mockClear();
                                    callSearchTechRecordSpy.mockClear();
                                });
                        });
                    });
                }
            );
        });

        context("CertGenService for Roadworthiness test", () => {
            context(
                "when a passing test result for Roadworthiness test for TRL is read from the queue",
                () => {
                    const event: any = cloneDeep(queueEventPass);
                    const testResult: TestResultSchemaTestTypesAsObject = JSON.parse(event.Records[2].body);
                    testResult.testTypes.testTypeId = "91";
                    testResult.vin = "T12768594";
                    testResult.trailerId = "0285678";
                    context(
                        "and weightDetails are fetched but not axles array is found",
                        () => {
                            it("it should throw error", async () => {
                                const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                                techRecordResponseRwtMock.techRecord_axles = [];
                                callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);
                                callSearchTechRecordSpy.mockResolvedValue(techRecordsRwtSearch);


                                // expect.assertions(1);
                                const expectedError = new HTTPError(
                                    500,
                                    "No axle weights for Roadworthiness test certificates!"
                                );
                                await techRecordService
                                    .getWeightDetails(testResult)
                                    .catch((err) => {
                                        expect(err).toEqual(expectedError);
                                        callGetTechRecordSpy.mockClear();
                                        callSearchTechRecordSpy.mockClear();
                                    });
                            });
                        }
                    );
                }
            );
        });
    });
});
