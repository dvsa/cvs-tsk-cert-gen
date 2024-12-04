import { Service } from 'typedi';
import { ICustomDefect, IDefectChild, IDefectParent, IFlatDefect, IItem } from '../models';
import { CERTIFICATE_DATA, IVA_30, LOCATION_ENGLISH, LOCATION_WELSH, TEST_RESULTS } from '../models/Enums';
import { TestResultService } from '../test-result/TestResultService';

@Service()
export class DefectService {
	constructor(private testResultService: TestResultService) {}

	/**
	 * Formats the additional defects for IVA and MSVA test based on whether custom defects is populated
	 * @param customDefects - the custom defects for the test
	 */
	public formatVehicleApprovalAdditionalDefects = (
		customDefects: ICustomDefect[] | undefined
	): ICustomDefect[] | undefined => {
		const defaultCustomDefect: ICustomDefect = {
			defectName: IVA_30.EMPTY_CUSTOM_DEFECTS,
			defectNotes: '',
		};
		return customDefects && customDefects.length > 0 ? customDefects : [defaultCustomDefect];
	};

	/**
	 * Returns a flattened array of every deficiency that only includes the key/value pairs required for certificate generation
	 * @param defects - the array of defects from the api
	 */
	public flattenDefectsFromApi(defects: IDefectParent[]): IFlatDefect[] {
		const flatDefects: IFlatDefect[] = [];
		try {
			// go through each defect in un-flattened array
			defects.forEach((defect: IDefectParent) => {
				const { imNumber, imDescription, imDescriptionWelsh, items } = defect;
				if (defect.items !== undefined && defect.items.length !== 0) {
					// go through each item of defect
					items.forEach((item: IItem) => {
						const { itemNumber, itemDescription, itemDescriptionWelsh, deficiencies } = item;
						if (item.deficiencies !== undefined && item.deficiencies.length !== 0) {
							// go through each deficiency and push to flatDefects array
							deficiencies.forEach((deficiency: IDefectChild) => {
								const { ref, deficiencyText, deficiencyTextWelsh, forVehicleType } = deficiency;
								const lowLevelDeficiency: IFlatDefect = {
									imNumber,
									imDescription,
									imDescriptionWelsh,
									itemNumber,
									itemDescription,
									itemDescriptionWelsh,
									ref,
									deficiencyText,
									deficiencyTextWelsh,
									forVehicleType,
								};
								flatDefects.push(lowLevelDeficiency);
							});
						}
					});
				}
			});
		} catch (e) {
			console.error(`Error flattening defects: ${e}`);
		}
		return flatDefects;
	}

	/**
	 * Returns a formatted string containing data about a given defect
	 * @param defect - defect for which to generate the formatted string
	 */
	public formatDefect(defect: any) {
		const toUpperFirstLetter: any = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

		let defectString = `${defect.deficiencyRef} ${defect.itemDescription}`;

		if (defect.deficiencyText) {
			defectString += ` ${defect.deficiencyText}`;
		}

		if (defect.additionalInformation.location) {
			Object.keys(defect.additionalInformation.location).forEach((location: string, index: number, array: string[]) => {
				if (defect.additionalInformation.location[location]) {
					switch (location) {
						case 'rowNumber':
							defectString += ` Rows: ${defect.additionalInformation.location.rowNumber}.`;
							break;
						case 'seatNumber':
							defectString += ` Seats: ${defect.additionalInformation.location.seatNumber}.`;
							break;
						case 'axleNumber':
							defectString += ` Axles: ${defect.additionalInformation.location.axleNumber}.`;
							break;
						default:
							defectString += ` ${toUpperFirstLetter(defect.additionalInformation.location[location])}`;
							break;
					}
				}

				if (index === array.length - 1) {
					defectString += `.`;
				}
			});
		}

		if (defect.additionalInformation.notes) {
			defectString += ` ${defect.additionalInformation.notes}`;
		}

		return defectString;
	}

	/**
	 * Returns a formatted welsh string containing data about a given defect
	 * @param defect - the defect for which to generate the formatted welsh string
	 * @param vehicleType - the vehicle type from the test result
	 * @param flattenedDefects - the list of flattened defects
	 */
	public formatDefectWelsh(defect: any, vehicleType: any, flattenedDefects: IFlatDefect[]) {
		const toUpperFirstLetter: any = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

		const filteredFlatDefects: IFlatDefect[] = flattenedDefects.filter(
			(x: IFlatDefect) => defect.deficiencyRef === x.ref
		);

		const filteredFlatDefect: IFlatDefect | null = this.filterFlatDefects(filteredFlatDefects, vehicleType);

		if (filteredFlatDefect !== null) {
			let defectString = `${defect.deficiencyRef} ${filteredFlatDefect.itemDescriptionWelsh}`;

			if (defect.deficiencyText) {
				defectString += ` ${filteredFlatDefect.deficiencyTextWelsh}`;
			}

			if (defect.additionalInformation.location) {
				Object.keys(defect.additionalInformation.location).forEach(
					(location: string, index: number, array: string[]) => {
						if (defect.additionalInformation.location[location]) {
							switch (location) {
								case 'rowNumber':
									defectString += ` ${LOCATION_WELSH.ROW_NUMBER}: ${defect.additionalInformation.location.rowNumber}.`;
									break;
								case 'seatNumber':
									defectString += ` ${LOCATION_WELSH.SEAT_NUMBER}: ${defect.additionalInformation.location.seatNumber}.`;
									break;
								case 'axleNumber':
									defectString += ` ${LOCATION_WELSH.AXLE_NUMBER}: ${defect.additionalInformation.location.axleNumber}.`;
									break;
								default:
									const welshLocation = this.convertLocationWelsh(defect.additionalInformation.location[location]);
									defectString += ` ${toUpperFirstLetter(welshLocation)}`;
									break;
							}
						}

						if (index === array.length - 1) {
							defectString += `.`;
						}
					}
				);
			}

			if (defect.additionalInformation.notes) {
				defectString += ` ${defect.additionalInformation.notes}`;
			}
			console.log(`Welsh Defect String Generated: ${defectString}`);
			return defectString;
		} else {
			console.log(`ERROR: Unable to find a filtered defect`);
			return null;
		}
	}

