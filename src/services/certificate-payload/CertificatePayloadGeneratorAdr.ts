import { Inject, Service } from 'typedi';
import { ITestResult } from '../../models/ITestResult';
import { TechRecordType } from '../../models/Types';
import { TechRecordsService } from '../TechRecordsService';
import { ICertificatePayloadGenerator } from '../ICertificatePayloadGenerator';
import { ICertificatePayload } from '../../models/ICertificatePayload';

@Service()
export class CertificatePayloadGeneratorAdr implements ICertificatePayloadGenerator {
  private readonly techRecordsService: TechRecordsService;

  constructor(@Inject() techRecordsService: TechRecordsService) {
    this.techRecordsService = techRecordsService;
  }

  public async generate(testResult: ITestResult): Promise<ICertificatePayload> {
    const adrDetails: TechRecordType<any> = await this.techRecordsService.getAdrDetails(testResult);
    const makeAndModel = await this.techRecordsService.getVehicleMakeAndModel(testResult);

    const docGenPayloadAdr = {
      ChasisNumber: testResult.vin,
      RegistrationNumber: testResult.vrm,
      ApplicantDetails: {
        name: adrDetails?.techRecord_applicantDetails_name,
        address1: adrDetails?.techRecord_applicantDetails_address1,
        address2: adrDetails?.techRecord_applicantDetails_address2,
        address3: adrDetails?.techRecord_applicantDetails_address1,
        postTown: adrDetails?.techRecord_applicantDetails_postTown,
        postCode: adrDetails?.techRecord_applicantDetails_postCode,
        telephoneNumber: adrDetails?.techRecord_applicantDetails_telephoneNumber,
        emailAddress: adrDetails?.techRecord_applicantDetails_emailAddress,
      },
      VehicleType: adrDetails?.techRecord_adrDetails_vehicleDetails_type,
      PermittedDangerousGoods: adrDetails?.techRecord_adrDetails_permittedDangerousGoods,
      BrakeEndurance: adrDetails?.techRecord_adrDetails_brakeEndurance,
      Weight: adrDetails?.techRecord_adrDetails_weight,
      TankManufacturer: adrDetails?.techRecord_adrDetails_tank_tankDetails_tankStatement_statement
        ? adrDetails.techRecord_adrDetails_tank_tankDetails_tankManufacturer
        : undefined,
      Tc2InitApprovalNo: adrDetails?.techRecord_adrDetails_tank_tankDetails_tc2Details_tc2IntermediateApprovalNo,
      TankManufactureSerialNo: adrDetails?.techRecord_adrDetails_tank_tankDetails_tankManufacturerSerialNo,
      YearOfManufacture: adrDetails?.techRecord_adrDetails_tank_tankDetails_yearOfManufacture,
      TankCode: adrDetails?.techRecord_adrDetails_tank_tankDetails_tankCode,
      SpecialProvisions: adrDetails?.techRecord_adrDetails_tank_tankDetails_specialProvisions,
      TankStatement: adrDetails?.techRecord_adrDetails_tank_tankDetails_tankStatement_statement,
      ExpiryDate: testResult.testTypes.testExpiryDate,
      AtfNameAtfPNumber: `${testResult.testStationName} ${testResult.testStationPNumber}`,
      Notes: testResult.testTypes.additionalNotesRecorded,
      TestTypeDate: testResult.testTypes.testTypeStartTimestamp,
    };

    return {
      ADR_DATA: {
        ...docGenPayloadAdr,
        ...makeAndModel,
      }
    } as ICertificatePayload;
  }
}
