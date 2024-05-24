import { Service } from 'typedi';
import moment from 'moment';
import { ITestResult } from '../../models/ITestResult';
import { TechRecordsService } from '../TechRecordsService';
import { CERTIFICATE_DATA, TEST_RESULTS, VEHICLE_TYPES } from '../../models/Enums';
import { IRoadworthinessCertificateData } from '../../models/IRoadworthinessCertificateData';
import { DefectService } from '../DefectService';
import { ICertificatePayloadCommand } from '../ICertificatePayloadCommand';
import { ICertificatePayload } from '../../models/ICertificatePayload';

@Service()
export class RwtPayloadCommand implements ICertificatePayloadCommand {
  private type?: CERTIFICATE_DATA;

  constructor(private defectService: DefectService, private techRecordsService: TechRecordsService) {
  }

  private certificateIsAnRwt = (): boolean => this.type === CERTIFICATE_DATA.RWT_DATA;

  initialise(type: CERTIFICATE_DATA, isWelsh: boolean = false) {
    this.type = type;
  }

  public async generate(testResult: ITestResult): Promise<ICertificatePayload> {
    if (!this.certificateIsAnRwt()) {
      return {} as ICertificatePayload;
    }

    const weightDetails = await this.techRecordsService.getWeightDetails(testResult);

    let defectRWTList: any;
    if (testResult.testTypes.testResult as TEST_RESULTS === TEST_RESULTS.FAIL) {
      defectRWTList = testResult.testTypes.defects.map((defect: any) => this.defectService.formatDefect(defect));
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
