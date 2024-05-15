import 'reflect-metadata';

/* eslint-disable import/first */
const mockGetProfile = jest.fn();

import Container from 'typedi';
import sinon from 'sinon';
import { cloneDeep } from 'lodash';
import Axios from 'axios';
import { toUint8Array } from '@smithy/util-utf8';
import { CertificateGenerationService } from '../../src/services/CertificateGenerationService';
import testResultsResp from '../resources/test-results-response.json';
import testResultsRespFail from '../resources/test-results-fail-response.json';
import testResultsRespPrs from '../resources/test-results-prs-response.json';
import testResultsRespEmpty from '../resources/test-results-empty-response.json';
import testResultsRespNoCert from '../resources/test-results-nocert-response.json';
import { LambdaService } from '../../src/services/LambdaService';
import mockTestResult from '../resources/test-result-with-defect.json';
import defectsMock from '../resources/defects_mock.json';
import flatDefectsMock from '../resources/flattened-defects.json';
import testStationsMock from '../resources/testStationsMock.json';
import { LOCATION_ENGLISH, LOCATION_WELSH } from '../../src/models/Enums';
import { Configuration } from '../../src/utils/Configuration';
import { ITestStation } from '../../src/models/ITestStations';
import { IDefectParent } from '../../src/models/IDefectParent';
import { HTTPError } from '../../src/models/HTTPError';
import queueEventPRS from '../resources/queue-event-prs.json';
import queueEventPass from '../resources/queue-event-pass.json';
import queueEventFail from '../resources/queue-event-fail.json';
import { S3BucketService } from '../../src/services/S3BucketService';
import { S3BucketMockService } from '../models/S3BucketMockService';
import { LambdaMockService } from '../models/LambdaMockService';
import { TechRecordsRepository } from '../../src/services/TechRecordsRepository';

jest.mock('@dvsa/cvs-microservice-common/feature-flags/profiles/vtx', () => ({
  getProfile: mockGetProfile,
}));

