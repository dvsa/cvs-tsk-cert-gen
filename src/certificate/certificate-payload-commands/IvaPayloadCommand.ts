import { Service } from 'typedi';
import moment from 'moment';
import { ITestResult } from '../../models/ITestResult';
import { DefectService } from '../../defect/DefectService';
import { CERTIFICATE_DATA, IVA_30 } from '../../models/Enums';
import { TestService } from '../../test-result/TestService';
import { ICertificatePayloadCommand } from '../ICertificatePayloadCommand';
import { ICertificatePayload } from '../../models/ICertificatePayload';

@Service()
export class IvaPayloadCommand implements ICertificatePayloadCommand {
  private type?: CERTIFICATE_DATA;

  constructor(private defectService: DefectService, private testService: TestService) {
  }

  private certificateIsAnIva = (): boolean => this.type === CERTIFICATE_DATA.IVA_DATA;

  initialise(type: CERTIFICATE_DATA, isWelsh: boolean = false) {
    this.type = type;
  }

  public generate(testResult: ITestResult): Promise<ICertificatePayload> {
    if (!this.certificateIsAnIva()) {
      return Promise.resolve({} as ICertificatePayload);
    }

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

    return Promise.resolve({
      IVA_DATA: ivaFailDetailsForDocGen
    } as ICertificatePayload);
  }
}
