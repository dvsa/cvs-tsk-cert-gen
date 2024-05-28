import 'reflect-metadata';

import Container from 'typedi';
import sinon from 'sinon';
import cloneDeep from 'lodash.clonedeep';
import mockTestResult from '../resources/test-result-with-defect.json';
import defectsMock from '../resources/defects_mock.json';
import flatDefectsMock from '../resources/flattened-defects.json';
import { LambdaMockService } from '../models/LambdaMockService';
import { LambdaService } from '../../src/services/LambdaService';
import { DefectService } from '../../src/services/DefectService';

context('Defects', () => {
  describe('welsh defect function', () => {
    Container.set(LambdaService, new LambdaMockService());
    const sandbox = sinon.createSandbox();

    const defectService = Container.get(DefectService);

    afterEach(() => {
      sandbox.restore();
    });

    context('test formatDefectWelsh method', () => {
      it('should return welsh string for hgv vehicle type when there are shared defect refs', () => {
        // get mock of defect or test result
        const testResultWithDefect = cloneDeep(mockTestResult);
        const format = defectService.formatDefectWelsh(
          testResultWithDefect.testTypes[0].defects[0],
          'hgv',
          flatDefectsMock,
        );

        expect(format).toBe(
          "74.1 Diffyg na ddisgrifir mewn man arall yn y llawlyfr fel: byddai defnyddio'r cerbyd neu'r trelar ar y ffordd yn golygu perygl uniongyrchol o anaf i unrhyw berson. Blaen. None",
        );
      });

      it('should return welsh string for trl vehicle type when there are shared defect refs', () => {
        // get mock of defect or test result
        const testResultWithDefect = cloneDeep(mockTestResult);
        const format = defectService.formatDefectWelsh(
          testResultWithDefect.testTypes[0].defects[0],
          'trl',
          flatDefectsMock,
        );

        expect(format).toBe(
          "74.1 Diffyg na ddisgrifir mewn man arall yn y llawlyfr fel: byddai defnyddio'r cerbyd neu'r trelar ar y ffordd yn golygu perygl uniongyrchol o anaf i unrhyw berson. Blaen. None",
        );
      });

      it('should return welsh string for psv vehicle type when there are shared defect refs', () => {
        // get mock of defect or test result
        const testResultWithDefect = cloneDeep(mockTestResult);
        const format = defectService.formatDefectWelsh(
          testResultWithDefect.testTypes[0].defects[0],
          'psv',
          flatDefectsMock,
        );

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
        const format = defectService.formatDefectWelsh(
          testResultWithDefect.testTypes[0].defects[0],
          'hgv',
          flatDefectsMock,
        );

        expect(format).toBe(
          "74.1 Diffyg na ddisgrifir mewn man arall yn y llawlyfr fel: byddai defnyddio'r cerbyd neu'r trelar ar y ffordd yn golygu perygl uniongyrchol o anaf i unrhyw berson. Echelau: 3. Blaen Rhesi: 1. Seddi: 2.. None",
        );
      });

      it('should return null if filteredFlatDefect array is empty', () => {
        const filterFlatDefectsStub = sandbox
          .stub(defectService, 'filterFlatDefects').returns(null);

        // get mock of defect or test result
        const testResultWithDefect = cloneDeep(mockTestResult);
        const format = defectService.formatDefectWelsh(
          testResultWithDefect.testTypes[0].defects[0],
          'hgv',
          [],
        );

        expect(format).toBeNull();
        filterFlatDefectsStub.restore();
      });
    });

    context('test filterFlatDefects method', () => {
      it('should return a filtered flat defect for hgv', () => {
        const flatDefect = flatDefectsMock[0];
        const filterFlatDefect = defectService.filterFlatDefects(
          flatDefectsMock,
          'hgv',
        );
        expect(filterFlatDefect).toEqual(flatDefect);
      });

      it('should return a filtered flat defect for trl', () => {
        const flatDefect = flatDefectsMock[0];
        const filterFlatDefect = defectService.filterFlatDefects(
          flatDefectsMock,
          'trl',
        );
        expect(filterFlatDefect).toEqual(flatDefect);
      });

      it('should return a filtered flat defect for psv', () => {
        const flatDefect = flatDefectsMock[1];
        const filterFlatDefect = defectService.filterFlatDefects(
          flatDefectsMock,
          'psv',
        );
        expect(filterFlatDefect).toEqual(flatDefect);
      });

      it('should return null if array is empty', () => {
        const filterFlatDefect = defectService.filterFlatDefects(
          [],
          'hgv',
        );
        expect(filterFlatDefect).toBeNull();
      });
    });

    context('test flattenDefectsFromApi method', () => {
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
