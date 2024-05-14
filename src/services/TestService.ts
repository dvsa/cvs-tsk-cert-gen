import {
  MSVA30_TEST,
  IVA30_TEST,
} from '../models/Enums';

export class TestService {
  /**
   * Returns true if testType is msva and false if not
   * @param testTypeId - test type id which is being tested
   */
  public isMsvaTest = (testTypeId: string): boolean => MSVA30_TEST.IDS.includes(testTypeId);

  /**
   * Returns true if testType is iva and false if not
   * @param testTypeId - test type id which is being tested
   */
  public isIvaTest = (testTypeId: string): boolean => IVA30_TEST.IDS.includes(testTypeId);
}
