import { TestResults } from '@dvsa/cvs-type-definitions/types/v1/enums/testResult.enum.js';
import moment from 'moment';
import { Service } from 'typedi';
import { ICertificatePayload, TestResultSchemaTestTypesAsObject } from '../../models';
import { CERTIFICATE_DATA, VEHICLE_TYPES } from '../../models/Enums';
import { BasePayloadCommand } from '../ICertificatePayloadCommand';

@Service()
export class PassOrFailCertificateCommand extends BasePayloadCommand {
	private certificateIsAnPassOrFail = (): boolean =>
		this.state.type === CERTIFICATE_DATA.PASS_DATA || this.state.type === CERTIFICATE_DATA.FAIL_DATA;

	public async generate(): Promise<ICertificatePayload> {
		const result = {} as ICertificatePayload;

		if (!this.certificateIsAnPassOrFail()) {
			return result;
		}

		const { testResult } = this.state;
		const testTypes = testResult.testTypes;

		const payload = await this.getPayloadData(testResult);

		if (testTypes.testResult !== TestResults.FAIL) {
			result.DATA = {
				...payload,
			};
		}

		if (testTypes.testResult !== TestResults.PASS) {
			result.FAIL_DATA = {
				...payload,
			};
		}

		return result;
	}

	private async getPayloadData(testResult: TestResultSchemaTestTypesAsObject): Promise<any> {
		const testType = testResult.testTypes;

		return {
			TestNumber: testType.testNumber,
			TestStationPNumber: testResult.testStationPNumber,
			TestStationName: testResult.testStationName,
			CurrentOdometer: {
				value: testResult.odometerReading,
				unit: testResult.odometerReadingUnits,
			},
			IssuersName: testResult.testerName,
			DateOfTheTest: moment(testResult.testEndTimestamp).format('DD.MM.YYYY'),
			CountryOfRegistrationCode: testResult.countryOfRegistration,
			VehicleEuClassification: testResult.euVehicleCategory.toUpperCase(),
			RawVIN: testResult.vin,
			RawVRM: (testResult.vehicleType as VEHICLE_TYPES) === VEHICLE_TYPES.TRL ? testResult.trailerId : testResult.vrm,
			ExpiryDate: testType.testExpiryDate ? moment(testType.testExpiryDate).format('DD.MM.YYYY') : undefined,
			EarliestDateOfTheNextTest:
				((testResult.vehicleType as VEHICLE_TYPES) === VEHICLE_TYPES.HGV ||
					(testResult.vehicleType as VEHICLE_TYPES) === VEHICLE_TYPES.TRL) &&
				(testType.testResult === TestResults.PASS || testType.testResult === TestResults.PRS)
					? moment(testType.testAnniversaryDate).subtract(1, 'months').startOf('month').format('DD.MM.YYYY')
					: moment(testType.testAnniversaryDate).format('DD.MM.YYYY'),
			SeatBeltTested: testType.seatbeltInstallationCheckDate ? 'Yes' : 'No',
			SeatBeltPreviousCheckDate: testType.lastSeatbeltInstallationCheckDate
				? moment(testType.lastSeatbeltInstallationCheckDate).format('DD.MM.YYYY')
				: '\u00A0',
			SeatBeltNumber: testType.numberOfSeatbeltsFitted,
			Recalls: {
				manufacturer: testResult.recalls?.manufacturer ?? null,
				hasRecall: testResult.recalls?.hasRecall ?? false,
			},
		};
	}
}
