import { IBodyTypeModel } from './IBodyTypeModel';
import { IVehicleClass } from './IVehicleClass';
import { ITestType } from './ITestType';

export interface ITestResult {
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
}
