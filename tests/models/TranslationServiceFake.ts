import { Service } from 'typedi';
import { TranslationService } from '../../src/services/TranslationService';
import { ITestResult } from '../../src/models/ITestResult';

/**
 * Fake for feature flags
 */

@Service()
export class TranslationServiceFake extends TranslationService {
  public shouldTranslateTestResult(testResult: ITestResult): Promise<boolean> {
    return Promise.resolve(true);
  }
}
