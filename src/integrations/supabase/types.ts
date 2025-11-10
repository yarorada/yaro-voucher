export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      airline_templates: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      airport_templates: {
        Row: {
          city: string
          country: string
          created_at: string
          iata: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          city: string
          country: string
          created_at?: string
          iata: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          iata?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      attractions: {
        Row: {
          created_at: string
          description: string | null
          destination_id: string
          id: string
          name: string
          type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          destination_id: string
          id?: string
          name: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          destination_id?: string
          id?: string
          name?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attractions_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          company_name: string | null
          created_at: string
          dic: string | null
          email: string | null
          first_name: string
          ico: string | null
          id: string
          last_name: string
          notes: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          company_name?: string | null
          created_at?: string
          dic?: string | null
          email?: string | null
          first_name: string
          ico?: string | null
          id?: string
          last_name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          address?: string | null
          company_name?: string | null
          created_at?: string
          dic?: string | null
          email?: string | null
          first_name?: string
          ico?: string | null
          id?: string
          last_name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      countries: {
        Row: {
          created_at: string
          currency: string | null
          id: string
          iso_code: string
          name: string
          phone_prefix: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string | null
          id?: string
          iso_code: string
          name: string
          phone_prefix?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string | null
          id?: string
          iso_code?: string
          name?: string
          phone_prefix?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      deal_services: {
        Row: {
          created_at: string
          deal_id: string
          description: string | null
          details: Json | null
          end_date: string | null
          id: string
          price: number | null
          service_name: string
          service_type: Database["public"]["Enums"]["service_type"]
          start_date: string | null
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          description?: string | null
          details?: Json | null
          end_date?: string | null
          id?: string
          price?: number | null
          service_name: string
          service_type: Database["public"]["Enums"]["service_type"]
          start_date?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          description?: string | null
          details?: Json | null
          end_date?: string | null
          id?: string
          price?: number | null
          service_name?: string
          service_type?: Database["public"]["Enums"]["service_type"]
          start_date?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_services_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_services_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_travelers: {
        Row: {
          client_id: string
          created_at: string
          deal_id: string
          id: string
          is_lead_traveler: boolean
        }
        Insert: {
          client_id: string
          created_at?: string
          deal_id: string
          id?: string
          is_lead_traveler?: boolean
        }
        Update: {
          client_id?: string
          created_at?: string
          deal_id?: string
          id?: string
          is_lead_traveler?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "deal_travelers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_travelers_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          created_at: string
          deal_number: string
          deposit_amount: number | null
          deposit_paid: boolean | null
          destination_id: string | null
          end_date: string | null
          id: string
          notes: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["deal_status"]
          total_price: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deal_number: string
          deposit_amount?: number | null
          deposit_paid?: boolean | null
          destination_id?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["deal_status"]
          total_price?: number | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          deal_number?: string
          deposit_amount?: number | null
          deposit_paid?: boolean | null
          destination_id?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["deal_status"]
          total_price?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
        ]
      }
      destinations: {
        Row: {
          country_id: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          country_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          country_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "destinations_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      golf_club_templates: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_templates: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      travel_contracts: {
        Row: {
          client_id: string
          contract_date: string
          contract_number: string
          created_at: string
          deal_id: string | null
          deposit_amount: number | null
          id: string
          payment_schedule: Json | null
          sent_at: string | null
          signed_at: string | null
          status: Database["public"]["Enums"]["contract_status"]
          terms: string | null
          total_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          contract_date?: string
          contract_number: string
          created_at?: string
          deal_id?: string | null
          deposit_amount?: number | null
          id?: string
          payment_schedule?: Json | null
          sent_at?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          terms?: string | null
          total_price: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          client_id?: string
          contract_date?: string
          contract_number?: string
          created_at?: string
          deal_id?: string | null
          deposit_amount?: number | null
          id?: string
          payment_schedule?: Json | null
          sent_at?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          terms?: string | null
          total_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_contracts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      voucher_counters: {
        Row: {
          last_number: number
          year: number
        }
        Insert: {
          last_number?: number
          year: number
        }
        Update: {
          last_number?: number
          year?: number
        }
        Relationships: []
      }
      voucher_travelers: {
        Row: {
          client_id: string
          created_at: string
          id: string
          is_main_client: boolean
          voucher_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          is_main_client?: boolean
          voucher_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          is_main_client?: boolean
          voucher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voucher_travelers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voucher_travelers_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
        ]
      }
      vouchers: {
        Row: {
          client_id: string | null
          client_name: string
          created_at: string
          deal_id: string | null
          expiration_date: string | null
          flights: Json | null
          hotel_name: string | null
          id: string
          issue_date: string
          other_travelers: string[] | null
          services: Json
          supplier_id: string | null
          tee_times: Json | null
          updated_at: string
          user_id: string
          voucher_code: string
          voucher_number: number
        }
        Insert: {
          client_id?: string | null
          client_name: string
          created_at?: string
          deal_id?: string | null
          expiration_date?: string | null
          flights?: Json | null
          hotel_name?: string | null
          id?: string
          issue_date?: string
          other_travelers?: string[] | null
          services: Json
          supplier_id?: string | null
          tee_times?: Json | null
          updated_at?: string
          user_id?: string
          voucher_code: string
          voucher_number: number
        }
        Update: {
          client_id?: string | null
          client_name?: string
          created_at?: string
          deal_id?: string | null
          expiration_date?: string | null
          flights?: Json | null
          hotel_name?: string | null
          id?: string
          issue_date?: string
          other_travelers?: string[] | null
          services?: Json
          supplier_id?: string | null
          tee_times?: Json | null
          updated_at?: string
          user_id?: string
          voucher_code?: string
          voucher_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "vouchers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vouchers_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vouchers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_contract_number: { Args: never; Returns: string }
      generate_deal_number: { Args: never; Returns: string }
      generate_voucher_code_for_year: {
        Args: { p_issue_date: string }
        Returns: string
      }
      is_voucher_owner: { Args: { voucher_id: string }; Returns: boolean }
    }
    Enums: {
      contract_status: "draft" | "sent" | "signed" | "cancelled"
      deal_status: "inquiry" | "quote" | "confirmed" | "completed" | "cancelled"
      service_type:
        | "flight"
        | "hotel"
        | "golf"
        | "transfer"
        | "insurance"
        | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      contract_status: ["draft", "sent", "signed", "cancelled"],
      deal_status: ["inquiry", "quote", "confirmed", "completed", "cancelled"],
      service_type: [
        "flight",
        "hotel",
        "golf",
        "transfer",
        "insurance",
        "other",
      ],
    },
  },
} as const
