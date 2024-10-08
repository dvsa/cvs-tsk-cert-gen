import moment from 'moment';
import { Service } from 'typedi';
import { DefectService } from '../../defect/DefectService';
import { IRequiredStandard, ITestResult } from '../../models';
import { ICertificatePayload } from '../../models';
import { CERTIFICATE_DATA, IVA_30 } from '../../models/Enums';
import { TestResultService } from '../../test-result/TestResultService';
import { ICertificatePayloadCommand } from '../ICertificatePayloadCommand';

@Service()
export class IvaCertificateCommand implements ICertificatePayloadCommand {
	private type?: CERTIFICATE_DATA;

	constructor(
		private defectService: DefectService,
		private testResultService: TestResultService
	) {}

	private certificateIsAnIva = (): boolean => this.type === CERTIFICATE_DATA.IVA_DATA;

	initialise(type: CERTIFICATE_DATA, isWelsh = false) {
		this.type = type;
	}

	public async generate(testResult: ITestResult): Promise<ICertificatePayload> {
		if (!this.certificateIsAnIva()) {
			return {} as ICertificatePayload;
		}

		const ivaFailDetailsForDocGen = {
			vin: testResult.vin,
			serialNumber: testResult.vehicleType === 'trl' ? testResult.trailerId : testResult.vrm,
			vehicleTrailerNrNo: testResult.vehicleType === 'trl' ? testResult.trailerId : testResult.vrm,
			testCategoryClass: testResult.euVehicleCategory,
			testCategoryBasicNormal: this.testResultService.isBasicIvaTest(testResult.testTypes.testTypeId)
				? IVA_30.BASIC
				: IVA_30.NORMAL,
			make: testResult.make,
			model: testResult.model,
			bodyType: testResult.bodyType?.description,
			date: moment(testResult.testTypes.testTypeStartTimestamp).format('DD/MM/YYYY'),
			testerName: testResult.testerName,
			reapplicationDate: testResult.testTypes?.reapplicationDate
				? moment(testResult.testTypes?.reapplicationDate).format('DD/MM/YYYY')
				: '',
			station: testResult.testStationName,
			additionalDefects: this.defectService.formatVehicleApprovalAdditionalDefects(testResult.testTypes.customDefects),
			requiredStandards: this.sortRequiredStandards(testResult.testTypes.requiredStandards),
		};

		return {
			IVA_DATA: ivaFailDetailsForDocGen,
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
