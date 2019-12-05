export enum ERRORS {
    TESTRESULT_ID = "Record does not have valid testResultId for certificate generation.",
    LAMBDA_INVOCATION_ERROR = "Lambda invocation returned error:",
    EMPTY_PAYLOAD = "with empty payload.",
    LAMBDA_INVOCATION_BAD_DATA = "Lambda invocation returned bad data:",
    RETRO_ERROR_OR_CVS_UPDATED = "Not eligible for certificate generation."
}

export enum VEHICLE_TYPES {
    PSV = "psv",
    HGV = "hgv",
    TRL = "trl"
}

export enum TEST_RESULTS {
    PASS = "pass",
    FAIL = "fail",
    PRS = "prs"
}

export enum CERTIFICATE_DATA {
    RWT_DATA = "RWT_DATA",
    PASS_DATA = "PASS_DATA",
    FAIL_DATA = "FAIL_DATA"
}

export const HGV_TRL_ROADWORTHINESS_TEST_TYPES = {
    IDS: ["62", "63", "91", "101", "122"]
};


