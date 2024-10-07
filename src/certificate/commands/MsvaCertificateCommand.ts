import moment from 'moment';
import { Service } from 'typedi';
import { DefectService } from '../../defect/DefectService';
import { ITestResult } from '../../models';
import { ICertificatePayload } from '../../models';
import { IRequiredStandard } from '../../models';
import { CERTIFICATE_DATA } from '../../models/Enums';
import { ICertificatePayloadCommand } from '../ICertificatePayloadCommand';

@Service()
export class MsvaCertificateCommand implements ICertificatePayloadCommand {
	private type?: CERTIFICATE_DATA;

	constructor(private defectService: DefectService) {}

	private certificateIsAnMsva = (): boolean => this.type === CERTIFICATE_DATA.MSVA_DATA;

	initialise(type: CERTIFICATE_DATA, isWelsh = false) {
		this.type = type;
	}

	public generate(testResult: ITestResult): Promise<ICertificatePayload> {
		if (!this.certificateIsAnMsva()) {
			return Promise.resolve({} as ICertificatePayload);
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
			reapplicationDate: testResult.testTypes?.reapplicationDate
				? moment(testResult.testTypes?.reapplicationDate).format('DD/MM/YYYY')
				: '',
			station: testResult.testStationName,
			additionalDefects: this.defectService.formatVehicleApprovalAdditionalDefects(testResult.testTypes.customDefects),
			requiredStandards: this.sortRequiredStandards(testResult.testTypes.requiredStandards),
		};

		return Promise.resolve({
			MSVA_DATA: msvaFailDetailsForDocGen,
		} as ICertificatePayload);
	}

	/**
	 * Sorts required standards if present by refCalculation and then returns it
	 * @param requiredStandards - the requiredStandards array to sort
	 * @returns - the sorted requiredStandards array
	 */
	private sortRequiredStandards = (
		requiredStandards: IRequiredStandard[] | undefined
	): IRequiredStandard[] | undefined => {
		if (!requiredStandards) {
			return;
		}

		const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
		return requiredStandards.sort((a, b) => collator.compare(a.refCalculation, b.refCalculation));
	};
}
