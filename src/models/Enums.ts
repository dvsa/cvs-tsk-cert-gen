export enum ERRORS {
    TESTRESULT_ID = "Record does not have valid testResultId for certificate generation.",
    LAMBDA_INVOCATION_ERROR = "Lambda invocation returned error:",
    EMPTY_PAYLOAD = "with empty payload.",
    LAMBDA_INVOCATION_BAD_DATA = "Lambda invocation returned bad data:",
    RETRO_ERROR_OR_CVS_UPDATED = "Not eligible for certificate generation.",
    SECRET_ENV_VAR_NOT_EXIST = "SECRET_KEY environment variable does not exist.",
    SECRET_DETAILS_NOT_FOUND = "No secret details found.",
    ADDRESS_BOOLEAN_DOES_NOT_EXIST = "Payload does not include boolean value for isWelshAddress: "
}

export enum VEHICLE_TYPES {
  PSV = "psv",
  HGV = "hgv",
  TRL = "trl",
}

export enum TEST_RESULTS {
  PASS = "pass",
  FAIL = "fail",
  PRS = "prs",
}

export enum CERTIFICATE_DATA {
  RWT_DATA = "RWT_DATA",
  PASS_DATA = "PASS_DATA",
  FAIL_DATA = "FAIL_DATA",
  ADR_DATA = "ADR_DATA",
  IVA_DATA = "IVA_DATA",
  MSVA_DATA = "MSVA_DATA"
}

export enum LOCATION_ENGLISH {
    FRONT = "front",
    REAR = "rear",
    UPPER = "upper",
    LOWER = "lower",
    NEARSIDE = "nearside",
    OFFSIDE = "offside",
    CENTRE = "centre",
    INNER = "inner",
    OUTER = "outer"
}

export enum LOCATION_WELSH {
    FRONT = "blaen",
    REAR = "cefn",
    UPPER = "uchaf",
    LOWER = "isaf",
    NEARSIDE = "ochr mewnol",
    OFFSIDE = "allanol",
    CENTRE = "canol",
    INNER = "mewnol",
    OUTER = "allanol",
    ROW_NUMBER = "Rhesi",
    SEAT_NUMBER = "Seddi",
    AXLE_NUMBER = "Echelau"
}

export enum IVA_30 {
    BASIC = "Basic",
    NORMAL = "Normal",
    EMPTY_CUSTOM_DEFECTS = "N/A"
}

export const HGV_TRL_ROADWORTHINESS_TEST_TYPES = {
  IDS: ["62", "63", "91", "101", "122"],
};

export const WELSH_CERT_VEHICLES = {
    TYPES: ["hgv", "trl", "psv"]
};
