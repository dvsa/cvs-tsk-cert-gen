import { Service } from 'typedi';
import { TranslationService } from '../../src/services/TranslationService';

/**
 * Fake for feature flags
 */

@Service()
export class TranslationServiceFake extends TranslationService {
  public shouldTranslateTestResult(testResult: any): Promise<boolean> {
    return Promise.resolve(true);
  }
}
