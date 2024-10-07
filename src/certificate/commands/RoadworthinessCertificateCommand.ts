import moment from 'moment';
import { Service } from 'typedi';
import { DefectService } from '../../defect/DefectService';
import { ITestResult } from '../../models';
import { IRoadworthinessCertificateData } from '../../models';
import { ICertificatePayload } from '../../models';
import { CERTIFICATE_DATA, TEST_RESULTS, VEHICLE_TYPES } from '../../models/Enums';
import { TechRecordService } from '../../tech-record/TechRecordService';
import { ICertificatePayloadCommand } from '../ICertificatePayloadCommand';

@Service()
export class RoadworthinessCertificateCommand implements ICertificatePayloadCommand {
	private type?: CERTIFICATE_DATA;

	constructor(
		private defectService: DefectService,
		private techRecordService: TechRecordService
	) {}

	private certificateIsAnRwt = (): boolean => this.type === CERTIFICATE_DATA.RWT_DATA;

	initialise(type: CERTIFICATE_DATA, isWelsh = false) {
		this.type = type;
	}

	public async generate(testResult: ITestResult): Promise<ICertificatePayload> {
		if (!this.certificateIsAnRwt()) {
			return {} as ICertificatePayload;
		}

		const weightDetails = await this.techRecordService.getWeightDetails(testResult);

		let defectRWTList: string[] | undefined;
		if ((testResult.testTypes.testResult as TEST_RESULTS) === TEST_RESULTS.FAIL) {
			defectRWTList = testResult.testTypes.defects.map((defect) => this.defectService.formatDefect(defect));
		}

		const testType = testResult.testTypes;

		const resultPass: IRoadworthinessCertificateData = {
			Dgvw: weightDetails.dgvw,
			Weight2: weightDetails.weight2,
			VehicleNumber:
				(testResult.vehicleType as VEHICLE_TYPES) === VEHICLE_TYPES.TRL ? testResult.trailerId : testResult.vrm,
			Vin: testResult.vin,
			IssuersName: testResult.testerName,
			DateOfInspection: moment(testType.testTypeStartTimestamp).format('DD.MM.YYYY'),
			TestStationPNumber: testResult.testStationPNumber,
			DocumentNumber: testType.certificateNumber,
			Date: moment(testType.testTypeStartTimestamp).format('DD.MM.YYYY'),
			Defects: defectRWTList,
			IsTrailer: (testResult.vehicleType as VEHICLE_TYPES) === VEHICLE_TYPES.TRL,
		};

		return {
			RWT_DATA: resultPass,
		} as ICertificatePayload;
	}
}
