export interface IRoadworthinessCertificateData {
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
