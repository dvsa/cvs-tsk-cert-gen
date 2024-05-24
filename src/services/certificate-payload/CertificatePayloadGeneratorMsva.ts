import { Service } from 'typedi';
import moment from 'moment';
import { ITestResult } from '../../models/ITestResult';
import { DefectService } from '../DefectService';
import { ICertificatePayloadGenerator } from '../ICertificatePayloadGenerator';
import { ICertificatePayload } from '../../models/ICertificatePayload';
import { CERTIFICATE_DATA } from '../../models/Enums';

@Service()
export class CertificatePayloadGeneratorMsva implements ICertificatePayloadGenerator {
  constructor(private defectService: DefectService) {
  }

  initialise(type: CERTIFICATE_DATA, isWelsh: boolean = false) {
  }

  public generate(testResult: ITestResult): ICertificatePayload {
    const msvaFailDetailsForDocGen = {
      vin: testResult.vin,
      serialNumber: testResult.vrm,
      vehicleZNumber: testResult.vrm,
      make: testResult.make,
      model: testResult.model,
      type: testResult.vehicleType,
      testerName: testResult.testerName,
      date: moment(testResult.testTypes.testTypeStartTimestamp).format('DD/MM/YYYY'),
      retestDate: this.defectService.calculateVehicleApprovalRetestDate(testResult.testTypes.testTypeStartTimestamp),
      station: testResult.testStationName,
      additionalDefects: this.defectService.formatVehicleApprovalAdditionalDefects(testResult.testTypes.customDefects),
      requiredStandards: testResult.testTypes.requiredStandards,
    };

    return {
      MSVA_DATA: msvaFailDetailsForDocGen
    } as ICertificatePayload;
  }
}
