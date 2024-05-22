export interface ITestStation {
  testStationId: string;
  testStationPNumber: string;
  testStationStatus: string;
  testStationName: string;
  testStationContactNumber: string;
  testStationAccessNotes: string;
  testStationGeneralNotes: string;
  testStationTown: string;
  testStationAddress: string;
  testStationPostcode: string;
  testStationCountry?: string;
  testStationLongitude: number;
  testStationLatitude: number;
  testStationType: string;
  testStationEmails: string[];
}
