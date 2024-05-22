import { Service } from 'typedi';
import { getProfile, FeatureFlags } from '@dvsa/cvs-microservice-common/feature-flags/profiles/vtx';
import { LOCATION_ENGLISH, LOCATION_WELSH, TEST_RESULTS } from '../models/Enums';

@Service()
export class TranslationService {
  /**
   * Returns welsh version of location
   * @param locationToTranslate
   */
  public convertLocationWelsh(locationToTranslate: LOCATION_ENGLISH) {
    switch (locationToTranslate) {
      case LOCATION_ENGLISH.FRONT:
        return LOCATION_WELSH.FRONT;
      case LOCATION_ENGLISH.REAR:
        return LOCATION_WELSH.REAR;
      case LOCATION_ENGLISH.UPPER:
        return LOCATION_WELSH.UPPER;
      case LOCATION_ENGLISH.LOWER:
        return LOCATION_WELSH.LOWER;
      case LOCATION_ENGLISH.NEARSIDE:
        return LOCATION_WELSH.NEARSIDE;
      case LOCATION_ENGLISH.OFFSIDE:
        return LOCATION_WELSH.OFFSIDE;
      case LOCATION_ENGLISH.CENTRE:
        return LOCATION_WELSH.CENTRE;
      case LOCATION_ENGLISH.INNER:
        return LOCATION_WELSH.INNER;
      case LOCATION_ENGLISH.OUTER:
        return LOCATION_WELSH.OUTER;
      default:
        return locationToTranslate;
    }
  }

  /**
   * Handler method for retrieving feature flags and checking if test station is in Wales
   * @param testResult
   * @returns Promise<boolean>
   */
  public async shouldTranslateTestResult(testResult: any): Promise<boolean> {
    try {
      const featureFlags = await getProfile();
      console.log('Using feature flags ', featureFlags);

      if (this.isGlobalWelshFlagEnabled(featureFlags) && this.isTestResultFlagEnabled(testResult.testTypes.testResult, featureFlags)) {
        return true;
      }
    } catch (e) {
      // eslint-disable-next-line
      console.error(`Failed to retrieve feature flags`, e);
    }
    return false;
  }

  /**
   * Method to check if Welsh translation is enabled.
   * @param featureFlags FeatureFlags interface
   * @returns boolean
   */
  public isGlobalWelshFlagEnabled(featureFlags: FeatureFlags): boolean {
    if (!featureFlags.welshTranslation.enabled) {
      console.warn('Unable to translate any test results: global Welsh flag disabled.');
      return false;
    }
    return true;
  }

  /**
   * Method to check if Welsh translation is enabled for the given test type.
   * @param featureFlags FeatureFlags interface
   * @param testResult string of result, PASS/PRS/FAIL
   * @returns boolean
   */
  public isTestResultFlagEnabled(testResult: TEST_RESULTS, featureFlags: FeatureFlags): boolean {
    let shouldTranslate: boolean = false;
    switch (testResult) {
      case TEST_RESULTS.PRS:
        shouldTranslate = featureFlags.welshTranslation.translatePrsTestResult ?? false;
        break;
      case TEST_RESULTS.PASS:
        shouldTranslate = featureFlags.welshTranslation.translatePassTestResult ?? false;
        break;
      case TEST_RESULTS.FAIL:
        shouldTranslate = featureFlags.welshTranslation.translateFailTestResult ?? false;
        break;
      default:
        console.warn('Translation not available for this test result type.');
        return shouldTranslate;
    }
    if (!shouldTranslate) {
      console.warn(`Unable to translate for test result: ${testResult} flag disabled`);
    }
    return shouldTranslate;
  }
}
