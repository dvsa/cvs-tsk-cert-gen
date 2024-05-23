import { Inject, Service } from 'typedi';
import moment from 'moment';
import { ITestResult } from '../../models/ITestResult';
import { TechRecordsService } from '../TechRecordsService';
import { TEST_RESULTS, VEHICLE_TYPES } from '../../models/Enums';
import { IRoadworthinessCertificateData } from '../../models/IRoadworthinessCertificateData';
import { DefectService } from '../DefectService';
import { ICertificatePayloadGenerator } from '../ICertificatePayloadGenerator';
import { ICertificatePayload } from '../../models/ICertificatePayload';

@Service()
export class CertificatePayloadGeneratorRwt implements ICertificatePayloadGenerator {
  private readonly defectService: DefectService;

  private readonly techRecordsService: TechRecordsService;

  constructor(@Inject() defectService: DefectService, @Inject() techRecordsService: TechRecordsService) {
    this.defectService = defectService;
    this.techRecordsService = techRecordsService;
  }

  public async generate(testResult: ITestResult): Promise<ICertificatePayload> {
    const weightDetails = await this.techRecordsService.getWeightDetails(testResult);

    let defectRWTList: any;
    if (testResult.testTypes.testResult as TEST_RESULTS === TEST_RESULTS.FAIL) {
      defectRWTList = [];
      testResult.testTypes.defects.forEach((defect: any) => {
        defectRWTList.push(this.defectService.formatDefect(defect));
      });
    } else {
      defectRWTList = undefined;
    }

    const testType: any = testResult.testTypes;

    const resultPass: IRoadworthinessCertificateData = {
      Dgvw: weightDetails.dgvw,
      Weight2: weightDetails.weight2,
      VehicleNumber: testResult.vehicleType as VEHICLE_TYPES === VEHICLE_TYPES.TRL
        ? testResult.trailerId
        : testResult.vrm,
      Vin: testResult.vin,
      IssuersName: testResult.testerName,
      DateOfInspection: moment(testType.testTypeStartTimestamp).format('DD.MM.YYYY'),
      TestStationPNumber: testResult.testStationPNumber,
      DocumentNumber: testType.certificateNumber,
      Date: moment(testType.testTypeStartTimestamp).format('DD.MM.YYYY'),
      Defects: defectRWTList,
      IsTrailer: testResult.vehicleType as VEHICLE_TYPES === VEHICLE_TYPES.TRL,
    };

    return {
      RWT_DATA: resultPass
    } as ICertificatePayload;
  }
}
