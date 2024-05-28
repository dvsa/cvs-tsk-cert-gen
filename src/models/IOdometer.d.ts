export interface IOdometer {
  value: number;
  unit: string;
  date: string;
}

export interface IOdometerHistory {
  OdometerHistoryList: IOdometer[];
}
