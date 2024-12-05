import { TestResults } from '@dvsa/cvs-type-definitions/types/v1/enums/testResult.enum.js';
import { TestTypeSchema } from '@dvsa/cvs-type-definitions/types/v1/test-result';
import { Inject, Service } from 'typedi';
import { DefectRepository } from '../../defect/DefectRepository';
import { DefectService } from '../../defect/DefectService';
import { ICertificatePayload, IFlatDefect, TestResultSchemaTestTypesAsObject } from '../../models';
import { CERTIFICATE_DATA } from '../../models/Enums';
import { BasePayloadCommand } from '../ICertificatePayloadCommand';

@Service()
export class DefectsCommand extends BasePayloadCommand {
	constructor(
		@Inject() private defectService: DefectService,
		@Inject() private defectRepository: DefectRepository
	) {
		super();
	}

	private certificateIsAnPassOrFail = (): boolean =>
		this.state.type === CERTIFICATE_DATA.PASS_DATA || this.state.type === CERTIFICATE_DATA.FAIL_DATA;

	public async generate(): Promise<ICertificatePayload> {
		if (!this.certificateIsAnPassOrFail()) {
			return {} as ICertificatePayload;
		}

		const { testResult } = this.state;
		const testTypes = testResult.testTypes;

		const result = {} as ICertificatePayload;

		if (testTypes.testResult !== TestResults.FAIL) {
			result.DATA = {
				...(await this.getPayloadData(testResult, CERTIFICATE_DATA.PASS_DATA)),
			};
		}

		if (testTypes.testResult !== TestResults.PASS) {
			result.FAIL_DATA = {
				...(await this.getPayloadData(testResult, CERTIFICATE_DATA.FAIL_DATA)),
			};
		}

		return result;
	}

	private async getPayloadData(testResult: TestResultSchemaTestTypesAsObject, type: CERTIFICATE_DATA): Promise<any> {
		const { isWelsh } = this.state;

		let flattenedDefects: IFlatDefect[] = [];

		if (isWelsh) {
			const defectListFromApi = await this.defectRepository.getDefectTranslations();
			flattenedDefects = this.defectService.flattenDefectsFromApi(defectListFromApi);
		}

		const defects = await this.generateDefects(
			testResult.testTypes,
			type,
			testResult.vehicleType,
			flattenedDefects,
			isWelsh
		);
		return defects;
	}

	/**
	 * Generates an object containing defects for a given test type and certificate type
	 * @param testTypes - the source test type for defect generation
	 * @param type - the certificate type
	 * @param vehicleType - the vehicle type from the test result
	 * @param flattenedDefects - the list of flattened defects after being retrieved from the defect service
	 * @param isWelsh - determines whether the atf in which the test result was conducted resides in Wales
	 */
	private generateDefects(
		testTypes: TestTypeSchema,
		type: CERTIFICATE_DATA,
		vehicleType: string,
		flattenedDefects: IFlatDefect[],
		isWelsh = false
	) {
		const defects = {
			DangerousDefects: [],
			MajorDefects: [],
			PRSDefects: [],
			MinorDefects: [],
			AdvisoryDefects: [],
			DangerousDefectsWelsh: [],
			MajorDefectsWelsh: [],
			PRSDefectsWelsh: [],
			MinorDefectsWelsh: [],
			AdvisoryDefectsWelsh: [],
		};

		testTypes.defects.forEach((defect) => {
			switch (defect.deficiencyCategory.toLowerCase()) {
				case 'dangerous':
					this.defectService.generateDangerousDefects(
						testTypes.testResult as TestResults,
						defect,
						type,
						defects,
						vehicleType,
						isWelsh,
						flattenedDefects
					);
					break;
				case 'major':
					this.defectService.generateMajorDefects(
						testTypes.testResult as TestResults,
						defect,
						type,
						defects,
						vehicleType,
						isWelsh,
						flattenedDefects
					);
					break;
				case 'minor':
					this.defectService.generateMinorDefects(
						defects,
						defect,
						vehicleType,
						testTypes.testResult as TestResults,
						isWelsh,
						flattenedDefects
					);
					break;
				case 'advisory':
					this.defectService.generateAdvisoryDefects(
						defects,
						defect,
						vehicleType,
						testTypes.testResult as TestResults,
						isWelsh
					);
					break;
				default:
					break;
			}
		});

		Object.entries(defects).forEach(([k, v]: [string, any]) => {
			if (v.length === 0) {
				Object.assign(defects, { [k]: undefined });
			}
		});

		return defects;
	}
}
