import { Service } from 'typedi';
import { DefectRepository } from '../../defect/DefectRepository';
import { DefectService } from '../../defect/DefectService';
import { ITestResult } from '../../models';
import { ICertificatePayload } from '../../models';
import { ITestType } from '../../models';
import { CERTIFICATE_DATA, TEST_RESULTS } from '../../models/Enums';
import { IDefectParent } from '../../models/IDefectParent';
import { IFlatDefect } from '../../models/IFlatDefect';

@Service()
export class DefectsCommand {
	protected type?: CERTIFICATE_DATA;

	protected isWelsh = false;

	constructor(
		private defectService: DefectService,
		private defectRepository: DefectRepository
	) {}

	private certificateIsAnPassOrFail = (): boolean =>
		this.type === CERTIFICATE_DATA.PASS_DATA || this.type === CERTIFICATE_DATA.FAIL_DATA;

	public initialise(type: CERTIFICATE_DATA, isWelsh = false) {
		this.type = type;
		this.isWelsh = isWelsh;
	}

	public async generate(testResult: ITestResult): Promise<ICertificatePayload> {
		if (!this.certificateIsAnPassOrFail()) {
			return {} as ICertificatePayload;
		}

		const { testTypes } = testResult;

		const result = {} as ICertificatePayload;

		if (testTypes.testResult !== TEST_RESULTS.FAIL) {
			result.DATA = {
				...(await this.getPayloadData(testResult, CERTIFICATE_DATA.PASS_DATA)),
			};
		}

		if (testTypes.testResult !== TEST_RESULTS.PASS) {
			result.FAIL_DATA = {
				...(await this.getPayloadData(testResult, CERTIFICATE_DATA.FAIL_DATA)),
			};
		}

		return result;
	}

	private async getPayloadData(testResult: ITestResult, type: CERTIFICATE_DATA): Promise<any> {
		let defectListFromApi: IDefectParent[] = [];
		let flattenedDefects: IFlatDefect[] = [];

		if (this.isWelsh) {
			defectListFromApi = await this.defectRepository.getDefectTranslations();
			flattenedDefects = this.defectService.flattenDefectsFromApi(defectListFromApi);
		}

		const defects = await this.generateDefects(
			testResult.testTypes,
			type,
			testResult.vehicleType,
			flattenedDefects,
			this.isWelsh
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
		testTypes: ITestType,
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
						testTypes.testResult,
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
						testTypes.testResult,
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
						testTypes.testResult,
						isWelsh,
						flattenedDefects
					);
					break;
				case 'advisory':
					this.defectService.generateAdvisoryDefects(defects, defect, vehicleType, testTypes.testResult, isWelsh);
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
