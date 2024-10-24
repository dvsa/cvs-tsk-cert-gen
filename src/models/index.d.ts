import { TEST_RESULTS } from './Enums';

interface IInvokeConfig {
	params: { apiVersion: string; endpoint?: string };
	functions: {
		testResults: { name: string };
		techRecords: { name: string; mock: string };
		techRecordsSearch: { name: string; mock: string };
		certGen: { name: string };
		trailerRegistration: { name: string };
		testStations: { name: string; mock: string };
		defects: { name: string };
	};
}

interface IMOTConfig {
	endpoint: string;
	documentDir: 'CVS';
	documentNames: {
		vt20: 'VT20.pdf';
		vt20w: 'VT20W.pdf';
		vt30: 'VT30.pdf';
		vt30w: 'VT30W.pdf';
		vt32ve: 'VT32VE.pdf';
		vt32vew: 'VT32VEW.pdf';
		prs: 'PRS.pdf';
		prsw: 'PRSW.pdf';
		ct20: 'CT20.pdf';
		ct30: 'CT30.pdf';
		vtp20: 'VTP20.pdf';
		vtp20_bilingual: 'VTP20_BILINGUAL.pdf';
		vtp30: 'VTP30.pdf';
		vtp30_bilingual: 'VTP30_BILINGUAL.pdf';
		psv_prs: 'PSV_PRS.pdf';
		psv_prs_bilingual: 'PSV_PRS_BILINGUAL.pdf';
		vtg5: 'VTG5.pdf';
		vtg5_bilingual: 'VTG5_BILINGUAL.pdf';
		vtg5a: 'VTG5A.pdf';
		vtg5a_bilingual: 'VTG5A_BILINGUAL.pdf';
		vtg30: 'VTG30.pdf';
		vtg30_bilingual: 'VTG30_BILINGUAL.pdf';
		hgv_prs: 'HGV_PRS.pdf';
		hgv_prs_bilingual: 'HGV_PRS_BILINGUAL.pdf';
		trl_prs: 'TRL_PRS.pdf';
		trl_prs_bilingual: 'TRL_PRS_BILINGUAL.pdf';
		adr_pass: 'ADR_PASS.pdf';
		rwt: 'RWT.pdf;';
		iva_fail: 'IVA30.pdf';
		msva_fail: 'MSVA30.pdf';
	};
	api_key: string;
}

interface IS3Config {
	endpoint: string;
}

interface IGeneratedCertificateResponse {
	fileName: string;
	vrm: string;
	testTypeName: string;
	testTypeResult: string;
	dateOfIssue: string;
	certificateType: string;
	fileFormat: string;
	fileSize: string;
	certificate: Buffer;
	certificateOrder: { current: number; total: number };
	email: string;
	shouldEmailCertificate: string;
}

interface ICertificateData {
	TestNumber: string;
	TestStationPNumber: string;
	TestStationName: string;
	CurrentOdometer: IOdometer;
	IssuersName: string;
	DateOfTheTest: string;
	CountryOfRegistrationCode: string;
	VehicleEuClassification: string;
	RawVIN: string;
	RawVRM: string;
	ExpiryDate: string;
	EarliestDateOfTheNextTest: string;
	SeatBeltTested: string;
	SeatBeltPreviousCheckDate: string;
	SeatBeltNumber: number;
}

interface IOdometer {
	value: string;
	unit: string;
}

interface IDefects {
	DangerousDefects: string[];
	MajorDefects: string[];
	PRSDefects: string[];
	MinorDefects: string[];
	AdvisoryDefects: string[];
}

interface ICertificatePayload {
	Watermark: string;
	DATA?: any;
	FAIL_DATA?: any;
	RWT_DATA?: any;
	ADR_DATA?: any;
	IVA_DATA?: any;
	MSVA_DATA?: any;
	Signature: ISignature;
	Reissue?: IReissue;
}

interface IReissue {
	Reason: string;
	Issuer: string;
	Date: string;
}

interface ISignature {
	ImageType: string;
	ImageData: string | null;
}

interface IRoadworthinessCertificateData {
	Dgvw: number;
	Weight2: number; // can be dgtw or dtaw based on vehcile type
	VehicleNumber: string; // can be vin or trailer Id based on vehicle type
	Vin: string;
	IssuersName: string;
	DateOfInspection: string;
	TestStationPNumber: string;
	DocumentNumber: string;
	Date: string;
	Defects: string[] | undefined;
	IsTrailer: boolean;
}

