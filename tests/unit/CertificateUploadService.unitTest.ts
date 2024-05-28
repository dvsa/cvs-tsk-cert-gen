import 'reflect-metadata';

/* eslint-disable import/first */
const mockGetProfile = jest.fn();

import * as fs from 'fs';
import * as path from 'path';
import { Container } from 'typedi';
import sinon from 'sinon';
import cloneDeep from 'lodash.clonedeep';
import { FeatureFlags } from '@dvsa/cvs-microservice-common/feature-flags/profiles/vtx';
import {
  CertificateGenerationService,
  IGeneratedCertificateResponse,
} from '../../src/services/CertificateGenerationService';
import { S3BucketMockService } from '../models/S3BucketMockService';
import { LambdaMockService } from '../models/LambdaMockService';
import { CertificateUploadService } from '../../src/services/CertificateUploadService';
import techRecordsRwt from '../resources/tech-records-response-rwt.json';
import techRecordsRwtSearch from '../resources/tech-records-response-rwt-search.json';
import { S3BucketService } from '../../src/services/S3BucketService';
import { LambdaService } from '../../src/services/LambdaService';
import { TechRecordsRepository } from '../../src/repositories/TechRecordsRepository';

const sandbox = sinon.createSandbox();

jest.mock('@dvsa/cvs-microservice-common/feature-flags/profiles/vtx', () => ({
  getProfile: mockGetProfile,
}));

describe('cert-gen', () => {
  it('should pass', () => {
    expect(true).toBe(true);
  });

  Container.set(S3BucketService, new S3BucketMockService());
  Container.set(LambdaService, new LambdaMockService());

  const techRecordsRepository = Container.get(TechRecordsRepository);
  const searchTechRecordsSpy = jest.spyOn(techRecordsRepository, 'callSearchTechRecords');
  const callGetTechRecordSpy = jest.spyOn(techRecordsRepository, 'callGetTechRecords');
  Container.set(TechRecordsRepository, techRecordsRepository);

  const certificateGenerationService = Container.get(CertificateGenerationService);

  beforeAll(() => {
    LambdaMockService.populateFunctions();
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
    searchTechRecordsSpy.mockReset();
    callGetTechRecordSpy.mockReset();
  });

  context('CertificateUploadService', () => {
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
            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);
            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);

            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

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
                S3BucketMockService.buckets.pop();
              });
          });
        });

        context('and the S3 bucket does not exist or is not accesible', () => {
          it('should throw an error', async () => {
            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            const certificateMock = {
              fileName: 'certificate-filename.pdf',
              certificateOrder: testResult.order,
            } as IGeneratedCertificateResponse;

            expect.assertions(1);

            return certificateUploadService
              .uploadCertificate(certificateMock)
              .catch((error: any) => {
                expect(error).toBeInstanceOf(Error);
              });
          });
        });
      });
    });
  });
});
