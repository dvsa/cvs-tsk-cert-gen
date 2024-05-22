import 'reflect-metadata';

import Container from 'typedi';
import { LOCATION_ENGLISH, LOCATION_WELSH } from '../../src/models/Enums';
import { TranslationService } from '../../src/services/TranslationService';

describe('TranslationService', () => {
  context('test convertLocationWelsh method', () => {
    it('should return the translated location value', () => {
      const translationService = Container.get(TranslationService);

      const welshLocation1 = translationService.convertLocationWelsh(
        LOCATION_ENGLISH.FRONT,
      );
      const welshLocation2 = translationService.convertLocationWelsh(
        LOCATION_ENGLISH.REAR,
      );
      const welshLocation3 = translationService.convertLocationWelsh(
        LOCATION_ENGLISH.UPPER,
      );
      const welshLocation4 = translationService.convertLocationWelsh(
        LOCATION_ENGLISH.LOWER,
      );
      const welshLocation5 = translationService.convertLocationWelsh(
        LOCATION_ENGLISH.NEARSIDE,
      );
      const welshLocation6 = translationService.convertLocationWelsh(
        LOCATION_ENGLISH.OFFSIDE,
      );
      const welshLocation7 = translationService.convertLocationWelsh(
        LOCATION_ENGLISH.CENTRE,
      );
      const welshLocation8 = translationService.convertLocationWelsh(
        LOCATION_ENGLISH.INNER,
      );
      const welshLocation9 = translationService.convertLocationWelsh(
        LOCATION_ENGLISH.OUTER,
      );
      const welshLocation10 = translationService.convertLocationWelsh('mockLocation' as LOCATION_ENGLISH);
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
});
