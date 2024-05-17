import 'reflect-metadata';

/* eslint-disable import/first */
const mockGetProfile = jest.fn();

import Container from 'typedi';
import sinon from 'sinon';
import { cloneDeep } from 'lodash';
import { CertificatePayloadGenerator } from '../../src/services/CertificatePayloadGenerator';
import mockTestResult from '../resources/test-result-with-defect.json';
import defectsMock from '../resources/defects_mock.json';
import flatDefectsMock from '../resources/flattened-defects.json';
import { LOCATION_ENGLISH, LOCATION_WELSH } from '../../src/models/Enums';
import { LambdaMockService } from '../models/LambdaMockService';
import { LambdaService } from '../../src/services/LambdaService';
import { DefectService } from '../../src/services/DefectService';

context('Defects', () => {
  describe('welsh defect function', () => {
    Container.set(LambdaService, new LambdaMockService());
    const certGenSvc = Container.get(CertificatePayloadGenerator);
    const sandbox = sinon.createSandbox();

    afterEach(() => {
      sandbox.restore();
    });

    context('test formatDefectWelsh method', () => {
      it('should return welsh string for hgv vehicle type when there are shared defect refs', () => {
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
        const flatDefect = flatDefectsMock[0];
        const filterFlatDefect = certGenSvc.filterFlatDefects(
          flatDefectsMock,
          'hgv',
        );
        expect(filterFlatDefect).toEqual(flatDefect);
      });

      it('should return a filtered flat defect for trl', () => {
        const flatDefect = flatDefectsMock[0];
        const filterFlatDefect = certGenSvc.filterFlatDefects(
          flatDefectsMock,
          'trl',
        );
        expect(filterFlatDefect).toEqual(flatDefect);
      });

      it('should return a filtered flat defect for psv', () => {
        const flatDefect = flatDefectsMock[1];
        const filterFlatDefect = certGenSvc.filterFlatDefects(
          flatDefectsMock,
          'psv',
        );
        expect(filterFlatDefect).toEqual(flatDefect);
      });

      it('should return null if array is empty', () => {
        const filterFlatDefect = certGenSvc.filterFlatDefects(
          [],
          'hgv',
        );
        expect(filterFlatDefect).toBeNull();
      });
    });

    context('test flattenDefectsFromApi method', () => {
      const defectService = Container.get(DefectService);

      it('should return the defects in a flat array', () => {
        const flattenedArray = defectService.flattenDefectsFromApi(defectsMock);
        expect(flattenedArray).toEqual(flatDefectsMock);
        expect(flattenedArray).toHaveLength(7);
      });

      it('should log any exceptions flattening defects', () => {
        const logSpy = jest.spyOn(console, 'error');

        const defectsMockForError = cloneDeep(defectsMock);
        defectsMockForError.forEach = jest.fn(() => {
          throw new Error('Some random error');
        });

        const flattenedArray = defectService.flattenDefectsFromApi(defectsMockForError);
        expect(logSpy).toHaveBeenCalledWith(
          'Error flattening defects: Error: Some random error',
        );
        expect(flattenedArray).toEqual([]);
        logSpy.mockClear();
        jest.clearAllMocks();
      });
    });
  });
});
