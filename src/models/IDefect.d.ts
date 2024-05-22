import { IAdditionalInformation } from './IAdditionalInformation';

export interface IDefect {
  imNumber: number;
  imDescription: string;
  additionalInformation: IAdditionalInformation;
  itemNumber: number;
  itemDescription: string;
  deficiencyRef: string;
  deficiencyId: string;
  deficiencySubId: string;
  deficiencyCategory: string;
  deficiencyText: string;
  stdForProhibition: boolean;
  prs: boolean;
  prohibitionIssued: boolean;
}