interface IWeightDetails {
	dgvw: number;
	weight2: number;
}

interface ITestResult {
	testResultId: string;
	vrm: string;
	trailerId: string;
	vin: string;
	vehicleId: string;
	deletionFlag: boolean;
	testStationName: string;
	testStationPNumber: string;
	testStationType: string;
	testerName: string;
	testerStaffId: string;
	testerEmailAddress: string;
	testStartTimestamp: string;
	testEndTimestamp: string;
	testStatus: string;
	reasonForCancellation: string;
	vehicleClass: IVehicleClass;
	vehicleType: string;
	numberOfSeats: number;
	vehicleConfiguration: string;
	odometerReading: number;
	odometerReadingUnits: string;
	preparerId: string;
	preparerName: string;
	euVehicleCategory: string;
	countryOfRegistration: string;
	vehicleSize: string;
	noOfAxles: number;
	regnDate: string;
	firstUseDate: string;
	make?: string;
	model?: string;
	bodyType?: IBodyTypeModel;
	testTypes: ITestType;
	createdById?: string;
	systemNumber: string;
}

interface ITestType {
	createdAt: string;
	lastUpdatedAt: string;
	deletionFlag: boolean;
	testCode: string;
	testTypeName: string;
	testTypeClassification: string;
	name: string;
	testTypeId: string;
	testNumber: string;
	certificateNumber: string;
	certificateLink: string;
	testExpiryDate: string;
	testAnniversaryDate: string;
	testTypeStartTimestamp: string;
	testTypeEndTimestamp: string;
	numberOfSeatbeltsFitted: number;
	lastSeatbeltInstallationCheckDate: string;
	seatbeltInstallationCheckDate: boolean;
	testResult: TEST_RESULTS;
	prohibitionIssued: boolean;
	reasonForAbandoning: string;
	additionalNotesRecorded: string;
	additionalCommentsForAbandon: string;
	modType: IVehicleClass;
	emissionStandard: string;
	fuelType: string;
	reapplicationDate?: string;
	defects: IDefect[];
	requiredStandards?: IRequiredStandard[];
	customDefects?: ICustomDefect[];
}

interface IDefect {
	imNumber: number;
	imDescription: string;
	additionalInformation: IAdditionalInformation;
	itemNumber: number;
	itemDescription: string;
	deficiencyRef: string;
	deficiencyId: string;
	deficiencySubId: string;
	deficiencyCategory: string;
	deficiencyText: string;
	stdForProhibition: boolean;
	prs: boolean;
	prohibitionIssued: boolean;
}

type InspectionType = 'basic' | 'normal';

interface IAdditionalInformation {
	location: ILocation;
	notes: string;
}

interface ILocation {
	vertical: string;
	horizontal: string;
	lateral: string;
	longitudinal: string;
	rowNumber: number;
	seatNumber: number;
	axleNumber: number;
}

interface IVehicleClass {
	code: string;
	description: string;
}

interface ITrailerRegistration {
	vinOrChassisWithMake?: string;
	vin: string;
	make: string;
	trn: string;
	certificateExpiryDate: Date;
	certificateIssueDate: Date;
}

interface IMakeAndModel {
	Make: string;
	Model: string;
}

interface IRequiredStandard {
	sectionNumber: string;
	sectionDescription: string;
	rsNumber: number;
	requiredStandard: string;
	refCalculation: string;
	additionalInfo: boolean;
	inspectionTypes: InspectionType[];
	prs: boolean;
	additionalNotes?: string;
}

interface IBodyTypeModel {
	code: string;
	description: string;
}

interface ICustomDefect {
	referenceNumber?: string;
	defectName: string;
	defectNotes: string;
}

interface IFeatureFlags {
	welshTranslation: {
		enabled: boolean;
		translatePassTestResult: boolean;
		translateFailTestResult: boolean;
		translatePrsTestResult: boolean;
	};
}

export type {
	IInvokeConfig,
	IMOTConfig,
	IS3Config,
	IGeneratedCertificateResponse,
	IDefects,
	ICertificatePayload,
	IRoadworthinessCertificateData,
	IWeightDetails,
	ITestResult,
	ITestType,
	ITrailerRegistration,
	IMakeAndModel,
	IRequiredStandard,
	IBodyTypeModel,
	ICustomDefect,
	IFeatureFlags,
};
