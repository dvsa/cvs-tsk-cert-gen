import { Service } from 'typedi';
import moment from 'moment';
import { ICustomDefect } from '../models/ICustomDefect';
import { IVA_30 } from '../models/Enums';
import { IFlatDefect } from '../models/IFlatDefect';
import { IItem } from '../models/IItem';
import { IDefectParent } from '../models/IDefectParent';
import { IDefectChild } from '../models/IDefectChild';

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

  /**
   * Returns a flattened array of every deficiency that only includes the key/value pairs required for certificate generation
   * @param defects - the array of defects from the api
   */
  public flattenDefectsFromApi(defects: IDefectParent[]): IFlatDefect[] {
    const flatDefects: IFlatDefect[] = [];
    try {
      // go through each defect in un-flattened array
      defects.forEach((defect: IDefectParent) => {
        const {
          imNumber, imDescription, imDescriptionWelsh, items,
        } = defect;
        if (defect.items !== undefined && defect.items.length !== 0) {
          // go through each item of defect
          items.forEach((item: IItem) => {
            const {
              itemNumber,
              itemDescription,
              itemDescriptionWelsh,
              deficiencies,
            } = item;
            if (
              item.deficiencies !== undefined
              && item.deficiencies.length !== 0
            ) {
              // go through each deficiency and push to flatDefects array
              deficiencies.forEach((deficiency: IDefectChild) => {
                const {
                  ref,
                  deficiencyText,
                  deficiencyTextWelsh,
                  forVehicleType,
                } = deficiency;
                const lowLevelDeficiency: IFlatDefect = {
                  imNumber,
                  imDescription,
                  imDescriptionWelsh,
                  itemNumber,
                  itemDescription,
                  itemDescriptionWelsh,
                  ref,
                  deficiencyText,
                  deficiencyTextWelsh,
                  forVehicleType,
                };
                flatDefects.push(lowLevelDeficiency);
              });
            }
          });
        }
      });
    } catch (e) {
      // eslint-disable-next-line
      console.error(`Error flattening defects: ${e}`);
    }
    return flatDefects;
  }

  /**
   * Returns a formatted string containing data about a given defect
   * @param defect - defect for which to generate the formatted string
   */
  public formatDefect(defect: any) {
    const toUpperFirstLetter: any = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

    let defectString = `${defect.deficiencyRef} ${defect.itemDescription}`;

    if (defect.deficiencyText) {
      defectString += ` ${defect.deficiencyText}`;
    }

    if (defect.additionalInformation.location) {
      Object.keys(defect.additionalInformation.location).forEach(
        (location: string, index: number, array: string[]) => {
          if (defect.additionalInformation.location[location]) {
            switch (location) {
              case 'rowNumber':
                defectString += ` Rows: ${defect.additionalInformation.location.rowNumber}.`;
                break;
              case 'seatNumber':
                defectString += ` Seats: ${defect.additionalInformation.location.seatNumber}.`;
                break;
              case 'axleNumber':
                defectString += ` Axles: ${defect.additionalInformation.location.axleNumber}.`;
                break;
              default:
                defectString += ` ${toUpperFirstLetter(
                  defect.additionalInformation.location[location],
                )}`;
                break;
            }
          }

          if (index === array.length - 1) {
            defectString += '.';
          }
        },
      );
    }

    if (defect.additionalInformation.notes) {
      defectString += ` ${defect.additionalInformation.notes}`;
    }

    return defectString;
  }
}
