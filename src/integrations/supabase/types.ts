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
      bank_notifications: {
        Row: {
          confirmed_at: string | null
          created_at: string
          id: string
          matched_contract_id: string | null
          matched_payment_id: string | null
          notes: string | null
          parsed_amount: number | null
          parsed_date: string | null
          parsed_vs: string | null
          raw_text: string
          status: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          id?: string
          matched_contract_id?: string | null
          matched_payment_id?: string | null
          notes?: string | null
          parsed_amount?: number | null
          parsed_date?: string | null
          parsed_vs?: string | null
          raw_text: string
          status?: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          id?: string
          matched_contract_id?: string | null
          matched_payment_id?: string | null
          notes?: string | null
          parsed_amount?: number | null
          parsed_date?: string | null
          parsed_vs?: string | null
          raw_text?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_notifications_matched_contract_id_fkey"
            columns: ["matched_contract_id"]
            isOneToOne: false
            referencedRelation: "travel_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_notifications_matched_payment_id_fkey"
            columns: ["matched_payment_id"]
            isOneToOne: false
            referencedRelation: "contract_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          company_name: string | null
          created_at: string
          date_of_birth: string | null
          dic: string | null
          document_urls: Json | null
          email: string | null
          first_name: string
          ico: string | null
          id: string
          id_card_expiry: string | null
          id_card_number: string | null
          last_name: string
          notes: string | null
          passport_expiry: string | null
          passport_number: string | null
          phone: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          company_name?: string | null
          created_at?: string
          date_of_birth?: string | null
          dic?: string | null
          document_urls?: Json | null
          email?: string | null
          first_name: string
          ico?: string | null
          id?: string
          id_card_expiry?: string | null
          id_card_number?: string | null
          last_name: string
          notes?: string | null
          passport_expiry?: string | null
          passport_number?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          address?: string | null
          company_name?: string | null
          created_at?: string
          date_of_birth?: string | null
          dic?: string | null
          document_urls?: Json | null
          email?: string | null
          first_name?: string
          ico?: string | null
          id?: string
          id_card_expiry?: string | null
          id_card_number?: string | null
          last_name?: string
          notes?: string | null
          passport_expiry?: string | null
          passport_number?: string | null
          phone?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contract_payments: {
        Row: {
          amount: number
          contract_id: string
          created_at: string | null
          due_date: string
          id: string
          notes: string | null
          paid: boolean | null
          paid_at: string | null
          payment_type: string
        }
        Insert: {
          amount: number
          contract_id: string
          created_at?: string | null
          due_date: string
          id?: string
          notes?: string | null
          paid?: boolean | null
          paid_at?: string | null
          payment_type: string
        }
        Update: {
          amount?: number
          contract_id?: string
          created_at?: string | null
          due_date?: string
          id?: string
          notes?: string | null
          paid?: boolean | null
          paid_at?: string | null
          payment_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "travel_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_service_travelers: {
        Row: {
          client_id: string
          contract_id: string
          created_at: string | null
          id: string
          notes: string | null
          service_name: string
          service_type: string
        }
        Insert: {
          client_id: string
          contract_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          service_name: string
          service_type: string
        }
        Update: {
          client_id?: string
          contract_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          service_name?: string
          service_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_service_travelers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_service_travelers_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "travel_contracts"
            referencedColumns: ["id"]
          },
        ]
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
      deal_documents: {
        Row: {
          deal_id: string
          description: string | null
          file_name: string
          file_type: string | null
          file_url: string
          id: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          deal_id: string
          description?: string | null
          file_name: string
          file_type?: string | null
          file_url: string
          id?: string
          uploaded_at?: string
          user_id?: string
        }
        Update: {
          deal_id?: string
          description?: string | null
          file_name?: string
          file_type?: string | null
          file_url?: string
          id?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_documents_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_profitability"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "deal_documents_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_payments: {
        Row: {
          amount: number
          created_at: string | null
          deal_id: string
          due_date: string
          id: string
          notes: string | null
          paid: boolean | null
          paid_at: string | null
          payment_type: string
        }
        Insert: {
          amount?: number
          created_at?: string | null
          deal_id: string
          due_date: string
          id?: string
          notes?: string | null
          paid?: boolean | null
          paid_at?: string | null
          payment_type?: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          deal_id?: string
          due_date?: string
          id?: string
          notes?: string | null
          paid?: boolean | null
          paid_at?: string | null
          payment_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_payments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_profitability"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "deal_payments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_services: {
        Row: {
          cost_currency: string | null
          cost_price: number | null
          cost_price_original: number | null
          created_at: string
          deal_id: string
          description: string | null
          details: Json | null
          end_date: string | null
          id: string
          order_index: number | null
          person_count: number | null
          price: number | null
          price_currency: string | null
          quantity: number
          service_name: string
          service_type: Database["public"]["Enums"]["service_type"]
          start_date: string | null
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          cost_currency?: string | null
          cost_price?: number | null
          cost_price_original?: number | null
          created_at?: string
          deal_id: string
          description?: string | null
          details?: Json | null
          end_date?: string | null
          id?: string
          order_index?: number | null
          person_count?: number | null
          price?: number | null
          price_currency?: string | null
          quantity?: number
          service_name: string
          service_type: Database["public"]["Enums"]["service_type"]
          start_date?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          cost_currency?: string | null
          cost_price?: number | null
          cost_price_original?: number | null
          created_at?: string
          deal_id?: string
          description?: string | null
          details?: Json | null
          end_date?: string | null
          id?: string
          order_index?: number | null
          person_count?: number | null
          price?: number | null
          price_currency?: string | null
          quantity?: number
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
            referencedRelation: "deal_profitability"
            referencedColumns: ["deal_id"]
          },
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
            referencedRelation: "deal_profitability"
            referencedColumns: ["deal_id"]
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
      deal_variant_services: {
        Row: {
          cost_currency: string | null
          cost_price: number | null
          cost_price_original: number | null
          created_at: string
          description: string | null
          details: Json | null
          end_date: string | null
          id: string
          order_index: number | null
          person_count: number | null
          price: number | null
          price_currency: string | null
          quantity: number
          service_name: string
          service_type: Database["public"]["Enums"]["service_type"]
          start_date: string | null
          supplier_id: string | null
          updated_at: string
          variant_id: string
        }
        Insert: {
          cost_currency?: string | null
          cost_price?: number | null
          cost_price_original?: number | null
          created_at?: string
          description?: string | null
          details?: Json | null
          end_date?: string | null
          id?: string
          order_index?: number | null
          person_count?: number | null
          price?: number | null
          price_currency?: string | null
          quantity?: number
          service_name: string
          service_type: Database["public"]["Enums"]["service_type"]
          start_date?: string | null
          supplier_id?: string | null
          updated_at?: string
          variant_id: string
        }
        Update: {
          cost_currency?: string | null
          cost_price?: number | null
          cost_price_original?: number | null
          created_at?: string
          description?: string | null
          details?: Json | null
          end_date?: string | null
          id?: string
          order_index?: number | null
          person_count?: number | null
          price?: number | null
          price_currency?: string | null
          quantity?: number
          service_name?: string
          service_type?: Database["public"]["Enums"]["service_type"]
          start_date?: string | null
          supplier_id?: string | null
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_variant_services_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_variant_services_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "deal_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_variants: {
        Row: {
          created_at: string
          deal_id: string
          destination_id: string | null
          end_date: string | null
          id: string
          is_selected: boolean
          notes: string | null
          start_date: string | null
          total_price: number | null
          updated_at: string
          user_id: string
          variant_name: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          destination_id?: string | null
          end_date?: string | null
          id?: string
          is_selected?: boolean
          notes?: string | null
          start_date?: string | null
          total_price?: number | null
          updated_at?: string
          user_id?: string
          variant_name: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          destination_id?: string | null
          end_date?: string | null
          id?: string
          is_selected?: boolean
          notes?: string | null
          start_date?: string | null
          total_price?: number | null
          updated_at?: string
          user_id?: string
          variant_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_variants_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_profitability"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "deal_variants_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_variants_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          adjustment_amount: number | null
          adjustment_note: string | null
          auto_send_documents: boolean
          created_at: string
          currency: string | null
          deal_number: string
          deposit_amount: number | null
          deposit_paid: boolean | null
          destination_id: string | null
          discount_amount: number | null
          discount_note: string | null
          documents_auto_sent_at: string | null
          end_date: string | null
          id: string
          name: string | null
          notes: string | null
          share_token: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["deal_status"]
          tee_times: Json | null
          total_price: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          adjustment_amount?: number | null
          adjustment_note?: string | null
          auto_send_documents?: boolean
          created_at?: string
          currency?: string | null
          deal_number: string
          deposit_amount?: number | null
          deposit_paid?: boolean | null
          destination_id?: string | null
          discount_amount?: number | null
          discount_note?: string | null
          documents_auto_sent_at?: string | null
          end_date?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          share_token?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["deal_status"]
          tee_times?: Json | null
          total_price?: number | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          adjustment_amount?: number | null
          adjustment_note?: string | null
          auto_send_documents?: boolean
          created_at?: string
          currency?: string | null
          deal_number?: string
          deposit_amount?: number | null
          deposit_paid?: boolean | null
          destination_id?: string | null
          discount_amount?: number | null
          discount_note?: string | null
          documents_auto_sent_at?: string | null
          end_date?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          share_token?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["deal_status"]
          tee_times?: Json | null
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
      email_log: {
        Row: {
          contract_id: string | null
          deal_id: string | null
          id: string
          recipient_email: string
          sent_at: string
          status: string
          template_id: string | null
          voucher_id: string | null
        }
        Insert: {
          contract_id?: string | null
          deal_id?: string | null
          id?: string
          recipient_email: string
          sent_at?: string
          status?: string
          template_id?: string | null
          voucher_id?: string | null
        }
        Update: {
          contract_id?: string | null
          deal_id?: string | null
          id?: string
          recipient_email?: string
          sent_at?: string
          status?: string
          template_id?: string | null
          voucher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_log_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "travel_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_log_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_profitability"
            referencedColumns: ["deal_id"]
          },
          {
            foreignKeyName: "email_log_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_log_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_log_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          subject: string
          template_key: string
          trigger_offset_days: number | null
          trigger_type: string | null
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          subject?: string
          template_key: string
          trigger_offset_days?: number | null
          trigger_type?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          subject?: string
          template_key?: string
          trigger_offset_days?: number | null
          trigger_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      global_pdf_settings: {
        Row: {
          content_padding: number
          email_cc_supplier: boolean | null
          email_send_pdf: boolean | null
          email_subject_template: string | null
          font_size: number
          heading_size: number
          id: string
          line_height: number
          logo_size: number
          section_spacing: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          content_padding?: number
          email_cc_supplier?: boolean | null
          email_send_pdf?: boolean | null
          email_subject_template?: string | null
          font_size?: number
          heading_size?: number
          id?: string
          line_height?: number
          logo_size?: number
          section_spacing?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          content_padding?: number
          email_cc_supplier?: boolean | null
          email_send_pdf?: boolean | null
          email_subject_template?: string | null
          font_size?: number
          heading_size?: number
          id?: string
          line_height?: number
          logo_size?: number
          section_spacing?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
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
      hotel_templates: {
        Row: {
          benefits: Json | null
          created_at: string
          description: string | null
          destination_id: string | null
          golf_courses: string | null
          green_fees: string | null
          id: string
          image_url: string | null
          image_url_10: string | null
          image_url_2: string | null
          image_url_3: string | null
          image_url_4: string | null
          image_url_5: string | null
          image_url_6: string | null
          image_url_7: string | null
          image_url_8: string | null
          image_url_9: string | null
          is_published: boolean | null
          name: string
          nights: string | null
          price_label: string | null
          room_types: Json | null
          slug: string | null
          subtitle: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          benefits?: Json | null
          created_at?: string
          description?: string | null
          destination_id?: string | null
          golf_courses?: string | null
          green_fees?: string | null
          id?: string
          image_url?: string | null
          image_url_10?: string | null
          image_url_2?: string | null
          image_url_3?: string | null
          image_url_4?: string | null
          image_url_5?: string | null
          image_url_6?: string | null
          image_url_7?: string | null
          image_url_8?: string | null
          image_url_9?: string | null
          is_published?: boolean | null
          name: string
          nights?: string | null
          price_label?: string | null
          room_types?: Json | null
          slug?: string | null
          subtitle?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          benefits?: Json | null
          created_at?: string
          description?: string | null
          destination_id?: string | null
          golf_courses?: string | null
          green_fees?: string | null
          id?: string
          image_url?: string | null
          image_url_10?: string | null
          image_url_2?: string | null
          image_url_3?: string | null
          image_url_4?: string | null
          image_url_5?: string | null
          image_url_6?: string | null
          image_url_7?: string | null
          image_url_8?: string | null
          image_url_9?: string | null
          is_published?: boolean | null
          name?: string
          nights?: string | null
          price_label?: string | null
          room_types?: Json | null
          slug?: string | null
          subtitle?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hotel_templates_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      service_templates: {
        Row: {
          created_at: string
          english_name: string | null
          id: string
          name: string
          service_type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          english_name?: string | null
          id?: string
          name: string
          service_type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          english_name?: string | null
          id?: string
          name?: string
          service_type?: string | null
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
      tasks: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string
          id: string
          priority: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date: string
          id?: string
          priority?: string
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          priority?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      travel_contracts: {
        Row: {
          agency_address: string | null
          agency_bank_account: string | null
          agency_contact: string | null
          agency_ico: string | null
          agency_name: string | null
          client_id: string
          contract_date: string
          contract_number: string
          created_at: string
          currency: string | null
          deal_id: string | null
          deposit_amount: number | null
          id: string
          payment_schedule: Json | null
          sent_at: string | null
          sign_token: string | null
          signature_url: string | null
          signed_at: string | null
          signed_ip: string | null
          signed_user_agent: string | null
          status: Database["public"]["Enums"]["contract_status"]
          tee_times: Json | null
          terms: string | null
          total_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          agency_address?: string | null
          agency_bank_account?: string | null
          agency_contact?: string | null
          agency_ico?: string | null
          agency_name?: string | null
          client_id: string
          contract_date?: string
          contract_number: string
          created_at?: string
          currency?: string | null
          deal_id?: string | null
          deposit_amount?: number | null
          id?: string
          payment_schedule?: Json | null
          sent_at?: string | null
          sign_token?: string | null
          signature_url?: string | null
          signed_at?: string | null
          signed_ip?: string | null
          signed_user_agent?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          tee_times?: Json | null
          terms?: string | null
          total_price: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          agency_address?: string | null
          agency_bank_account?: string | null
          agency_contact?: string | null
          agency_ico?: string | null
          agency_name?: string | null
          client_id?: string
          contract_date?: string
          contract_number?: string
          created_at?: string
          currency?: string | null
          deal_id?: string | null
          deposit_amount?: number | null
          id?: string
          payment_schedule?: Json | null
          sent_at?: string | null
          sign_token?: string | null
          signature_url?: string | null
          signed_at?: string | null
          signed_ip?: string | null
          signed_user_agent?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          tee_times?: Json | null
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
            referencedRelation: "deal_profitability"
            referencedColumns: ["deal_id"]
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
      user_analytics_presets: {
        Row: {
          created_at: string | null
          filters: Json
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          filters: Json
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          filters?: Json
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_analytics_presets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          contract_id: string | null
          created_at: string
          deal_id: string | null
          expiration_date: string | null
          flights: Json | null
          hotel_name: string | null
          id: string
          issue_date: string
          other_travelers: string[] | null
          sent_at: string | null
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
          contract_id?: string | null
          created_at?: string
          deal_id?: string | null
          expiration_date?: string | null
          flights?: Json | null
          hotel_name?: string | null
          id?: string
          issue_date?: string
          other_travelers?: string[] | null
          sent_at?: string | null
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
          contract_id?: string | null
          created_at?: string
          deal_id?: string | null
          expiration_date?: string | null
          flights?: Json | null
          hotel_name?: string | null
          id?: string
          issue_date?: string
          other_travelers?: string[] | null
          sent_at?: string | null
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
            foreignKeyName: "vouchers_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "travel_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vouchers_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deal_profitability"
            referencedColumns: ["deal_id"]
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
      deal_profitability: {
        Row: {
          created_at: string | null
          deal_id: string | null
          deal_number: string | null
          lead_client_id: string | null
          profit: number | null
          profit_margin_percent: number | null
          revenue: number | null
          start_date: string | null
          status: Database["public"]["Enums"]["deal_status"] | null
          total_costs: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_travelers_client_id_fkey"
            columns: ["lead_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      generate_contract_number: { Args: never; Returns: string }
      generate_deal_number: { Args: never; Returns: string }
      generate_voucher_code_for_year: {
        Args: { p_issue_date: string }
        Returns: string
      }
      is_task_admin: { Args: { _user_id: string }; Returns: boolean }
      is_voucher_owner: { Args: { voucher_id: string }; Returns: boolean }
      select_deal_variant: { Args: { p_variant_id: string }; Returns: boolean }
      update_deal_display_number: {
        Args: { p_deal_id: string }
        Returns: string
      }
    }
    Enums: {
      contract_status: "draft" | "sent" | "signed" | "cancelled"
      deal_status:
        | "inquiry"
        | "quote"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "dispatched"
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
      deal_status: [
        "inquiry",
        "quote",
        "confirmed",
        "completed",
        "cancelled",
        "dispatched",
      ],
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
