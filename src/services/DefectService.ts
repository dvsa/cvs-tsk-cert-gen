import { Service } from 'typedi';
import moment from 'moment';
import { ICustomDefect } from '../models/ICustomDefect';
import { IVA_30 } from '../models/Enums';

@Service()
export class DefectService {
  /**
   * Calculates the retest date for an IVA or MSVA test
   * @param testTypeStartTimestamp - the test start timestamp of the test
   */
  public calculateVehicleApprovalRetestDate = (testTypeStartTimestamp: string): string => moment(testTypeStartTimestamp)
    .add(6, 'months')
    .subtract(1, 'day')
    .format('DD/MM/YYYY');

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
