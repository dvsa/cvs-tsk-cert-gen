import moment from 'moment';
import { Inject, Service } from 'typedi';
import { DefectService } from '../../defect/DefectService';
import { ICertificatePayload } from '../../models';
import { IRequiredStandard } from '../../models';
import { CERTIFICATE_DATA } from '../../models/Enums';
import { BasePayloadCommand } from '../ICertificatePayloadCommand';

@Service()
export class MsvaCertificateCommand extends BasePayloadCommand {
	constructor(@Inject() private defectService: DefectService) {
		super();
	}

	private certificateIsAnMsva = (): boolean => this.state.type === CERTIFICATE_DATA.MSVA_DATA;

	public async generate(): Promise<ICertificatePayload> {
		if (!this.certificateIsAnMsva()) {
			return {} as ICertificatePayload;
		}

		const { testResult } = this.state;

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

		return {
			MSVA_DATA: msvaFailDetailsForDocGen,
		} as ICertificatePayload;
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
