export type InspectionType = 'basic' | 'normal';

export interface IRequiredStandard {
  sectionNumber: string;
  sectionDescription: string;
  rsNumber: number;
  requiredStandard: string;
  refCalculation: string;
  additionalInfo: boolean;
  inspectionTypes: InspectionType[];
  prs: boolean;
  additionalNotes?: string;
}
