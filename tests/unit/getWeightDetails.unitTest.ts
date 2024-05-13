import sinon from 'sinon';
import { cloneDeep } from 'lodash';
import { Injector } from '../../src/models/injector/Injector';
import { CertificateGenerationService } from '../../src/services/CertificateGenerationService';
import { S3BucketMockService } from '../models/S3BucketMockService';
import { LambdaMockService } from '../models/LambdaMockService';
import queueEventPass from '../resources/queue-event-pass.json';
import techRecordsRwt from '../resources/tech-records-response-rwt.json';
import techRecordsRwtSearch from '../resources/tech-records-response-rwt-search.json';
import { IWeightDetails, ITestResult } from '../../src/models';
import { HTTPError } from '../../src/models/HTTPError';

const sandbox = sinon.createSandbox();

describe('cert-gen', () => {
  const certificateGenerationService: CertificateGenerationService = Injector.resolve<CertificateGenerationService>(
    CertificateGenerationService,
    [S3BucketMockService, LambdaMockService],
  );
  afterEach(() => {
    sandbox.restore();
  });
  context('CertificateGenerationService', () => {
    LambdaMockService.populateFunctions();
    context('CertGenService for Roadworthiness test', () => {
      context(
        'when a passing test result for Roadworthiness test for TRL is read from the queue',
        () => {
          const event: any = cloneDeep(queueEventPass);
          const testResult: ITestResult = JSON.parse(event.Records[2].body);
          testResult.testTypes.testTypeId = '91';
          testResult.vin = 'T12768594';
          testResult.trailerId = '0285678';
          context('and weightDetails are fetched', () => {
            it("should return dgvw as 'grossDesignWeight' and weight2 as sum of 'designWeight' of the axles", async () => {
              const expectedWeightDetails: IWeightDetails = {
                dgvw: 2000,
                weight2: 0,
              };
              const getTechRecordSearchStub = sandbox
                .stub(certificateGenerationService, 'callSearchTechRecords')
                .resolves(techRecordsRwtSearch);

              const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
              const getTechRecordStub = sandbox
                .stub(certificateGenerationService, 'callGetTechRecords')
                .resolves((techRecordResponseRwtMock) as any);

              // expect.assertions(1);
              await certificateGenerationService
                .getWeightDetails(testResult)
                .then((weightDetails) => {
                  expect(weightDetails).toEqual(expectedWeightDetails);
                  getTechRecordStub.restore();
                  getTechRecordSearchStub.restore();
                });
            });
          });
        },
      );
    });

    context('CertGenService for Roadworthiness test', () => {
      context(
        'when a passing test result for Roadworthiness test for HGV is read from the queue',
        () => {
          const event: any = cloneDeep(queueEventPass);
          const testResult: ITestResult = JSON.parse(event.Records[1].body);
          context('and weightDetails are fetched', () => {
            it("should return dgvw as 'grossDesignWeight' and weight2 and 'trainDesignWeight' of the vehicle", async () => {
              const expectedWeightDetails: IWeightDetails = {
                dgvw: 2000,
                weight2: 0,
              };
              const getTechRecordSearchStub = sandbox
                .stub(certificateGenerationService, 'callSearchTechRecords')
                .resolves(techRecordsRwtSearch);

              const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
              const getTechRecordStub = sandbox
                .stub(certificateGenerationService, 'callGetTechRecords')
                .resolves((techRecordResponseRwtMock) as any);

              // expect.assertions(1);
              await certificateGenerationService
                .getWeightDetails(testResult)
                .then((weightDetails) => {
                  expect(weightDetails).toEqual(expectedWeightDetails);
                  getTechRecordStub.restore();
                  getTechRecordSearchStub.restore();
                });
            });
          });
        },
      );
    });

    context('CertGenService for Roadworthiness test', () => {
      context(
        'when a passing test result for Roadworthiness test for HGV is read from the queue',
        () => {
          const event: any = cloneDeep(queueEventPass);
          const testResult: ITestResult = JSON.parse(event.Records[1].body);
          context('and tech record for vehicle is not found', () => {
            it('should throw error', async () => {
              const techRecordResponseRwtMock = undefined;
              const getTechRecordSearchStub = sandbox
                .stub(certificateGenerationService, 'callSearchTechRecords')
                .resolves(techRecordsRwtSearch);

              const getTechRecordStub = sandbox
                .stub(certificateGenerationService, 'callGetTechRecords')
                .resolves(techRecordResponseRwtMock);

              // expect.assertions(1);
              const expectedError = new HTTPError(
                500,
                'No vehicle found for Roadworthiness test certificate!',
              );
              await certificateGenerationService
                .getWeightDetails(testResult)
                .catch((err) => {
                  expect(err).toEqual(expectedError);
                  getTechRecordStub.restore();
                  getTechRecordSearchStub.restore();
                });
            });
          });
        },
      );
    });

    context('CertGenService for Roadworthiness test', () => {
      context(
        'when a passing test result for Roadworthiness test for TRL is read from the queue',
        () => {
          const event: any = cloneDeep(queueEventPass);
          const testResult: ITestResult = JSON.parse(event.Records[2].body);
          testResult.testTypes.testTypeId = '91';
          testResult.vin = 'T12768594';
          testResult.trailerId = '0285678';
          context(
            'and weightDetails are fetched but not axles array is found',
            () => {
              it('should throw error', async () => {
                const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                techRecordResponseRwtMock.techRecord_axles = [];
                const getTechRecordStub = sandbox
                  .stub(certificateGenerationService, 'callGetTechRecords')
                  .resolves((techRecordResponseRwtMock) as any);
                const getTechRecordSearchStub = sandbox
                  .stub(certificateGenerationService, 'callSearchTechRecords')
                  .resolves(techRecordsRwtSearch);

                // expect.assertions(1);
                const expectedError = new HTTPError(
                  500,
                  'No axle weights for Roadworthiness test certificates!',
                );
                await certificateGenerationService
                  .getWeightDetails(testResult)
                  .catch((err) => {
                    expect(err).toEqual(expectedError);
                    getTechRecordStub.restore();
                    getTechRecordSearchStub.restore();
                  });
              });
            },
          );
        },
      );
    });
  });
});