describe('Certificate Generation Service', () => {
  Container.set(S3BucketService, new S3BucketMockService());

  const lambdaService = new LambdaMockService();
  const invokeSpy = jest.spyOn(lambdaService, 'invoke');
  Container.set(LambdaService, lambdaService);

  const techRecordsRepository = Container.get(TechRecordsRepository);
  const searchTechRecordsSpy = jest.spyOn(techRecordsRepository, 'callSearchTechRecords');
  const callGetTechRecordSpy = jest.spyOn(techRecordsRepository, 'callGetTechRecords');
  Container.set(TechRecordsRepository, techRecordsRepository);

  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
    searchTechRecordsSpy.mockReset();
    callGetTechRecordSpy.mockReset();
    invokeSpy.mockReset();
  });

  describe('getOdometerHistory function', () => {
    context('when given a systemNumber with only failed test results', () => {
      it('should return an empty odometer history list', async () => {
        invokeSpy
          .mockResolvedValueOnce(AWSResolve(JSON.stringify(testResultsRespFail)));

        const certGenSvc = Container.get(CertificateGenerationService);
        const systemNumberMock = '12345678';
        const odometerHistory = await certGenSvc.getOdometerHistory(
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
        const certGenSvc = Container.get(CertificateGenerationService);
        const systemNumberMock = '12345678';
        const odometerHistory = await certGenSvc.getOdometerHistory(
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
        const certGenSvc = Container.get(CertificateGenerationService);
        const systemNumberMock = '12345678';
        const odometerHistory = await certGenSvc.getOdometerHistory(
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
        const certGenSvc = Container.get(CertificateGenerationService);
        const systemNumberMock = '12345678';
        const odometerHistory = await certGenSvc.getOdometerHistory(
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
        const certGenSvc = Container.get(CertificateGenerationService);
        const systemNumberMock = '12345678';
        const odometerHistory = await certGenSvc.getOdometerHistory(
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

  describe('welsh defect function', () => {
    context('test formatDefectWelsh method', () => {
      it('should return welsh string for hgv vehicle type when there are shared defect refs', () => {
        const certGenSvc = Container.get(CertificateGenerationService);

        // get mock of defect or test result
        const testResultWithDefect = cloneDeep(mockTestResult);
        console.log(testResultWithDefect.testTypes[0].defects[0]);
        const format = certGenSvc.formatDefectWelsh(
          testResultWithDefect.testTypes[0].defects[0],
          'hgv',
          flatDefectsMock,
        );
        console.log(format);
        expect(format).toBe(
          "74.1 Diffyg na ddisgrifir mewn man arall yn y llawlyfr fel: byddai defnyddio'r cerbyd neu'r trelar ar y ffordd yn golygu perygl uniongyrchol o anaf i unrhyw berson. Blaen. None",
        );
      });
      it('should return welsh string for trl vehicle type when there are shared defect refs', () => {
        const certGenSvc = Container.get(CertificateGenerationService);

        // get mock of defect or test result
        const testResultWithDefect = cloneDeep(mockTestResult);
        console.log(testResultWithDefect.testTypes[0].defects[0]);
        const format = certGenSvc.formatDefectWelsh(
          testResultWithDefect.testTypes[0].defects[0],
          'trl',
          flatDefectsMock,
        );
        console.log(format);
        expect(format).toBe(
          "74.1 Diffyg na ddisgrifir mewn man arall yn y llawlyfr fel: byddai defnyddio'r cerbyd neu'r trelar ar y ffordd yn golygu perygl uniongyrchol o anaf i unrhyw berson. Blaen. None",
        );
      });
      it('should return welsh string for psv vehicle type when there are shared defect refs', () => {
        const certGenSvc = Container.get(CertificateGenerationService);

        // get mock of defect or test result
        const testResultWithDefect = cloneDeep(mockTestResult);
        console.log(testResultWithDefect.testTypes[0].defects[0]);
        const format = certGenSvc.formatDefectWelsh(
          testResultWithDefect.testTypes[0].defects[0],
          'psv',
          flatDefectsMock,
        );
        console.log(format);
        expect(format).toBe(
          "74.1 Diffyg na ddisgrifir mewn man arall yn y llawlyfr fel: byddai defnyddio'r cerbyd  ar y ffordd yn golygu perygl uniongyrchol o anaf i unrhyw berson arall. Blaen. None",
        );
      });
      it('should return welsh string including location numbers if populated', () => {
        const certGenSvc = Container.get(CertificateGenerationService);

        // get mock of defect or test result
        const testResultWithDefect = cloneDeep(mockTestResult);
        Object.assign(testResultWithDefect.testTypes[0].defects[0].additionalInformation.location, { rowNumber: 1 });
        Object.assign(testResultWithDefect.testTypes[0].defects[0].additionalInformation.location, { seatNumber: 2 });
        Object.assign(testResultWithDefect.testTypes[0].defects[0].additionalInformation.location, { axleNumber: 3 });
        console.log(testResultWithDefect.testTypes[0].defects[0]);
        const format = certGenSvc.formatDefectWelsh(
          testResultWithDefect.testTypes[0].defects[0],
          'hgv',
          flatDefectsMock,
        );
        console.log(format);
        expect(format).toBe(
          "74.1 Diffyg na ddisgrifir mewn man arall yn y llawlyfr fel: byddai defnyddio'r cerbyd neu'r trelar ar y ffordd yn golygu perygl uniongyrchol o anaf i unrhyw berson. Echelau: 3. Blaen Rhesi: 1. Seddi: 2.. None",
        );
      });
      it('should return null if filteredFlatDefect array is empty', () => {
        const certGenSvc = Container.get(CertificateGenerationService);

        const filterFlatDefectsStub = sandbox
          .stub(certGenSvc, 'filterFlatDefects').returns(null);

        // get mock of defect or test result
        const testResultWithDefect = cloneDeep(mockTestResult);
        console.log(testResultWithDefect.testTypes[0].defects[0]);
        const format = certGenSvc.formatDefectWelsh(
          testResultWithDefect.testTypes[0].defects[0],
          'hgv',
          [],
        );
        console.log(format);
        expect(format).toBeNull();
        filterFlatDefectsStub.restore();
      });
    });

    context('test convertLocationWelsh method', () => {
      it('should return the translated location value', () => {
        const certGenSvc = Container.get(CertificateGenerationService);
        const welshLocation1 = certGenSvc.convertLocationWelsh(
          LOCATION_ENGLISH.FRONT,
        );
        const welshLocation2 = certGenSvc.convertLocationWelsh(
          LOCATION_ENGLISH.REAR,
        );
        const welshLocation3 = certGenSvc.convertLocationWelsh(
          LOCATION_ENGLISH.UPPER,
        );
        const welshLocation4 = certGenSvc.convertLocationWelsh(
          LOCATION_ENGLISH.LOWER,
        );
        const welshLocation5 = certGenSvc.convertLocationWelsh(
          LOCATION_ENGLISH.NEARSIDE,
        );
        const welshLocation6 = certGenSvc.convertLocationWelsh(
          LOCATION_ENGLISH.OFFSIDE,
        );
        const welshLocation7 = certGenSvc.convertLocationWelsh(
          LOCATION_ENGLISH.CENTRE,
        );
        const welshLocation8 = certGenSvc.convertLocationWelsh(
          LOCATION_ENGLISH.INNER,
        );
        const welshLocation9 = certGenSvc.convertLocationWelsh(
          LOCATION_ENGLISH.OUTER,
        );
        const welshLocation10 = certGenSvc.convertLocationWelsh('mockLocation');
        expect(welshLocation1).toEqual(LOCATION_WELSH.FRONT);
        expect(welshLocation2).toEqual(LOCATION_WELSH.REAR);
        expect(welshLocation3).toEqual(LOCATION_WELSH.UPPER);
        expect(welshLocation4).toEqual(LOCATION_WELSH.LOWER);
        expect(welshLocation5).toEqual(LOCATION_WELSH.NEARSIDE);
        expect(welshLocation6).toEqual(LOCATION_WELSH.OFFSIDE);
        expect(welshLocation7).toEqual(LOCATION_WELSH.CENTRE);
        expect(welshLocation8).toEqual(LOCATION_WELSH.INNER);
        expect(welshLocation9).toEqual(LOCATION_WELSH.OUTER);
        expect(welshLocation10).toBe('mockLocation');
      });
    });

    context('test filterFlatDefects method', () => {
      it('should return a filtered flat defect for hgv', () => {
        const certGenSvc = Container.get(CertificateGenerationService);
        const flatDefect = flatDefectsMock[0];
        const filterFlatDefect = certGenSvc.filterFlatDefects(
          flatDefectsMock,
          'hgv',
        );
        expect(filterFlatDefect).toEqual(flatDefect);
      });
      it('should return a filtered flat defect for trl', () => {
        const certGenSvc = Container.get(CertificateGenerationService);
        const flatDefect = flatDefectsMock[0];
        const filterFlatDefect = certGenSvc.filterFlatDefects(
          flatDefectsMock,
          'trl',
        );
        expect(filterFlatDefect).toEqual(flatDefect);
      });
      it('should return a filtered flat defect for psv', () => {
        const certGenSvc = Container.get(CertificateGenerationService);
        const flatDefect = flatDefectsMock[1];
        const filterFlatDefect = certGenSvc.filterFlatDefects(
          flatDefectsMock,
          'psv',
        );
        expect(filterFlatDefect).toEqual(flatDefect);
      });
      it('should return null if array is empty', () => {
        const certGenSvc = Container.get(CertificateGenerationService);
        const filterFlatDefect = certGenSvc.filterFlatDefects(
          [],
          'hgv',
        );
        expect(filterFlatDefect).toBeNull();
      });
    });

    context('test flattenDefectsFromApi method', () => {
      it('should return the defects in a flat array', () => {
        const certGenSvc = Container.get(CertificateGenerationService);
        const flattenedArray = certGenSvc.flattenDefectsFromApi(defectsMock);
        expect(flattenedArray).toEqual(flatDefectsMock);
        expect(flattenedArray).toHaveLength(7);
      });
      it('should log any exceptions flattening defects', () => {
        const certGenSvc = Container.get(CertificateGenerationService);
        const logSpy = jest.spyOn(console, 'error');

        const defectsMockForError = cloneDeep(defectsMock);
        defectsMockForError.forEach = jest.fn(() => {
          throw new Error('Some random error');
        });

        const flattenedArray = certGenSvc.flattenDefectsFromApi(defectsMockForError);
        expect(logSpy).toHaveBeenCalledWith(
          'Error flattening defects: Error: Some random error',
        );
        expect(flattenedArray).toEqual([]);
        logSpy.mockClear();
        jest.clearAllMocks();
      });
    });
  });

  describe('welsh address function', () => {
    context('test getThisTestStation method', () => {
      it('should return a postcode if pNumber exists in the list of test stations', () => {
        const certGenSvc = Container.get(CertificateGenerationService);
        const testStation = testStationsMock[0];
        const postCode = certGenSvc.getThisTestStation(
          testStationsMock,
          'P11223',
        );
        expect(postCode).toEqual(testStation.testStationPostcode);
      });
      it('should return a null and message if pNumber does not exists in the list of test stations', () => {
        const logSpy = jest.spyOn(console, 'log');
        const certGenSvc = Container.get(CertificateGenerationService);
        const postCode = certGenSvc.getThisTestStation(
          testStationsMock,
          '445567',
        );
        expect(postCode).toBeNull();
        expect(logSpy).toHaveBeenCalledWith(
          'Test station details could not be found for 445567',
        );
        logSpy.mockClear();
      });
      it('should return a null and message if the list of test stations is empty', () => {
        const logSpy = jest.spyOn(console, 'log');
        const certGenSvc = Container.get(CertificateGenerationService);
        const postCode = certGenSvc.getThisTestStation([], 'P50742');
        expect(postCode).toBeNull();
        expect(logSpy).toHaveBeenCalledWith('Test stations data is empty');
        logSpy.mockClear();
      });
    });

    context('test getTestStation method', () => {
      it('should return an array of test stations if invoke is successful', async () => {
        const certGenSvc = Container.get(CertificateGenerationService);

        const mockStations = testStationsMock;

        invokeSpy
          .mockResolvedValue({
            Payload: toUint8Array(JSON.stringify({ body: JSON.stringify(mockStations) })),
            FunctionError: undefined,
            StatusCode: 200,
          });

        const testStations = await certGenSvc.getTestStations();

        expect(testStations).toEqual(mockStations);
        jest.clearAllMocks();
      });
      it('should invoke test stations up to 3 times if there is an issue', async () => {
        const logSpy = jest.spyOn(console, 'error');
        const certGenSvc = Container.get(CertificateGenerationService);

        invokeSpy
          .mockResolvedValue({
            Payload: toUint8Array(JSON.stringify({ body: '' })),
            FunctionError: undefined,
            StatusCode: 200,
          });

        const testStations = await certGenSvc.getTestStations();

        expect(logSpy).toHaveBeenLastCalledWith('There was an error retrieving the test stations on attempt 3: Error');
        expect(logSpy).toHaveBeenCalledTimes(3);
        expect(testStations).not.toBeNull();
        logSpy.mockClear();
        jest.clearAllMocks();
      });
      it('should return an empty array if test stations invoke is unsuccessful', async () => {
        const certGenSvc = Container.get(CertificateGenerationService);

        invokeSpy
          .mockResolvedValue({
            Payload: toUint8Array(JSON.stringify({ body: '' })),
            FunctionError: undefined,
            StatusCode: 200,
          });

        const testStations = await certGenSvc.getTestStations();

        expect(testStations).toEqual([]);
        jest.clearAllMocks();
      });
      it('should throw error if issue when parsing test stations', async () => {
        const certGenSvc = Container.get(CertificateGenerationService);

        const mockStations: ITestStation[] = [];

        invokeSpy
          .mockResolvedValue({
            Payload: toUint8Array(JSON.stringify({ body: JSON.stringify(mockStations) })),
            FunctionError: undefined,
            StatusCode: 200,
          });

        const defects = await certGenSvc.getTestStations()
          .catch((e) => {
            expect(e).toBeInstanceOf(HTTPError);
          });
        expect(defects).toEqual(mockStations);
        jest.clearAllMocks();
      });
    });

    context('test getDefectTranslations method', () => {
      it('should return an array of defects if invoke is successful', async () => {
        const certGenSvc = Container.get(CertificateGenerationService);

        const mockDefects = defectsMock;

        invokeSpy
          .mockResolvedValue({
            Payload: toUint8Array(JSON.stringify({ body: JSON.stringify(mockDefects) })),
            FunctionError: undefined,
            StatusCode: 200,
          });

        const defects = await certGenSvc.getDefectTranslations();

        expect(defects).toEqual(mockDefects);
        jest.clearAllMocks();
      });
      it('should invoke defects up to 3 times if there is an issue', async () => {
        const logSpy = jest.spyOn(console, 'error');
        const certGenSvc = Container.get(CertificateGenerationService);

        invokeSpy
          .mockResolvedValue({
            Payload: toUint8Array(JSON.stringify({ body: '' })),
            FunctionError: undefined,
            StatusCode: 200,
          });

        const defects = await certGenSvc.getDefectTranslations();

        expect(logSpy).toHaveBeenLastCalledWith('There was an error retrieving the welsh defect translations on attempt 3: Error');
        expect(logSpy).toHaveBeenCalledTimes(3);
        expect(defects).not.toBeNull();
        logSpy.mockClear();
        jest.clearAllMocks();
      });
      it('should return an empty array if defects invoke is unsuccessful', async () => {
        const certGenSvc = Container.get(CertificateGenerationService);

        invokeSpy
          .mockResolvedValue({
            Payload: toUint8Array(JSON.stringify({ body: '' })),
            FunctionError: undefined,
            StatusCode: 200,
          });

        const defects = await certGenSvc.getDefectTranslations();

        expect(defects).toEqual([]);
        jest.clearAllMocks();
      });
      it('should throw error if issue when parsing defects', async () => {
        const certGenSvc = Container.get(CertificateGenerationService);

        const mockDefects: IDefectParent[] = [];

        invokeSpy
          .mockResolvedValue({
            Payload: toUint8Array(JSON.stringify({ body: JSON.stringify(mockDefects) })),
            FunctionError: undefined,
            StatusCode: 200,
          });

        const defects = await certGenSvc.getDefectTranslations()
          .catch((e) => {
            expect(e).toBeInstanceOf(HTTPError);
          });
        expect(defects).toEqual(mockDefects);
        jest.clearAllMocks();
      });
    });

    describe('Welsh feature flags', () => {
      let certGenSvc: CertificateGenerationService;
      beforeEach(() => {
        certGenSvc = Container.get(CertificateGenerationService);
      });
      afterEach(() => {
        jest.resetAllMocks();
      });

      context('test ShouldTranslateTestResult method', () => {
        const event = cloneDeep(queueEventPass);
        const testResult: any = JSON.parse(event.Records[0].body);

        it('should prevent Welsh translation if flag retrieval fails and log relevant message', async () => {
          const generateCertificate = {
            statusCode: 500,
            body: 'Failed retrieve feature flags',
          };

          mockGetProfile.mockRejectedValueOnce(generateCertificate);

          const logSpy = jest.spyOn(console, 'error');

          const shouldTranslateTestResult = await certGenSvc.shouldTranslateTestResult(testResult);
          expect(shouldTranslateTestResult).toBeFalsy();
          expect(logSpy).toHaveBeenCalledWith('Failed to retrieve feature flags', generateCertificate);
          logSpy.mockClear();
        });

        it('should prevent Welsh translation when global and test result flag are invalid', async () => {
          const globalFlagStub = sandbox.stub(certGenSvc, 'isGlobalWelshFlagEnabled').resolves(false);
          const testResultFlagStub = sandbox.stub(certGenSvc, 'isTestResultFlagEnabled').resolves(false);
          const isTestStationWelshStub = sandbox.stub(certGenSvc, 'isTestStationWelsh').resolves(false);

          const shouldTranslateTestResult = await certGenSvc.shouldTranslateTestResult(testResult);
          expect(shouldTranslateTestResult).toBeFalsy();
          globalFlagStub.restore();
          testResultFlagStub.restore();
          isTestStationWelshStub.restore();
        });

        it('should allow Welsh translation if global and test result flag are enabled', async () => {
          const globalFlagStub = sandbox.stub(certGenSvc, 'isGlobalWelshFlagEnabled').resolves(true);
          const testResultFlagStub = sandbox.stub(certGenSvc, 'isTestResultFlagEnabled').resolves(true);
          const isTestStationWelshStub = sandbox.stub(certGenSvc, 'isTestStationWelsh').resolves(true);

          const shouldTranslateTestResult = await certGenSvc.shouldTranslateTestResult(testResult);
          expect(shouldTranslateTestResult).toBeTruthy();
          globalFlagStub.restore();
          testResultFlagStub.restore();
          isTestStationWelshStub.restore();
        });
      });
      context('test isGlobalWelshFlagEnabled method', () => {
        it('should allow Welsh translation when flag is enabled', () => {
          const featureFlags = {
            welshTranslation: {
              enabled: true,
              translatePassTestResult: false,
              translatePrsTestResult: false,
              translateFailTestResult: false,
            },
          };
          mockGetProfile.mockReturnValueOnce(Promise.resolve(featureFlags));

          const isWelsh = certGenSvc.isGlobalWelshFlagEnabled(featureFlags);
          expect(isWelsh).toBeTruthy();
        });
        it('should prevent Welsh translation when flag is disabled and log relevant warning', () => {
          const featureFlags = {
            welshTranslation: {
              enabled: false,
              translatePassTestResult: false,
              translatePrsTestResult: false,
              translateFailTestResult: false,
            },
          };
          mockGetProfile.mockReturnValueOnce(Promise.resolve(featureFlags));

          const logSpy = jest.spyOn(console, 'warn');

          const isWelsh = certGenSvc.isGlobalWelshFlagEnabled(featureFlags);
          expect(isWelsh).toBeFalsy();
          expect(logSpy).toHaveBeenCalledWith('Unable to translate any test results: global Welsh flag disabled.');
          logSpy.mockClear();
        });
      });

      context('test isTestResultFlagEnabled method', () => {
        context('when a test result is valid for Welsh translation', () => {
          context('and the PASS Flag is valid', () => {
            const event = cloneDeep(queueEventPass);
            const testResult: any = JSON.parse(event.Records[0].body);

            it('should allow PASS test result for Welsh translation', () => {
              const featureFlags = {
                welshTranslation: {
                  enabled: true,
                  translatePassTestResult: true,
                  translatePrsTestResult: false,
                  translateFailTestResult: false,
                },
              };
              mockGetProfile.mockReturnValueOnce(Promise.resolve(featureFlags));

              const isWelsh = certGenSvc.isTestResultFlagEnabled(testResult.testTypes.testResult, featureFlags);
              expect(isWelsh).toBeTruthy();
            });

            it('should prevent Welsh translation when PASS is disabled and log relevant warning', () => {
              const featureFlags = {
                welshTranslation: {
                  enabled: true,
                  translatePassTestResult: false,
                  translatePrsTestResult: false,
                  translateFailTestResult: false,
                },
              };
              mockGetProfile.mockReturnValueOnce(Promise.resolve(featureFlags));

              const logSpy = jest.spyOn(console, 'warn');

              const isWelsh = certGenSvc.isTestResultFlagEnabled(testResult.testTypes.testResult, featureFlags);
              expect(isWelsh).toBeFalsy();
              expect(logSpy).toHaveBeenCalledWith('Unable to translate for test result: pass flag disabled');
              logSpy.mockClear();
            });
          });

          context('and the PRS Flag is valid', () => {
            const event = cloneDeep(queueEventPRS);
            const testResult: any = JSON.parse(event.Records[0].body);

            it('should allow PRS test result for Welsh translation', () => {
              const featureFlags = {
                welshTranslation: {
                  enabled: true,
                  translatePassTestResult: false,
                  translatePrsTestResult: true,
                  translateFailTestResult: false,
                },
              };
              mockGetProfile.mockReturnValueOnce(Promise.resolve(featureFlags));

              const isWelsh = certGenSvc.isTestResultFlagEnabled(testResult.testTypes.testResult, featureFlags);
              expect(isWelsh).toBeTruthy();
            });

            it('should prevent Welsh translation when PRS is disabled and log relevant warning', () => {
              const featureFlags = {
                welshTranslation: {
                  enabled: true,
                  translatePassTestResult: false,
                  translatePrsTestResult: false,
                  translateFailTestResult: false,
                },
              };
              mockGetProfile.mockReturnValueOnce(Promise.resolve(featureFlags));

              const logSpy = jest.spyOn(console, 'warn');

              const isWelsh = certGenSvc.isTestResultFlagEnabled(testResult.testTypes.testResult, featureFlags);
              expect(isWelsh).toBeFalsy();
              expect(logSpy).toHaveBeenCalledWith('Unable to translate for test result: prs flag disabled');
              logSpy.mockClear();
            });
          });

          context('and the FAIL flag is valid', () => {
            const event = cloneDeep(queueEventFail);
            const testResult: any = JSON.parse(event.Records[0].body);

            it('should allow FAIL test result for Welsh translation', () => {
              const featureFlags = {
                welshTranslation: {
                  enabled: true,
                  translatePassTestResult: false,
                  translatePrsTestResult: false,
                  translateFailTestResult: true,
                },
              };
              mockGetProfile.mockReturnValueOnce(Promise.resolve(featureFlags));

              const isWelsh = certGenSvc.isTestResultFlagEnabled(testResult.testTypes.testResult, featureFlags);
              expect(isWelsh).toBeTruthy();
            });

            it('should prevent Welsh translation when FAIL is disabled and log relevant warning', () => {
              const featureFlags = {
                welshTranslation: {
                  enabled: true,
                  translatePassTestResult: false,
                  translatePrsTestResult: false,
                  translateFailTestResult: false,
                },
              };
              mockGetProfile.mockReturnValueOnce(Promise.resolve(featureFlags));

              const logSpy = jest.spyOn(console, 'warn');

              const isWelsh = certGenSvc.isTestResultFlagEnabled(testResult.testTypes.testResult, featureFlags);
              expect(isWelsh).toBeFalsy();
              expect(logSpy).toHaveBeenCalledWith('Unable to translate for test result: fail flag disabled');
              logSpy.mockClear();
            });
          });
        });

        context('When a test result is invalid for Welsh translation', () => {
          const event = cloneDeep(queueEventPass);
          const testResult: any = JSON.parse(event.Records[0].body);
          testResult.testTypes.testResult = 'Invalid_test_result';
          it('should prevent translation and log relevant warning', () => {
            const featureFlags = {
              welshTranslation: {
                enabled: true,
                translatePassTestResult: true,
                translatePrsTestResult: true,
                translateFailTestResult: true,
              },
            };
            mockGetProfile.mockReturnValueOnce(Promise.resolve(featureFlags));

            const logSpy = jest.spyOn(console, 'warn');

            const isWelsh = certGenSvc.isTestResultFlagEnabled(testResult.testTypes.testResult, featureFlags);
            expect(isWelsh).toBeFalsy();
            expect(logSpy).toHaveBeenCalledWith('Translation not available for this test result type.');
            logSpy.mockClear();
          });
        });
      });

      context('test isTestStationWelsh method', () => {
        context('with a valid Welsh test station P number', () => {
          const event = cloneDeep(queueEventPass);
          const testResult: any = JSON.parse(event.Records[0].body);
          testResult.testStationPNumber = 'P11223';

          it('should identify the test requires translation', async () => {
            const isWelsh = await certGenSvc.isTestStationWelsh(testResult.testStationPNumber);
            expect(isWelsh).toBeFalsy();
            jest.resetAllMocks();
          });
        });
        context('with a non-Welsh test station P number', () => {
          const event = cloneDeep(queueEventPass);
          const testResult: any = JSON.parse(event.Records[0].body);

          it('should identify that the test does not require translation', async () => {
            const isWelsh = await certGenSvc.isTestStationWelsh(testResult.testStationPNumber);
            expect(isWelsh).toBeFalsy();
          });
        });
        context('with an invalid Welsh test station P number', () => {
          const event = cloneDeep(queueEventPass);
          const testResult: any = JSON.parse(event.Records[0].body);
          testResult.testStationPNumber = 'Nonsense_P_Number';

          it('should identify no test stations exist with that P number and log relevant message', async () => {
            const logSpy = jest.spyOn(console, 'log');

            const isWelsh = await certGenSvc.isTestStationWelsh(testResult.testStationPNumber);
            expect(isWelsh).toBeFalsy();
            expect(logSpy).toHaveBeenCalledWith('Test stations data is empty');
            logSpy.mockClear();
          });
        });
      });
    });

    context('test postcode lookup method', () => {
      context('when the SECRET_KEY environment variable does not exist', () => {
        it('should log the the errors', async () => {
          const certGenSvc = Container.get(CertificateGenerationService);

          const logSpy = jest.spyOn(console, 'log');

          Configuration.prototype.getWelshSecretKey = jest.fn().mockReturnValue(null);

          await certGenSvc.lookupPostcode('some_postcode');
          expect(logSpy.mock.calls[0][0]).toBe('Secret details not found.');
          expect(logSpy.mock.calls[1][0]).toBe('SMC Postcode lookup details not found. Return value for isWelsh for some_postcode is false');

          logSpy.mockClear();
        });
      });

      context('when the SECRET_KEY environment variable does exist', () => {
        const mockSecretResponse = {
          url: 'mockUrl',
          key: 'mockKey',
        };

        it('should log correctly if isWelshAddress was true', async () => {
          const certGenSvc = Container.get(CertificateGenerationService);

          const logSpy = jest.spyOn(console, 'log');

          Axios.create = jest.fn().mockReturnValueOnce(({
            get: jest.fn().mockResolvedValueOnce({
              data: {
                isWelshAddress: true,
              },
            }),
          }));
          Configuration.prototype.getSecret = jest.fn().mockReturnValue(mockSecretResponse);

          const response = await certGenSvc.lookupPostcode('welsh_postcode');
          expect(logSpy.mock.calls[0][0]).toBe('Return value for isWelsh for welsh_postcode is true');
          expect(response).toBeTruthy();

          logSpy.mockClear();
          jest.resetAllMocks();
        });

        it('should log correctly if isWelshAddress was false', async () => {
          const certGenSvc = Container.get(CertificateGenerationService);

          const logSpy = jest.spyOn(console, 'log');

          Axios.create = jest.fn().mockReturnValueOnce(({
            get: jest.fn().mockResolvedValueOnce({
              data: {
                isWelshAddress: false,
              },
            }),
          }));

          Configuration.prototype.getSecret = jest.fn().mockReturnValue(mockSecretResponse);

          const response = await certGenSvc.lookupPostcode('non_welsh_postcode');
          expect(logSpy.mock.calls[0][0]).toBe('Return value for isWelsh for non_welsh_postcode is false');
          expect(response).toBeFalsy();

          logSpy.mockClear();
          jest.resetAllMocks();
        });

        it('should return false if error is thrown due to invalid type in response from api call', async () => {
          const certGenSvc = Container.get(CertificateGenerationService);

          const logSpy = jest.spyOn(console, 'log');

          Axios.create = jest.fn().mockReturnValueOnce(({
            get: jest.fn().mockResolvedValueOnce({
              data: {
                someRandomKey: true,
              },
            }),
          }));

          Configuration.prototype.getSecret = jest.fn().mockReturnValue(mockSecretResponse);

          const response = await certGenSvc.lookupPostcode('welsh_postcode')
            .catch((e) => {
              expect(e).toBeInstanceOf(HTTPError);
            });
          expect(response).toBeFalsy();

          logSpy.mockClear();
          jest.resetAllMocks();
        });

        it('should return false if axios client is null', async () => {
          const certGenSvc = Container.get(CertificateGenerationService);
          const logSpy = jest.spyOn(console, 'log');

          Axios.create = jest.fn().mockReturnValueOnce(null);

          Configuration.prototype.getSecret = jest.fn().mockReturnValue(mockSecretResponse);

          const response = await certGenSvc.lookupPostcode('welsh_postcode');
          expect(logSpy.mock.calls[0][0]).toBe('SMC Postcode lookup details not found. Return value for isWelsh for welsh_postcode is false');
          expect(response).toBeFalsy();

          logSpy.mockClear();
          jest.resetAllMocks();
        });

        it('should return false if an error occurs in axios client', async () => {
          const certGenSvc = Container.get(CertificateGenerationService);
          const logSpy = jest.spyOn(console, 'error');

          const mockError = new Error('some random error');
          Configuration.prototype.getSecret = jest.fn().mockRejectedValue(mockError);

          const response = await certGenSvc.lookupPostcode('welsh_postcode');
          expect(logSpy.mock.calls[0][0]).toBe('Error generating Axios Instance: Error: some random error');
          expect(response).toBeFalsy();

          logSpy.mockClear();
          jest.resetAllMocks();
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

const AWSReject = (payload: any) => ({
  $response: { HttpStatusCode: 400, payload },
  $metadata: {},
  StatusCode: 400,
  Payload: payload,
});
