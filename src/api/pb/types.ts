export type {
	RecordingsTypeOptions as RecordingType,
	RecordingsResponse as Recording,
	BroadcastProgramsResponse as BroadcastProgram,
	VisitorStatsResponse as VisitorStat,
	UsersResponse as User,
	Create,
	Update,
} from "../pocketbase-types";

import type { Create, Update } from "../pocketbase-types";

export type RecordingInsert = Create<"recordings">;
export type RecordingUpdate = Update<"recordings">;
export type BroadcastProgramInsert = Create<"broadcast_programs">;
export type BroadcastProgramUpdate = Update<"broadcast_programs">;
