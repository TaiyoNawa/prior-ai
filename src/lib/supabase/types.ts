export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      logs: {
        Row: {
          created_at: string | null;
          id: string;
          prompt: string;
          response: Json;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          prompt: string;
          response: Json;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          prompt?: string;
          response?: Json;
          user_id?: string | null;
        };
      };
      tasks: {
        Row: {
          created_at: string | null;
          data: Json;
          id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          data: Json;
          id?: string;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          data?: Json;
          id?: string;
          user_id?: string;
        };
      };
    };
  };
}
