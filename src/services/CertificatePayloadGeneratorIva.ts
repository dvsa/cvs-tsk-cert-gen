import { Inject, Service } from 'typedi';
import moment from 'moment';
import { ITestResult } from '../models/ITestResult';
import { DefectService } from './DefectService';
import { IVA_30 } from '../models/Enums';
import { TestService } from './TestService';
import { ICertificatePayloadGenerator } from './ICertificatePayloadGenerator';

@Service()
export class CertificatePayloadGeneratorIva implements ICertificatePayloadGenerator {
  private readonly defectService: DefectService;

  private readonly testService: TestService;

  constructor(@Inject() defectService: DefectService, @Inject() testService: TestService) {
    this.defectService = defectService;
    this.testService = testService;
  }

  public generate(testResult: ITestResult): any {
    const ivaFailDetailsForDocGen = {
      vin: testResult.vin,
      serialNumber: testResult.vehicleType === 'trl' ? testResult.trailerId : testResult.vrm,
      vehicleTrailerNrNo: testResult.vehicleType === 'trl' ? testResult.trailerId : testResult.vrm,
      testCategoryClass: testResult.euVehicleCategory,
      testCategoryBasicNormal: this.testService.isBasicIvaTest(testResult.testTypes.testTypeId) ? IVA_30.BASIC : IVA_30.NORMAL,
      make: testResult.make,
      model: testResult.model,
      bodyType: testResult.bodyType?.description,
      date: moment(testResult.testTypes.testTypeStartTimestamp).format('DD/MM/YYYY'),
      testerName: testResult.testerName,
      reapplicationDate: this.defectService.calculateVehicleApprovalRetestDate(testResult.testTypes.testTypeStartTimestamp),
      station: testResult.testStationName,
      additionalDefects: this.defectService.formatVehicleApprovalAdditionalDefects(testResult.testTypes.customDefects),
      requiredStandards: testResult.testTypes.requiredStandards,
    };
    return ivaFailDetailsForDocGen;
  }
}
