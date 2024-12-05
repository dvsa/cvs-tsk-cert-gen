import { TestResults } from '@dvsa/cvs-type-definitions/types/v1/enums/testResult.enum.js';
import moment from 'moment';
import { Inject, Service } from 'typedi';
import { DefectService } from '../../defect/DefectService';
import { ICertificatePayload, IRoadworthinessCertificateData } from '../../models';
import { CERTIFICATE_DATA, VEHICLE_TYPES } from '../../models/Enums';
import { TechRecordService } from '../../tech-record/TechRecordService';
import { BasePayloadCommand } from '../ICertificatePayloadCommand';

@Service()
export class RoadworthinessCertificateCommand extends BasePayloadCommand {
	constructor(
		@Inject() private defectService: DefectService,
		@Inject() private techRecordService: TechRecordService
	) {
		super();
	}

	private certificateIsAnRwt = (): boolean => this.state.type === CERTIFICATE_DATA.RWT_DATA;

	public async generate(): Promise<ICertificatePayload> {
		if (!this.certificateIsAnRwt()) {
			return {} as ICertificatePayload;
		}

		const { testResult } = this.state;
		const testTypes = testResult.testTypes;

		const weightDetails = await this.techRecordService.getWeightDetails(testResult);

		let defectRWTList: string[] | undefined;
		if ((testTypes.testResult as TestResults) === TestResults.FAIL) {
			defectRWTList = testTypes.defects.map((defect) => this.defectService.formatDefect(defect));
		}

		const resultPass: IRoadworthinessCertificateData = {
			Dgvw: weightDetails.dgvw,
			Weight2: weightDetails.weight2,
			VehicleNumber:
				((testResult.vehicleType as VEHICLE_TYPES) === VEHICLE_TYPES.TRL ? testResult.trailerId : testResult.vrm) ?? '',
			Vin: testResult.vin,
			IssuersName: testResult.testerName ?? '',
			DateOfInspection: moment(testTypes.testTypeStartTimestamp).format('DD.MM.YYYY'),
			TestStationPNumber: testResult.testStationPNumber ?? '',
			DocumentNumber: testTypes.certificateNumber ?? '',
			Date: moment(testTypes.testTypeStartTimestamp).format('DD.MM.YYYY'),
			Defects: defectRWTList,
			IsTrailer: (testResult.vehicleType as VEHICLE_TYPES) === VEHICLE_TYPES.TRL,
		};

		return {
			RWT_DATA: resultPass,
		} as ICertificatePayload;
	}
}
