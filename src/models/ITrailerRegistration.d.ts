export interface ITrailerRegistration {
  vinOrChassisWithMake?: string;
  vin: string;
  make: string;
  trn: string;
  certificateExpiryDate: Date;
  certificateIssueDate: Date;
}
