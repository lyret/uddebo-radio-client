export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
	// Allows to automatically instantiate createClient with right options
	// instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
	__InternalSupabase: {
		PostgrestVersion: "13.0.4";
	};
	public: {
		Tables: {
			recordings: {
				Row: {
					id: string;
					edited_at: string;
					edited_by: string | null;
					uploaded_at: string;
					uploaded_filename: string;
					uploaded_by: string | null;
					duration: number;
					file_size: number;
					file_url: string;
					title: string | null;
					author: string | null;
					description: string | null;
					link_out_url: string | null;
					captions_url: string | null;
					cover_url: string | null;
					type:
						| "unknown"
						| "rejected"
						| "music"
						| "news"
						| "commentary"
						| "talk"
						| "comedy"
						| "talkshow"
						| "interview"
						| "other";
				};
				Insert: {
					id?: string;
					edited_at?: string;
					edited_by?: string | null;
					uploaded_at?: string;
					uploaded_filename: string;
					uploaded_by?: string | null;
					duration: number;
					file_size: number;
					file_url: string;
					title?: string | null;
					author?: string | null;
					description?: string | null;
					link_out_url?: string | null;
					captions_url?: string | null;
					cover_url?: string | null;
					type?:
						| "unknown"
						| "rejected"
						| "music"
						| "news"
						| "commentary"
						| "talk"
						| "comedy"
						| "talkshow"
						| "interview"
						| "other";
				};
				Update: {
					id?: string;
					edited_at?: string;
					edited_by?: string | null;
					uploaded_at?: string;
					uploaded_filename?: string;
					uploaded_by?: string | null;
					duration?: number;
					file_size?: number;
					file_url?: string;
					title?: string | null;
					author?: string | null;
					description?: string | null;
					link_out_url?: string | null;
					captions_url?: string | null;
					cover_url?: string | null;
					type?:
						| "unknown"
						| "rejected"
						| "music"
						| "news"
						| "commentary"
						| "talk"
						| "comedy"
						| "talkshow"
						| "interview"
						| "other";
				};
				Relationships: [
					{
						foreignKeyName: "recordings_edited_by_fkey";
						columns: ["edited_by"];
						isOneToOne: false;
						referencedRelation: "users";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "recordings_uploaded_by_fkey";
						columns: ["uploaded_by"];
						isOneToOne: false;
						referencedRelation: "users";
						referencedColumns: ["id"];
					},
				];
			};
			broadcast_programs: {
				Row: {
					id: string;
					edited_at: string;
					edited_by: string | null;
					created_at: string;
					created_by: string | null;
					title: string;
					description: string | null;
					cover_url: string | null;
					is_active: boolean;
					start_time: string;
					recordings: string[];
				};
				Insert: {
					id?: string;
					edited_at?: string;
					edited_by?: string | null;
					created_at?: string;
					created_by?: string | null;
					title: string;
					description?: string | null;
					cover_url?: string | null;
					is_active?: boolean;
					start_time: string;
					recordings?: string[];
				};
				Update: {
					id?: string;
					edited_at?: string;
					edited_by?: string | null;
					created_at?: string;
					created_by?: string | null;
					title?: string;
					description?: string | null;
					cover_url?: string | null;
					is_active?: boolean;
					start_time?: string;
					recordings?: string[];
				};
				Relationships: [
					{
						foreignKeyName: "broadcast_programs_edited_by_fkey";
						columns: ["edited_by"];
						isOneToOne: false;
						referencedRelation: "users";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "broadcast_programs_created_by_fkey";
						columns: ["created_by"];
						isOneToOne: false;
						referencedRelation: "users";
						referencedColumns: ["id"];
					},
				];
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			[_ in never]: never;
		};
		Enums: {
			recording_type:
				| "unknown"
				| "rejected"
				| "music"
				| "news"
				| "commentary"
				| "talk"
				| "comedy"
				| "talkshow"
				| "interview"
				| "other";
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
	DefaultSchemaTableNameOrOptions extends
		| keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
				DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
		: never = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
			DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
			Row: infer R;
		}
		? R
		: never
	: DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
		? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
				Row: infer R;
			}
			? R
			: never
		: never;

export type TablesInsert<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema["Tables"]
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
		: never = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
			Insert: infer I;
		}
		? I
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
		? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
				Insert: infer I;
			}
			? I
			: never
		: never;

export type TablesUpdate<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema["Tables"]
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
		: never = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
			Update: infer U;
		}
		? U
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
		? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
				Update: infer U;
			}
			? U
			: never
		: never;

export type Enums<
	DefaultSchemaEnumNameOrOptions extends
		| keyof DefaultSchema["Enums"]
		| { schema: keyof DatabaseWithoutInternals },
	EnumName extends DefaultSchemaEnumNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
		: never = never,
> = DefaultSchemaEnumNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
	: DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
		? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
		: never;

export type CompositeTypes<
	PublicCompositeTypeNameOrOptions extends
		| keyof DefaultSchema["CompositeTypes"]
		| { schema: keyof DatabaseWithoutInternals },
	CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
		: never = never,
> = PublicCompositeTypeNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
	: PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
		? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
		: never;

export const Constants = {
	public: {
		Enums: {
			recording_type: [
				"unknown",
				"rejected",
				"music",
				"news",
				"commentary",
				"talk",
				"comedy",
				"talkshow",
				"interview",
				"jingle",
				"other",
			] as const,
		},
	},
} as const;

// Export convenience types
export type Recording = Tables<"recordings">;
export type RecordingInsert = TablesInsert<"recordings">;
export type RecordingUpdate = TablesUpdate<"recordings">;
export type RecordingType = Enums<"recording_type">;

export type BroadcastProgram = Tables<"broadcast_programs">;
export type BroadcastProgramInsert = TablesInsert<"broadcast_programs">;
export type BroadcastProgramUpdate = TablesUpdate<"broadcast_programs">;
