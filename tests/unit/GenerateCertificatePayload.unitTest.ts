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
import queueEventPass from '../resources/queue-event-pass.json';
import queueEventFail from '../resources/queue-event-fail.json';
import queueEventFailPRS from '../resources/queue-event-fail-prs.json';
import queueEventPRS from '../resources/queue-event-prs.json';
import techRecordsRwt from '../resources/tech-records-response-rwt.json';
import docGenRwt from '../resources/doc-gen-payload-rwt.json';
import docGenIva30 from '../resources/doc-gen-payload-iva30.json';
import docGenMsva30 from '../resources/doc-gen-payload-msva30.json';

const sandbox = sinon.createSandbox();
import { ITestResult } from '../../src/models/ITestResult';
import { ICertificatePayload } from '../../src/models/ICertificatePayload';
import techRecordsRwtSearch from '../resources/tech-records-response-rwt-search.json';
import techRecordsRwtHgv from '../resources/tech-records-response-rwt-hgv.json';
import techRecordsRwtHgvSearch from '../resources/tech-records-response-rwt-hgv-search.json';
import techRecordsPsv from '../resources/tech-records-response-PSV.json';
import techRecordsSearchPsv from '../resources/tech-records-response-search-PSV.json';
import { CERTIFICATE_DATA } from '../../src/models/Enums';
import { S3BucketService } from '../../src/services/S3BucketService';
import { LambdaService } from '../../src/services/LambdaService';
import { TechRecordsRepository } from '../../src/repositories/TechRecordsRepository';
import { CertificatePayloadGenerator } from '../../src/services/CertificatePayloadGenerator';
import { TrailerRepository } from '../../src/repositories/TrailerRepository';
import { TestResultRepository } from '../../src/repositories/TestResultRepository';
import { DefectService } from '../../src/services/DefectService';
import { DefectRepository } from '../../src/services/DefectRepository';

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

  const trailerRepository = Container.get(TrailerRepository);
  const getTrailerRegistrationStub = jest.spyOn(trailerRepository, 'getTrailerRegistrationObject');
  Container.set(TrailerRepository, trailerRepository);

  const testResultRepository = Container.get(TestResultRepository);
  const getOdometerSpy = jest.spyOn(testResultRepository, 'getOdometerHistory');
  Container.set(TestResultRepository, testResultRepository);

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
    searchTechRecordsSpy.mockClear();
    callGetTechRecordSpy.mockClear();
    getTrailerRegistrationStub.mockClear();
    getOdometerSpy.mockClear();
  });

  context('CertificateGenerationService', () => {
    LambdaMockService.populateFunctions();

    context('when a passing test result is read from the queue', () => {
      const event: any = { ...queueEventPass };
      const testResult: any = JSON.parse(event.Records[3].body);
      const testResult2: any = JSON.parse(event.Records[4].body);

      context('and a payload is generated', () => {
        context('and no signatures were found in the bucket', () => {
          it('should return a VTP20 payload without signature and the issuers name should have been swapped', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'Dev1 CVS',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'XMGDE02FS0H012345',
                RawVRM: 'BQ91YHQ',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '26.12.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                Make: 'STANLEY',
                Model: 'AUTOTRL',
                OdometerHistoryList: [
                  {
                    value: 400000,
                    unit: 'kilometres',
                    date: '19.01.2019',
                  },
                  {
                    value: 390000,
                    unit: 'kilometres',
                    date: '18.01.2019',
                  },
                  {
                    value: 380000,
                    unit: 'kilometres',
                    date: '17.01.2019',
                  },
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(testResult)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });
        context('and no signatures were found in the bucket', () => {
          it('should return a VTP20 payload without signature and the issuers name should have not been swapped', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS, Test, Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'XMGDE02FS0H012345',
                RawVRM: 'BQ91YHQ',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '26.12.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                Make: 'STANLEY',
                Model: 'AUTOTRL',
                OdometerHistoryList: [
                  {
                    value: 400000,
                    unit: 'kilometres',
                    date: '19.01.2019',
                  },
                  {
                    value: 390000,
                    unit: 'kilometres',
                    date: '18.01.2019',
                  },
                  {
                    value: 380000,
                    unit: 'kilometres',
                    date: '17.01.2019',
                  },
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(testResult2)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });
      });
    });

    context('when a passing test result is read from the queue', () => {
      const event: any = { ...queueEventPass };
      const testResult: any = JSON.parse(event.Records[0].body);

      context('and a payload is generated', () => {
        context('and no signatures were found in the bucket', () => {
          it('should return a VTP20 payload without signature', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'XMGDE02FS0H012345',
                RawVRM: 'BQ91YHQ',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '26.12.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                Make: 'STANLEY',
                Model: 'AUTOTRL',
                OdometerHistoryList: [
                  {
                    value: 400000,
                    unit: 'kilometres',
                    date: '19.01.2019',
                  },
                  {
                    value: 390000,
                    unit: 'kilometres',
                    date: '18.01.2019',
                  },
                  {
                    value: 380000,
                    unit: 'kilometres',
                    date: '17.01.2019',
                  },
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(testResult)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });

        context('and lambda-to-lambda calls were unsuccessful', () => {
          it('should return a VTP20 payload without bodyMake, bodyModel and odometer history', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'XMGDE02FS0H012345',
                RawVRM: 'BQ91YHQ',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '26.12.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);

            // @ts-ignore
            delete techRecordResponseRwtMock.techRecord_make;
            // @ts-ignore
            delete techRecordResponseRwtMock.techRecord_model;
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            // Make the functions return undefined
            // Stub CertificateGenerationService getOdometerHistory method to return undefined value.
            getOdometerSpy.mockResolvedValueOnce(undefined as any);

            return certificateGenerationService
              .generatePayload(testResult)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });

        context('and signatures were found in the bucket', () => {
          it('should return a VTP20 payload with signature', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'XMGDE02FS0H012345',
                RawVRM: 'BQ91YHQ',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '26.12.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                Make: 'STANLEY',
                Model: 'AUTOTRL',
                OdometerHistoryList: [
                  {
                    value: 400000,
                    unit: 'kilometres',
                    date: '19.01.2019',
                  },
                  {
                    value: 390000,
                    unit: 'kilometres',
                    date: '18.01.2019',
                  },
                  {
                    value: 380000,
                    unit: 'kilometres',
                    date: '17.01.2019',
                  },
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: fs
                  .readFileSync(
                    path.resolve(__dirname, '../resources/signatures/1.base64'),
                  )
                  .toString(),
              },
            };
            // Add a new signature
            S3BucketMockService.buckets.push({
              bucketName: `cvs-signature-${process.env.BUCKET}`,
              files: ['1.base64'],
            });

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(testResult)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
                // Remove the signature
                S3BucketMockService.buckets.pop();
              });
          });
        });
      });

      context(
        'and the generated payload is used to call the MOT service',
        () => {
          it('successfully generate a certificate', async () => {
            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            expect.assertions(3);
            return certificateGenerationService
              .generateCertificate(testResult)
              .then((response: any) => {
                expect(response.fileName).toBe(
                  'W01A00310_XMGDE02FS0H012345.pdf',
                );
                expect(response.certificateType).toBe('VTP20');
                expect(response.certificateOrder).toEqual({
                  current: 1,
                  total: 2,
                });
              });
          });
        },
      );
    });

    context('when a passing test result is read from the queue', () => {
      const event: any = { ...queueEventPass };
      const testResultWithTestHistoryForResult: any = JSON.parse(event.Records[5].body);
      const testResultWithTestHistoryForSomeotherResult: any = JSON.parse(event.Records[6].body);

      context('and the result has testHistory', () => {
        context('and the testHistory has history for the test result', () => {
          it('should return a VTP20 payload with Reissue populated', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'XMGDE02FS0H012345',
                RawVRM: 'BQ91YHQ',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '26.12.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                Make: 'STANLEY',
                Model: 'AUTOTRL',
                OdometerHistoryList: [
                  {
                    value: 400000,
                    unit: 'kilometres',
                    date: '19.01.2019',
                  },
                  {
                    value: 390000,
                    unit: 'kilometres',
                    date: '18.01.2019',
                  },
                  {
                    value: 380000,
                    unit: 'kilometres',
                    date: '17.01.2019',
                  },
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
              Reissue: {
                Reason: 'Replacement',
                Issuer: 'Joe Smith',
                Date: '14.12.2022',
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(testResultWithTestHistoryForResult)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });

        context('and the testHistory has history for an unrelated test result', () => {
          it('should return a VTP20 payload with no Reissue set', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'XMGDE02FS0H012345',
                RawVRM: 'BQ91YHQ',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '26.12.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                Make: 'STANLEY',
                Model: 'AUTOTRL',
                OdometerHistoryList: [
                  {
                    value: 400000,
                    unit: 'kilometres',
                    date: '19.01.2019',
                  },
                  {
                    value: 390000,
                    unit: 'kilometres',
                    date: '18.01.2019',
                  },
                  {
                    value: 380000,
                    unit: 'kilometres',
                    date: '17.01.2019',
                  },
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(testResultWithTestHistoryForSomeotherResult)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });
      });
    });

    context('when a passing test result is read from the queue', () => {
      const event: any = { ...queueEventPass };
      const hgvTestResultWithMinorDefect: any = JSON.parse(event.Records[7].body);
      const hgvTestResultWithAdvisoryDefect: any = JSON.parse(event.Records[8].body);

      const trlTestResultWithMinorDefect: any = JSON.parse(event.Records[9].body);
      const trlTestResultWithAdvisoryDefect: any = JSON.parse(event.Records[10].body);

      const psvTestResultWithMinorDefect: any = JSON.parse(event.Records[11].body);
      const psvTestResultWithAdvisoryDefect: any = JSON.parse(event.Records[12].body);

      context('and the hgv result has a minor defect', () => {
        context('and the test station location is not in Wales', () => {
          it('should return a VTG5 payload without the MinorDefectsWelsh array populated', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'P012301098765',
                RawVRM: 'VM14MDT',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '01.11.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                Make: 'Isuzu',
                MinorDefects: [
                  '62.1.a.i Reflectors, conspicuity markings and/or rear markers: incorrectly positioned. Nearside Front.',
                ],
                Model: 'FM',
                OdometerHistoryList: [
                  {
                    value: 400000,
                    unit: 'kilometres',
                    date: '19.01.2019',
                  },
                  {
                    value: 390000,
                    unit: 'kilometres',
                    date: '18.01.2019',
                  },
                  {
                    value: 380000,
                    unit: 'kilometres',
                    date: '17.01.2019',
                  },
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtHgvSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(hgvTestResultWithMinorDefect)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });

          context('and the test station location is in Wales', () => {
            it('should return a VTG5 payload with the MinorDefectsWelsh array populated', async () => {
              const expectedResult: any = {
                Watermark: 'NOT VALID',
                DATA: {
                  TestNumber: 'W01A00310',
                  TestStationPNumber: '09-4129632',
                  TestStationName: 'Abshire-Kub',
                  CurrentOdometer: {
                    value: 12312,
                    unit: 'kilometres',
                  },
                  IssuersName: 'CVS Dev1',
                  DateOfTheTest: '26.02.2019',
                  CountryOfRegistrationCode: 'gb',
                  VehicleEuClassification: 'M1',
                  RawVIN: 'P012301098765',
                  RawVRM: 'VM14MDT',
                  ExpiryDate: '25.02.2020',
                  EarliestDateOfTheNextTest: '01.11.2019',
                  SeatBeltTested: 'Yes',
                  SeatBeltPreviousCheckDate: '26.02.2019',
                  SeatBeltNumber: 2,
                  Make: 'Isuzu',
                  MinorDefects: [
                    '62.1.a.i Reflectors, conspicuity markings and/or rear markers: incorrectly positioned. Nearside Front.',
                  ],
                  MinorDefectsWelsh: [
                    "62.1.a.i Adlewyrchwyr, marciau amlygrwydd a/neu farcwyr cefn: wedi'i leoli'n anghywir. Ochr mewnol Blaen.",
                  ],
                  Model: 'FM',
                  OdometerHistoryList: [
                    {
                      value: 400000,
                      unit: 'kilometres',
                      date: '19.01.2019',
                    },
                    {
                      value: 390000,
                      unit: 'kilometres',
                      date: '18.01.2019',
                    },
                    {
                      value: 380000,
                      unit: 'kilometres',
                      date: '17.01.2019',
                    },
                  ],
                },
                Signature: {
                  ImageType: 'png',
                  ImageData: null,
                },
              };

              searchTechRecordsSpy.mockResolvedValue(techRecordsRwtHgvSearch);

              const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
              callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

              return certificateGenerationService
                .generatePayload(hgvTestResultWithMinorDefect, true)
                .then((payload: any) => {
                  expect(payload).toEqual(expectedResult);
                });
            });
          });
        });
      });

      context('and the hgv result has an advisory defect', () => {
        context('and the test station location is not in Wales', () => {
          it('should return a VTG5 payload without the AdvisoryDefectsWelsh array populated', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'P012301098765',
                RawVRM: 'VM14MDT',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '01.11.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                Make: 'Isuzu',
                AdvisoryDefects: [
                  '1.1 A registration plate: Note one',
                ],
                Model: 'FM',
                OdometerHistoryList: [
                  {
                    value: 400000,
                    unit: 'kilometres',
                    date: '19.01.2019',
                  },
                  {
                    value: 390000,
                    unit: 'kilometres',
                    date: '18.01.2019',
                  },
                  {
                    value: 380000,
                    unit: 'kilometres',
                    date: '17.01.2019',
                  },
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtHgvSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(hgvTestResultWithAdvisoryDefect)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });
        context('and the test station location is in Wales', () => {
          it('should return a VTG5 payload with the AdvisoryDefectsWelsh array populated', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'P012301098765',
                RawVRM: 'VM14MDT',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '01.11.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                Make: 'Isuzu',
                AdvisoryDefects: [
                  '1.1 A registration plate: Note one',
                ],
                AdvisoryDefectsWelsh: [
                  '1.1 A registration plate: Note one',
                ],
                Model: 'FM',
                OdometerHistoryList: [
                  {
                    value: 400000,
                    unit: 'kilometres',
                    date: '19.01.2019',
                  },
                  {
                    value: 390000,
                    unit: 'kilometres',
                    date: '18.01.2019',
                  },
                  {
                    value: 380000,
                    unit: 'kilometres',
                    date: '17.01.2019',
                  },
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtHgvSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(hgvTestResultWithAdvisoryDefect, true)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });
      });

      context('and the trl result has a minor defect', () => {
        context('and the test station location is not in Wales', () => {
          it('should return a VTG5A payload without the MinorDefectsWelsh array populated', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'T12876765',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '01.11.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                Make: 'STANLEY',
                Model: 'AUTOTRL',
                MinorDefects: [
                  '62.1.a.i Reflectors, conspicuity markings and/or rear markers: incorrectly positioned. Nearside Front.',
                ],
                Trn: 'ABC123',
                IsTrailer: true,
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(trlTestResultWithMinorDefect)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });
        context('and the test station location is in Wales', () => {
          it('should return a VTG5A payload with the MinorDefectsWelsh array populated', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'T12876765',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '01.11.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                Make: 'STANLEY',
                Model: 'AUTOTRL',
                MinorDefects: [
                  '62.1.a.i Reflectors, conspicuity markings and/or rear markers: incorrectly positioned. Nearside Front.',
                ],
                MinorDefectsWelsh: [
                  "62.1.a.i Adlewyrchwyr, marciau amlygrwydd a/neu farcwyr cefn: wedi'i leoli'n anghywir. Ochr mewnol Blaen.",
                ],
                Trn: 'ABC123',
                IsTrailer: true,
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(trlTestResultWithMinorDefect, true)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });
      });

      context('and the trl result has an advisory defect', () => {
        context('and the test station location is not in Wales', () => {
          it('should return a VTG5A payload without the AdvisoryDefectsWelsh array populated', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'T12876765',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '01.11.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                Make: 'STANLEY',
                Model: 'AUTOTRL',
                AdvisoryDefects: [
                  '1.1 A registration plate: Note one',
                ],
                Trn: 'ABC123',
                IsTrailer: true,
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(trlTestResultWithAdvisoryDefect)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });
        context('and the test station location is in Wales', () => {
          it('should return a VTG5A payload with the AdvisoryDefectsWelsh array populated', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'T12876765',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '01.11.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                Make: 'STANLEY',
                Model: 'AUTOTRL',
                AdvisoryDefects: [
                  '1.1 A registration plate: Note one',
                ],
                AdvisoryDefectsWelsh: [
                  '1.1 A registration plate: Note one',
                ],
                Trn: 'ABC123',
                IsTrailer: true,
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(trlTestResultWithAdvisoryDefect, true)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });
      });

      context('and the psv result has a minor defect', () => {
        context('and the test station location is not in Wales', () => {
          it('should return a VTP20 payload without the MinorDefectsWelsh array populated', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS, Test, Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'XMGDE02FS0H012345',
                RawVRM: 'BQ91YHQ',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '26.12.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                Make: 'AEC',
                MinorDefects: [
                  '62.1.a.i Reflectors, conspicuity markings and/or rear markers: incorrectly positioned. Nearside Front.',
                ],
                Model: 'RELIANCE',
                OdometerHistoryList: [
                  {
                    value: 400000,
                    unit: 'kilometres',
                    date: '19.01.2019',
                  },
                  {
                    value: 390000,
                    unit: 'kilometres',
                    date: '18.01.2019',
                  },
                  {
                    value: 380000,
                    unit: 'kilometres',
                    date: '17.01.2019',
                  },
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsSearchPsv);

            const techRecordResponseRwtMock = cloneDeep(techRecordsPsv);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(psvTestResultWithMinorDefect)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });
        context('and the test station location is in Wales', () => {
          it('should return a VTP20 payload with the MinorDefectsWelsh array populated', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS, Test, Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'XMGDE02FS0H012345',
                RawVRM: 'BQ91YHQ',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '26.12.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                Make: 'AEC',
                MinorDefects: [
                  '62.1.a.i Reflectors, conspicuity markings and/or rear markers: incorrectly positioned. Nearside Front.',
                ],
                MinorDefectsWelsh: [
                  "62.1.a.i Adlewyrchwyr, marciau amlygrwydd a/neu farcwyr cefn: wedi'i leoli'n anghywir. Ochr mewnol Blaen.",
                ],
                Model: 'RELIANCE',
                OdometerHistoryList: [
                  {
                    value: 400000,
                    unit: 'kilometres',
                    date: '19.01.2019',
                  },
                  {
                    value: 390000,
                    unit: 'kilometres',
                    date: '18.01.2019',
                  },
                  {
                    value: 380000,
                    unit: 'kilometres',
                    date: '17.01.2019',
                  },
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsSearchPsv);

            const techRecordResponseRwtMock = cloneDeep(techRecordsPsv);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(psvTestResultWithMinorDefect, true)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });
      });

      context('and the psv result has an advisory defect', () => {
        context('and the test station location is not in Wales', () => {
          it('should return a VTP20 payload without the AdvisoryDefectsWelsh array populated', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              DATA: {
                AdvisoryDefects: [
                  '1.1 A registration plate: Notes here',
                  '6.3 A hub: Second advisory note',
                ],
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS, Test, Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'XMGDE02FS0H012345',
                RawVRM: 'BQ91YHQ',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '26.12.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                Make: 'AEC',
                Model: 'RELIANCE',
                OdometerHistoryList: [
                  {
                    value: 400000,
                    unit: 'kilometres',
                    date: '19.01.2019',
                  },
                  {
                    value: 390000,
                    unit: 'kilometres',
                    date: '18.01.2019',
                  },
                  {
                    value: 380000,
                    unit: 'kilometres',
                    date: '17.01.2019',
                  },
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsSearchPsv);

            const techRecordResponseRwtMock = cloneDeep(techRecordsPsv);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(psvTestResultWithAdvisoryDefect)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });
        context('and the test station location is in Wales', () => {
          it('should return a VTP20 payload with the AdvisoryDefectsWelsh array populated', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              DATA: {
                AdvisoryDefects: [
                  '1.1 A registration plate: Notes here',
                  '6.3 A hub: Second advisory note',
                ],
                AdvisoryDefectsWelsh: [
                  '1.1 A registration plate: Notes here',
                  '6.3 A hub: Second advisory note',
                ],
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS, Test, Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'XMGDE02FS0H012345',
                RawVRM: 'BQ91YHQ',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '26.12.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                Make: 'AEC',
                Model: 'RELIANCE',
                OdometerHistoryList: [
                  {
                    value: 400000,
                    unit: 'kilometres',
                    date: '19.01.2019',
                  },
                  {
                    value: 390000,
                    unit: 'kilometres',
                    date: '18.01.2019',
                  },
                  {
                    value: 380000,
                    unit: 'kilometres',
                    date: '17.01.2019',
                  },
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsSearchPsv);

            const techRecordResponseRwtMock = cloneDeep(techRecordsPsv);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(psvTestResultWithAdvisoryDefect, true)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });
      });

      context('and the test result has a defect', () => {
        context('and the test station location is not in Wales', () => {
          it('should return a VTP20 without calling getDefect or flattenDefects methods', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS, Test, Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'XMGDE02FS0H012345',
                RawVRM: 'BQ91YHQ',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '26.12.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                Make: 'AEC',
                MinorDefects: [
                  '62.1.a.i Reflectors, conspicuity markings and/or rear markers: incorrectly positioned. Nearside Front.',
                ],
                Model: 'RELIANCE',
                OdometerHistoryList: [
                  {
                    value: 400000,
                    unit: 'kilometres',
                    date: '19.01.2019',
                  },
                  {
                    value: 390000,
                    unit: 'kilometres',
                    date: '18.01.2019',
                  },
                  {
                    value: 380000,
                    unit: 'kilometres',
                    date: '17.01.2019',
                  },
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsSearchPsv);

            const techRecordResponseRwtMock = cloneDeep(techRecordsPsv);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            const payloadGenerator = Container.get(CertificatePayloadGenerator);
            const defectService = Container.get(DefectService);
            const defectRepository = Container.get(DefectRepository);

            const defectSpy = jest.spyOn(defectRepository, 'getDefectTranslations');
            const flattenSpy = jest.spyOn(defectService, 'flattenDefectsFromApi');

            Container.set(CertificatePayloadGenerator, payloadGenerator);

            expect.assertions(3);
            return certificateGenerationService
              .generatePayload(psvTestResultWithMinorDefect)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
                expect(defectSpy).not.toHaveBeenCalled();
                expect(flattenSpy).not.toHaveBeenCalled();
              });
          });
        });
      });
    });

    context('when a failing test result is read from the queue', () => {
      const event: any = { ...queueEventFail };
      const testResult: any = JSON.parse(event.Records[0].body);

      context('and a payload is generated', () => {
        context('and no signatures were found in the bucket', () => {
          it('should return a VTP30 payload without signature', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'XMGDE02FS0H012345',
                RawVRM: 'BQ91YHQ',
                EarliestDateOfTheNextTest: '26.12.2019',
                ExpiryDate: '25.02.2020',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                DangerousDefects: [
                  '54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd',
                ],
                MinorDefects: [
                  '54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.',
                ],
                AdvisoryDefects: [
                  '5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc',
                ],
                Make: 'STANLEY',
                Model: 'AUTOTRL',
                OdometerHistoryList: [
                  {
                    value: 400000,
                    unit: 'kilometres',
                    date: '19.01.2019',
                  },
                  {
                    value: 390000,
                    unit: 'kilometres',
                    date: '18.01.2019',
                  },
                  {
                    value: 380000,
                    unit: 'kilometres',
                    date: '17.01.2019',
                  },
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(testResult)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });

        context('and lambda-to-lambda calls were unsuccessful', () => {
          it('should return a VTP30 payload without bodyMake, bodyModel and odometer history', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'XMGDE02FS0H012345',
                RawVRM: 'BQ91YHQ',
                EarliestDateOfTheNextTest: '26.12.2019',
                ExpiryDate: '25.02.2020',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                DangerousDefects: [
                  '54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd',
                ],
                MinorDefects: [
                  '54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.',
                ],
                AdvisoryDefects: [
                  '5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc',
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            // @ts-ignore
            delete techRecordResponseRwtMock.techRecord_make;
            // @ts-ignore
            delete techRecordResponseRwtMock.techRecord_model;
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            // Make the functions return undefined
            // Stub CertificateGenerationService getOdometerHistory method to return undefined value.
            getOdometerSpy.mockResolvedValueOnce(undefined as any);

            return certificateGenerationService
              .generatePayload(testResult)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });

        context('and signatures were found in the bucket', () => {
          it('should return a VTP30 payload with signature', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'XMGDE02FS0H012345',
                RawVRM: 'BQ91YHQ',
                EarliestDateOfTheNextTest: '26.12.2019',
                ExpiryDate: '25.02.2020',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                DangerousDefects: [
                  '54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd',
                ],
                MinorDefects: [
                  '54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.',
                ],
                AdvisoryDefects: [
                  '5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc',
                ],
                Make: 'STANLEY',
                Model: 'AUTOTRL',
                OdometerHistoryList: [
                  {
                    value: 400000,
                    unit: 'kilometres',
                    date: '19.01.2019',
                  },
                  {
                    value: 390000,
                    unit: 'kilometres',
                    date: '18.01.2019',
                  },
                  {
                    value: 380000,
                    unit: 'kilometres',
                    date: '17.01.2019',
                  },
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: fs
                  .readFileSync(
                    path.resolve(__dirname, '../resources/signatures/1.base64'),
                  )
                  .toString(),
              },
            };
            // Add a new signature
            S3BucketMockService.buckets.push({
              bucketName: `cvs-signature-${process.env.BUCKET}`,
              files: ['1.base64'],
            });

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(testResult)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
                // Remove the signature
                S3BucketMockService.buckets.pop();
              });
          });
        });
      });

      context(
        'and the generated payload is used to call the MOT service',
        () => {
          it('successfully generate a certificate', async () => {
            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            expect.assertions(3);
            return certificateGenerationService
              .generateCertificate(testResult)
              .then((response: any) => {
                expect(response.fileName).toBe(
                  'W01A00310_XMGDE02FS0H012345.pdf',
                );
                expect(response.certificateType).toBe('VTP30');
                expect(response.certificateOrder).toEqual({
                  current: 2,
                  total: 2,
                });
              });
          });
        },
      );
    });

    context('when a failing test result is read from the queue', () => {
      const event: any = { ...queueEventFail };
      const failWithPrsEvent: any = { ...queueEventFailPRS };
      const prsEvent: any = { ...queueEventPRS };

      const hgvFailWithDangerousDefect: any = JSON.parse(event.Records[11].body);
      const hgvFailWithMajorDefect: any = JSON.parse(event.Records[12].body);
      const hgvFailWithDangerousAndMajorDefect: any = JSON.parse(event.Records[13].body);
      const hgvFailWithAdvisoryMinorDangerousMajorDefect: any = JSON.parse(event.Records[14].body);
      const hgvFailWithDangerousDefectMajorRectified: any = JSON.parse(failWithPrsEvent.Records[3].body);
      const hgvFailWithMajorDefectDangerousRectified: any = JSON.parse(failWithPrsEvent.Records[4].body);
      const psvPrsNotAcceptableForBilingualCert: any = JSON.parse(prsEvent.Records[0].body);
      const psvFailWithDefects: any = JSON.parse(event.Records[19].body);
      const trlFailWithDangerousDefect: any = JSON.parse(event.Records[15].body);
      const trlFailWithMajorDefect: any = JSON.parse(event.Records[16].body);
      const trlFailWithDangerousAndMajorDefect: any = JSON.parse(event.Records[17].body);
      const trlFailWithAdvisoryMinorDangerousMajorDefect: any = JSON.parse(event.Records[18].body);
      const trlFailWithDangerousDefectMajorRectified: any = JSON.parse(failWithPrsEvent.Records[5].body);
      const trlFailWithMajorDefectDangerousRectified: any = JSON.parse(failWithPrsEvent.Records[6].body);

      context('and the hgv result has a dangerous defect', () => {
        context('and the test station location is not in Wales', () => {
          it('should return a VTG30 payload without the DangerousDefectsWelsh array populated', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'P012301098765',
                RawVRM: 'VM14MDT',
                EarliestDateOfTheNextTest: '26.12.2019',
                ExpiryDate: '25.02.2020',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                DangerousDefects: [
                  '54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd',
                ],
                Make: 'Isuzu',
                Model: 'FM',
                OdometerHistoryList: [
                  {
                    value: 400000,
                    unit: 'kilometres',
                    date: '19.01.2019',
                  },
                  {
                    value: 390000,
                    unit: 'kilometres',
                    date: '18.01.2019',
                  },
                  {
                    value: 380000,
                    unit: 'kilometres',
                    date: '17.01.2019',
                  },
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtHgvSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(hgvFailWithDangerousDefect)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });

        context('and the test station location is in Wales', () => {
          it('should return a VTG30W payload with the DangerousDefectsWelsh array populated', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'P012301098765',
                RawVRM: 'VM14MDT',
                EarliestDateOfTheNextTest: '26.12.2019',
                ExpiryDate: '25.02.2020',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                DangerousDefects: [
                  '54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd',
                ],
                DangerousDefectsWelsh: [
                  "54.1.a.ii Llywio pŵer: ddim yn gweithio'n gywir ac yn amlwg yn effeithio ar reolaeth llywio. Echelau: 7. Mewnol Allanol. Asdasd",
                ],
                Make: 'Isuzu',
                Model: 'FM',
                OdometerHistoryList: [
                  {
                    value: 400000,
                    unit: 'kilometres',
                    date: '19.01.2019',
                  },
                  {
                    value: 390000,
                    unit: 'kilometres',
                    date: '18.01.2019',
                  },
                  {
                    value: 380000,
                    unit: 'kilometres',
                    date: '17.01.2019',
                  },
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtHgvSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(hgvFailWithDangerousDefect, true)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });
      });

      context('and the hgv result has a major defect', () => {
        context('and the test station location is not in Wales', () => {
          it('should return a VTG30 payload without the MajorDefectsWelsh array populated', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'P012301098765',
                RawVRM: 'VM14MDT',
                EarliestDateOfTheNextTest: '26.12.2019',
                ExpiryDate: '25.02.2020',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                MajorDefects: [
                  '6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd',
                ],
                Make: 'Isuzu',
                Model: 'FM',
                OdometerHistoryList: [
                  {
                    value: 400000,
                    unit: 'kilometres',
                    date: '19.01.2019',
                  },
                  {
                    value: 390000,
                    unit: 'kilometres',
                    date: '18.01.2019',
                  },
                  {
                    value: 380000,
                    unit: 'kilometres',
                    date: '17.01.2019',
                  },
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtHgvSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(hgvFailWithMajorDefect)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });

        context('and the test station location is in Wales', () => {
          it('should return a VTG30W payload with the MajorDefectsWelsh array populated', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'P012301098765',
                RawVRM: 'VM14MDT',
                EarliestDateOfTheNextTest: '26.12.2019',
                ExpiryDate: '25.02.2020',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                MajorDefects: [
                  '6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd',
                ],
                MajorDefectsWelsh: [
                  "6.1.a Cylch cadw teiar: wedi torri neu heb ei ffitio'n iawn fel bod datgysylltiad yn debygol. Echelau: 1. Mewnol Allanol. Asdasd",
                ],
                Make: 'Isuzu',
                Model: 'FM',
                OdometerHistoryList: [
                  {
                    value: 400000,
                    unit: 'kilometres',
                    date: '19.01.2019',
                  },
                  {
                    value: 390000,
                    unit: 'kilometres',
                    date: '18.01.2019',
                  },
                  {
                    value: 380000,
                    unit: 'kilometres',
                    date: '17.01.2019',
                  },
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtHgvSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(hgvFailWithMajorDefect, true)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });
      });

      context('and the hgv result has a dangerous and major defect', () => {
        context('and the test station location is not in Wales', () => {
          it('should return a VTG30 payload without the MajorDefectsWelsh array populated', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'P012301098765',
                RawVRM: 'VM14MDT',
                EarliestDateOfTheNextTest: '26.12.2019',
                ExpiryDate: '25.02.2020',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                MajorDefects: [
                  '6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd',
                ],
                DangerousDefects: [
                  '54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd',
                ],
                Make: 'Isuzu',
                Model: 'FM',
                OdometerHistoryList: [
                  {
                    value: 400000,
                    unit: 'kilometres',
                    date: '19.01.2019',
                  },
                  {
                    value: 390000,
                    unit: 'kilometres',
                    date: '18.01.2019',
                  },
                  {
                    value: 380000,
                    unit: 'kilometres',
                    date: '17.01.2019',
                  },
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtHgvSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(hgvFailWithDangerousAndMajorDefect)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });

        context('and the test station location is in Wales', () => {
          it('should return a VTG30W payload with the MajorDefectsWelsh array populated', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'P012301098765',
                RawVRM: 'VM14MDT',
                EarliestDateOfTheNextTest: '26.12.2019',
                ExpiryDate: '25.02.2020',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                MajorDefects: [
                  '6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd',
                ],
                MajorDefectsWelsh: [
                  "6.1.a Cylch cadw teiar: wedi torri neu heb ei ffitio'n iawn fel bod datgysylltiad yn debygol. Echelau: 1. Mewnol Allanol. Asdasd",
                ],
                DangerousDefects: [
                  '54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd',
                ],
                DangerousDefectsWelsh: [
                  "54.1.a.ii Llywio pŵer: ddim yn gweithio'n gywir ac yn amlwg yn effeithio ar reolaeth llywio. Echelau: 7. Mewnol Allanol. Asdasd",
                ],
                Make: 'Isuzu',
                Model: 'FM',
                OdometerHistoryList: [
                  {
                    value: 400000,
                    unit: 'kilometres',
                    date: '19.01.2019',
                  },
                  {
                    value: 390000,
                    unit: 'kilometres',
                    date: '18.01.2019',
                  },
                  {
                    value: 380000,
                    unit: 'kilometres',
                    date: '17.01.2019',
                  },
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtHgvSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(hgvFailWithDangerousAndMajorDefect, true)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });
      });

      context('and the hgv result has advisory, minor, dangerous and major defects', () => {
        context('and the test station location is not in Wales', () => {
          it('should return a VTG30 payload without any Welsh defect arrays populated', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'P012301098765',
                RawVRM: 'VM14MDT',
                EarliestDateOfTheNextTest: '26.12.2019',
                ExpiryDate: '25.02.2020',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                MajorDefects: [
                  '6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd',
                ],
                DangerousDefects: [
                  '54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd',
                ],
                MinorDefects: [
                  '54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.',
                ],
                AdvisoryDefects: [
                  '5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc',
                ],
                Make: 'Isuzu',
                Model: 'FM',
                OdometerHistoryList: [
                  {
                    value: 400000,
                    unit: 'kilometres',
                    date: '19.01.2019',
                  },
                  {
                    value: 390000,
                    unit: 'kilometres',
                    date: '18.01.2019',
                  },
                  {
                    value: 380000,
                    unit: 'kilometres',
                    date: '17.01.2019',
                  },
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtHgvSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(hgvFailWithAdvisoryMinorDangerousMajorDefect)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });

        context('and the test station location is in Wales', () => {
          it('should return a VTG30W payload with all Welsh defect arrays populated', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'P012301098765',
                RawVRM: 'VM14MDT',
                EarliestDateOfTheNextTest: '26.12.2019',
                ExpiryDate: '25.02.2020',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                MajorDefects: [
                  '6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd',
                ],
                MajorDefectsWelsh: [
                  "6.1.a Cylch cadw teiar: wedi torri neu heb ei ffitio'n iawn fel bod datgysylltiad yn debygol. Echelau: 1. Mewnol Allanol. Asdasd",
                ],
                DangerousDefects: [
                  '54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd',
                ],
                DangerousDefectsWelsh: [
                  "54.1.a.ii Llywio pŵer: ddim yn gweithio'n gywir ac yn amlwg yn effeithio ar reolaeth llywio. Echelau: 7. Mewnol Allanol. Asdasd",
                ],
                MinorDefects: [
                  '54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.',
                ],
                MinorDefectsWelsh: [
                  "54.1.d.i Llywio pŵer: cronfa ddŵr yn is na'r lefel isaf. Echelau: 7. Allanol Ochr mewnol.",
                ],
                AdvisoryDefects: [
                  '5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc',
                ],
                AdvisoryDefectsWelsh: [
                  '5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc',
                ],
                Make: 'Isuzu',
                Model: 'FM',
                OdometerHistoryList: [
                  {
                    value: 400000,
                    unit: 'kilometres',
                    date: '19.01.2019',
                  },
                  {
                    value: 390000,
                    unit: 'kilometres',
                    date: '18.01.2019',
                  },
                  {
                    value: 380000,
                    unit: 'kilometres',
                    date: '17.01.2019',
                  },
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtHgvSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(hgvFailWithAdvisoryMinorDangerousMajorDefect, true)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });
      });

      context('and the hgv result has a Dangerous Defect with Major defect rectified', () => {
        context('and the test station location is not in Wales', () => {
          it('should return a VTG30 payload with PRSDefects list in fail data', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'P012301098765',
                RawVRM: 'VM14MDT',
                EarliestDateOfTheNextTest: '26.12.2019',
                ExpiryDate: '25.02.2020',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                DangerousDefects: [
                  '54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd',
                ],
                MajorDefects: undefined,
                MinorDefects: undefined,
                PRSDefects: ['6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd'],
                Make: 'Isuzu',
                Model: 'FM',
                OdometerHistoryList: [
                  {
                    date: '19.01.2019',
                    unit: 'kilometres',
                    value: 400000,
                  },
                  {
                    date: '18.01.2019',
                    unit: 'kilometres',
                    value: 390000,
                  },
                  {
                    date: '17.01.2019',
                    unit: 'kilometres',
                    value: 380000,
                  },
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtHgvSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(hgvFailWithDangerousDefectMajorRectified)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });

        context('and the test station location is in Wales', () => {
          it('should return a VTG30W payload with PRSDefectsWelsh list in fail data', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'P012301098765',
                RawVRM: 'VM14MDT',
                EarliestDateOfTheNextTest: '26.12.2019',
                ExpiryDate: '25.02.2020',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                DangerousDefects: [
                  '54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd',
                ],
                DangerousDefectsWelsh: [
                  "54.1.a.ii Llywio pŵer: ddim yn gweithio'n gywir ac yn amlwg yn effeithio ar reolaeth llywio. Echelau: 7. Mewnol Allanol. Asdasd",
                ],
                MajorDefects: undefined,
                MajorDefectsWelsh: undefined,
                MinorDefects: undefined,
                MinorDefectsWelsh: undefined,
                PRSDefects: [
                  '6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd',
                ],
                PRSDefectsWelsh: [
                  "6.1.a Cylch cadw teiar: wedi torri neu heb ei ffitio'n iawn fel bod datgysylltiad yn debygol. Echelau: 1. Mewnol Allanol. Asdasd",
                ],
                Make: 'Isuzu',
                Model: 'FM',
                OdometerHistoryList: [
                  {
                    date: '19.01.2019',
                    unit: 'kilometres',
                    value: 400000,
                  },
                  {
                    date: '18.01.2019',
                    unit: 'kilometres',
                    value: 390000,
                  },
                  {
                    date: '17.01.2019',
                    unit: 'kilometres',
                    value: 380000,
                  },
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtHgvSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(hgvFailWithDangerousDefectMajorRectified, true)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });
      });

      context('and the hgv result has a Major Defect with Dangerous defect rectified', () => {
        context('and the test station location is not in Wales', () => {
          it('should return a VTG30 payload with PRSDefects list in fail data', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'P012301098765',
                RawVRM: 'VM14MDT',
                EarliestDateOfTheNextTest: '26.12.2019',
                ExpiryDate: '25.02.2020',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                DangerousDefects: undefined,
                MajorDefects: [
                  '6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd',
                ],
                MinorDefects: undefined,
                PRSDefects: [
                  '54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd',
                ],
                Make: 'Isuzu',
                Model: 'FM',
                OdometerHistoryList: [
                  {
                    date: '19.01.2019',
                    unit: 'kilometres',
                    value: 400000,
                  },
                  {
                    date: '18.01.2019',
                    unit: 'kilometres',
                    value: 390000,
                  },
                  {
                    date: '17.01.2019',
                    unit: 'kilometres',
                    value: 380000,
                  },
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtHgvSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(hgvFailWithMajorDefectDangerousRectified)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });

        context('and the test station location is in Wales', () => {
          it('should return a VTG30W payload with PRSDefectsWelsh list in fail data', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'P012301098765',
                RawVRM: 'VM14MDT',
                EarliestDateOfTheNextTest: '26.12.2019',
                ExpiryDate: '25.02.2020',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                DangerousDefects: undefined,
                MajorDefects: [
                  '6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd',
                ],
                MajorDefectsWelsh: [
                  "6.1.a Cylch cadw teiar: wedi torri neu heb ei ffitio'n iawn fel bod datgysylltiad yn debygol. Echelau: 1. Mewnol Allanol. Asdasd",
                ],
                MinorDefects: undefined,
                PRSDefects: [
                  '54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd',
                ],
                PRSDefectsWelsh: [
                  "54.1.a.ii Llywio pŵer: ddim yn gweithio'n gywir ac yn amlwg yn effeithio ar reolaeth llywio. Echelau: 7. Mewnol Allanol. Asdasd",
                ],
                Make: 'Isuzu',
                Model: 'FM',
                OdometerHistoryList: [
                  {
                    date: '19.01.2019',
                    unit: 'kilometres',
                    value: 400000,
                  },
                  {
                    date: '18.01.2019',
                    unit: 'kilometres',
                    value: 390000,
                  },
                  {
                    date: '17.01.2019',
                    unit: 'kilometres',
                    value: 380000,
                  },
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtHgvSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(hgvFailWithMajorDefectDangerousRectified, true)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });
      });

      context('and the trl result has a dangerous defect', () => {
        context('and the test station location is not in Wales', () => {
          it('should return a VTG30 payload without the DangerousDefectsWelsh array populated', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'T12876765',
                EarliestDateOfTheNextTest: '26.12.2019',
                ExpiryDate: '25.02.2020',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                DangerousDefects: [
                  '54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd',
                ],
                Make: 'STANLEY',
                Model: 'AUTOTRL',
                Trn: 'ABC123',
                IsTrailer: true,
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(trlFailWithDangerousDefect)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
                // Remove the signature
                S3BucketMockService.buckets.pop();
              });
          });
        });

        context('and the test station location is in Wales', () => {
          it('should return a VTG30W payload with the DangerousDefectsWelsh array populated', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'T12876765',
                EarliestDateOfTheNextTest: '26.12.2019',
                ExpiryDate: '25.02.2020',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                DangerousDefects: [
                  '54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd',
                ],
                DangerousDefectsWelsh: [
                  "54.1.a.ii Llywio pŵer: ddim yn gweithio'n gywir ac yn amlwg yn effeithio ar reolaeth llywio. Echelau: 7. Mewnol Allanol. Asdasd",
                ],
                Make: 'STANLEY',
                Model: 'AUTOTRL',
                Trn: 'ABC123',
                IsTrailer: true,
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(trlFailWithDangerousDefect, true)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
                // Remove the signature
                S3BucketMockService.buckets.pop();
              });
          });
        });
      });

      context('and the trl result has a major defect', () => {
        context('and the test station location is not in Wales', () => {
          it('should return a VTG30 payload without the MajorDefectsWelsh array populated', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'T12876765',
                EarliestDateOfTheNextTest: '26.12.2019',
                ExpiryDate: '25.02.2020',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                MajorDefects: [
                  '6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd',
                ],
                Make: 'STANLEY',
                Model: 'AUTOTRL',
                Trn: 'ABC123',
                IsTrailer: true,
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(trlFailWithMajorDefect)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
                // Remove the signature
                S3BucketMockService.buckets.pop();
              });
          });
        });

        context('and the test station location is in Wales', () => {
          it('should return a VTG30W payload with the MajorDefectsWelsh array populated', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'T12876765',
                EarliestDateOfTheNextTest: '26.12.2019',
                ExpiryDate: '25.02.2020',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                MajorDefects: [
                  '6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd',
                ],
                MajorDefectsWelsh: [
                  "6.1.a Cylch cadw teiar: wedi torri neu heb ei ffitio'n iawn fel bod datgysylltiad yn debygol. Echelau: 1. Mewnol Allanol. Asdasd",
                ],
                Make: 'STANLEY',
                Model: 'AUTOTRL',
                Trn: 'ABC123',
                IsTrailer: true,
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(trlFailWithMajorDefect, true)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
                // Remove the signature
                S3BucketMockService.buckets.pop();
              });
          });
        });
      });

      context('and the trl result has a dangerous and major defect', () => {
        context('and the test station location is not in Wales', () => {
          it('should return a VTG30 payload without the DangerousDefectsWelsh array populated', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'T12876765',
                EarliestDateOfTheNextTest: '26.12.2019',
                ExpiryDate: '25.02.2020',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                DangerousDefects: [
                  '54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd',
                ],
                MajorDefects: [
                  '6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd',
                ],
                Make: 'STANLEY',
                Model: 'AUTOTRL',
                Trn: 'ABC123',
                IsTrailer: true,
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(trlFailWithDangerousAndMajorDefect)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
                // Remove the signature
                S3BucketMockService.buckets.pop();
              });
          });
        });

        context('and the test station location is in Wales', () => {
          it('should return a VTG30W payload with the DangerousDefectsWelsh array populated', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'T12876765',
                EarliestDateOfTheNextTest: '26.12.2019',
                ExpiryDate: '25.02.2020',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                DangerousDefects: [
                  '54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd',
                ],
                DangerousDefectsWelsh: [
                  "54.1.a.ii Llywio pŵer: ddim yn gweithio'n gywir ac yn amlwg yn effeithio ar reolaeth llywio. Echelau: 7. Mewnol Allanol. Asdasd",
                ],
                MajorDefects: [
                  '6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd',
                ],
                MajorDefectsWelsh: [
                  "6.1.a Cylch cadw teiar: wedi torri neu heb ei ffitio'n iawn fel bod datgysylltiad yn debygol. Echelau: 1. Mewnol Allanol. Asdasd",
                ],
                Make: 'STANLEY',
                Model: 'AUTOTRL',
                Trn: 'ABC123',
                IsTrailer: true,
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(trlFailWithDangerousAndMajorDefect, true)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
                // Remove the signature
                S3BucketMockService.buckets.pop();
              });
          });
        });
      });

      context('and the trl result has advisory, minor, dangerous and major defects', () => {
        context('and the test station location is not in Wales', () => {
          it('should return a VTG30 payload without any Welsh defect arrays populated', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'T12876765',
                EarliestDateOfTheNextTest: '26.12.2019',
                ExpiryDate: '25.02.2020',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                DangerousDefects: [
                  '54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd',
                ],
                MajorDefects: [
                  '6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd',
                ],
                AdvisoryDefects: [
                  '5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc',
                ],
                MinorDefects: [
                  '54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.',
                ],
                Make: 'STANLEY',
                Model: 'AUTOTRL',
                Trn: 'ABC123',
                IsTrailer: true,
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(trlFailWithAdvisoryMinorDangerousMajorDefect)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
                // Remove the signature
                S3BucketMockService.buckets.pop();
              });
          });
        });

        context('and the test station location is in Wales', () => {
          it('should return a VTG30W payload with all Welsh defect arrays populated', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'T12876765',
                EarliestDateOfTheNextTest: '26.12.2019',
                ExpiryDate: '25.02.2020',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                DangerousDefects: [
                  '54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd',
                ],
                DangerousDefectsWelsh: [
                  "54.1.a.ii Llywio pŵer: ddim yn gweithio'n gywir ac yn amlwg yn effeithio ar reolaeth llywio. Echelau: 7. Mewnol Allanol. Asdasd",
                ],
                MajorDefects: [
                  '6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd',
                ],
                MajorDefectsWelsh: [
                  "6.1.a Cylch cadw teiar: wedi torri neu heb ei ffitio'n iawn fel bod datgysylltiad yn debygol. Echelau: 1. Mewnol Allanol. Asdasd",
                ],
                AdvisoryDefects: [
                  '5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc',
                ],
                AdvisoryDefectsWelsh: [
                  '5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc',
                ],
                MinorDefects: [
                  '54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.',
                ],
                MinorDefectsWelsh: [
                  "54.1.d.i Llywio pŵer: cronfa ddŵr yn is na'r lefel isaf. Echelau: 7. Allanol Ochr mewnol.",
                ],
                Make: 'STANLEY',
                Model: 'AUTOTRL',
                Trn: 'ABC123',
                IsTrailer: true,
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(trlFailWithAdvisoryMinorDangerousMajorDefect, true)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
                // Remove the signature
                S3BucketMockService.buckets.pop();
              });
          });
        });
      });

      context('and the trl result has a Dangerous Defect with Major defect rectified', () => {
        context('and the test station location is not in Wales', () => {
          it('should return a VTG30 payload with PRSDefects list in fail data', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'T12876765',
                EarliestDateOfTheNextTest: '26.12.2019',
                ExpiryDate: '25.02.2020',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                DangerousDefects: [
                  '54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd',
                ],
                MajorDefects: undefined,
                AdvisoryDefects: [
                  '5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc',
                ],
                MinorDefects: [
                  '54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.',
                ],
                PRSDefects: [
                  '6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd',
                ],
                Make: 'STANLEY',
                Model: 'AUTOTRL',
                Trn: 'ABC123',
                IsTrailer: true,
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(trlFailWithDangerousDefectMajorRectified)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });

        context('and the test station location is in Wales', () => {
          it('should return a VTG30W payload with PRSDefectsWelsh list in fail data', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'T12876765',
                EarliestDateOfTheNextTest: '26.12.2019',
                ExpiryDate: '25.02.2020',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                DangerousDefects: [
                  '54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd',
                ],
                DangerousDefectsWelsh: [
                  "54.1.a.ii Llywio pŵer: ddim yn gweithio'n gywir ac yn amlwg yn effeithio ar reolaeth llywio. Echelau: 7. Mewnol Allanol. Asdasd",
                ],
                MajorDefects: undefined,
                MajorDefectsWelsh: undefined,
                AdvisoryDefects: [
                  '5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc',
                ],
                AdvisoryDefectsWelsh: [
                  '5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc',
                ],
                MinorDefects: [
                  '54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.',
                ],
                MinorDefectsWelsh: [
                  "54.1.d.i Llywio pŵer: cronfa ddŵr yn is na'r lefel isaf. Echelau: 7. Allanol Ochr mewnol.",
                ],
                PRSDefects: [
                  '6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd',
                ],
                PRSDefectsWelsh: [
                  "6.1.a Cylch cadw teiar: wedi torri neu heb ei ffitio'n iawn fel bod datgysylltiad yn debygol. Echelau: 1. Mewnol Allanol. Asdasd",
                ],
                Make: 'STANLEY',
                Model: 'AUTOTRL',
                Trn: 'ABC123',
                IsTrailer: true,
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(trlFailWithDangerousDefectMajorRectified, true)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });
      });

      context('and the trl result has a Major Defect with Dangerous defect rectified', () => {
        context('and the test station location is not in Wales', () => {
          it('should return a VTG30 payload with PRSDefects list in fail data', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'T12876765',
                EarliestDateOfTheNextTest: '26.12.2019',
                ExpiryDate: '25.02.2020',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                DangerousDefects: undefined,
                MajorDefects: [
                  '6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd',
                ],
                AdvisoryDefects: [
                  '5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc',
                ],
                MinorDefects: [
                  '54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.',
                ],
                PRSDefects: [
                  '54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd',
                ],
                Make: 'STANLEY',
                Model: 'AUTOTRL',
                Trn: 'ABC123',
                IsTrailer: true,
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(trlFailWithMajorDefectDangerousRectified)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });

        context('and the test station location is in Wales', () => {
          it('should return a VTG30W payload with PRSDefectsWelsh list in fail data', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'T12876765',
                EarliestDateOfTheNextTest: '26.12.2019',
                ExpiryDate: '25.02.2020',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                DangerousDefects: undefined,
                MajorDefects: [
                  '6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd',
                ],
                MajorDefectsWelsh: [
                  "6.1.a Cylch cadw teiar: wedi torri neu heb ei ffitio'n iawn fel bod datgysylltiad yn debygol. Echelau: 1. Mewnol Allanol. Asdasd",
                ],
                AdvisoryDefects: [
                  '5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc',
                ],
                AdvisoryDefectsWelsh: [
                  '5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc',
                ],
                MinorDefects: [
                  '54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.',
                ],
                MinorDefectsWelsh: [
                  "54.1.d.i Llywio pŵer: cronfa ddŵr yn is na'r lefel isaf. Echelau: 7. Allanol Ochr mewnol.",
                ],
                PRSDefects: [
                  '54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd',
                ],
                PRSDefectsWelsh: [
                  "54.1.a.ii Llywio pŵer: ddim yn gweithio'n gywir ac yn amlwg yn effeithio ar reolaeth llywio. Echelau: 7. Mewnol Allanol. Asdasd",
                ],
                Make: 'STANLEY',
                Model: 'AUTOTRL',
                Trn: 'ABC123',
                IsTrailer: true,
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(trlFailWithMajorDefectDangerousRectified, true)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });
      });

      context('should return Certificate Data without any Welsh defect arrays populated', () => {
        let techRecordsPsvStub: any;
        const expectedResultEnglish: any = {
          FAIL_DATA: {
            AdvisoryDefects: [
              '5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc',
            ],
            CountryOfRegistrationCode: 'gb',
            CurrentOdometer: {
              unit: 'kilometres',
              value: 12312,
            },
            DangerousDefects: [
              '54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd',
            ],

            DateOfTheTest: '26.02.2019',
            EarliestDateOfTheNextTest: '26.12.2019',
            ExpiryDate: '25.02.2020',
            IssuersName: 'Dev1 CVS',
            MajorDefects: [
              '6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd',
            ],
            MinorDefects: [
              '54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.',
            ],
            OdometerHistoryList: [
              {
                date: '19.01.2019',
                unit: 'kilometres',
                value: 400000,
              },
              {
                date: '18.01.2019',
                unit: 'kilometres',
                value: 390000,
              },
              {
                date: '17.01.2019',
                unit: 'kilometres',
                value: 380000,
              },
            ],
            RawVIN: 'XMGDE02FS0H012345',
            RawVRM: 'BQ91YHQ',
            SeatBeltNumber: 2,
            SeatBeltPreviousCheckDate: '26.02.2019',
            SeatBeltTested: 'Yes',
            TestNumber: 'W01A00310',
            TestStationName: 'Abshire-Kub',
            Make: 'AEC',
            Model: 'RELIANCE',
            TestStationPNumber: '09-4129632',
            VehicleEuClassification: 'M1',
          },
          Signature: {
            ImageData: null,
            ImageType: 'png',
          },
          Watermark: 'NOT VALID',
        };

        beforeEach(() => {
          searchTechRecordsSpy.mockResolvedValue(techRecordsSearchPsv);

          techRecordsPsvStub = cloneDeep(psvFailWithDefects);
          callGetTechRecordSpy.mockResolvedValue(techRecordsPsv as any);
        });

        it('should return a VTP30W payload with the MajorDefectsWelsh array populated', async () => certificateGenerationService
          .generatePayload(psvFailWithDefects)
          .then((payload: any) => {
            expect(payload).toEqual(expectedResultEnglish);
            expect(payload.FAIL_DATA.MajorDefectsWelsh).toBeUndefined();
          }));

        it('should return a VTP30W payload with the MinorDefectsWelsh array populated', async () => certificateGenerationService
          .generatePayload(psvFailWithDefects)
          .then((payload: any) => {
            expect(payload).toEqual(expectedResultEnglish);
            expect(payload.FAIL_DATA.MinorDefectsWelsh).toBeUndefined();
          }));

        it('should return a VTP30W payload without the AdvisoryDefectsWelsh array populated', async () => certificateGenerationService
          .generatePayload(psvFailWithDefects)
          .then((payload: any) => {
            expect(payload).toEqual(expectedResultEnglish);
            expect(payload.FAIL_DATA.AdvisoryDefectsWelsh).toBeUndefined();
          }));
        it('should return a VTP30W payload without the DangerousDefects array populated', async () => certificateGenerationService
          .generatePayload(psvFailWithDefects)
          .then((payload: any) => {
            expect(payload).toEqual(expectedResultEnglish);
            expect(payload.FAIL_DATA.DangerousDefectsWelsh).toBeUndefined();
          }));
      });

      context('should return certificate data with welsh defects array', () => {
        let techRecordsPsvStub: any;
        const expectedResultWelsh: any = {
          FAIL_DATA: {
            AdvisoryDefects: [
              '5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc',
            ],
            AdvisoryDefectsWelsh: [
              '5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc',
            ],
            CountryOfRegistrationCode: 'gb',
            CurrentOdometer: {
              unit: 'kilometres',
              value: 12312,
            },
            DangerousDefects: [
              '54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd',
            ],
            DangerousDefectsWelsh: [
              "54.1.a.ii Llywio pŵer: ddim yn gweithio'n gywir ac yn amlwg yn effeithio ar reolaeth llywio. Echelau: 7. Mewnol Allanol. Asdasd",
            ],
            DateOfTheTest: '26.02.2019',
            EarliestDateOfTheNextTest: '26.12.2019',
            ExpiryDate: '25.02.2020',
            IssuersName: 'Dev1 CVS',
            MajorDefects: [
              '6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd',
            ],
            MajorDefectsWelsh: [
              "6.1.a Cylch cadw teiar: wedi torri neu heb ei ffitio'n iawn fel bod datgysylltiad yn debygol. Echelau: 1. Mewnol Allanol. Asdasd",
            ],
            MinorDefects: [
              '54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.',
            ],
            MinorDefectsWelsh: [
              "54.1.d.i Llywio pŵer: cronfa ddŵr yn is na'r lefel isaf. Echelau: 7. Allanol Ochr mewnol.",
            ],
            OdometerHistoryList: [
              {
                date: '19.01.2019',
                unit: 'kilometres',
                value: 400000,
              },
              {
                date: '18.01.2019',
                unit: 'kilometres',
                value: 390000,
              },
              {
                date: '17.01.2019',
                unit: 'kilometres',
                value: 380000,
              },
            ],
            RawVIN: 'XMGDE02FS0H012345',
            RawVRM: 'BQ91YHQ',
            SeatBeltNumber: 2,
            SeatBeltPreviousCheckDate: '26.02.2019',
            SeatBeltTested: 'Yes',
            TestNumber: 'W01A00310',
            TestStationName: 'Abshire-Kub',
            TestStationPNumber: '09-4129632',
            Model: 'RELIANCE',
            Make: 'AEC',
            VehicleEuClassification: 'M1',
          },
          Signature: {
            ImageData: null,
            ImageType: 'png',
          },
          Watermark: 'NOT VALID',
        };

        beforeEach(() => {
          searchTechRecordsSpy.mockResolvedValue(techRecordsSearchPsv);

          techRecordsPsvStub = cloneDeep(psvFailWithDefects);
          callGetTechRecordSpy.mockResolvedValue(techRecordsPsv as any);
        });

        it('should return a VTP30W payload with the MajorDefectsWelsh array populated', async () => certificateGenerationService
          .generatePayload(psvFailWithDefects, true)
          .then((payload: any) => {
            expect(payload).toEqual(expectedResultWelsh);
            expect(payload.FAIL_DATA.MajorDefectsWelsh).toEqual(["6.1.a Cylch cadw teiar: wedi torri neu heb ei ffitio'n iawn fel bod datgysylltiad yn debygol. Echelau: 1. Mewnol Allanol. Asdasd"]);
          }));

        it('should return a VTP30W payload with the MinorDefectsWelsh array populated', async () => certificateGenerationService
          .generatePayload(psvFailWithDefects, true)
          .then((payload: any) => {
            expect(payload).toEqual(expectedResultWelsh);
            expect(payload.FAIL_DATA.MinorDefectsWelsh).toEqual(["54.1.d.i Llywio pŵer: cronfa ddŵr yn is na'r lefel isaf. Echelau: 7. Allanol Ochr mewnol."]);
          }));
        it('should return a VTP30W payload with the AdvisoryDefectsWelsh array populated', async () => certificateGenerationService
          .generatePayload(psvFailWithDefects, true)
          .then((payload: any) => {
            expect(payload).toEqual(expectedResultWelsh);
            expect(payload.FAIL_DATA.AdvisoryDefectsWelsh).toEqual(['5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc']);
          }));
        it('should return a VTP30W payload with the DangerousDefects array populated', async () => certificateGenerationService
          .generatePayload(psvFailWithDefects, true)
          .then((payload: any) => {
            expect(payload).toEqual(expectedResultWelsh);
            expect(payload.FAIL_DATA.DangerousDefectsWelsh).toEqual(["54.1.a.ii Llywio pŵer: ddim yn gweithio'n gywir ac yn amlwg yn effeithio ar reolaeth llywio. Echelau: 7. Mewnol Allanol. Asdasd"]);
          }));
      });
    });

    context('when a prs test result is read from the queue', () => {
      const event: any = JSON.parse(
        fs.readFileSync(
          path.resolve(__dirname, '../resources/queue-event-prs.json'),
          'utf8',
        ),
      );
      context('and the TRL has defects that is rectified at the test', () => {
        const trlPRS = JSON.parse(event.Records[4].body);

        context('and the test station is not in wales', () => {
          it('should return a TRL PRS certificate with the defects array populated', async () => {
            const expectedResult = {
              DATA: {
                CountryOfRegistrationCode: 'gb',
                CurrentOdometer: {
                  unit: 'kilometres',
                  value: 12312,
                },
                DateOfTheTest: '26.02.2019',
                EarliestDateOfTheNextTest: '01.11.2019',
                ExpiryDate: '25.02.2020',
                IsTrailer: true,
                IssuersName: 'CVS Dev1',
                Make: 'Isuzu',
                Model: 'FM',
                RawVIN: 'T12876765',
                SeatBeltNumber: 2,
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltTested: 'Yes',
                TestNumber: 'W01A00310',
                TestStationName: 'Abshire-Kub',
                TestStationPNumber: '09-4129632',
                Trn: 'ABC123',
                VehicleEuClassification: 'M1',
              },
              FAIL_DATA: {
                CountryOfRegistrationCode: 'gb',
                CurrentOdometer: {
                  unit: 'kilometres',
                  value: 12312,
                },
                DateOfTheTest: '26.02.2019',
                EarliestDateOfTheNextTest: '01.11.2019',
                ExpiryDate: '25.02.2020',
                IsTrailer: true,
                IssuersName: 'CVS Dev1',
                Make: 'Isuzu',
                Model: 'FM',
                PRSDefects: [
                  '6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd',
                ],
                RawVIN: 'T12876765',
                SeatBeltNumber: 2,
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltTested: 'Yes',
                TestNumber: 'W01A00310',
                TestStationName: 'Abshire-Kub',
                TestStationPNumber: '09-4129632',
                Trn: 'ABC123',
                VehicleEuClassification: 'M1',
              },
              Signature: {
                ImageData: null,
                ImageType: 'png',
              },
              Watermark: 'NOT VALID',
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtHgvSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(trlPRS)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
          context(' and the test station is in wales', () => {
            it('should return a TRL PRS bilingual certificate with the defects array populated', async () => {
              const expectedResult = {
                DATA: {
                  CountryOfRegistrationCode: 'gb',
                  CurrentOdometer: {
                    unit: 'kilometres',
                    value: 12312,
                  },
                  DateOfTheTest: '26.02.2019',
                  EarliestDateOfTheNextTest: '01.11.2019',
                  ExpiryDate: '25.02.2020',
                  IsTrailer: true,
                  IssuersName: 'CVS Dev1',
                  Make: 'Isuzu',
                  Model: 'FM',
                  RawVIN: 'T12876765',
                  SeatBeltNumber: 2,
                  SeatBeltPreviousCheckDate: '26.02.2019',
                  SeatBeltTested: 'Yes',
                  TestNumber: 'W01A00310',
                  TestStationName: 'Abshire-Kub',
                  TestStationPNumber: '09-4129632',
                  Trn: 'ABC123',
                  VehicleEuClassification: 'M1',
                },
                FAIL_DATA: {
                  CountryOfRegistrationCode: 'gb',
                  CurrentOdometer: {
                    unit: 'kilometres',
                    value: 12312,
                  },
                  DateOfTheTest: '26.02.2019',
                  EarliestDateOfTheNextTest: '01.11.2019',
                  ExpiryDate: '25.02.2020',
                  IsTrailer: true,
                  IssuersName: 'CVS Dev1',
                  Make: 'Isuzu',
                  Model: 'FM',
                  PRSDefects: [
                    '6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd',
                  ],
                  PRSDefectsWelsh: [
                    "6.1.a Cylch cadw teiar: wedi torri neu heb ei ffitio'n iawn fel bod datgysylltiad yn debygol. Echelau: 1. Mewnol Allanol. Asdasd",
                  ],
                  RawVIN: 'T12876765',
                  SeatBeltNumber: 2,
                  SeatBeltPreviousCheckDate: '26.02.2019',
                  SeatBeltTested: 'Yes',
                  TestNumber: 'W01A00310',
                  TestStationName: 'Abshire-Kub',
                  TestStationPNumber: '09-4129632',
                  Trn: 'ABC123',
                  VehicleEuClassification: 'M1',
                },
                Signature: {
                  ImageData: null,
                  ImageType: 'png',
                },
                Watermark: 'NOT VALID',
              };

              searchTechRecordsSpy.mockResolvedValue(techRecordsRwtHgvSearch);

              const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
              callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

              return certificateGenerationService
                .generatePayload(trlPRS, true)
                .then((payload: any) => {
                  expect(payload).toEqual(expectedResult);
                });
            });
          });
        });
      });

      context('and the PSV has defects that are rectified at the test', () => {
        const psvPRS = JSON.parse(event.Records[5].body);

        context('and the test station is not in wales', () => {
          it('should return a PSV certificate with the defects array', async () => {
            const expectedResult = {
              DATA: {
                CountryOfRegistrationCode: 'gb',
                CurrentOdometer: {
                  unit: 'kilometres',
                  value: 12312,
                },
                DateOfTheTest: '26.02.2019',
                EarliestDateOfTheNextTest: '26.12.2019',
                ExpiryDate: '25.02.2020',
                IssuersName: 'CVS Dev1',
                Make: 'AEC',
                Model: 'RELIANCE',
                OdometerHistoryList: [
                  {
                    date: '19.01.2019',
                    unit: 'kilometres',
                    value: 400000,
                  },
                  {
                    date: '18.01.2019',
                    unit: 'kilometres',
                    value: 390000,
                  },
                  {
                    date: '17.01.2019',
                    unit: 'kilometres',
                    value: 380000,
                  },
                ],
                RawVIN: 'XMGDE02FS0H012345',
                RawVRM: 'BQ91YHQ',
                SeatBeltNumber: 2,
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltTested: 'Yes',
                TestNumber: 'W01A00310',
                TestStationName: 'Abshire-Kub',
                TestStationPNumber: '09-4129632',
                VehicleEuClassification: 'M1',
              },
              FAIL_DATA: {
                CountryOfRegistrationCode: 'gb',
                CurrentOdometer: {
                  unit: 'kilometres',
                  value: 12312,
                },
                DateOfTheTest: '26.02.2019',
                EarliestDateOfTheNextTest: '26.12.2019',
                ExpiryDate: '25.02.2020',
                IssuersName: 'CVS Dev1',
                Make: 'AEC',
                Model: 'RELIANCE',
                OdometerHistoryList: [
                  {
                    date: '19.01.2019',
                    unit: 'kilometres',
                    value: 400000,
                  },
                  {
                    date: '18.01.2019',
                    unit: 'kilometres',
                    value: 390000,
                  },
                  {
                    date: '17.01.2019',
                    unit: 'kilometres',
                    value: 380000,
                  },
                ],
                PRSDefects: [
                  '6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd',
                ],
                RawVIN: 'XMGDE02FS0H012345',
                RawVRM: 'BQ91YHQ',
                SeatBeltNumber: 2,
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltTested: 'Yes',
                TestNumber: 'W01A00310',
                TestStationName: 'Abshire-Kub',
                TestStationPNumber: '09-4129632',
                VehicleEuClassification: 'M1',
              },
              Signature: {
                ImageData: null,
                ImageType: 'png',
              },
              Watermark: 'NOT VALID',
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsSearchPsv);

            const techRecordResponseRwtMock = cloneDeep(techRecordsPsv);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(psvPRS)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });

        context('and the test station is in wales', () => {
          it('should return a PSV bilingual certificate with the defects array populated', async () => {
            const expectedResult = {
              DATA: {
                CountryOfRegistrationCode: 'gb',
                CurrentOdometer: {
                  unit: 'kilometres',
                  value: 12312,
                },
                DateOfTheTest: '26.02.2019',
                EarliestDateOfTheNextTest: '26.12.2019',
                ExpiryDate: '25.02.2020',
                IssuersName: 'CVS Dev1',
                Make: 'AEC',
                Model: 'RELIANCE',
                OdometerHistoryList: [
                  {
                    date: '19.01.2019',
                    unit: 'kilometres',
                    value: 400000,
                  },
                  {
                    date: '18.01.2019',
                    unit: 'kilometres',
                    value: 390000,
                  },
                  {
                    date: '17.01.2019',
                    unit: 'kilometres',
                    value: 380000,
                  },
                ],
                RawVIN: 'XMGDE02FS0H012345',
                RawVRM: 'BQ91YHQ',
                SeatBeltNumber: 2,
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltTested: 'Yes',
                TestNumber: 'W01A00310',
                TestStationName: 'Abshire-Kub',
                TestStationPNumber: '09-4129632',
                VehicleEuClassification: 'M1',
              },
              FAIL_DATA: {
                CountryOfRegistrationCode: 'gb',
                CurrentOdometer: {
                  unit: 'kilometres',
                  value: 12312,
                },
                DateOfTheTest: '26.02.2019',
                EarliestDateOfTheNextTest: '26.12.2019',
                ExpiryDate: '25.02.2020',
                IssuersName: 'CVS Dev1',
                Make: 'AEC',
                Model: 'RELIANCE',
                OdometerHistoryList: [
                  {
                    date: '19.01.2019',
                    unit: 'kilometres',
                    value: 400000,
                  },
                  {
                    date: '18.01.2019',
                    unit: 'kilometres',
                    value: 390000,
                  },
                  {
                    date: '17.01.2019',
                    unit: 'kilometres',
                    value: 380000,
                  },
                ],
                PRSDefects: [
                  '6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd',
                ],
                PRSDefectsWelsh: [
                  "6.1.a Cylch cadw teiar: wedi torri neu heb ei ffitio'n iawn fel bod datgysylltiad yn debygol. Echelau: 1. Mewnol Allanol. Asdasd",
                ],
                RawVIN: 'XMGDE02FS0H012345',
                RawVRM: 'BQ91YHQ',
                SeatBeltNumber: 2,
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltTested: 'Yes',
                TestNumber: 'W01A00310',
                TestStationName: 'Abshire-Kub',
                TestStationPNumber: '09-4129632',
                VehicleEuClassification: 'M1',
              },
              Signature: {
                ImageData: null,
                ImageType: 'png',
              },
              Watermark: 'NOT VALID',
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsSearchPsv);

            const techRecordResponseMock = cloneDeep(techRecordsPsv);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseMock as any);

            return certificateGenerationService
              .generatePayload(psvPRS, true)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });
      });
      const testResult: any = JSON.parse(event.Records[0].body);
      let resBody: string = '';

      context('and the result has a defect that is rectified at test', () => {
        const hgvWithDefectRectifiedAtTest: any = JSON.parse(event.Records[3].body);
        context('and the test station location is not in Wales', () => {
          it('should return a VTG5 payload without the DangerousDefectsWelsh array populated', async () => {
            const expectedResult: any = {
              DATA: {
                CountryOfRegistrationCode: 'gb',
                CurrentOdometer: {
                  unit: 'kilometres',
                  value: 12312,
                },
                DateOfTheTest: '26.02.2019',
                EarliestDateOfTheNextTest: '01.11.2019',
                ExpiryDate: '25.02.2020',
                IssuersName: 'CVS Dev1',
                Make: 'Isuzu',
                Model: 'FM',
                OdometerHistoryList: [
                  {
                    date: '19.01.2019',
                    unit: 'kilometres',
                    value: 400000,
                  },
                  {
                    date: '18.01.2019',
                    unit: 'kilometres',
                    value: 390000,
                  },
                  {
                    date: '17.01.2019',
                    unit: 'kilometres',
                    value: 380000,
                  },
                ],
                RawVIN: 'P012301098765',
                RawVRM: 'VM14MDT',
                SeatBeltNumber: 2,
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltTested: 'Yes',
                TestNumber: 'W01A00310',
                TestStationName: 'Abshire-Kub',
                TestStationPNumber: '09-4129632',
                VehicleEuClassification: 'M1',
              },
              FAIL_DATA: {
                CountryOfRegistrationCode: 'gb',
                CurrentOdometer: {
                  unit: 'kilometres',
                  value: 12312,
                },
                DateOfTheTest: '26.02.2019',
                EarliestDateOfTheNextTest: '01.11.2019',
                ExpiryDate: '25.02.2020',
                IssuersName: 'CVS Dev1',
                Make: 'Isuzu',
                Model: 'FM',
                OdometerHistoryList: [
                  {
                    date: '19.01.2019',
                    unit: 'kilometres',
                    value: 400000,
                  },
                  {
                    date: '18.01.2019',
                    unit: 'kilometres',
                    value: 390000,
                  },
                  {
                    date: '17.01.2019',
                    unit: 'kilometres',
                    value: 380000,
                  },
                ],
                PRSDefects: [
                  '6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd',
                ],
                RawVIN: 'P012301098765',
                RawVRM: 'VM14MDT',
                SeatBeltNumber: 2,
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltTested: 'Yes',
                TestNumber: 'W01A00310',
                TestStationName: 'Abshire-Kub',
                TestStationPNumber: '09-4129632',
                VehicleEuClassification: 'M1',
              },
              Signature: {
                ImageData: null,
                ImageType: 'png',
              },
              Watermark: 'NOT VALID',
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtHgvSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(hgvWithDefectRectifiedAtTest)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });

        context('and the test station location is in Wales', () => {
          it('should return a VTG5W payload with the DangerousDefectsWelsh array populated', async () => {
            const expectedResult: any = {
              DATA: {
                CountryOfRegistrationCode: 'gb',
                CurrentOdometer: {
                  unit: 'kilometres',
                  value: 12312,
                },
                DateOfTheTest: '26.02.2019',
                EarliestDateOfTheNextTest: '01.11.2019',
                ExpiryDate: '25.02.2020',
                IssuersName: 'CVS Dev1',
                Make: 'Isuzu',
                Model: 'FM',
                OdometerHistoryList: [
                  {
                    date: '19.01.2019',
                    unit: 'kilometres',
                    value: 400000,
                  },
                  {
                    date: '18.01.2019',
                    unit: 'kilometres',
                    value: 390000,
                  },
                  {
                    date: '17.01.2019',
                    unit: 'kilometres',
                    value: 380000,
                  },
                ],
                RawVIN: 'P012301098765',
                RawVRM: 'VM14MDT',
                SeatBeltNumber: 2,
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltTested: 'Yes',
                TestNumber: 'W01A00310',
                TestStationName: 'Abshire-Kub',
                TestStationPNumber: '09-4129632',
                VehicleEuClassification: 'M1',
              },
              FAIL_DATA: {
                CountryOfRegistrationCode: 'gb',
                CurrentOdometer: {
                  unit: 'kilometres',
                  value: 12312,
                },
                DateOfTheTest: '26.02.2019',
                EarliestDateOfTheNextTest: '01.11.2019',
                ExpiryDate: '25.02.2020',
                IssuersName: 'CVS Dev1',
                Make: 'Isuzu',
                Model: 'FM',
                OdometerHistoryList: [
                  {
                    date: '19.01.2019',
                    unit: 'kilometres',
                    value: 400000,
                  },
                  {
                    date: '18.01.2019',
                    unit: 'kilometres',
                    value: 390000,
                  },
                  {
                    date: '17.01.2019',
                    unit: 'kilometres',
                    value: 380000,
                  },
                ],
                PRSDefects: [
                  '6.1.a A tyre retaining ring: fractured or not properly fitted such that detachment is likely. Axles: 1. Inner Offside. Asdasd',
                ],
                PRSDefectsWelsh: [
                  "6.1.a Cylch cadw teiar: wedi torri neu heb ei ffitio'n iawn fel bod datgysylltiad yn debygol. Echelau: 1. Mewnol Allanol. Asdasd",
                ],
                RawVIN: 'P012301098765',
                RawVRM: 'VM14MDT',
                SeatBeltNumber: 2,
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltTested: 'Yes',
                TestNumber: 'W01A00310',
                TestStationName: 'Abshire-Kub',
                TestStationPNumber: '09-4129632',
                VehicleEuClassification: 'M1',
              },
              Signature: {
                ImageData: null,
                ImageType: 'png',
              },
              Watermark: 'NOT VALID',
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtHgvSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(hgvWithDefectRectifiedAtTest, true)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });
      });

      context('and a payload is generated', () => {
        context('and no signatures were found in the bucket', () => {
          it('should return a PRS payload without signature', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'XMGDE02FS0H012345',
                RawVRM: 'BQ91YHQ',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '26.12.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                Make: 'STANLEY',
                Model: 'AUTOTRL',
                OdometerHistoryList: [
                  {
                    value: 400000,
                    unit: 'kilometres',
                    date: '19.01.2019',
                  },
                  {
                    value: 390000,
                    unit: 'kilometres',
                    date: '18.01.2019',
                  },
                  {
                    value: 380000,
                    unit: 'kilometres',
                    date: '17.01.2019',
                  },
                ],
              },
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'XMGDE02FS0H012345',
                RawVRM: 'BQ91YHQ',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '26.12.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                PRSDefects: ['1.1.a A registration plate: missing. Front.'],
                Make: 'STANLEY',
                Model: 'AUTOTRL',
                OdometerHistoryList: [
                  {
                    value: 400000,
                    unit: 'kilometres',
                    date: '19.01.2019',
                  },
                  {
                    value: 390000,
                    unit: 'kilometres',
                    date: '18.01.2019',
                  },
                  {
                    value: 380000,
                    unit: 'kilometres',
                    date: '17.01.2019',
                  },
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(testResult)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });

        context('and lambda-to-lambda calls were unsuccessful', () => {
          it('should return a PRS payload without bodyMake, bodyModel and odometer history', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'XMGDE02FS0H012345',
                RawVRM: 'BQ91YHQ',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '26.12.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
              },
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'XMGDE02FS0H012345',
                RawVRM: 'BQ91YHQ',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '26.12.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                PRSDefects: ['1.1.a A registration plate: missing. Front.'],
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            // @ts-ignore
            delete techRecordResponseRwtMock.techRecord_model;
            // @ts-ignore
            delete techRecordResponseRwtMock.techRecord_make;
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            // Make the functions return undefined
            // Stub CertificateGenerationService getOdometerHistory method to return undefined value.
            getOdometerSpy.mockResolvedValueOnce(undefined as any);

            return certificateGenerationService
              .generatePayload(testResult)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });

        context('and signatures were found in the bucket', () => {
          it('should return a PRS payload with signature', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'XMGDE02FS0H012345',
                RawVRM: 'BQ91YHQ',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '26.12.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                Make: 'STANLEY',
                Model: 'AUTOTRL',
                OdometerHistoryList: [
                  {
                    value: 400000,
                    unit: 'kilometres',
                    date: '19.01.2019',
                  },
                  {
                    value: 390000,
                    unit: 'kilometres',
                    date: '18.01.2019',
                  },
                  {
                    value: 380000,
                    unit: 'kilometres',
                    date: '17.01.2019',
                  },
                ],
              },
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'XMGDE02FS0H012345',
                RawVRM: 'BQ91YHQ',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '26.12.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                PRSDefects: ['1.1.a A registration plate: missing. Front.'],
                Make: 'STANLEY',
                Model: 'AUTOTRL',
                OdometerHistoryList: [
                  {
                    value: 400000,
                    unit: 'kilometres',
                    date: '19.01.2019',
                  },
                  {
                    value: 390000,
                    unit: 'kilometres',
                    date: '18.01.2019',
                  },
                  {
                    value: 380000,
                    unit: 'kilometres',
                    date: '17.01.2019',
                  },
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: fs
                  .readFileSync(
                    path.resolve(__dirname, '../resources/signatures/1.base64'),
                  )
                  .toString(),
              },
            };
            // Add a new signature
            S3BucketMockService.buckets.push({
              bucketName: `cvs-signature-${process.env.BUCKET}`,
              files: ['1.base64'],
            });

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(testResult)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
                resBody = payload.body;
                // Remove the signature
                S3BucketMockService.buckets.pop();
              });
          });
        });
      });

      context(
        'and the generated payload is used to call the MOT service',
        () => {
          it('successfully generate a certificate', async () => {
            searchTechRecordsSpy.mockResolvedValue(techRecordsSearchPsv);

            const techRecordResponseRwtMock = cloneDeep(techRecordsPsv);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            expect.assertions(3);
            return certificateGenerationService
              .generateCertificate(testResult)
              .then((response: any) => {
                expect(response.fileName).toBe(
                  'W01A00310_XMGDE02FS0H012345.pdf',
                );
                expect(response.certificateType).toBe('PSV_PRS');
                expect(response.certificateOrder).toEqual({
                  current: 1,
                  total: 2,
                });
              });
          });
        },
      );
    });
  });

  context('CertGenService for HGV', () => {
    context('when a passing test result for HGV is read from the queue', () => {
      const event: any = { ...queueEventPass };
      const testResult: any = JSON.parse(event.Records[1].body);

      context('and a payload is generated', () => {
        context('and no signatures were found in the bucket', () => {
          it('should return a VTG5 payload without signature', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'P012301098765',
                RawVRM: 'VM14MDT',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '01.11.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                Make: 'Isuzu',
                Model: 'FM',
                OdometerHistoryList: [
                  {
                    value: 400000,
                    unit: 'kilometres',
                    date: '19.01.2019',
                  },
                  {
                    value: 390000,
                    unit: 'kilometres',
                    date: '18.01.2019',
                  },
                  {
                    value: 380000,
                    unit: 'kilometres',
                    date: '17.01.2019',
                  },
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtHgvSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(testResult)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });

        context('and lambda-to-lambda calls were unsuccessful', () => {
          it('should return a VTG5 payload without bodyMake, bodyModel and odometer history', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'P012301098765',
                RawVRM: 'VM14MDT',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '01.11.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtHgvSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
            // @ts-ignore
            delete techRecordResponseRwtMock.techRecord_make;
            // @ts-ignore
            delete techRecordResponseRwtMock.techRecord_model;
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);
            // Make the functions return undefined
            // Stub CertificateGenerationService getOdometerHistory method to return undefined value.
            getOdometerSpy.mockResolvedValueOnce(undefined as any);

            return certificateGenerationService
              .generatePayload(testResult)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });

        context('and signatures were found in the bucket', () => {
          it('should return a VTG5 payload with signature', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'P012301098765',
                RawVRM: 'VM14MDT',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '01.11.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                Make: 'Isuzu',
                Model: 'FM',
                OdometerHistoryList: [
                  {
                    value: 400000,
                    unit: 'kilometres',
                    date: '19.01.2019',
                  },
                  {
                    value: 390000,
                    unit: 'kilometres',
                    date: '18.01.2019',
                  },
                  {
                    value: 380000,
                    unit: 'kilometres',
                    date: '17.01.2019',
                  },
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: fs
                  .readFileSync(
                    path.resolve(__dirname, '../resources/signatures/1.base64'),
                  )
                  .toString(),
              },
            };
            // Add a new signature
            S3BucketMockService.buckets.push({
              bucketName: `cvs-signature-${process.env.BUCKET}`,
              files: ['1.base64'],
            });

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtHgvSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(testResult)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
                // Remove the signature
                S3BucketMockService.buckets.pop();
              });
          });
        });
      });

      context(
        'and the generated payload is used to call the MOT service',
        () => {
          it('successfully generate a certificate', async () => {
            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtHgvSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            expect.assertions(3);
            return certificateGenerationService
              .generateCertificate(testResult)
              .then((response: any) => {
                expect(response.fileName).toBe(
                  'W01A00310_P012301098765.pdf',
                );
                expect(response.certificateType).toBe('VTG5');
                expect(response.certificateOrder).toEqual({
                  current: 1,
                  total: 2,
                });
              });
          });
        },
      );
    });

    context('when a prs test result is read from the queue', () => {
      const event: any = JSON.parse(
        fs.readFileSync(
          path.resolve(__dirname, '../resources/queue-event-prs.json'),
          'utf8',
        ),
      );
      const testResult: any = JSON.parse(event.Records[1].body);
      let resBody: string = '';
      context('and a payload is generated', () => {
        context('and no signatures were found in the bucket', () => {
          it('should return a PRS payload without signature', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'P012301098765',
                RawVRM: 'VM14MDT',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '01.11.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                Make: 'Isuzu',
                Model: 'FM',
                OdometerHistoryList: [
                  {
                    value: 400000,
                    unit: 'kilometres',
                    date: '19.01.2019',
                  },
                  {
                    value: 390000,
                    unit: 'kilometres',
                    date: '18.01.2019',
                  },
                  {
                    value: 380000,
                    unit: 'kilometres',
                    date: '17.01.2019',
                  },
                ],
              },
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'P012301098765',
                RawVRM: 'VM14MDT',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '01.11.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                PRSDefects: ['1.1.a A registration plate: missing. Front.'],
                Make: 'Isuzu',
                Model: 'FM',
                OdometerHistoryList: [
                  {
                    value: 400000,
                    unit: 'kilometres',
                    date: '19.01.2019',
                  },
                  {
                    value: 390000,
                    unit: 'kilometres',
                    date: '18.01.2019',
                  },
                  {
                    value: 380000,
                    unit: 'kilometres',
                    date: '17.01.2019',
                  },
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtHgvSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(testResult)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });

        context('and lambda-to-lambda calls were unsuccessful', () => {
          it('should return a PRS payload without bodyMake, bodyModel and odometer history', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'P012301098765',
                RawVRM: 'VM14MDT',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '01.11.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
              },
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'P012301098765',
                RawVRM: 'VM14MDT',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '01.11.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                PRSDefects: ['1.1.a A registration plate: missing. Front.'],
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtHgvSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
            // @ts-ignore
            delete techRecordResponseRwtMock.techRecord_make;
            // @ts-ignore
            delete techRecordResponseRwtMock.techRecord_model;
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);
            // Make the functions return undefined
            // Stub CertificateGenerationService getOdometerHistory method to return undefined value.
            getOdometerSpy.mockResolvedValueOnce(undefined as any);

            return certificateGenerationService
              .generatePayload(testResult)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });

        context('and signatures were found in the bucket', () => {
          it('should return a PRS payload with signature', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'P012301098765',
                RawVRM: 'VM14MDT',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '01.11.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                Make: 'Isuzu',
                Model: 'FM',
                OdometerHistoryList: [
                  {
                    value: 400000,
                    unit: 'kilometres',
                    date: '19.01.2019',
                  },
                  {
                    value: 390000,
                    unit: 'kilometres',
                    date: '18.01.2019',
                  },
                  {
                    value: 380000,
                    unit: 'kilometres',
                    date: '17.01.2019',
                  },
                ],
              },
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'P012301098765',
                RawVRM: 'VM14MDT',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '01.11.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                PRSDefects: ['1.1.a A registration plate: missing. Front.'],
                Make: 'Isuzu',
                Model: 'FM',
                OdometerHistoryList: [
                  {
                    value: 400000,
                    unit: 'kilometres',
                    date: '19.01.2019',
                  },
                  {
                    value: 390000,
                    unit: 'kilometres',
                    date: '18.01.2019',
                  },
                  {
                    value: 380000,
                    unit: 'kilometres',
                    date: '17.01.2019',
                  },
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: fs
                  .readFileSync(
                    path.resolve(__dirname, '../resources/signatures/1.base64'),
                  )
                  .toString(),
              },
            };
            // Add a new signature
            S3BucketMockService.buckets.push({
              bucketName: `cvs-signature-${process.env.BUCKET}`,
              files: ['1.base64'],
            });

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtHgvSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(testResult)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
                resBody = payload.body;
                // Remove the signature
                S3BucketMockService.buckets.pop();
              });
          });
        });
      });

      context(
        'and the generated payload is used to call the MOT service',
        () => {
          it('successfully generate a certificate', async () => {
            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtHgvSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            expect.assertions(3);
            return certificateGenerationService
              .generateCertificate(testResult)
              .then((response: any) => {
                expect(response.fileName).toBe(
                  'W01A00310_P012301098765.pdf',
                );
                expect(response.certificateType).toBe('HGV_PRS');
                expect(response.certificateOrder).toEqual({
                  current: 1,
                  total: 2,
                });
              });
          });
        },
      );
    });

    context('when a failing test result is read from the queue', () => {
      const event: any = { ...queueEventFail };
      const testResult: any = JSON.parse(event.Records[1].body);

      context('and a payload is generated', () => {
        context('and no signatures were found in the bucket', () => {
          it('should return a VTG30 payload without signature', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'P012301098765',
                RawVRM: 'VM14MDT',
                EarliestDateOfTheNextTest: '26.12.2019',
                ExpiryDate: '25.02.2020',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                DangerousDefects: [
                  '54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd',
                ],
                MinorDefects: [
                  '54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.',
                ],
                AdvisoryDefects: [
                  '5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc',
                ],
                Make: 'Isuzu',
                Model: 'FM',
                OdometerHistoryList: [
                  {
                    value: 400000,
                    unit: 'kilometres',
                    date: '19.01.2019',
                  },
                  {
                    value: 390000,
                    unit: 'kilometres',
                    date: '18.01.2019',
                  },
                  {
                    value: 380000,
                    unit: 'kilometres',
                    date: '17.01.2019',
                  },
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtHgvSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(testResult)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });

        context('and lambda-to-lambda calls were unsuccessful', () => {
          it('should return a VTG30 payload without bodyMake, bodyModel and odometer history', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'P012301098765',
                RawVRM: 'VM14MDT',
                EarliestDateOfTheNextTest: '26.12.2019',
                ExpiryDate: '25.02.2020',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                DangerousDefects: [
                  '54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd',
                ],
                MinorDefects: [
                  '54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.',
                ],
                AdvisoryDefects: [
                  '5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc',
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtHgvSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
            // @ts-ignore
            delete techRecordResponseRwtMock.techRecord_make;
            // @ts-ignore
            delete techRecordResponseRwtMock.techRecord_model;
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);
            // Make the functions return undefined
            // Stub CertificateGenerationService getOdometerHistory method to return undefined value.
            getOdometerSpy.mockResolvedValueOnce(undefined as any);

            // Stub CertificateGenerationService getVehicleMakeAndModel method to return undefined value.
            return certificateGenerationService
              .generatePayload(testResult)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });

        context('and signatures were found in the bucket', () => {
          it('should return a VTG30 payload with signature', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'P012301098765',
                RawVRM: 'VM14MDT',
                EarliestDateOfTheNextTest: '26.12.2019',
                ExpiryDate: '25.02.2020',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                DangerousDefects: [
                  '54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd',
                ],
                MinorDefects: [
                  '54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.',
                ],
                AdvisoryDefects: [
                  '5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc',
                ],
                Make: 'Isuzu',
                Model: 'FM',
                OdometerHistoryList: [
                  {
                    value: 400000,
                    unit: 'kilometres',
                    date: '19.01.2019',
                  },
                  {
                    value: 390000,
                    unit: 'kilometres',
                    date: '18.01.2019',
                  },
                  {
                    value: 380000,
                    unit: 'kilometres',
                    date: '17.01.2019',
                  },
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: fs
                  .readFileSync(
                    path.resolve(__dirname, '../resources/signatures/1.base64'),
                  )
                  .toString(),
              },
            };
            // Add a new signature
            S3BucketMockService.buckets.push({
              bucketName: `cvs-signature-${process.env.BUCKET}`,
              files: ['1.base64'],
            });

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtHgvSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(testResult)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
                // Remove the signature
                S3BucketMockService.buckets.pop();
              });
          });
        });
      });

      context(
        'and the generated payload is used to call the MOT service',
        () => {
          it('successfully generate a certificate', async () => {
            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtHgvSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwtHgv);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            expect.assertions(3);
            return certificateGenerationService
              .generateCertificate(testResult)
              .then((response: any) => {
                expect(response.fileName).toBe(
                  'W01A00310_P012301098765.pdf',
                );
                expect(response.certificateType).toBe('VTG30');
                expect(response.certificateOrder).toEqual({
                  current: 2,
                  total: 2,
                });
              });
          });
        },
      );
    });
  });

  context('CertGenService for TRL', () => {
    context('when a passing test result for TRL is read from the queue', () => {
      const event: any = { ...queueEventPass };
      const testResult: any = JSON.parse(event.Records[2].body);

      context('and a payload is generated', () => {
        context('and no signatures were found in the bucket', () => {
          it('should return a VTG5A payload without signature', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'T12876765',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '01.11.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                Make: 'STANLEY',
                Model: 'AUTOTRL',
                Trn: 'ABC123',
                IsTrailer: true,
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(testResult)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });

        context('and lambda-to-lambda calls were unsuccessful', () => {
          it('should return a VTG5A payload without bodyMake, bodyModel and odometer history', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                IsTrailer: true,
                Trn: 'ABC123',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'T12876765',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '01.11.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            // @ts-ignore
            delete techRecordResponseRwtMock.techRecord_model;
            // @ts-ignore
            delete techRecordResponseRwtMock.techRecord_make;
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            // Make the functions return undefined
            // Stub CertificateGenerationService getOdometerHistory method to return undefined value.
            getOdometerSpy.mockResolvedValueOnce(undefined as any);

            return certificateGenerationService
              .generatePayload(testResult)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });

        context('and signatures were found in the bucket', () => {
          it('should return a VTG5A payload with signature', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'T12876765',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '01.11.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                Make: 'STANLEY',
                Model: 'AUTOTRL',
                Trn: 'ABC123',
                IsTrailer: true,
              },
              Signature: {
                ImageType: 'png',
                ImageData: fs
                  .readFileSync(
                    path.resolve(__dirname, '../resources/signatures/1.base64'),
                  )
                  .toString(),
              },
            };
            // Add a new signature
            S3BucketMockService.buckets.push({
              bucketName: `cvs-signature-${process.env.BUCKET}`,
              files: ['1.base64'],
            });

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(testResult)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
                // Remove the signature
                S3BucketMockService.buckets.pop();
              });
          });
        });
      });

      context(
        'and the generated payload is used to call the MOT service',
        () => {
          it('successfully generate a certificate', async () => {
            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            expect.assertions(3);
            return certificateGenerationService
              .generateCertificate(testResult)
              .then((response: any) => {
                expect(response.fileName).toBe('W01A00310_T12876765.pdf');
                expect(response.certificateType).toBe('VTG5A');
                expect(response.certificateOrder).toEqual({
                  current: 1,
                  total: 2,
                });
              });
          });
        },
      );
      context(
        'and trailer registration lambda returns status code 404 not found',
        () => {
          it('should return a VTG5A payload without Trn', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'T12876765',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '01.11.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                Make: 'STANLEY',
                Model: 'AUTOTRL',
                IsTrailer: true,
              },
              Signature: {
                ImageType: 'png',
                ImageData: fs
                  .readFileSync(
                    path.resolve(__dirname, '../resources/signatures/1.base64'),
                  )
                  .toString(),
              },
            };
            // Add a new signature
            S3BucketMockService.buckets.push({
              bucketName: `cvs-signature-${process.env.BUCKET}`,
              files: ['1.base64'],
            });

            getTrailerRegistrationStub.mockResolvedValueOnce({ Trn: undefined, IsTrailer: true } as any);

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(testResult)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
                // Remove the signature
                S3BucketMockService.buckets.pop();
              });
          });
        },
      );

      context(
        'and trailer registration lambda returns status code other than 200 or 404 not found',
        () => {
          it('should throw an error', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'T12876765',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '01.11.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                Make: 'STANLEY',
                Model: 'AUTOTRL',
              },
              Signature: {
                ImageType: 'png',
                ImageData: fs
                  .readFileSync(
                    path.resolve(__dirname, '../resources/signatures/1.base64'),
                  )
                  .toString(),
              },
            };
            // Add a new signature
            S3BucketMockService.buckets.push({
              bucketName: `cvs-signature-${process.env.BUCKET}`,
              files: ['1.base64'],
            });

            getTrailerRegistrationStub.mockRejectedValueOnce({ statusCode: 500, body: 'an error occured' } as any);

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(testResult)
              .catch((err: any) => {
                expect(err.statusCode).toBe(500);
                // Remove the signature
                S3BucketMockService.buckets.pop();
              });
          });
        },
      );
    });

    context('when a prs test result is read from the queue', () => {
      const event: any = JSON.parse(
        fs.readFileSync(
          path.resolve(__dirname, '../resources/queue-event-prs.json'),
          'utf8',
        ),
      );
      const testResult: any = JSON.parse(event.Records[2].body);
      let resBody: string = '';
      context('and a payload is generated', () => {
        context('and no signatures were found in the bucket', () => {
          it('should return a PRS payload without signature', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'T12876765',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '01.11.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                Make: 'STANLEY',
                Model: 'AUTOTRL',
                Trn: 'ABC123',
                IsTrailer: true,
              },
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'T12876765',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '01.11.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                PRSDefects: ['1.1.a A registration plate: missing. Front.'],
                Make: 'STANLEY',
                Model: 'AUTOTRL',
                Trn: 'ABC123',
                IsTrailer: true,
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(testResult)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });

        context('and lambda-to-lambda calls were unsuccessful', () => {
          it('should return a PRS payload without bodyMake, bodyModel and odometer history', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                Trn: 'ABC123',
                IsTrailer: true,
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'T12876765',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '01.11.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
              },
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'T12876765',
                IsTrailer: true,
                Trn: 'ABC123',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '01.11.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                PRSDefects: ['1.1.a A registration plate: missing. Front.'],
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            // @ts-ignore
            delete techRecordResponseRwtMock.techRecord_make;
            // @ts-ignore
            delete techRecordResponseRwtMock.techRecord_model;
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            // Make the functions return undefined
            // Stub CertificateGenerationService getOdometerHistory method to return undefined value.
            getOdometerSpy.mockResolvedValueOnce(undefined as any);

            return certificateGenerationService
              .generatePayload(testResult)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });

        context('and signatures were found in the bucket', () => {
          it('should return a PRS payload with signature', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'T12876765',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '01.11.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                Make: 'STANLEY',
                Model: 'AUTOTRL',
                Trn: 'ABC123',
                IsTrailer: true,
              },
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'T12876765',
                ExpiryDate: '25.02.2020',
                EarliestDateOfTheNextTest: '01.11.2019',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                PRSDefects: ['1.1.a A registration plate: missing. Front.'],
                Make: 'STANLEY',
                Model: 'AUTOTRL',
                Trn: 'ABC123',
                IsTrailer: true,
              },
              Signature: {
                ImageType: 'png',
                ImageData: fs
                  .readFileSync(
                    path.resolve(__dirname, '../resources/signatures/1.base64'),
                  )
                  .toString(),
              },
            };
            // Add a new signature
            S3BucketMockService.buckets.push({
              bucketName: `cvs-signature-${process.env.BUCKET}`,
              files: ['1.base64'],
            });

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(testResult)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
                resBody = payload.body;
                // Remove the signature
                S3BucketMockService.buckets.pop();
              });
          });
        });
      });

      context(
        'and the generated payload is used to call the MOT service',
        () => {
          it('successfully generate a certificate', async () => {
            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            expect.assertions(3);
            return certificateGenerationService
              .generateCertificate(testResult)
              .then((response: any) => {
                expect(response.fileName).toBe('W01A00310_T12876765.pdf');
                expect(response.certificateType).toBe('TRL_PRS');
                expect(response.certificateOrder).toEqual({
                  current: 1,
                  total: 2,
                });
              });
          });
        },
      );
    });

    context('when a failing test result is read from the queue', () => {
      const event: any = { ...queueEventFail };
      const testResult: any = JSON.parse(event.Records[2].body);

      context('and a payload is generated', () => {
        context('and no signatures were found in the bucket', () => {
          it('should return a VTG30 payload without signature', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'T12876765',
                EarliestDateOfTheNextTest: '26.12.2019',
                ExpiryDate: '25.02.2020',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                DangerousDefects: [
                  '54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd',
                ],
                MinorDefects: [
                  '54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.',
                ],
                AdvisoryDefects: [
                  '5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc',
                ],
                Make: 'STANLEY',
                Model: 'AUTOTRL',
                Trn: 'ABC123',
                IsTrailer: true,
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(testResult)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });

        context('and lambda-to-lambda calls were unsuccessful', () => {
          it('should return a VTG30 payload without bodyMake, bodyModel and odometer history', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                IsTrailer: true,
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                Trn: 'ABC123',
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'T12876765',
                EarliestDateOfTheNextTest: '26.12.2019',
                ExpiryDate: '25.02.2020',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                DangerousDefects: [
                  '54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd',
                ],
                MinorDefects: [
                  '54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.',
                ],
                AdvisoryDefects: [
                  '5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc',
                ],
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            // @ts-ignore
            delete techRecordResponseRwtMock.techRecord_make;
            // @ts-ignore
            delete techRecordResponseRwtMock.techRecord_model;
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            // Make the functions return undefined
            // Stub CertificateGenerationService getOdometerHistory method to return undefined value.
            getOdometerSpy.mockResolvedValueOnce(undefined as any);

            return certificateGenerationService
              .generatePayload(testResult)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });

        context('and signatures were found in the bucket', () => {
          it('should return a VTG30 payload with signature', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'T12876765',
                EarliestDateOfTheNextTest: '26.12.2019',
                ExpiryDate: '25.02.2020',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                DangerousDefects: [
                  '54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd',
                ],
                MinorDefects: [
                  '54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.',
                ],
                AdvisoryDefects: [
                  '5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc',
                ],
                Make: 'STANLEY',
                Model: 'AUTOTRL',
                Trn: 'ABC123',
                IsTrailer: true,
              },
              Signature: {
                ImageType: 'png',
                ImageData: fs
                  .readFileSync(
                    path.resolve(__dirname, '../resources/signatures/1.base64'),
                  )
                  .toString(),
              },
            };
            // Add a new signature
            S3BucketMockService.buckets.push({
              bucketName: `cvs-signature-${process.env.BUCKET}`,
              files: ['1.base64'],
            });

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(testResult)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
                // Remove the signature
                S3BucketMockService.buckets.pop();
              });
          });
        });
      });

      context(
        'and the generated payload is used to call the MOT service',
        () => {
          it('successfully generate a certificate', async () => {
            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            expect.assertions(3);
            return certificateGenerationService
              .generateCertificate(testResult)
              .then((response: any) => {
                expect(response.fileName).toBe('W01A00310_T12876765.pdf');
                expect(response.certificateType).toBe('VTG30');
                expect(response.certificateOrder).toEqual({
                  current: 2,
                  total: 2,
                });
              });
          });
        },
      );

      context(
        'and trailer registration lambda returns status code 404 not found',
        () => {
          it('should return a VTG30 payload without Trn', async () => {
            const expectedResult: any = {
              Watermark: 'NOT VALID',
              FAIL_DATA: {
                TestNumber: 'W01A00310',
                TestStationPNumber: '09-4129632',
                TestStationName: 'Abshire-Kub',
                CurrentOdometer: {
                  value: 12312,
                  unit: 'kilometres',
                },
                IssuersName: 'CVS Dev1',
                DateOfTheTest: '26.02.2019',
                CountryOfRegistrationCode: 'gb',
                VehicleEuClassification: 'M1',
                RawVIN: 'T12876765',
                EarliestDateOfTheNextTest: '26.12.2019',
                ExpiryDate: '25.02.2020',
                SeatBeltTested: 'Yes',
                SeatBeltPreviousCheckDate: '26.02.2019',
                SeatBeltNumber: 2,
                DangerousDefects: [
                  '54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd',
                ],
                MinorDefects: [
                  '54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.',
                ],
                AdvisoryDefects: [
                  '5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc',
                ],
                Make: 'STANLEY',
                Model: 'AUTOTRL',
                IsTrailer: true,
              },
              Signature: {
                ImageType: 'png',
                ImageData: null,
              },
            };

            getTrailerRegistrationStub.mockResolvedValueOnce({ Trn: undefined, IsTrailer: true });

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(testResult)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
                // Remove the signature
                S3BucketMockService.buckets.pop();
              });
          });
        },
      );
    });
  });

  context('CertGenService for ADR', () => {
    context('when a passing test result for ADR is read from the queue', () => {
      const event: any = cloneDeep(queueEventPass);
      const testResult: any = JSON.parse(event.Records[1].body);
      testResult.testTypes.testTypeId = '50';

      context('and a payload is generated', () => {
        context('and no signatures were found in the bucket', () => {
          it('should return an ADR_PASS payload without signature', async () => {
            const expectedResult: any = JSON.parse(
              fs.readFileSync(
                path.resolve(
                  __dirname,
                  '../resources/doc-gen-payload-adr.json',
                ),
                'utf8',
              ),
            );

            const techRecordResponseAdrMock = JSON.parse(
              fs.readFileSync(
                path.resolve(
                  __dirname,
                  '../resources/tech-records-response-adr.json',
                ),
                'utf8',
              ),
            );

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            delete expectedResult.techRecord_make;
            delete expectedResult.techRecord_model;
            delete expectedResult.ApplicantDetails;
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(testResult)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
              });
          });
        });

        context('and signatures were found in the bucket', () => {
          it('should return an ADR_PASS payload with signature', async () => {
            const expectedResult: any = JSON.parse(
              fs.readFileSync(
                path.resolve(
                  __dirname,
                  '../resources/doc-gen-payload-adr.json',
                ),
                'utf8',
              ),
            );
            expectedResult.Signature.ImageType = 'png';
            expectedResult.Signature.ImageData = fs
              .readFileSync(
                path.resolve(__dirname, '../resources/signatures/1.base64'),
              )
              .toString();
            JSON.parse(
              fs.readFileSync(
                path.resolve(
                  __dirname,
                  '../resources/tech-records-response-adr.json',
                ),
                'utf8',
              ),
            );
            // Add a new signature
            S3BucketMockService.buckets.push({
              bucketName: `cvs-signature-${process.env.BUCKET}`,
              files: ['1.base64'],
            });

            searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

            const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
            callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

            return certificateGenerationService
              .generatePayload(testResult)
              .then((payload: any) => {
                expect(payload).toEqual(expectedResult);
                S3BucketMockService.buckets.pop();
              });
          });
        });
      });
    });
  });

  context('CertGenService for Roadworthiness test', () => {
    context(
      'when a passing test result for Roadworthiness test for HGV or TRL is read from the queue',
      () => {
        const event: any = cloneDeep(queueEventPass);
        const testResult: ITestResult = JSON.parse(event.Records[1].body);
        testResult.testTypes.testTypeId = '122';
        testResult.vin = 'GYFC26269R240355';
        testResult.vrm = 'NKPILNCN';
        context('and a payload is generated', () => {
          context('and no signatures were found in the bucket', () => {
            it('should return an RWT_DATA payload without signature', async () => {
              const expectedResult: ICertificatePayload = cloneDeep(
                docGenRwt[0],
              );

              searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

              const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
              callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

              return certificateGenerationService
                .generatePayload(testResult)
                .then((payload: any) => {
                  expect(payload).toEqual(expectedResult);
                });
            });
          });

          context('and signatures were found in the bucket', () => {
            it('should return an RWT_DATA payload with signature', async () => {
              const expectedResult: ICertificatePayload = cloneDeep(
                docGenRwt[1],
              );

              // Add a new signature
              S3BucketMockService.buckets.push({
                bucketName: `cvs-signature-${process.env.BUCKET}`,
                files: ['1.base64'],
              });

              searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

              const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
              callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

              return certificateGenerationService
                .generatePayload(testResult)
                .then((payload: any) => {
                  expect(payload).toEqual(expectedResult);
                  S3BucketMockService.buckets.pop();
                });
            });
          });
        });
      },
    );
    context(
      'and the generate certificate is used to call the doc generation service',
      () => {
        it('should pass certificateType as RWT', async () => {
          const event: any = cloneDeep(queueEventPass);
          const testResult: ITestResult = JSON.parse(event.Records[1].body);
          testResult.testTypes.testTypeId = '122';
          testResult.vin = 'GYFC26269R240355';
          testResult.vrm = 'NKPILNCN';

          searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

          const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
          callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

          expect.assertions(1);
          return certificateGenerationService
            .generateCertificate(testResult)
            .then((response: any) => {
              expect(response.certificateType).toBe('RWT');
            });
        });
      },
    );

    context(
      'when a failing test result for Roadworthiness test for HGV or TRL is read from the queue',
      () => {
        const event: any = cloneDeep(queueEventFail);
        const testResult: ITestResult = JSON.parse(event.Records[2].body);
        testResult.testTypes.testTypeId = '91';
        testResult.vin = 'T12768594';
        testResult.trailerId = '0285678';
        context('and a payload is generated', () => {
          context('and no signatures were found in the bucket', () => {
            it('should return an RWT_DATA payload without signature', async () => {
              const expectedResult: ICertificatePayload = cloneDeep(
                docGenRwt[4],
              );

              searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

              const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
              callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

              const payload = await certificateGenerationService
                .generatePayload(testResult);
              expect(payload).toEqual(expectedResult);
            });
          });

          context('and signatures were found in the bucket', () => {
            it('should return an RWT_DATA payload with signature', async () => {
              const expectedResult: ICertificatePayload = cloneDeep(
                docGenRwt[3],
              );

              // Add a new signature
              S3BucketMockService.buckets.push({
                bucketName: `cvs-signature-${process.env.BUCKET}`,
                files: ['1.base64'],
              });

              searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

              const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
              callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

              const payload = await certificateGenerationService
                .generatePayload(testResult);
              expect(payload).toEqual(expectedResult);
              S3BucketMockService.buckets.pop();
            });
          });
        });
      },
    );
  });

  context('CertGenService for IVA 30 test', () => {
    context(
      'when a failing test result for basic IVA test is read from the queue',
      () => {
        const event: any = cloneDeep(queueEventFail);
        const testResult: ITestResult = JSON.parse(event.Records[3].body); // retrieve record
        context('and a payload is generated', () => {
          context('and no signatures were found in the bucket', () => {
            it('should return an IVA_30 payload without signature', async () => {
              const expectedResult: ICertificatePayload = cloneDeep(
                docGenIva30[0],
              );

              searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

              const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
              callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

              return certificateGenerationService
                .generatePayload(testResult)
                .then((payload: any) => {
                  expect(payload).toEqual(expectedResult);
                });
            });
          });

          context('and signatures were found in the bucket', () => {
            it('should return an IVA 30 payload with signature', async () => {
              const expectedResult: ICertificatePayload = cloneDeep(
                docGenIva30[1],
              );

              // Add a new signature
              S3BucketMockService.buckets.push({
                bucketName: `cvs-signature-${process.env.BUCKET}`,
                files: ['1.base64'],
              });

              searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

              const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
              callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

              return certificateGenerationService
                .generatePayload(testResult)
                .then((payload: any) => {
                  expect(payload).toEqual(expectedResult);
                  S3BucketMockService.buckets.pop();
                });
            });
          });

          context(
            'and the generated payload is used to call the MOT service',
            () => {
              it('successfully generate a certificate', async () => {
                searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

                const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                expect.assertions(3);
                return certificateGenerationService
                  .generateCertificate(testResult)
                  .then((response: any) => {
                    expect(response.fileName).toBe(
                      'W01A00310_T12876765.pdf',
                    );
                    expect(response.certificateType).toBe('IVA30');
                    expect(response.certificateOrder).toEqual({
                      current: 2,
                      total: 2,
                    });
                  });
              });
            },
          );
        });
      },
    );
  });

  context('CertGenService for MSVA 30 test', () => {
    context(
      'when a failing test result MSVA test is read from the queue',
      () => {
        const event: any = cloneDeep(queueEventFail);
        const testResult: ITestResult = JSON.parse(event.Records[8].body); // retrieve record
        context('and a payload is generated', () => {
          context('and no signatures were found in the bucket', () => {
            it('should return an MSVA_30 payload without signature', async () => {
              const expectedResult: ICertificatePayload = cloneDeep(
                docGenMsva30[0],
              );

              searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

              const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
              callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

              return certificateGenerationService
                .generatePayload(testResult)
                .then((payload: any) => {
                  expect(payload).toEqual(expectedResult);
                });
            });
          });

          context('and signatures were found in the bucket', () => {
            it('should return a MSVA 30 payload with signature', async () => {
              const expectedResult: ICertificatePayload = cloneDeep(
                docGenMsva30[1],
              );

              // Add a new signature
              S3BucketMockService.buckets.push({
                bucketName: `cvs-signature-${process.env.BUCKET}`,
                files: ['1.base64'],
              });

              searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

              const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
              callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

              return certificateGenerationService
                .generatePayload(testResult)
                .then((payload: any) => {
                  expect(payload).toEqual(expectedResult);
                  S3BucketMockService.buckets.pop();
                });
            });
          });

          context(
            'and the generated payload is used to call the MOT service',
            () => {
              it('successfully generate a certificate', async () => {
                searchTechRecordsSpy.mockResolvedValue(techRecordsRwtSearch);

                const techRecordResponseRwtMock = cloneDeep(techRecordsRwt);
                callGetTechRecordSpy.mockResolvedValue(techRecordResponseRwtMock as any);

                expect.assertions(3);
                return certificateGenerationService
                  .generateCertificate(testResult)
                  .then((response: any) => {
                    expect(response.fileName).toBe(
                      'W01A00128_P0123010956789.pdf',
                    );
                    expect(response.certificateType).toBe('MSVA30');
                    expect(response.certificateOrder).toEqual({
                      current: 2,
                      total: 2,
                    });
                  });
              });
            },
          );
        });
      },
    );
  });
});
