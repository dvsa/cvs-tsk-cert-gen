import 'reflect-metadata';

/* eslint-disable import/first */
const mockGetProfile = jest.fn();

import Container from 'typedi';
import sinon from 'sinon';
import { CertificateUploadService } from '../../src/services/CertificateUploadService';
import { S3BucketMockService } from '../models/S3BucketMockService';
import { LambdaMockService } from '../models/LambdaMockService';
import { CertGenReturn, certGen } from '../../src/functions/certGen';
import queueEventFail from '../resources/queue-event-fail.json';
import cancelledEvent from '../resources/queue-event-cancelled.json';

const sandbox = sinon.createSandbox();
import { IFeatureFlags } from '../../src/models';
import { S3BucketService } from '../../src/services/S3BucketService';
import { LambdaService } from '../../src/services/LambdaService';

jest.mock('@dvsa/cvs-microservice-common/feature-flags/profiles/vtx', () => ({
  getProfile: mockGetProfile,
}));

describe('cert-gen', () => {
  it('should pass', () => {
    expect(true).toBe(true);
  });

  Container.set(S3BucketService, new S3BucketMockService());
  Container.set(LambdaService, new LambdaMockService());

  beforeAll(() => {
    jest.setTimeout(10000);
  });

  afterAll(() => {
    sandbox.restore();
    jest.setTimeout(5000);
  });

  beforeEach(() => {
    const featureFlags: IFeatureFlags = {
      welshTranslation: {
        enabled: false,
        translatePassTestResult: false,
        translatePrsTestResult: false,
        translateFailTestResult: false,
      },
    };

    mockGetProfile.mockReturnValue(Promise.resolve(featureFlags));
  });

  afterEach(() => {
    sandbox.restore();
  });

  context('CertGen function', () => {
    context('when a failing test result is read from the queue', () => {
      const event: any = { ...queueEventFail };
      context('and the testResultId is malformed', () => {
        it('should thrown an error', async () => {
          expect.assertions(1);
          try {
            await certGen(event, undefined as any, () => {

            });
          } catch (err) {
            expect((err as Error).message).toBe('Bad Test Record: 1');
          }
        });
      });

      context('and the event is undefiend', () => {
        it('should thrown an error', async () => {
          expect.assertions(1);
          try {
            await certGen(undefined, undefined as any, () => {

            });
          } catch (err) {
            expect((err as Error).message).toBe('Event is empty');
          }
        });
      });

      context('and the event is empty', () => {
        it('should thrown an error', async () => {
          expect.assertions(1);
          try {
            await certGen({}, undefined as any, () => {

            });
          } catch (err) {
            expect((err as Error).message).toBe('Event is empty');
          }
        });
      });

      context('and the event has no records', () => {
        it('should thrown an error', async () => {
          expect.assertions(1);
          try {
            await certGen(
              { otherStuff: 'hi', Records: [] },
              undefined as any,
              () => {

              },
            );
          } catch (err) {
            expect((err as Error).message).toBe('Event is empty');
          }
        });
      });
    });

    context('and the event is valid', () => {
      it('should cancel an existing record', async () => {
        const uploadMock = jest.fn();
        Container.set(CertificateUploadService, { removeCertificate: uploadMock });

        const result = await certGen(cancelledEvent, undefined as any, undefined as any);

        expect(result).toHaveLength(1);
        cancelledEvent.Records.forEach((record: any) => {
          const expected = JSON.parse(record.body);
          expect(uploadMock).toHaveBeenCalledWith(expected);
        });
      });
    });
  });
});
