import { Inject, Service } from 'typedi';
import { ICertificatePayload } from '../../models';
import { CERTIFICATE_DATA } from '../../models/Enums';
import { TechRecordService } from '../../tech-record/TechRecordService';
import { BasePayloadCommand } from '../ICertificatePayloadCommand';

@Service()
export class AdrCertificateCommand extends BasePayloadCommand {
	constructor(@Inject() private techRecordService: TechRecordService) {
		super();
	}

	private certificateIsAnAdr = (): boolean => this.state.type === CERTIFICATE_DATA.ADR_DATA;

	public async generate(): Promise<ICertificatePayload> {
		if (!this.certificateIsAnAdr()) {
			return {} as ICertificatePayload;
		}

		const { testResult } = this.state;
		const testTypes = testResult.testTypes;

		const [adrDetails, makeAndModel] = await Promise.all([
			this.techRecordService.getAdrDetails(testResult),
			this.techRecordService.getVehicleMakeAndModel(testResult),
		]);

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
			ExpiryDate: testTypes.testExpiryDate,
			AtfNameAtfPNumber: testResult.testStationName + ' ' + testResult.testStationPNumber,
			Notes: testTypes.additionalNotesRecorded,
			TestTypeDate: testTypes.testTypeStartTimestamp,
		};

		return {
			ADR_DATA: {
				...docGenPayloadAdr,
				...makeAndModel,
			},
		} as ICertificatePayload;
	}
}
