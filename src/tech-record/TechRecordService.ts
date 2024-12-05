import { TechRecordSearchSchema } from '@dvsa/cvs-type-definitions/types/v3/tech-record/get/search';
import { Inject, Service } from 'typedi';
import { IWeightDetails } from '../models';
import { VEHICLE_TYPES } from '../models/Enums';
import { HTTPError } from '../models/HTTPError';
import { TechRecordGet, TechRecordType } from '../models/Types';
import { TechRecordRepository } from './TechRecordRepository';

@Service()
export class TechRecordService {
	constructor(@Inject() private techRecordRepository: TechRecordRepository) {}

	/**
	 * Method for getting make and model based on the vehicle from a test-result
	 * @param testResult - the testResult for which the tech record search is done for
	 */
	public getVehicleMakeAndModel = async (testResult: any) => {
		const searchRes = await this.techRecordRepository.callSearchTechRecords(testResult.systemNumber);
		const techRecord = await this.processGetCurrentProvisionalRecords(searchRes);
		// Return bodyMake and bodyModel values for PSVs
		return techRecord?.techRecord_vehicleType === VEHICLE_TYPES.PSV
			? {
					Make: (techRecord as TechRecordType<'psv'>).techRecord_chassisMake,
					Model: (techRecord as TechRecordType<'psv'>).techRecord_chassisModel,
				}
			: {
					Make: (techRecord as TechRecordType<'hgv' | 'trl'>).techRecord_make,
					Model: (techRecord as TechRecordType<'hgv' | 'trl'>).techRecord_model,
				};
	};

	private processGetCurrentProvisionalRecords = async <T extends TechRecordGet['techRecord_vehicleType']>(
		searchResult: TechRecordSearchSchema[]
	): Promise<TechRecordType<T> | undefined> => {
		if (searchResult) {
			const processRecordsRes = this.groupRecordsByStatusCode(searchResult);
			return processRecordsRes.currentCount !== 0
				? this.techRecordRepository.callGetTechRecords(
						processRecordsRes.currentRecords[0].systemNumber,
						processRecordsRes.currentRecords[0].createdTimestamp
					)
				: processRecordsRes.provisionalCount === 1
					? this.techRecordRepository.callGetTechRecords(
							processRecordsRes.provisionalRecords[0].systemNumber,
							processRecordsRes.provisionalRecords[0].createdTimestamp
						)
					: this.techRecordRepository.callGetTechRecords(
							processRecordsRes.provisionalRecords[1].systemNumber,
							processRecordsRes.provisionalRecords[1].createdTimestamp
						);
		} else {
			await Promise.reject('Tech record Search returned nothing.');
		}
	};

	/**
	 * helper function is used to process records and count provisional and current records
	 * @param records
	 */
	private groupRecordsByStatusCode = (
		records: TechRecordSearchSchema[]
	): {
		currentRecords: TechRecordSearchSchema[];
		provisionalRecords: TechRecordSearchSchema[];
		currentCount: number;
		provisionalCount: number;
	} => {
		const currentRecords: TechRecordSearchSchema[] = [];
		const provisionalRecords: TechRecordSearchSchema[] = [];
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

	/**
	 * Retrieves the vehicle weight details for Roadworthisness certificates
	 * @param testResult
	 */
	public async getWeightDetails(testResult: any) {
		const searchRes = await this.techRecordRepository.callSearchTechRecords(testResult.systemNumber);
		const techRecord = (await this.processGetCurrentProvisionalRecords(searchRes)) as TechRecordType<
			'hgv' | 'psv' | 'trl'
		>;
		if (techRecord) {
			const weightDetails: IWeightDetails = {
				dgvw: techRecord.techRecord_grossDesignWeight ?? 0,
				weight2: 0,
			};
			if (testResult.vehicleType === VEHICLE_TYPES.HGV) {
				weightDetails.weight2 = (techRecord as TechRecordType<'hgv'>).techRecord_trainDesignWeight ?? 0;
			} else {
				if ((techRecord.techRecord_noOfAxles ?? -1) > 0) {
					const initialValue: number = 0;
					weightDetails.weight2 = (techRecord.techRecord_axles as any).reduce(
						(accumulator: number, currentValue: { weights_designWeight: number }) =>
							accumulator + currentValue.weights_designWeight,
						initialValue
					);
				} else {
					throw new HTTPError(500, 'No axle weights for Roadworthiness test certificates!');
				}
			}
			return weightDetails;
		} else {
			console.log('No techRecord found for weight details');
			throw new HTTPError(500, 'No vehicle found for Roadworthiness test certificate!');
		}
	}

	/**
	 * Retrieves the adrDetails from a techRecord searched by vin
	 * @param testResult - testResult from which the VIN is used to search a tech-record
	 */
	public getAdrDetails = async (testResult: any) => {
		const searchRes = await this.techRecordRepository.callSearchTechRecords(testResult.systemNumber);
		return (await this.processGetCurrentProvisionalRecords(searchRes)) as TechRecordType<'hgv' | 'trl'>;
	};
}
