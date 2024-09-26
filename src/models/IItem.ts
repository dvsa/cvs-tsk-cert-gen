import { IDefectChild } from './IDefectChild';

export interface IItem {
	itemNumber?: number;
	itemDescription?: string;
	itemDescriptionWelsh?: string;
	deficiencies: IDefectChild[];
}
