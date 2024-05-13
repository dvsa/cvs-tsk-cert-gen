import { IItem } from './IItem';

export interface IDefectParent {
  imNumber?: number;
  imDescription?: string;
  imDescriptionWelsh?: string;
  items: IItem[];
}
