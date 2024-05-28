import 'reflect-metadata';

import cloneDeep from 'lodash.clonedeep';
import mockIvaTestResult from '../resources/test-result-with-iva-defect.json';
import { TestService } from '../../src/test-result/TestService';

describe('iva 30 logic', () => {
  const testService = new TestService();

  context('test isBasicIvaTest logic', () => {
    it('should return true if test type id on test result exists in basic array', () => {
      const ivaTestResult = cloneDeep(mockIvaTestResult);

      const result: boolean = testService.isBasicIvaTest(ivaTestResult.testTypes[0].testTypeId);

      expect(result).toBeTruthy();
    });
    it('should return false if test type id on test result does not exist in basic array', () => {
      const ivaTestResult = cloneDeep(mockIvaTestResult);
      ivaTestResult.testTypes[0].testTypeId = '130';
      ivaTestResult.testTypes[0].testTypeName = 'Mutual recognition/ end of series & inspection';

      const result: boolean = testService.isBasicIvaTest(ivaTestResult.testTypes[0].testTypeId);

      expect(result).toBeFalsy();
    });
  });
});
