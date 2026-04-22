export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          nickname: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          nickname?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          nickname?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      feedback_submissions: {
        Row: {
          id: string
          user_id: string | null
          category: string
          content: string
          source: string | null
          scene: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          category: string
          content: string
          source?: string | null
          scene?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          category?: string
          content?: string
          source?: string | null
          scene?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
