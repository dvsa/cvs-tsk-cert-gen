import 'reflect-metadata';

import Container from 'typedi';
import { toUint8Array } from '@smithy/util-utf8';
import { LambdaService } from '../../src/services/LambdaService';
import testStationsMock from '../resources/testStationsMock.json';
import { S3BucketService } from '../../src/services/S3BucketService';
import { S3BucketMockService } from '../models/S3BucketMockService';
import { LambdaMockService } from '../models/LambdaMockService';
import { TestStationRepository } from '../../src/repositories/TestStationRepository';

describe('Certificate Generation Service', () => {
  Container.set(S3BucketService, new S3BucketMockService());

  const lambdaService = new LambdaMockService();
  const invokeSpy = jest.spyOn(lambdaService, 'invoke');
  Container.set(LambdaService, lambdaService);

  const testStationRepository = Container.get(TestStationRepository);

  afterEach(() => {
    invokeSpy.mockReset();
  });

  describe('welsh address function', () => {
    context('test getTestStation method', () => {
      it('should return an array of test stations if invoke is successful', async () => {
        const mockStations = testStationsMock;

        invokeSpy
          .mockResolvedValue({
            Payload: toUint8Array(JSON.stringify({ body: JSON.stringify(mockStations) })),
            FunctionError: undefined,
            StatusCode: 200,
          });

        const testStations = await testStationRepository.getTestStations();

        expect(testStations).toEqual(mockStations);
        jest.clearAllMocks();
      });

      it('should return an empty array if test stations invoke is unsuccessful', async () => {
        invokeSpy
          .mockResolvedValue({
            Payload: toUint8Array(JSON.stringify({ body: '[]' })),
            FunctionError: undefined,
            StatusCode: 200,
          });

        const testStations = await testStationRepository.getTestStations();

        expect(testStations).toEqual([]);
        jest.clearAllMocks();
      });
    });
  });
});
