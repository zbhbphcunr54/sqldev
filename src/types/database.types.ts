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
      feedback_entries: {
        Row: {
          id: string
          user_id: string | null
          category: string
          content: string
          contact: string | null
          source: string | null
          scene: string | null
          page: string | null
          theme: string | null
          user_agent: string | null
          client_ip: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          category: string
          content: string
          contact?: string | null
          source?: string | null
          scene?: string | null
          page?: string | null
          theme?: string | null
          user_agent?: string | null
          client_ip?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          category?: string
          content?: string
          contact?: string | null
          source?: string | null
          scene?: string | null
          page?: string | null
          theme?: string | null
          user_agent?: string | null
          client_ip?: string | null
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
