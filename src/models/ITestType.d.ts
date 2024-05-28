import { ICustomDefect } from './ICustomDefect';
import { IRequiredStandard } from './IRequiredStandard';
import { IVehicleClass } from './IVehicleClass';
import { IDefect } from './IDefect';
import { TEST_RESULTS } from './Enums';

export interface ITestType {
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
  defects: IDefect[];
  requiredStandards?: IRequiredStandard[];
  customDefects?: ICustomDefect[];
}
