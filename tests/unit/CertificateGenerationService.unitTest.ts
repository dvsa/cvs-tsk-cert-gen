import 'reflect-metadata';
import Container from 'typedi';
import { LambdaService } from '../../src/services/LambdaService';
import { CERTIFICATE_DATA } from '../../src/models/Enums';
import queueEventFail from '../resources/queue-event-fail.json';
import queueEventFailPRS from '../resources/queue-event-fail-prs.json';
import { S3BucketService } from '../../src/services/S3BucketService';
import { S3BucketMockService } from '../models/S3BucketMockService';
import { LambdaMockService } from '../models/LambdaMockService';
import { CertificatePayloadGenerator } from '../../src/certificate/CertificatePayloadGenerator';
import { TestResultRepository } from '../../src/test-result/TestResultRepository';
import { TechRecordsService } from '../../src/tech-record/TechRecordsService';

describe('Certificate Generation Service', () => {
  Container.set(S3BucketService, new S3BucketMockService());

  const lambdaService = new LambdaMockService();
  LambdaMockService.populateFunctions();
  const invokeSpy = jest.spyOn(lambdaService, 'invoke');
  Container.set(LambdaService, lambdaService);

  const techRecordsService = Container.get(TechRecordsService);
  const getVehicleMakeAndModelMock = jest.spyOn(techRecordsService, 'getVehicleMakeAndModel');
  Container.set(TechRecordsService, techRecordsService);

  const testResultRepository = Container.get(TestResultRepository);
  const getOdometerSpy = jest.spyOn(testResultRepository, 'getOdometerHistory');
  Container.set(TestResultRepository, testResultRepository);

  afterEach(() => {
    invokeSpy.mockReset();
    getVehicleMakeAndModelMock.mockClear();
  });

  const payloadGenerator = Container.get(CertificatePayloadGenerator);

  context('when a failing test result is read from the queue', () => {
    const event: any = { ...queueEventFailPRS };
    const testResult: any = JSON.parse(event.Records[0].body);

    context('and certificate Data is generated', () => {
      context('and test-result contains a Dagerous Defect with Major defect rectified', () => {
        it('should return Certificate Data with PRSDefects list in Fail data', async () => {
          const expectedResult: any = {
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
            MajorDefects: undefined,
            MinorDefects: [
              '54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.',
            ],
            AdvisoryDefects: [
              '5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc',
            ],
            PRSDefects: ['1.1.a A registration plate: missing. Front.'],
          };

          getVehicleMakeAndModelMock.mockResolvedValue(undefined as any);
          getOdometerSpy.mockResolvedValueOnce(undefined as any);

          return payloadGenerator
            .generateCertificateData(testResult, CERTIFICATE_DATA.FAIL_DATA)
            .then((payload: any) => {
              expect(payload.FAIL_DATA).toEqual(expectedResult);
            });
        });
      });
    });

    const testResult2: any = JSON.parse(event.Records[1].body);
    context('and certificate Data is generated', () => {
      context('and test-result contains a Major Defect with Dangerous defect rectified', () => {
        it('should return Certificate Data with PRSDefects list in Fail Data', async () => {
          const expectedResult: any = {
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
            DangerousDefects: undefined,
            MajorDefects: ['1.1.a A registration plate: missing. Front.'],
            MinorDefects: [
              '54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.',
            ],
            AdvisoryDefects: [
              '5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc',
            ],
            PRSDefects: [
              '54.1.a.ii Power steering: not working correctly and obviously affects steering control. Axles: 7. Inner Offside. Asdasd',
            ],
          };

          getVehicleMakeAndModelMock.mockResolvedValue(undefined as any);
          getOdometerSpy.mockResolvedValueOnce(undefined as any);

          return payloadGenerator
            .generateCertificateData(testResult2, CERTIFICATE_DATA.FAIL_DATA)
            .then((payload: any) => {
              expect(payload.FAIL_DATA).toEqual(expectedResult);
            });
        });
      });
    });

    const testResult3: any = JSON.parse(event.Records[2].body);

    context('and certificate Data is generated', () => {
      context('and test-result contains a Major and Dagerous Defect with no Major or Dagerous defect rectified', () => {
        it('should return Certificate Data with 0 PRSDefects list in Fail Data', async () => {
          const expectedResult: any = {
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
            MajorDefects: ['1.1.a A registration plate: missing. Front.'],
            MinorDefects: [
              '54.1.d.i Power steering: reservoir is below minimum level. Axles: 7. Outer Nearside.',
            ],
            AdvisoryDefects: [
              '5.1 Compression Ignition Engines Statutory Smoke Meter Test: null Dasdasdccc',
            ],
            PRSDefects: undefined,
          };

          getVehicleMakeAndModelMock.mockResolvedValue(undefined as any);
          getOdometerSpy.mockResolvedValueOnce(undefined as any);

          return payloadGenerator
            .generateCertificateData(testResult3, CERTIFICATE_DATA.FAIL_DATA)
            .then((payload: any) => {
              expect(payload.FAIL_DATA).toEqual(expectedResult);
            });
        });
      });
    });
  });

  context('when a failing test result is read from the queue', () => {
    const event: any = { ...queueEventFail };
    const testResult1: any = JSON.parse(event.Records[3].body);

    context('and certificate Data is generated', () => {
      context(
        'and test-result is an IVA test with a required standard and a test status of fail',
        () => {
          it('should return Certificate Data with requiredStandards in IVA_DATA', async () => {
            const expectedResult: any = {
              additionalDefects: [
                {
                  defectName: 'N/A',
                  defectNotes: '',
                },
              ],
              bodyType: 'some bodyType',
              date: '28/11/2023',
              requiredStandards: [
                {
                  additionalInfo: true,
                  additionalNotes: 'The exhaust was held on with blue tac',
                  inspectionTypes: [
                    'normal',
                    'basic',
                  ],
                  prs: false,
                  refCalculation: '1.1',
                  requiredStandard: 'The exhaust must be securely mounted',
                  rsNumber: 1,
                  sectionDescription: 'Noise',
                  sectionNumber: '01',
                },
              ],
              make: 'some make',
              model: 'some model',
              reapplicationDate: '27/05/2024',
              serialNumber: 'C456789',
              station: 'Abshire-Kub',
              testCategoryBasicNormal: 'Basic',
              testCategoryClass: 'm1',
              testerName: 'CVS Dev1',
              vehicleTrailerNrNo: 'C456789',
              vin: 'T12876765',
            };

            return payloadGenerator
              .generateCertificateData(testResult1, CERTIFICATE_DATA.IVA_DATA)
              .then((payload: any) => {
                expect(payload.IVA_DATA).toEqual(expectedResult);
              });
          });
        },
      );

      const testResult2: any = JSON.parse(event.Records[4].body);
      context(
        'and test-result is an IVA test with multiple required standards and a test status of fail',
        () => {
          it('should return Certificate Data with requiredStandards in IVA_DATA', async () => {
            const expectedResult: any = {
              additionalDefects: [
                {
                  defectName: 'N/A',
                  defectNotes: '',
                },
              ],
              bodyType: 'some bodyType',
              date: '28/11/2023',
              requiredStandards: [
                {
                  additionalInfo: true,
                  additionalNotes: 'The exhaust was held on with blue tac',
                  inspectionTypes: [
                    'normal',
                    'basic',
                  ],
                  prs: false,
                  refCalculation: '1.1',
                  requiredStandard: 'The exhaust must be securely mounted',
                  rsNumber: 1,
                  sectionDescription: 'Noise',
                  sectionNumber: '01',
                },
                {
                  additionalInfo: false,
                  additionalNotes: null,
                  inspectionTypes: [
                    'basic',
                  ],
                  prs: false,
                  refCalculation: '1.5',
                  requiredStandard: 'The stationary noise must have a measured sound level not exceeding 99dbA. (see Notes 2 & 3).',
                  rsNumber: 5,
                  sectionDescription: 'Noise',
                  sectionNumber: '01',
                },
              ],
              make: 'some make',
              model: 'some model',
              reapplicationDate: '27/05/2024',
              serialNumber: 'C456789',
              station: 'Abshire-Kub',
              testCategoryBasicNormal: 'Basic',
              testCategoryClass: 'm1',
              testerName: 'CVS Dev1',
              vehicleTrailerNrNo: 'C456789',
              vin: 'T12876765',
            };

            return payloadGenerator
              .generateCertificateData(testResult2, CERTIFICATE_DATA.IVA_DATA)
              .then((payload: any) => {
                expect(payload.IVA_DATA).toEqual(expectedResult);
              });
          });
        },
      );

      const testResult3: any = JSON.parse(event.Records[5].body);
      context(
        'and test-result is an IVA test with a required standard and custom defect, with a test status of fail',
        () => {
          it('should return Certificate Data with requiredStandards and additionalDefects in IVA_DATA', async () => {
            const expectedResult: any = {
              additionalDefects: [
                'Some custom defect one',
                'Some other custom defect two',
              ],
              bodyType: 'some bodyType',
              date: '28/11/2023',
              requiredStandards: [
                {
                  additionalInfo: true,
                  additionalNotes: 'The exhaust was held on with blue tac',
                  inspectionTypes: [
                    'normal',
                    'basic',
                  ],
                  prs: false,
                  refCalculation: '1.1',
                  requiredStandard: 'The exhaust must be securely mounted',
                  rsNumber: 1,
                  sectionDescription: 'Noise',
                  sectionNumber: '01',
                },
              ],
              make: 'some make',
              model: 'some model',
              reapplicationDate: '27/05/2024',
              serialNumber: 'C456789',
              station: 'Abshire-Kub',
              testCategoryBasicNormal: 'Basic',
              testCategoryClass: 'm1',
              testerName: 'CVS Dev1',
              vehicleTrailerNrNo: 'C456789',
              vin: 'T12876765',
            };

            return payloadGenerator
              .generateCertificateData(testResult3, CERTIFICATE_DATA.IVA_DATA)
              .then((payload: any) => {
                expect(payload.IVA_DATA).toEqual(expectedResult);
              });
          });
        },
      );

      const testResult4: any = JSON.parse(event.Records[6].body);
      context(
        'and trailer test-result is an IVA test with a required standard, with a test status of fail',
        () => {
          it('return Certificate Data with requiredStandards and additionalDefects in IVA_DATA', async () => {
            const expectedResult: any = {
              additionalDefects: [
                {
                  defectName: 'N/A',
                  defectNotes: '',
                },
              ],
              bodyType: 'some bodyType',
              date: '28/11/2023',
              requiredStandards: [
                {
                  additionalInfo: false,
                  additionalNotes: null,
                  inspectionTypes: [
                    'basic',
                  ],
                  prs: false,
                  refCalculation: '1.5',
                  requiredStandard: 'The stationary noise must have a measured sound level not exceeding 99dbA. (see Notes 2 & 3).',
                  rsNumber: 5,
                  sectionDescription: 'Noise',
                  sectionNumber: '01',
                },
              ],
              make: 'some make',
              model: 'some model',
              reapplicationDate: '27/05/2024',
              serialNumber: 'C456789',
              station: 'Abshire-Kub',
              testCategoryBasicNormal: 'Basic',
              testCategoryClass: 'm1',
              testerName: 'CVS Dev1',
              vehicleTrailerNrNo: 'C456789',
              vin: 'T12876765',
            };

            return payloadGenerator
              .generateCertificateData(testResult4, CERTIFICATE_DATA.IVA_DATA)
              .then((payload: any) => {
                expect(payload.IVA_DATA).toEqual(expectedResult);
              });
          });
        },
      );

      const testResult5: any = JSON.parse(event.Records[7].body);
      context(
        'and test-result is a Normal IVA test with a required standard and a test status of fail',
        () => {
          it('should return Certificate Data with requiredStandards in IVA_DATA', async () => {
            const expectedResult: any = {
              additionalDefects: [
                {
                  defectName: 'N/A',
                  defectNotes: '',
                },
              ],
              bodyType: 'some bodyType',
              date: '28/11/2023',
              requiredStandards: [
                {
                  additionalInfo: true,
                  additionalNotes: 'The exhaust was held on with blue tac',
                  inspectionTypes: [
                    'normal',
                    'basic',
                  ],
                  prs: false,
                  refCalculation: '1.1',
                  requiredStandard: 'The exhaust must be securely mounted',
                  rsNumber: 1,
                  sectionDescription: 'Noise',
                  sectionNumber: '01',
                },
              ],
              make: 'some make',
              model: 'some model',
              reapplicationDate: '27/05/2024',
              serialNumber: 'C456789',
              station: 'Abshire-Kub',
              testCategoryBasicNormal: 'Normal',
              testCategoryClass: 'm1',
              testerName: 'CVS Dev1',
              vehicleTrailerNrNo: 'C456789',
              vin: 'T12876765',
            };

            return payloadGenerator
              .generateCertificateData(testResult5, CERTIFICATE_DATA.IVA_DATA)
              .then((payload: any) => {
                expect(payload.IVA_DATA).toEqual(expectedResult);
              });
          });
        },
      );

      const testResult6: any = JSON.parse(event.Records[8].body);
      context(
        'and test-result is a MSVA test with a required standard and a test status of fail',
        () => {
          it('should return Certificate Data with requiredStandards in MSVA_DATA', async () => {
            const expectedResult: any = {
              vin: 'P0123010956789',
              serialNumber: 'ZX345CV',
              vehicleZNumber: 'ZX345CV',
              make: null,
              model: null,
              type: 'motorcycle',
              testerName: 'CVS Dev1',
              date: '04/03/2024',
              retestDate: '03/09/2024',
              station: 'Abshire-Kub',
              additionalDefects: [
                {
                  defectName: 'N/A',
                  defectNotes: '',
                },
              ],
              requiredStandards: [
                {
                  additionalInfo: true,
                  additionalNotes: 'The bulbs were slightly worn',
                  inspectionTypes: [],
                  prs: false,
                  refCalculation: '6.2a',
                  requiredStandard: 'An obligatory (or optional) lamp or reflector;  incorrect number fitted',
                  rsNumber: 2,
                  sectionDescription: 'Lighting',
                  sectionNumber: '06',
                },
              ],
            };

            return payloadGenerator
              .generateCertificateData(testResult6, CERTIFICATE_DATA.MSVA_DATA)
              .then((payload: any) => {
                expect(payload.MSVA_DATA).toEqual(expectedResult);
              });
          });
        },
      );

      const testResult7: any = JSON.parse(event.Records[9].body);
      context(
        'and test-result is a MSVA test with multiple required standards and a test status of fail',
        () => {
          it('should return Certificate Data with requiredStandards in MSVA_DATA', async () => {
            const expectedResult: any = {
              vin: 'P0123010956789',
              serialNumber: 'ZX345CV',
              vehicleZNumber: 'ZX345CV',
              make: null,
              model: null,
              type: 'motorcycle',
              testerName: 'CVS Dev1',
              date: '04/03/2024',
              retestDate: '03/09/2024',
              station: 'Abshire-Kub',
              additionalDefects: [
                {
                  defectName: 'N/A',
                  defectNotes: '',
                },
              ],
              requiredStandards: [
                {
                  additionalInfo: true,
                  additionalNotes: 'The bulbs were slightly worn',
                  inspectionTypes: [],
                  prs: false,
                  refCalculation: '6.2a',
                  requiredStandard: 'An obligatory (or optional) lamp or reflector;  incorrect number fitted',
                  rsNumber: 2,
                  sectionDescription: 'Lighting',
                  sectionNumber: '06',
                },
                {
                  additionalInfo: true,
                  additionalNotes: 'Switch was missing',
                  inspectionTypes: [],
                  prs: false,
                  refCalculation: '6.3a',
                  requiredStandard: 'Any light switch; missing',
                  rsNumber: 3,
                  sectionDescription: 'Lighting',
                  sectionNumber: '06',
                },
              ],
            };

            return payloadGenerator
              .generateCertificateData(testResult7, CERTIFICATE_DATA.MSVA_DATA)
              .then((payload: any) => {
                expect(payload.MSVA_DATA).toEqual(expectedResult);
              });
          });
        },
      );

      const testResult8: any = JSON.parse(event.Records[10].body);
      context(
        'and test-result is a MSVA test with a required standard and custom defect, with a test status of fail',
        () => {
          it('should return Certificate Data with requiredStandards and additionalDefects in IVA_DATA', async () => {
            const expectedResult: any = {
              vin: 'P0123010956789',
              serialNumber: 'ZX345CV',
              vehicleZNumber: 'ZX345CV',
              make: null,
              model: null,
              type: 'motorcycle',
              testerName: 'CVS Dev1',
              date: '04/03/2024',
              retestDate: '03/09/2024',
              station: 'Abshire-Kub',
              additionalDefects: [
                {
                  defectName: 'Rust',
                  defectNotes: 'slight rust around the wheel arch',
                },
              ],
              requiredStandards: [
                {
                  additionalInfo: true,
                  additionalNotes: 'The bulbs were slightly worn',
                  inspectionTypes: [],
                  prs: false,
                  refCalculation: '6.2a',
                  requiredStandard: 'An obligatory (or optional) lamp or reflector;  incorrect number fitted',
                  rsNumber: 2,
                  sectionDescription: 'Lighting',
                  sectionNumber: '6',
                },
              ],
            };

            return payloadGenerator
              .generateCertificateData(testResult8, CERTIFICATE_DATA.MSVA_DATA)
              .then((payload: any) => {
                expect(payload.MSVA_DATA).toEqual(expectedResult);
              });
          });
        },
      );
    });
  });
});
