import 'reflect-metadata';
import { Container } from 'typedi';
import sinon from 'sinon';
import cloneDeep from 'lodash.clonedeep';
import { S3BucketMockService } from '../models/S3BucketMockService';
import { LambdaMockService } from '../models/LambdaMockService';
import queueEventPass from '../resources/queue-event-pass.json';
import techRecordsRwt from '../resources/tech-records-response-rwt.json';
import techRecordsRwtSearch from '../resources/tech-records-response-rwt-search.json';
import { ITestResult } from '../../src/models/ITestResult';
import { IWeightDetails } from '../../src/models/IWeightDetails';
import { HTTPError } from '../../src/models/HTTPError';
import { S3BucketService } from '../../src/services/S3BucketService';
import { LambdaService } from '../../src/services/LambdaService';
import { TechRecordsRepository } from '../../src/tech-record/TechRecordsRepository';
import { TechRecordsService } from '../../src/tech-record/TechRecordsService';

const sandbox = sinon.createSandbox();

describe('cert-gen', () => {
  Container.set(S3BucketService, new S3BucketMockService());
  Container.set(LambdaService, new LambdaMockService());

  const techRecordsRepository = Container.get(TechRecordsRepository);
  const searchTechRecordsSpy = jest.spyOn(techRecordsRepository, 'callSearchTechRecords');
  const callGetTechRecordSpy = jest.spyOn(techRecordsRepository, 'callGetTechRecords');
  Container.set(TechRecordsRepository, techRecordsRepository);

  const techRecordsService = Container.get(TechRecordsService);

  afterEach(() => {
    sandbox.restore();
    searchTechRecordsSpy.mockReset();
    callGetTechRecordSpy.mockReset();
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

              searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

              const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
              callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

              // expect.assertions(1);
              await techRecordsService
                .getWeightDetails(testResult)
                .then((weightDetails) => {
                  expect(weightDetails).toEqual(expectedWeightDetails);
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

              searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

              const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
              callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

              // expect.assertions(1);
              await techRecordsService
                .getWeightDetails(testResult)
                .then((weightDetails) => {
                  expect(weightDetails).toEqual(expectedWeightDetails);
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

              searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);
              callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

              // expect.assertions(1);
              const expectedError = new HTTPError(
                500,
                'No vehicle found for Roadworthiness test certificate!',
              );
              await techRecordsService
                .getWeightDetails(testResult)
                .catch((err) => {
                  expect(err).toEqual(expectedError);
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
                callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

                // expect.assertions(1);
                const expectedError = new HTTPError(
                  500,
                  'No axle weights for Roadworthiness test certificates!',
                );
                await techRecordsService
                  .getWeightDetails(testResult)
                  .catch((err) => {
                    expect(err).toEqual(expectedError);
                  });
              });
            },
          );
        },
      );
    });
  });
});
