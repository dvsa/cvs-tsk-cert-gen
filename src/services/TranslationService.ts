import { Service } from 'typedi';
import { LOCATION_ENGLISH, LOCATION_WELSH } from '../models/Enums';

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
}
