import { Service } from 'typedi';
import moment from 'moment';
import { ITestResult } from '../../models/ITestResult';
import { DefectService } from '../DefectService';
import { ICertificatePayloadCommand } from '../ICertificatePayloadCommand';
import { ICertificatePayload } from '../../models/ICertificatePayload';
import { CERTIFICATE_DATA } from '../../models/Enums';

@Service()
export class MsvaPayloadCommand implements ICertificatePayloadCommand {
  private type?: CERTIFICATE_DATA;

  constructor(private defectService: DefectService) {
  }

  private certificateIsAnMsva = (): boolean => this.type === CERTIFICATE_DATA.MSVA_DATA;

  initialise(type: CERTIFICATE_DATA, isWelsh: boolean = false) {
    this.type = type;
  }

  public generate(testResult: ITestResult): ICertificatePayload {
    if (!this.certificateIsAnMsva()) {
      return {} as ICertificatePayload;
    }

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
