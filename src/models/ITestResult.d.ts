import { IBodyTypeModel } from './IBodyTypeModel';
import { IVehicleClass } from './IVehicleClass';
import { ITestType } from './ITestType';
import { ICertificateOrder } from './ICertificateOrder';
import { TEST_RESULT_STATUS, VEHICLE_TYPES } from './Enums';

export interface IBaseTestResult {
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
  testStatus: TEST_RESULT_STATUS;
  reasonForCancellation: string;
  vehicleClass: IVehicleClass;
  vehicleType: VEHICLE_TYPES;
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
  order: ICertificateOrder
  createdByEmailAddress: string;
  shouldEmailCertificate: string;
  systemNumber: string;
}

export interface ITestResult extends IBaseTestResult {
  testTypes: ITestType;
  createdById?: string;
}

export interface ITestResultActual extends IBaseTestResult {
  testTypes: ITestType[];
}
