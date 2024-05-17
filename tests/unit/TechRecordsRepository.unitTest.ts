import 'reflect-metadata';

/* eslint-disable import/first */
const mockGetProfile = jest.fn();

import Container from 'typedi';
import { cloneDeep } from 'lodash';
import { LambdaService } from '../../src/services/LambdaService';
import techRecordsRwtSearch from '../resources/tech-records-response-rwt-search.json';
import techRecordsRwt from '../resources/tech-records-response-rwt.json';
import techRecordsRwtHgv from '../resources/tech-records-response-rwt-hgv.json';
import techRecordsRwtHgvSearch from '../resources/tech-records-response-rwt-hgv-search.json';
import techRecordsPsv from '../resources/tech-records-response-PSV.json';
import techRecordsSearchPsv from '../resources/tech-records-response-search-PSV.json';
import { S3BucketService } from '../../src/services/S3BucketService';
import { S3BucketMockService } from '../models/S3BucketMockService';
import { LambdaMockService } from '../models/LambdaMockService';
import { TechRecordsRepository } from '../../src/services/TechRecordsRepository';
import { TechRecordsService } from '../../src/services/TechRecordsService';

jest.mock('@dvsa/cvs-microservice-common/feature-flags/profiles/vtx', () => ({
  getProfile: mockGetProfile,
}));

describe('Certificate Generation Service', () => {
  Container.set(S3BucketService, new S3BucketMockService());
  Container.set(LambdaService, new LambdaMockService());

  describe('getVehicleMakeAndModel function', () => {
    const techRecordsRepository = Container.get(TechRecordsRepository);
    const searchTechRecordsSpy = jest.spyOn(techRecordsRepository, 'callSearchTechRecords');
    const callGetTechRecordSpy = jest.spyOn(techRecordsRepository, 'callGetTechRecords');

    const techRecordsService = Container.get(TechRecordsService);

    afterEach(() => {
      searchTechRecordsSpy.mockReset();
      callGetTechRecordSpy.mockReset();
    });

    context('when given a systemNumber with matching record', () => {
      it('should return the record & only invoke the LambdaService once', async () => {
        searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);
        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

        const testResultMock = {
          systemNumber: '12345678',
        };

        const makeAndModel = await techRecordsService.getVehicleMakeAndModel(
          testResultMock,
        );

        expect(makeAndModel).toEqual({ Make: 'STANLEY', Model: 'AUTOTRL' });
      });
    });

    context('when given a systemNumber  with no matching record and a vin with matching record', () => {
      it('should return the record & invoke the LambdaService twice', async () => {
        searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);
        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

        const testResultMock = {
          systemNumber: '134567889',
          vin: 'abc123',
        };

        const makeAndModel = await techRecordsService.getVehicleMakeAndModel(
          testResultMock,
        );

        expect(makeAndModel).toEqual({ Make: 'STANLEY', Model: 'AUTOTRL' });
      });
    });

    context('when given a vin with no matching record but a matching partialVin', () => {
      it('should return the record & invoke the LambdaService twice', async () => {
        searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

        const testResultMock = {
          vin: 'abc123',
          partialVin: 'abc123',
        };

        const makeAndModel = await techRecordsService.getVehicleMakeAndModel(
          testResultMock,
        );

        expect(makeAndModel).toEqual({ Make: 'STANLEY', Model: 'AUTOTRL' });
      });
    });

    context(
      'when given a vin and partialVin with no matching record but a matching VRM',
      () => {
        it('should return the record & invoke the LambdaService three times', async () => {
          searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

          const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
          callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

          const testResultMock = {
            vin: 'abc123',
            partialVin: 'abc123',
            vrm: 'testvrm',
          };

          const makeAndModel = await techRecordsService.getVehicleMakeAndModel(
            testResultMock,
          );

          expect(makeAndModel).toEqual({ Make: 'STANLEY', Model: 'AUTOTRL' });
        });
      },
    );

    context('when given a vin, partialVin and VRM with no matching record but a matching TrailerID', () => {
      it('should return the record & invoke the LambdaService four times', async () => {
        searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

        const testResultMock = {
          vin: 'abc123',
          partialVin: 'abc123',
          vrm: 'testvrm',
          trailerId: 'testTrailerId',
        };

        const makeAndModel = await techRecordsService.getVehicleMakeAndModel(
          testResultMock,
        );

        expect(makeAndModel).toEqual({ Make: 'STANLEY', Model: 'AUTOTRL' });
      });
    });

    context('when given a vehicle details with no matching records', () => {
      it('should call Tech Records Lambda 4 times and then throw an error', async () => {
        searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

        const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
        callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

        const testResultMock = {
          vin: 'abc123',
          partialVin: 'abc123',
          vrm: 'testvrm',
          trailerId: 'testTrailerId',
        };
        try {
          await techRecordsService.getVehicleMakeAndModel(testResultMock);
        } catch (e) {
          expect(e).toBeInstanceOf(Error);
          expect((e as Error).message).toBe(
            'Unable to retrieve unique Tech Record for Test Result',
          );
        }
      });
    });

    context(
      'when given a vehicle details with missing vehicle detail fields and no match',
      () => {
        it('should call Tech Records Lambda matching number (2) times and then throw an error', async () => {
          searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

          const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
          callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

          const testResultMock = {
            vin: 'abc123',
            trailerId: 'testTrailerId',
          };

          try {
            await techRecordsService.getVehicleMakeAndModel(testResultMock);
          } catch (e) {
            expect(e).toBeInstanceOf(Error);
            expect((e as Error).message).toBe(
              'Unable to retrieve unique Tech Record for Test Result',
            );
          }
        });
      },
    );

    context('when lookup returns a PSV tech record', () => {
      it('should return make and model from chassis details', async () => {
        searchTechRecordsSpy.mockResolvedValue(techRecordsSearchPsv);
        callGetTechRecordSpy.mockResolvedValue(techRecordsPsv as any);

        const testResultMock = {
          systemNumber: '12345678',
        };

        const makeAndModel = await techRecordsService.getVehicleMakeAndModel(
          testResultMock,
        );

        expect(makeAndModel.Make).toBe('AEC');
        expect(makeAndModel.Model).toBe('RELIANCE');
      });
    });

    context('when lookup returns a non-PSV tech record', () => {
      it('should return make and model from not-chassis details', async () => {
        searchTechRecordsSpy.mockResolvedValue(techRecordsRwtHgvSearch);
        callGetTechRecordSpy.mockResolvedValue(techRecordsRwtHgv as any);

        const testResultMock = {
          systemNumber: '12345678',
        };

        const makeAndModel = await techRecordsService.getVehicleMakeAndModel(
          testResultMock,
        );

        expect(makeAndModel.Make).toBe('Isuzu');
        expect(makeAndModel.Model).toBe('FM');
      });
    });
  });
});
