import { TechRecordCompleteCarSchema } from '@dvsa/cvs-type-definitions/types/v3/tech-record/get/car/complete';
import { TechRecordSkeletonCarSchema } from '@dvsa/cvs-type-definitions/types/v3/tech-record/get/car/skeleton';
import { GETHGVTechnicalRecordV3Complete } from '@dvsa/cvs-type-definitions/types/v3/tech-record/get/hgv/complete';
import { GETHGVTechnicalRecordV3Skeleton } from '@dvsa/cvs-type-definitions/types/v3/tech-record/get/hgv/skeleton';
import { GETHGVTechnicalRecordV3Testable } from '@dvsa/cvs-type-definitions/types/v3/tech-record/get/hgv/testable';
import { TechRecordCompleteMotorcycleSchema } from '@dvsa/cvs-type-definitions/types/v3/tech-record/get/motorcycle/complete';
import { GETPSVTechnicalRecordV3Complete } from '@dvsa/cvs-type-definitions/types/v3/tech-record/get/psv/complete';
import { GETPSVTechnicalRecordV3Skeleton } from '@dvsa/cvs-type-definitions/types/v3/tech-record/get/psv/skeleton';
import { GETPSVTechnicalRecordV3Testable } from '@dvsa/cvs-type-definitions/types/v3/tech-record/get/psv/testable';
import { GETTRLTechnicalRecordV3Complete } from '@dvsa/cvs-type-definitions/types/v3/tech-record/get/trl/complete';
import { GETTRLTechnicalRecordV3Skeleton } from '@dvsa/cvs-type-definitions/types/v3/tech-record/get/trl/skeleton';
import { GETTRLTechnicalRecordV3Testable } from '@dvsa/cvs-type-definitions/types/v3/tech-record/get/trl/testable';

export type TechRecordGet =
	| TechRecordCompleteCarSchema
	| TechRecordSkeletonCarSchema
	| GETHGVTechnicalRecordV3Complete
	| GETHGVTechnicalRecordV3Testable
	| GETHGVTechnicalRecordV3Skeleton
	| TechRecordCompleteMotorcycleSchema
	| GETPSVTechnicalRecordV3Complete
	| GETPSVTechnicalRecordV3Testable
	| GETPSVTechnicalRecordV3Skeleton
	| GETTRLTechnicalRecordV3Complete
	| GETTRLTechnicalRecordV3Testable
	| GETTRLTechnicalRecordV3Skeleton;

export type TechRecordType<T extends TechRecordGet['techRecord_vehicleType']> = T extends 'car' | 'lgv'
	? TechRecordCompleteCarSchema
	: T extends 'hgv'
		? GETHGVTechnicalRecordV3Complete | GETHGVTechnicalRecordV3Testable
		: T extends 'motorcycle'
			? TechRecordCompleteMotorcycleSchema
			: T extends 'psv'
				? GETPSVTechnicalRecordV3Complete | GETPSVTechnicalRecordV3Testable
				: T extends 'trl'
					? GETTRLTechnicalRecordV3Complete | GETTRLTechnicalRecordV3Testable
					: never;

export interface ISearchResult {
	systemNumber: string;
	createdTimestamp: string;
	vin: string;
	primaryVrm?: string;
	trailerId?: string;
	techRecord_vehicleType: string;
	techRecord_manufactureYear?: number | null;
	techRecord_chassisMake?: string;
	techRecord_chassisModel?: string;
	techRecord_make?: string;
	techRecord_model?: string;
	techRecord_statusCode?: string;
}
