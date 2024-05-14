import 'reflect-metadata';

/* eslint-disable import/first */
const mockGetProfile = jest.fn();

import * as fs from 'fs';
import * as path from 'path';
import { Container } from 'typedi';
import sinon from 'sinon';
import { cloneDeep } from 'lodash';
import { FeatureFlags } from '@dvsa/cvs-microservice-common/feature-flags/profiles/vtx';
import {
  CertificateGenerationService,
  IGeneratedCertificateResponse,
} from '../../src/services/CertificateGenerationService';
import { S3BucketMockService } from '../models/S3BucketMockService';
import { LambdaMockService } from '../models/LambdaMockService';
import { CertificateUploadService } from '../../src/services/CertificateUploadService';
import techRecordsRwt from '../resources/tech-records-response-rwt.json';

const sandbox = sinon.createSandbox();
import techRecordsRwtSearch from '../resources/tech-records-response-rwt-search.json';
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

  const certificateGenerationService = Container.get(CertificateGenerationService);

  beforeAll(() => {
    jest.setTimeout(10000);
  });

  afterAll(() => {
    sandbox.restore();
    jest.setTimeout(5000);
  });

  beforeEach(() => {
    const featureFlags: FeatureFlags = {
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

  context('CertificateUploadService', () => {
    LambdaMockService.populateFunctions();

    context('when a valid event is received', () => {
      const event: any = JSON.parse(
        fs.readFileSync(
          path.resolve(__dirname, '../resources/queue-event-prs.json'),
          'utf8',
        ),
      );
      const testResult: any = JSON.parse(event.Records[0].body);
      const certificateUploadService = Container.get(CertificateUploadService);

      context('when uploading a certificate', () => {
        context('and the S3 bucket exists and is accesible', () => {
          it('should successfully upload the certificate', async () => {
            const getTechRecordSearchStub = sandbox
              .stub(certificateGenerationService, 'callSearchTechRecords')
              .resolves(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            const getTechRecordStub = sandbox
              .stub(certificateGenerationService, 'callGetTechRecords')
              .resolves((techRecordResponseRwtMock) as any);

            const generatedCertificateResponse: IGeneratedCertificateResponse = await certificateGenerationService.generateCertificate(
              testResult,
            );
            S3BucketMockService.buckets.push({
              bucketName: `cvs-cert-${process.env.BUCKET}`,
              files: [],
            });

            return certificateUploadService
              .uploadCertificate(generatedCertificateResponse)
              .then((response: any) => {
                expect(response.Key).toBe(
                  `${process.env.BRANCH}/${generatedCertificateResponse.fileName}`,
                );
                getTechRecordStub.restore();
                getTechRecordSearchStub.restore();
                S3BucketMockService.buckets.pop();
              });
          });
        });

        context('and the S3 bucket does not exist or is not accesible', () => {
          it('should throw an error', async () => {
            const getTechRecordSearchStub = sandbox
              .stub(certificateGenerationService, 'callSearchTechRecords')
              .resolves(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            const getTechRecordStub = sandbox
              .stub(certificateGenerationService, 'callGetTechRecords')
              .resolves((techRecordResponseRwtMock) as any);

            const generatedCertificateResponse: IGeneratedCertificateResponse = await certificateGenerationService.generateCertificate(
              testResult,
            );
            expect.assertions(1);
            return certificateUploadService
              .uploadCertificate(generatedCertificateResponse)
              .catch((error: any) => {
                expect(error).toBeInstanceOf(Error);
                getTechRecordStub.restore();
                getTechRecordSearchStub.restore();
              });
          });
        });
      });
    });
  });
});
