import { Service } from 'typedi';
import { TechRecordsRepository } from './TechRecordsRepository';
import { VEHICLE_TYPES } from '../models/Enums';
import { ISearchResult, TechRecordGet, TechRecordType } from '../models/Types';

@Service()
export class TechRecordsService {
  private readonly techRecordsRepository: TechRecordsRepository;

  constructor(techRecordsRepository: TechRecordsRepository) {
    this.techRecordsRepository = techRecordsRepository;
  }

  /**
   * Method for getting make and model based on the vehicle from a test-result
   * @param testResult - the testResult for which the tech record search is done for
   */
  public getVehicleMakeAndModel = async (testResult: any) => {
    const searchRes = await this.techRecordsRepository.callSearchTechRecords(testResult.systemNumber);
    const techRecord = await this.processGetCurrentProvisionalRecords(searchRes);
    // Return bodyMake and bodyModel values for PSVs
    return techRecord?.techRecord_vehicleType as VEHICLE_TYPES === VEHICLE_TYPES.PSV ? {
      Make: (techRecord as TechRecordType<'psv'>).techRecord_chassisMake,
      Model: (techRecord as TechRecordType<'psv'>).techRecord_chassisModel,
    } : {
      Make: (techRecord as TechRecordType<'hgv' | 'trl'>).techRecord_make,
      Model: (techRecord as TechRecordType<'hgv' | 'trl'>).techRecord_model,
    };
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
      if (record.techRecord_statusCode === 'current') {
        currentRecords.push(record);
      } else if (record.techRecord_statusCode === 'provisional') {
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
}
