import { Service } from 'typedi';
import moment from 'moment';
import { ICustomDefect } from '../models/ICustomDefect';
import {
  CERTIFICATE_DATA, IVA_30, LOCATION_ENGLISH, LOCATION_WELSH, TEST_RESULTS,
} from '../models/Enums';
import { IFlatDefect } from '../models/IFlatDefect';
import { IItem } from '../models/IItem';
import { IDefectParent } from '../models/IDefectParent';
import { IDefectChild } from '../models/IDefectChild';
import { TranslationService } from '../services/TranslationService';
import { IDefect } from '../models/IDefect';
import { TestService } from '../test-result/TestService';

@Service()
export class DefectService {
  constructor(private translationService: TranslationService, private testService: TestService) {
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

            if (item.deficiencies !== undefined && item.deficiencies.length !== 0) {
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
  public formatDefect(defect: IDefect): string {
    const toUpperFirstLetter = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

    let defectString = `${defect.deficiencyRef} ${defect.itemDescription}`;

    if (defect.deficiencyText) {
      defectString += ` ${defect.deficiencyText}`;
    }

    if (defect.additionalInformation.location) {
      Object.keys(defect.additionalInformation.location).forEach(
        (location: string, index: number, array: string[]) => {
          const keyTyped = location as keyof typeof defect.additionalInformation.location;
          if (defect.additionalInformation.location[keyTyped]) {
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
                defectString += ` ${toUpperFirstLetter(defect.additionalInformation.location[keyTyped] as string)}`;
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
  public filterFlatDefects(filteredFlatDefects: IFlatDefect[], vehicleType: string): IFlatDefect | null {
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
  public formatDefectWelsh(defect: IDefect, vehicleType: any, flattenedDefects: IFlatDefect[]): string | null {
    const toUpperFirstLetter = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

    const filteredFlatDefects = flattenedDefects.filter((x) => defect.deficiencyRef === x.ref);
    const filteredFlatDefect = this.filterFlatDefects(filteredFlatDefects, vehicleType);

    if (filteredFlatDefect !== null) {
      let defectString = `${defect.deficiencyRef} ${filteredFlatDefect.itemDescriptionWelsh}`;

      if (defect.deficiencyText) {
        defectString += ` ${filteredFlatDefect.deficiencyTextWelsh}`;
      }

      if (defect.additionalInformation.location) {
        Object.keys(defect.additionalInformation.location).forEach(
          (location: string, index: number, array: string[]) => {
            const keyTyped = location as keyof typeof defect.additionalInformation.location;
            if (defect.additionalInformation.location[keyTyped]) {
              const welshLocation = this.translationService.convertLocationWelsh(
                defect.additionalInformation.location[keyTyped] as LOCATION_ENGLISH,
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

  public generateDangerousDefects(testResult: TEST_RESULTS, defect: any, type: CERTIFICATE_DATA, defects: any, vehicleType: string, isWelsh: boolean, flattenedDefects: IFlatDefect[]) {
    if ((testResult === TEST_RESULTS.PRS || defect.prs) && type === CERTIFICATE_DATA.FAIL_DATA) {
      defects.PRSDefects.push(this.formatDefect(defect));

      if (this.testService.isWelshCertificateAvailable(vehicleType, testResult) && isWelsh) {
        defects.PRSDefectsWelsh.push(this.formatDefectWelsh(defect, vehicleType, flattenedDefects));
      }
    } else if (testResult === TEST_RESULTS.FAIL) {
      defects.DangerousDefects.push(this.formatDefect(defect));

      // If the test was conducted in Wales and is valid vehicle type, format and add the welsh defects to the list
      if (this.testService.isWelshCertificateAvailable(vehicleType, testResult) && isWelsh) {
        defects.DangerousDefectsWelsh.push(this.formatDefectWelsh(defect, vehicleType, flattenedDefects));
      }
    }
  }

  public generateMajorDefects(testResult: TEST_RESULTS, defect: any, type: CERTIFICATE_DATA, defects: any, vehicleType: string, isWelsh: boolean, flattenedDefects: IFlatDefect[]) {
    if ((testResult === TEST_RESULTS.PRS || defect.prs) && type === CERTIFICATE_DATA.FAIL_DATA) {
      defects.PRSDefects.push(this.formatDefect(defect));

      if (this.testService.isWelshCertificateAvailable(vehicleType, testResult) && isWelsh) {
        defects.PRSDefectsWelsh.push(this.formatDefectWelsh(defect, vehicleType, flattenedDefects));
      }
    } else if (testResult === TEST_RESULTS.FAIL) {
      defects.MajorDefects.push(this.formatDefect(defect));

      // If the test was conducted in Wales and is valid vehicle type, format and add the welsh defects to the list
      if (this.testService.isWelshCertificateAvailable(vehicleType, testResult) && isWelsh) {
        defects.MajorDefectsWelsh.push(this.formatDefectWelsh(defect, vehicleType, flattenedDefects));
      }
    }
  }

  public generateMinorDefects(defects: any, defect: any, vehicleType: string, testResult: TEST_RESULTS, isWelsh: boolean, flattenedDefects: IFlatDefect[]) {
    defects.MinorDefects.push(this.formatDefect(defect));

    if (this.testService.isWelshCertificateAvailable(vehicleType, testResult) && isWelsh) {
      defects.MinorDefectsWelsh.push(this.formatDefectWelsh(defect, vehicleType, flattenedDefects));
    }
  }

  public generateAdvisoryDefects(defects: any, defect: any, vehicleType: string, testResult: TEST_RESULTS, isWelsh: boolean) {
    defects.AdvisoryDefects.push(this.formatDefect(defect));

    if (this.testService.isWelshCertificateAvailable(vehicleType, testResult) && isWelsh) {
      defects.AdvisoryDefectsWelsh.push(this.formatDefect(defect));
    }
  }
}
