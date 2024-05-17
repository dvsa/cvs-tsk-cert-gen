import 'reflect-metadata';

import Container from 'typedi';
import testResultsResp from '../resources/test-results-response.json';
import testResultsRespFail from '../resources/test-results-fail-response.json';
import testResultsRespPrs from '../resources/test-results-prs-response.json';
import testResultsRespEmpty from '../resources/test-results-empty-response.json';
import testResultsRespNoCert from '../resources/test-results-nocert-response.json';
import { LambdaService } from '../../src/services/LambdaService';
import { S3BucketService } from '../../src/services/S3BucketService';
import { S3BucketMockService } from '../models/S3BucketMockService';
import { LambdaMockService } from '../models/LambdaMockService';
import { TestResultRepository } from '../../src/services/TestResultRepository';

describe('Certificate Generation Service', () => {
  Container.set(S3BucketService, new S3BucketMockService());

  const lambdaService = new LambdaMockService();
  const invokeSpy = jest.spyOn(lambdaService, 'invoke');
  Container.set(LambdaService, lambdaService);

  const testResultRepository = Container.get(TestResultRepository);

  afterEach(() => {
    invokeSpy.mockReset();
  });

  describe('getOdometerHistory function', () => {
    context('when given a systemNumber with only failed test results', () => {
      it('should return an empty odometer history list', async () => {
        invokeSpy
          .mockResolvedValueOnce(AWSResolve(JSON.stringify(testResultsRespFail)));

        const systemNumberMock = '12345678';
        const odometerHistory = await testResultRepository.getOdometerHistory(
          systemNumberMock,
        );

        expect(invokeSpy).toBeCalledTimes(1);
        expect(odometerHistory).toEqual({ OdometerHistoryList: [] });
      });
    });

    context('when given a systemNumber which returns more than 3 pass or prs', () => {
      it('should return an odometer history no greater than 3', async () => {
        invokeSpy
          .mockResolvedValue(AWSResolve(JSON.stringify(testResultsResp)));
        const systemNumberMock = '12345678';
        const odometerHistory = await testResultRepository.getOdometerHistory(
          systemNumberMock,
        );
        expect(invokeSpy).toBeCalledTimes(1);
        expect(odometerHistory).toEqual({
          OdometerHistoryList: [
            {
              value: 400000,
              unit: 'kilometres',
              date: '19.01.2019',
            },
            {
              value: 390000,
              unit: 'kilometres',
              date: '18.01.2019',
            },
            {
              value: 380000,
              unit: 'kilometres',
              date: '17.01.2019',
            },
          ],
        });
      });
    });

    context('when given a systemNumber which returns tests which include those that are not Annual With Certificate', () => {
      it('should omiting results that are not Annual With Certificate', async () => {
        invokeSpy
          .mockResolvedValue(AWSResolve(JSON.stringify(testResultsRespNoCert)));
        const systemNumberMock = '12345678';
        const odometerHistory = await testResultRepository.getOdometerHistory(
          systemNumberMock,
        );
        expect(invokeSpy).toBeCalledTimes(1);
        expect(odometerHistory).toEqual({
          OdometerHistoryList: [
            {
              value: 400000,
              unit: 'kilometres',
              date: '19.01.2019',
            },
            {
              value: 380000,
              unit: 'kilometres',
              date: '17.01.2019',
            },
            {
              value: 360000,
              unit: 'kilometres',
              date: '15.01.2019',
            },
          ],
        });
      });
    });

    context('when given a systemNumber which returns a test result which was fail then prs', () => {
      it('should return an odometer history which includes test result', async () => {
        invokeSpy
          .mockResolvedValue(AWSResolve(JSON.stringify(testResultsRespPrs)));
        const systemNumberMock = '12345678';
        const odometerHistory = await testResultRepository.getOdometerHistory(
          systemNumberMock,
        );
        expect(invokeSpy).toBeCalledTimes(1);
        expect(odometerHistory).toEqual({
          OdometerHistoryList: [
            {
              value: 350000,
              unit: 'kilometres',
              date: '14.01.2019',
            },
          ],
        });
      });
    });

    context('when given a systemNumber which returns a test result which has no test types array', () => {
      it('should omit the result from the odometer history', async () => {
        invokeSpy
          .mockResolvedValue(AWSResolve(JSON.stringify(testResultsRespEmpty)));
        const systemNumberMock = '12345678';
        const odometerHistory = await testResultRepository.getOdometerHistory(
          systemNumberMock,
        );
        expect(invokeSpy).toBeCalledTimes(1);
        expect(odometerHistory).toEqual({
          OdometerHistoryList: [
            {
              value: 400000,
              unit: 'kilometres',
              date: '19.01.2019',
            },
            {
              value: 380000,
              unit: 'kilometres',
              date: '17.01.2019',
            },
            {
              value: 370000,
              unit: 'kilometres',
              date: '16.01.2019',
            },
          ],
        });
      });
    });
  });
});

const AWSResolve = (payload: any) => ({
  $response: { HttpStatusCode: 200, payload },
  $metadata: {},
  StatusCode: 200,
  Payload: payload,
});
