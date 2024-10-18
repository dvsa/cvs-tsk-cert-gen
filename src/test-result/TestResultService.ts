import { Service } from 'typedi';
import { IMakeAndModel } from '../models';
import {
	ADR_TEST,
	AVAILABLE_WELSH,
	BASIC_IVA_TEST,
	HGV_TRL_ROADWORTHINESS_TEST_TYPES,
	IVA30_TEST,
	MSVA30_TEST,
	VEHICLE_TYPES,
} from '../models/Enums';

@Service()
export class TestResultService {
	/**
	 * Returns true if testType is adr and false if not
	 * @param testType - testType which is tested
	 */
	public isTestTypeAdr(testType: any): boolean {
		return ADR_TEST.IDS.includes(testType.testTypeId);
	}

	/**
	 * Returns a boolean value indicating whether the test type is a basic IVA test
	 * @param testTypeId - the test type ID on the test result
	 */
	public isBasicIvaTest = (testTypeId: string): boolean => {
		return BASIC_IVA_TEST.IDS.includes(testTypeId);
	};

	/**
	 * Returns true if testType is iva and false if not
	 * @param testTypeId - test type id which is being tested
	 */
	public isIvaTest(testTypeId: string): boolean {
		return IVA30_TEST.IDS.includes(testTypeId);
	}

	/**
	 * Returns true if testType is msva and false if not
	 * @param testTypeId - test type id which is being tested
	 */
	public isMsvaTest(testTypeId: string): boolean {
		return MSVA30_TEST.IDS.includes(testTypeId);
	}

	/**
	 * Returns true if testType is roadworthiness test for HGV or TRL and false if not
	 * @param testTypeId - testType which is tested
	 */
	public isRoadworthinessTestType(testTypeId: string): boolean {
		return HGV_TRL_ROADWORTHINESS_TEST_TYPES.IDS.includes(testTypeId);
	}

	/**
	 * Returns true if provided testResult is HGV or TRL Roadworthiness test otherwise false
	 * @param testResult - testResult of the vehicle
	 */
	public isHgvTrlRoadworthinessCertificate(testResult: any): boolean {
		return (
			(testResult.vehicleType === VEHICLE_TYPES.HGV || testResult.vehicleType === VEHICLE_TYPES.TRL) &&
			this.isRoadworthinessTestType(testResult.testTypes.testTypeId)
		);
	}

	/**
	 * To check if the testResult is valid for fetching Trn.
	 * @param vehicleType the vehicle type
	 * @param makeAndModel object containing Make and Model
	 * @returns returns if the condition is satisfied else false
	 */
	public isValidForTrn(vehicleType: string, makeAndModel: IMakeAndModel): boolean {
		return makeAndModel && !!makeAndModel.Make && vehicleType === VEHICLE_TYPES.TRL;
	}

	/**
	 * Check that the test result and vehicle type are a valid combination and bilingual certificate is available
	 * @param vehicleType - the vehicle type from the test result
	 * @param testResult - the result of the test
	 */
	public isWelshCertificateAvailable = (vehicleType: string, testResult: string): boolean => {
		return AVAILABLE_WELSH.CERTIFICATES.includes(`${vehicleType}_${testResult}`);
	};
}
