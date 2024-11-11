import { TechRecordGETCarComplete } from '@dvsa/cvs-type-definitions/types/v3/tech-record/get/car/complete';
import { TechRecordGETCarSkeleton } from '@dvsa/cvs-type-definitions/types/v3/tech-record/get/car/skeleton';
import { TechRecordGETHGVComplete } from '@dvsa/cvs-type-definitions/types/v3/tech-record/get/hgv/complete';
import { TechRecordGETHGVSkeleton } from '@dvsa/cvs-type-definitions/types/v3/tech-record/get/hgv/skeleton';
import { TechRecordGETHGVTestable } from '@dvsa/cvs-type-definitions/types/v3/tech-record/get/hgv/testable';
import { TechRecordGETMotorcycleComplete } from '@dvsa/cvs-type-definitions/types/v3/tech-record/get/motorcycle/complete';
import { TechRecordGETPSVComplete } from '@dvsa/cvs-type-definitions/types/v3/tech-record/get/psv/complete';
import { TechRecordGETPSVSkeleton } from '@dvsa/cvs-type-definitions/types/v3/tech-record/get/psv/skeleton';
import { TechRecordGETPSVTestable } from '@dvsa/cvs-type-definitions/types/v3/tech-record/get/psv/testable';
import { TechRecordGETTRLComplete } from '@dvsa/cvs-type-definitions/types/v3/tech-record/get/trl/complete';
import { TechRecordGETTRLSkeleton } from '@dvsa/cvs-type-definitions/types/v3/tech-record/get/trl/skeleton';
import { TechRecordGETTRLTestable } from '@dvsa/cvs-type-definitions/types/v3/tech-record/get/trl/testable';

export type TechRecordGet =
	| TechRecordGETCarComplete
	| TechRecordGETCarSkeleton
	| TechRecordGETHGVComplete
	| TechRecordGETHGVTestable
	| TechRecordGETHGVSkeleton
	| TechRecordGETMotorcycleComplete
	| TechRecordGETPSVComplete
	| TechRecordGETPSVTestable
	| TechRecordGETPSVSkeleton
	| TechRecordGETTRLComplete
	| TechRecordGETTRLTestable
	| TechRecordGETTRLSkeleton;

export type TechRecordType<T extends TechRecordGet['techRecord_vehicleType']> = T extends 'car' | 'lgv'
	? TechRecordGETCarComplete
	: T extends 'hgv'
		? TechRecordGETHGVComplete | TechRecordGETHGVTestable
		: T extends 'motorcycle'
			? TechRecordGETMotorcycleComplete
			: T extends 'psv'
				? TechRecordGETPSVComplete | TechRecordGETPSVTestable
				: T extends 'trl'
					? TechRecordGETTRLComplete | TechRecordGETTRLTestable
					: never;
