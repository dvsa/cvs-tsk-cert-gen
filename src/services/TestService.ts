import { Service } from 'typedi';
import {
  ADR_TEST,
  BASIC_IVA_TEST,
  MSVA30_TEST,
  IVA30_TEST,
  HGV_TRL_ROADWORTHINESS_TEST_TYPES,
  VEHICLE_TYPES,
  AVAILABLE_WELSH,
} from '../models/Enums';
import { IMakeAndModel } from '../models/IMakeAndModel';

@Service()
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

  /**
   * Returns a boolean value indicating whether the test type is a basic IVA test
   * @param testTypeId - the test type ID on the test result
   */
  public isBasicIvaTest = (testTypeId: string): boolean => BASIC_IVA_TEST.IDS.includes(testTypeId);

  /**
   * Returns true if testType is adr and false if not
   * @param testType - testType which is tested
   */
  public isTestTypeAdr = (testType: any): boolean => ADR_TEST.IDS.includes(testType.testTypeId);

  /**
   * Returns true if testType is roadworthiness test for HGV or TRL and false if not
   * @param testTypeId - testType which is tested
   */
  public isRoadworthinessTestType(testTypeId: string): boolean {
    return HGV_TRL_ROADWORTHINESS_TEST_TYPES.IDS.includes(testTypeId);
  }

  /**
   * Returns true if provided testResult is HGV or TRL Roadworthiness test otherwise false
   * @param testResult - testResult of the vehicle
   */
  public isHgvTrlRoadworthinessCertificate(testResult: any): boolean {
    return (
      (testResult.vehicleType === VEHICLE_TYPES.HGV
        || testResult.vehicleType === VEHICLE_TYPES.TRL)
      && this.isRoadworthinessTestType(testResult.testTypes.testTypeId)
    );
  }

  /**
   * To check if the testResult is valid for fetching Trn.
   * @param vehicleType the vehicle type
   * @param makeAndModel object containing Make and Model
   * @returns returns if the condition is satisfied else false
   */
  public isValidForTrn(
    vehicleType: string,
    makeAndModel: IMakeAndModel,
  ): boolean {
    return makeAndModel && vehicleType as VEHICLE_TYPES === VEHICLE_TYPES.TRL;
  }

  /**
   * Check that the test result and vehicle type are a valid combination and bilingual certificate is available
   * @param vehicleType - the vehicle type from the test result
   * @param testResult - the result of the test
   */
  public isWelshCertificateAvailable = (vehicleType: string, testResult: string): boolean => AVAILABLE_WELSH.CERTIFICATES.includes(`${vehicleType}_${testResult}`);
}
