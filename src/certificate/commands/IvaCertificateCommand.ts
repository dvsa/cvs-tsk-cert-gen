import { SpecialistCustomDefectsSchemaPut } from '@dvsa/cvs-type-definitions/types/v1/test-result';
import moment from 'moment';
import { Inject, Service } from 'typedi';
import { DefectService } from '../../defect/DefectService';
import { ICertificatePayload } from '../../models';
import { CERTIFICATE_DATA, IVA_30 } from '../../models/Enums';
import { TestResultService } from '../../test-result/TestResultService';
import { BasePayloadCommand } from '../ICertificatePayloadCommand';

@Service()
export class IvaCertificateCommand extends BasePayloadCommand {
	constructor(
		@Inject() private defectService: DefectService,
		@Inject() private testResultService: TestResultService
	) {
		super();
	}

	private certificateIsAnIva = (): boolean => this.state.type === CERTIFICATE_DATA.IVA_DATA;

	public async generate(): Promise<ICertificatePayload> {
		if (!this.certificateIsAnIva()) {
			return {} as ICertificatePayload;
		}

		const { testResult } = this.state;
		const testTypes = testResult.testTypes;

		const ivaFailDetailsForDocGen = {
			vin: testResult.vin,
			serialNumber: testResult.vehicleType === 'trl' ? testResult.trailerId : testResult.vrm,
			vehicleTrailerNrNo: testResult.vehicleType === 'trl' ? testResult.trailerId : testResult.vrm,
			testCategoryClass: testResult.euVehicleCategory,
			testCategoryBasicNormal: this.testResultService.isBasicIvaTest(testTypes.testTypeId)
				? IVA_30.BASIC
				: IVA_30.NORMAL,
			make: testResult.make,
			model: testResult.model,
			bodyType: testResult.bodyType?.description,
			date: moment(testTypes.testTypeStartTimestamp).format('DD/MM/YYYY'),
			testerName: testResult.testerName,
			reapplicationDate: testTypes.reapplicationDate ? moment(testTypes.reapplicationDate).format('DD/MM/YYYY') : '',
			station: testResult.testStationName,
			additionalDefects: this.defectService.formatVehicleApprovalAdditionalDefects(testTypes.customDefects ?? []),
			requiredStandards: this.sortRequiredStandards(testTypes.requiredStandards),
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
		requiredStandards: SpecialistCustomDefectsSchemaPut[] | undefined
	): SpecialistCustomDefectsSchemaPut[] | undefined => {
		if (!requiredStandards) {
			return;
		}

		const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
		return requiredStandards.sort((a, b) => collator.compare(a.refCalculation, b.refCalculation));
	};
}
