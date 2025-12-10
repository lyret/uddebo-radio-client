import * as SupabaseTypes from "@/../supabase/database.types";
export * from "@/../supabase/database.types";

// Export convenience types
export type Recording = SupabaseTypes.Tables<"recordings">;
export type RecordingInsert = SupabaseTypes.TablesInsert<"recordings">;
export type RecordingUpdate = SupabaseTypes.TablesUpdate<"recordings">;
export type RecordingType = SupabaseTypes.Enums<"recording_type">;

export type BroadcastProgram = SupabaseTypes.Tables<"broadcast_programs">;
export type BroadcastProgramInsert = SupabaseTypes.TablesInsert<"broadcast_programs">;
export type BroadcastProgramUpdate = SupabaseTypes.TablesUpdate<"broadcast_programs">;
