import { Service } from 'typedi';
import { TechRecordsRepository } from './TechRecordsRepository';
import { TECH_RECORD_STATUS_CODE, VEHICLE_TYPES } from '../models/Enums';
import { ISearchResult, TechRecordGet, TechRecordType } from '../models/Types';
import { IWeightDetails } from '../models/IWeightDetails';
import { HTTPError } from '../models/HTTPError';
import { ITestResult } from '../models/ITestResult';
import { IMakeAndModel } from '../models/IMakeAndModel';

@Service()
export class TechRecordsService {
  constructor(private techRecordsRepository: TechRecordsRepository) {
  }

  /**
   * Method for getting make and model based on the vehicle from a test-result
   * @param testResult - the testResult for which the tech record search is done for
   */
  public getVehicleMakeAndModel = async (testResult: ITestResult): Promise<IMakeAndModel> => {
    const searchRes = await this.techRecordsRepository.callSearchTechRecords(testResult.systemNumber);
    const techRecord = await this.processGetCurrentProvisionalRecords(searchRes);

    // Return bodyMake and bodyModel values for PSVs
    if (techRecord?.techRecord_vehicleType as VEHICLE_TYPES === VEHICLE_TYPES.PSV) {
      const tr = techRecord as TechRecordType<'psv'>;
      return {
        Make: tr.techRecord_chassisMake,
        Model: tr.techRecord_chassisModel,
      } as IMakeAndModel;
    }

    const tr = techRecord as TechRecordType<'hgv' | 'trl'>;
    return {
      Make: tr.techRecord_make,
      Model: tr.techRecord_model,
    } as IMakeAndModel;
  };

  public processGetCurrentProvisionalRecords = async <T extends TechRecordGet['techRecord_vehicleType']>(searchResult: ISearchResult[]): Promise<TechRecordType<T> | undefined> => {
    if (searchResult) {
      const processRecordsRes = this.groupRecordsByStatusCode(searchResult);

      if (processRecordsRes.currentCount !== 0) {
        return this.techRecordsRepository.callGetTechRecords(
          processRecordsRes.currentRecords[0].systemNumber,
          processRecordsRes.currentRecords[0].createdTimestamp,
        );
      }

      if (processRecordsRes.provisionalCount === 1) {
        return this.techRecordsRepository.callGetTechRecords(
          processRecordsRes.provisionalRecords[0].systemNumber,
          processRecordsRes.provisionalRecords[0].createdTimestamp,
        );
      }

      return this.techRecordsRepository.callGetTechRecords(
        processRecordsRes.provisionalRecords[1].systemNumber,
        processRecordsRes.provisionalRecords[1].createdTimestamp,
      );
    }

    return Promise.reject(new Error('Tech record Search returned nothing.'));
  };

  /**
   * helper function is used to process records and count provisional and current records
   * @param records
   */
  private groupRecordsByStatusCode = (records: ISearchResult[]): { currentRecords: ISearchResult[]; provisionalRecords: ISearchResult[]; currentCount: number; provisionalCount: number; } => {
    const currentRecords: ISearchResult[] = [];
    const provisionalRecords: ISearchResult[] = [];

    records.forEach((record) => {
      if (record.techRecord_statusCode === TECH_RECORD_STATUS_CODE.CURRENT) {
        currentRecords.push(record);
      } else if (record.techRecord_statusCode === TECH_RECORD_STATUS_CODE.PROVISIONAL) {
        provisionalRecords.push(record);
      }
    });

    return {
      currentRecords,
      provisionalRecords,
      currentCount: currentRecords.length,
      provisionalCount: provisionalRecords.length,
    };
  };

  /**
   * Retrieves the vehicle weight details for Roadworthisness certificates
   * @param testResult
   */
  public async getWeightDetails(testResult: ITestResult): Promise<IWeightDetails> {
    const searchRes = await this.techRecordsRepository.callSearchTechRecords(testResult.systemNumber);
    const techRecord = await this.processGetCurrentProvisionalRecords(searchRes) as TechRecordType<'hgv' | 'psv' | 'trl'>;

    if (techRecord) {
      const weightDetails: IWeightDetails = {
        dgvw: techRecord.techRecord_grossDesignWeight ?? 0,
        weight2: 0,
      };

      if (testResult.vehicleType === VEHICLE_TYPES.HGV) {
        weightDetails.weight2 = (techRecord as TechRecordType<'hgv'>).techRecord_trainDesignWeight ?? 0;
      } else if (
        (techRecord.techRecord_noOfAxles ?? -1) > 0
      ) {
        const initialValue: number = 0;
        weightDetails.weight2 = (techRecord.techRecord_axles as any).reduce(
          (
            accumulator: number,
            currentValue: { weights_designWeight: number },
          ) => accumulator + currentValue.weights_designWeight,
          initialValue,
        );
      } else {
        throw new HTTPError(500, 'No axle weights for Roadworthiness test certificates!');
      }

      return weightDetails;
    }

    console.log('No techRecord found for weight details');
    throw new HTTPError(500, 'No vehicle found for Roadworthiness test certificate!');
  }

  /**
   * Retrieves the adrDetails from a techRecord searched by vin
   * @param testResult - testResult from which the VIN is used to search a tech-record
   */
  public getAdrDetails = async (testResult: ITestResult): Promise<TechRecordType<'hgv' | 'trl'>> => {
    const searchRes = await this.techRecordsRepository.callSearchTechRecords(testResult.systemNumber);
    return await this.processGetCurrentProvisionalRecords(searchRes) as TechRecordType<'hgv' | 'trl'>;
  };
}
