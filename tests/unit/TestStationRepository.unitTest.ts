import 'reflect-metadata';

import Container from 'typedi';
import { toUint8Array } from '@smithy/util-utf8';
import { LambdaService } from '../../src/services/LambdaService';
import testStationsMock from '../resources/testStationsMock.json';
import { ITestStation } from '../../src/models/ITestStations';
import { HTTPError } from '../../src/models/HTTPError';
import { S3BucketService } from '../../src/services/S3BucketService';
import { S3BucketMockService } from '../models/S3BucketMockService';
import { LambdaMockService } from '../models/LambdaMockService';
import { TestStationRepository } from '../../src/services/TestStationRepository';

describe('Certificate Generation Service', () => {
  Container.set(S3BucketService, new S3BucketMockService());

  const lambdaService = new LambdaMockService();
  const invokeSpy = jest.spyOn(lambdaService, 'invoke');
  Container.set(LambdaService, lambdaService);

  afterEach(() => {
    invokeSpy.mockReset();
  });

  describe('welsh address function', () => {
    context('test getTestStation method', () => {
      const testStationRepository = Container.get(TestStationRepository);

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

      it('should invoke test stations up to 3 times if there is an issue', async () => {
        const logSpy = jest.spyOn(console, 'error');

        invokeSpy
          .mockResolvedValue({
            Payload: toUint8Array(JSON.stringify({ body: '' })),
            FunctionError: undefined,
            StatusCode: 200,
          });

        const testStations = await testStationRepository.getTestStations();

        expect(logSpy).toHaveBeenLastCalledWith('There was an error retrieving the test stations on attempt 3: Error');
        expect(logSpy).toHaveBeenCalledTimes(3);
        expect(testStations).not.toBeNull();

        logSpy.mockClear();
        jest.clearAllMocks();
      });

      it('should return an empty array if test stations invoke is unsuccessful', async () => {
        invokeSpy
          .mockResolvedValue({
            Payload: toUint8Array(JSON.stringify({ body: '' })),
            FunctionError: undefined,
            StatusCode: 200,
          });

        const testStations = await testStationRepository.getTestStations();

        expect(testStations).toEqual([]);
        jest.clearAllMocks();
      });

      it('should throw error if issue when parsing test stations', async () => {
        const mockStations: ITestStation[] = [];

        invokeSpy
          .mockResolvedValue({
            Payload: toUint8Array(JSON.stringify({ body: JSON.stringify(mockStations) })),
            FunctionError: undefined,
            StatusCode: 200,
          });

        const defects = await testStationRepository.getTestStations()
          .catch((e) => {
            expect(e).toBeInstanceOf(HTTPError);
          });

        expect(defects).toEqual(mockStations);
        jest.clearAllMocks();
      });
    });
  });
});
