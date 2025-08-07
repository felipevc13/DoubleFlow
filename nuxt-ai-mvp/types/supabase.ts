export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      questions: {
        Row: {
          allowMultiple: boolean | null;
          allowOther: boolean | null;
          created_at: string | null;
          endLabel: string | null;
          extra: Json | null;
          id: string;
          isRequired: boolean;
          maxValue: number | null;
          minValue: number | null;
          options: Json | null;
          order: number | null;
          questionText: string;
          startLabel: string | null;
          survey_id: string;
          task_id: string | null;
          type: string;
          user_id: string | null;
        };
        Insert: {
          allowMultiple?: boolean | null;
          allowOther?: boolean | null;
          created_at?: string | null;
          endLabel?: string | null;
          extra?: Json | null;
          id?: string;
          isRequired?: boolean;
          maxValue?: number | null;
          minValue?: number | null;
          options?: Json | null;
          order?: number | null;
          questionText: string;
          startLabel?: string | null;
          survey_id: string;
          task_id?: string | null;
          type: string;
          user_id?: string | null;
        };
        Update: {
          allowMultiple?: boolean | null;
          allowOther?: boolean | null;
          created_at?: string | null;
          endLabel?: string | null;
          extra?: Json | null;
          id?: string;
          isRequired?: boolean;
          maxValue?: number | null;
          minValue?: number | null;
          options?: Json | null;
          order?: number | null;
          questionText?: string;
          startLabel?: string | null;
          survey_id?: string;
          task_id?: string | null;
          type?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "questions_survey_id_fkey";
            columns: ["survey_id"];
            isOneToOne: false;
            referencedRelation: "surveys";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "questions_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          }
        ];
      };
      survey_responses: {
        Row: {
          created_at: string;
          id: string;
          question_id: string;
          respondent_session_id: string | null;
          response_value: Json | null;
          submission_id: string | null;
          survey_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          question_id: string;
          respondent_session_id?: string | null;
          response_value?: Json | null;
          submission_id?: string | null;
          survey_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          question_id?: string;
          respondent_session_id?: string | null;
          response_value?: Json | null;
          submission_id?: string | null;
          survey_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "survey_responses_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "survey_responses_survey_id_fkey";
            columns: ["survey_id"];
            isOneToOne: false;
            referencedRelation: "surveys";
            referencedColumns: ["id"];
          }
        ];
      };
      surveys: {
        Row: {
          created_at: string | null;
          id: string;
          is_active: boolean;
          task_id: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          is_active?: boolean;
          task_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          is_active?: boolean;
          task_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "surveys_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          }
        ];
      };
      task_flows: {
        Row: {
          created_at: string;
          edges: Json | null;
          id: string;
          nodes: Json | null;
          task_id: string | null;
          updated_at: string;
          user_id: string | null;
          viewport: Json | null;
        };
        Insert: {
          created_at?: string;
          edges?: Json | null;
          id?: string;
          nodes?: Json | null;
          task_id?: string | null;
          updated_at?: string;
          user_id?: string | null;
          viewport?: Json | null;
        };
        Update: {
          created_at?: string;
          edges?: Json | null;
          id?: string;
          nodes?: Json | null;
          task_id?: string | null;
          updated_at?: string;
          user_id?: string | null;
          viewport?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "task_flows_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: true;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          }
        ];
      };
      reports: {
        Row: {
          created_at: string;
          id: string;
          report_blocks: Json | null; // Array de objetos JSON que definem os blocos modulares do relatório.
          summary: string | null;
          task_id: string;
          title: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          report_blocks?: Json | null; // Array de blocos modulares do relatório
          summary?: string | null;
          task_id: string;
          title: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          report_blocks?: Json | null; // Array de blocos modulares do relatório
          summary?: string | null;
          task_id?: string;
          title?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          created_at: string | null;
          id: string;
          name: string;
          problem_statement: Json | null;
          slug: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          name: string;
          problem_statement?: Json | null;
          slug: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          name?: string;
          problem_statement?: Json | null;
          slug?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      agent_conversations: {
        Row: {
          created_at: string;
          history: Json; // Armazena o array de mensagens [{type, data}]
          id: string; // Geralmente o mesmo que task_id
          task_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          history: Json;
          id: string;
          task_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          history?: Json;
          id?: string;
          task_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agent_conversations_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: true;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_conversations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      update_survey_structure: {
        Args: { p_survey_id: string; p_survey_structure: Json };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DefaultSchema = Database[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
      DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
      DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R;
    }
    ? R
    : never
  : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