	/**
	 * Returns welsh version of location
	 * @param locationToTranslate
	 */
	public convertLocationWelsh(locationToTranslate: string) {
		switch (locationToTranslate) {
			case LOCATION_ENGLISH.FRONT:
				return LOCATION_WELSH.FRONT;
			case LOCATION_ENGLISH.REAR:
				return LOCATION_WELSH.REAR;
			case LOCATION_ENGLISH.UPPER:
				return LOCATION_WELSH.UPPER;
			case LOCATION_ENGLISH.LOWER:
				return LOCATION_WELSH.LOWER;
			case LOCATION_ENGLISH.NEARSIDE:
				return LOCATION_WELSH.NEARSIDE;
			case LOCATION_ENGLISH.OFFSIDE:
				return LOCATION_WELSH.OFFSIDE;
			case LOCATION_ENGLISH.CENTRE:
				return LOCATION_WELSH.CENTRE;
			case LOCATION_ENGLISH.INNER:
				return LOCATION_WELSH.INNER;
			case LOCATION_ENGLISH.OUTER:
				return LOCATION_WELSH.OUTER;
			default:
				return locationToTranslate;
		}
	}

	/**
	 * Returns filtered welsh defects
	 * @param filteredFlatDefects - the array of flattened defects
	 * @param vehicleType - the vehicle type from the test result
	 */
	public filterFlatDefects(filteredFlatDefects: IFlatDefect[], vehicleType: string): IFlatDefect | null {
		if (filteredFlatDefects.length === 0) {
			return null;
		} else if (filteredFlatDefects.length === 1) {
			return filteredFlatDefects[0];
		} else {
			const filteredWelshDefectsOnVehicleType = filteredFlatDefects.filter((flatDefect: IFlatDefect) =>
				flatDefect.forVehicleType!.includes(vehicleType)
			);
			return filteredWelshDefectsOnVehicleType[0];
		}
	}

	public generateDangerousDefects(
		testResult: TEST_RESULTS,
		defect: any,
		type: CERTIFICATE_DATA,
		defects: any,
		vehicleType: string,
		isWelsh: boolean,
		flattenedDefects: IFlatDefect[]
	) {
		if ((testResult === TEST_RESULTS.PRS || defect.prs) && type === CERTIFICATE_DATA.FAIL_DATA) {
			defects.PRSDefects.push(this.formatDefect(defect));

			if (this.testResultService.isWelshCertificateAvailable(vehicleType, testResult) && isWelsh) {
				defects.PRSDefectsWelsh.push(this.formatDefectWelsh(defect, vehicleType, flattenedDefects));
			}
		} else if (testResult === TEST_RESULTS.FAIL) {
			defects.DangerousDefects.push(this.formatDefect(defect));

			// If the test was conducted in Wales and is valid vehicle type, format and add the welsh defects to the list
			if (this.testResultService.isWelshCertificateAvailable(vehicleType, testResult) && isWelsh) {
				defects.DangerousDefectsWelsh.push(this.formatDefectWelsh(defect, vehicleType, flattenedDefects));
			}
		}
	}

	public generateMajorDefects(
		testResult: TEST_RESULTS,
		defect: any,
		type: CERTIFICATE_DATA,
		defects: any,
		vehicleType: string,
		isWelsh: boolean,
		flattenedDefects: IFlatDefect[]
	) {
		if ((testResult === TEST_RESULTS.PRS || defect.prs) && type === CERTIFICATE_DATA.FAIL_DATA) {
			defects.PRSDefects.push(this.formatDefect(defect));

			if (this.testResultService.isWelshCertificateAvailable(vehicleType, testResult) && isWelsh) {
				defects.PRSDefectsWelsh.push(this.formatDefectWelsh(defect, vehicleType, flattenedDefects));
			}
		} else if (testResult === TEST_RESULTS.FAIL) {
			defects.MajorDefects.push(this.formatDefect(defect));

			// If the test was conducted in Wales and is valid vehicle type, format and add the welsh defects to the list
			if (this.testResultService.isWelshCertificateAvailable(vehicleType, testResult) && isWelsh) {
				defects.MajorDefectsWelsh.push(this.formatDefectWelsh(defect, vehicleType, flattenedDefects));
			}
		}
	}

	public generateMinorDefects(
		defects: any,
		defect: any,
		vehicleType: string,
		testResult: TEST_RESULTS,
		isWelsh: boolean,
		flattenedDefects: IFlatDefect[]
	) {
		defects.MinorDefects.push(this.formatDefect(defect));

		if (this.testResultService.isWelshCertificateAvailable(vehicleType, testResult) && isWelsh) {
			defects.MinorDefectsWelsh.push(this.formatDefectWelsh(defect, vehicleType, flattenedDefects));
		}
	}

	public generateAdvisoryDefects(
		defects: any,
		defect: any,
		vehicleType: string,
		testResult: TEST_RESULTS,
		isWelsh: boolean
	) {
		defects.AdvisoryDefects.push(this.formatDefect(defect));

		if (this.testResultService.isWelshCertificateAvailable(vehicleType, testResult) && isWelsh) {
			defects.AdvisoryDefectsWelsh.push(this.formatDefect(defect));
		}
	}
}
