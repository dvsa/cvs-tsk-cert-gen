import { Service } from 'typedi';
import { ICustomDefect } from '../models/ICustomDefect';
import { IVA_30 } from '../models/Enums';

@Service()
export class DefectService {
  /**
   * Formats the additional defects for IVA and MSVA test based on whether custom defects is populated
   * @param customDefects - the custom defects for the test
   */
  public formatVehicleApprovalAdditionalDefects = (customDefects: ICustomDefect[] | undefined): ICustomDefect[] | undefined => {
    const defaultCustomDefect: ICustomDefect = {
      defectName: IVA_30.EMPTY_CUSTOM_DEFECTS,
      defectNotes: '',
    };
    return (customDefects && customDefects.length > 0) ? customDefects : [defaultCustomDefect];
  };
}
