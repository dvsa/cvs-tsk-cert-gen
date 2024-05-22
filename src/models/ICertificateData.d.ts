import { IOdometer } from './IOdometer';

export interface ICertificateData {
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
