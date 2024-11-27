import { TestResultSchema, TestTypeSchema } from '@dvsa/cvs-type-definitions/types/v1/test-result';

//Create custom type of test result schema with flat test type array for this service.
interface TestResultSchemaTestTypesAsObject extends Omit<TestResultSchema, 'testTypes'> {
	testTypes: TestTypeSchema;
}

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

interface IFeatureFlags {
	welshTranslation: {
		enabled: boolean;
		translatePassTestResult: boolean;
		translateFailTestResult: boolean;
		translatePrsTestResult: boolean;
	};
}

interface IDefectChild {
	ref?: string;
	deficiencyText?: string;
	deficiencyTextWelsh?: string;
	forVehicleType?: string[];
}

interface IItem {
	itemNumber?: number;
	itemDescription?: string;
	itemDescriptionWelsh?: string;
	deficiencies: IDefectChild[];
}

interface IDefectParent {
	imNumber?: number;
	imDescription?: string;
	imDescriptionWelsh?: string;
	items: IItem[];
}

interface IFlatDefect {
	imNumber?: number;
	imDescription?: string;
	imDescriptionWelsh?: string;
	itemNumber?: number;
	itemDescription?: string;
	itemDescriptionWelsh?: string;
	ref?: string;
	deficiencyText?: string;
	deficiencyTextWelsh?: string;
	forVehicleType?: string[];
}

export type {
	ICertificatePayload,
	IDefectChild,
	IDefectParent,
	IDefects,
	IFeatureFlags,
	IFlatDefect,
	IGeneratedCertificateResponse,
	IInvokeConfig,
	IItem,
	IMOTConfig,
	IMakeAndModel,
	IRoadworthinessCertificateData,
	IS3Config,
	ITrailerRegistration,
	IWeightDetails,
	TestResultSchemaTestTypesAsObject,
};
