interface IInvokeConfig {
    params: { apiVersion: string; endpoint?: string; };
    functions: { testResults: { name: string }, techRecords: { name: string; mock: string }, certGen: { name: string } };
}

interface IMOTConfig {
    endpoint: string;
    documentDir: "CVS";
    documentNames: {
        vt20: "VT20.pdf";
        vt20w: "VT20W.pdf";
        vt30: "VT30.pdf";
        vt30w: "VT30W.pdf";
        vt32ve: "VT32VE.pdf";
        vt32vew: "VT32VEW.pdf";
        prs: "PRS.pdf";
        prsw: "PRSW.pdf";
        ct20: "CT20.pdf";
        ct30: "CT30.pdf";
        vtp20: "VTP20.pdf";
        vtp30: "VTP30.pdf";
        psv_prs: "PSV_PRS.pdf";
        vtg5: "VTG5.pdf";
        vtg5a: "VTG5A.pdf";
        vtg30: "VTG30.pdf";
        hgv_prs: "HGV_PRS.pdf";
        trl_prs: "TRL_PRS.pdf";
        adr_pass: "ADR_PASS.pdf";
        rwt: "RWT.pdf;";
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
    certificateOrder: { current: number; total: number; };
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
    Signature: ISignature;
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
    testTypes: ITestType;
  }
interface ITestType {
    createdAt: string;
    lastUpdatedAt: string;
    deletionFlag: boolean;
    testCode: string;
    testTypeName: string;
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
    testResult: string;
    prohibitionIssued: boolean;
    reasonForAbandoning: string;
    additionalNotesRecorded: string;
    additionalCommentsForAbandon: string;
    modType: IVehicleClass;
    emissionStandard: string;
    fuelType: string;
    defects: IDefect[];
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

export {IInvokeConfig, IMOTConfig, IS3Config, IGeneratedCertificateResponse, IDefects, ICertificatePayload, IRoadworthinessCertificateData, IWeightDetails, ITestResult};
