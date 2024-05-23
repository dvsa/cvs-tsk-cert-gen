import { Service } from 'typedi';
import moment from 'moment';
import { ICustomDefect } from '../models/ICustomDefect';
import { IVA_30, LOCATION_WELSH } from '../models/Enums';
import { IFlatDefect } from '../models/IFlatDefect';
import { IItem } from '../models/IItem';
import { IDefectParent } from '../models/IDefectParent';
import { IDefectChild } from '../models/IDefectChild';
import { TranslationService } from './TranslationService';

@Service()
export class DefectService {
  constructor(private translationService: TranslationService) {
  }

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

  /**
   * Returns filtered welsh defects
   * @param filteredFlatDefects - the array of flattened defects
   * @param vehicleType - the vehicle type from the test result
   */
  public filterFlatDefects(
    filteredFlatDefects: IFlatDefect[],
    vehicleType: string,
  ): IFlatDefect | null {
    if (filteredFlatDefects.length === 0) {
      return null;
    } if (filteredFlatDefects.length === 1) {
      return filteredFlatDefects[0];
    }
    const filteredWelshDefectsOnVehicleType = filteredFlatDefects.filter(
      (flatDefect: IFlatDefect) => flatDefect.forVehicleType!.includes(vehicleType),
    );
    return filteredWelshDefectsOnVehicleType[0];
  }

  /**
   * Returns a formatted welsh string containing data about a given defect
   * @param defect - the defect for which to generate the formatted welsh string
   * @param vehicleType - the vehicle type from the test result
   * @param flattenedDefects - the list of flattened defects
   */
  public formatDefectWelsh(
    defect: any,
    vehicleType: any,
    flattenedDefects: IFlatDefect[],
  ) {
    const toUpperFirstLetter: any = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

    const filteredFlatDefects: IFlatDefect[] = flattenedDefects.filter(
      (x: IFlatDefect) => defect.deficiencyRef === x.ref,
    );

    const filteredFlatDefect: IFlatDefect | null = this.filterFlatDefects(
      filteredFlatDefects,
      vehicleType,
    );

    if (filteredFlatDefect !== null) {
      let defectString = `${defect.deficiencyRef} ${filteredFlatDefect.itemDescriptionWelsh}`;

      if (defect.deficiencyText) {
        defectString += ` ${filteredFlatDefect.deficiencyTextWelsh}`;
      }

      if (defect.additionalInformation.location) {
        Object.keys(defect.additionalInformation.location).forEach(
          (location: string, index: number, array: string[]) => {
            if (defect.additionalInformation.location[location]) {
              const welshLocation = this.translationService.convertLocationWelsh(
                defect.additionalInformation.location[location],
              );

              switch (location) {
                case 'rowNumber':
                  defectString += ` ${LOCATION_WELSH.ROW_NUMBER}: ${defect.additionalInformation.location.rowNumber}.`;
                  break;
                case 'seatNumber':
                  defectString += ` ${LOCATION_WELSH.SEAT_NUMBER}: ${defect.additionalInformation.location.seatNumber}.`;
                  break;
                case 'axleNumber':
                  defectString += ` ${LOCATION_WELSH.AXLE_NUMBER}: ${defect.additionalInformation.location.axleNumber}.`;
                  break;
                default:
                  defectString += ` ${toUpperFirstLetter(welshLocation)}`;
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
    console.log('ERROR: Unable to find a filtered defect');
    return null;
  }
}
