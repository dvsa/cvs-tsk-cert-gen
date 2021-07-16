import { Injector } from "../../src/models/injector/Injector";
import { CertificateGenerationService } from "../../src/services/CertificateGenerationService";
import { S3BucketMockService } from "../models/S3BucketMockService";
import { LambdaMockService } from "../models/LambdaMockService";
import sinon from "sinon";
import queueEventPass from "../resources/queue-event-pass.json";
import techRecordsRwt from "../resources/tech-records-response-rwt.json";
const sandbox = sinon.createSandbox();
import { cloneDeep } from "lodash";
import { IWeightDetails, ITestResult } from "../../src/models";
import { HTTPError } from "../../src/models/HTTPError";

describe("cert-gen", () => {
  const certificateGenerationService: CertificateGenerationService =
    Injector.resolve<CertificateGenerationService>(
      CertificateGenerationService,
      [S3BucketMockService, LambdaMockService]
    );
  afterAll(() => {
    sandbox.restore();
  });
  context("CertificateGenerationService", () => {
    LambdaMockService.populateFunctions();
    context("CertGenService for Roadworthiness test", () => {
      context(
        "when a passing test result for Roadworthiness test for TRL is read from the queue",
        () => {
          const event: any = cloneDeep(queueEventPass);
          const testResult: ITestResult = JSON.parse(event.Records[2].body);
          testResult.testTypes.testTypeId = "91";
          testResult.vin = "T12768594";
          testResult.trailerId = "0285678";
          context("and weightDetails are fetched", () => {
            it("should return dgvw as 'grossDesignWeight' and weight2 as sum of 'designWeight' of the axles", () => {
              const expectedWeightDetails: IWeightDetails = {
                dgvw: 98204,
                weight2: 9400,
              };
              const techRecordResponseRwtMock = cloneDeep(techRecordsRwt[0]);

              const getTechRecordStub = sandbox
                .stub(CertificateGenerationService.prototype, "getTechRecord")
                .resolves(techRecordResponseRwtMock);

              expect.assertions(1);
              certificateGenerationService
                .getWeightDetails(testResult)
                .then((weightDetails) => {
                  expect(weightDetails).toEqual(expectedWeightDetails);
                  getTechRecordStub.restore();
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
          const testResult: ITestResult = JSON.parse(event.Records[1].body);
          context("and weightDetails are fetched", () => {
            it("should return dgvw as 'grossDesignWeight' and weight2 and 'trainDesignWeight' of the vehicle", () => {
              const expectedWeightDetails: IWeightDetails = {
                dgvw: 98204,
                weight2: 40568,
              };
              const techRecordResponseRwtMock = cloneDeep(techRecordsRwt[1]);

              const getTechRecordStub = sandbox
                .stub(CertificateGenerationService.prototype, "getTechRecord")
                .resolves(techRecordResponseRwtMock);

              expect.assertions(1);
              certificateGenerationService
                .getWeightDetails(testResult)
                .then((weightDetails) => {
                  expect(weightDetails).toEqual(expectedWeightDetails);
                  getTechRecordStub.restore();
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
          const testResult: ITestResult = JSON.parse(event.Records[1].body);
          context("and tech record for vehicle is not found", () => {
            it("should throw error", () => {
              const techRecordResponseRwtMock = null;

              const getTechRecordStub = sandbox
                .stub(CertificateGenerationService.prototype, "getTechRecord")
                .resolves(techRecordResponseRwtMock);

              expect.assertions(1);
              const expectedError = new HTTPError(
                500,
                "No vehicle found for Roadworthiness test certificate!"
              );
              certificateGenerationService
                .getWeightDetails(testResult)
                .catch((err) => {
                  expect(err).toEqual(expectedError);
                  getTechRecordStub.restore();
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
          const testResult: ITestResult = JSON.parse(event.Records[2].body);
          testResult.testTypes.testTypeId = "91";
          testResult.vin = "T12768594";
          testResult.trailerId = "0285678";
          context(
            "and weightDetails are fetched but not axles array is found",
            () => {
              it("it should throw error", () => {
                const techRecordResponseRwtMock = cloneDeep(techRecordsRwt[0]);
                delete techRecordResponseRwtMock.techRecord[0].axles;
                const getTechRecordStub = sandbox
                  .stub(CertificateGenerationService.prototype, "getTechRecord")
                  .resolves(techRecordResponseRwtMock);

                expect.assertions(1);
                const expectedError = new HTTPError(
                  500,
                  "No axle weights for Roadworthiness test certificates!"
                );
                certificateGenerationService
                  .getWeightDetails(testResult)
                  .catch((err) => {
                    expect(err).toEqual(expectedError);
                    getTechRecordStub.restore();
                  });
              });
            }
          );
        }
      );
    });
  });
});
