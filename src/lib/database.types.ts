export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      orders: {
        Row: {
          assigned_upi_id: string | null
          completed_at: string | null
          created_at: string
          gateway_order_no: string | null
          id: string
          inr_amount: number
          merchant_order_no: string | null
          network: Database["public"]["Enums"]["network_type_enum"]
          order_type: Database["public"]["Enums"]["order_type_enum"]
          payment_gateway_ref: string | null
          payment_url: string | null
          rate_applied: number
          status: Database["public"]["Enums"]["order_status_enum"]
          updated_at: string
          usdt_amount: number
          user_id: string
          user_payout_details: string | null
          wallet_address: string | null
        }
        Insert: {
          assigned_upi_id?: string | null
          completed_at?: string | null
          created_at?: string
          gateway_order_no?: string | null
          id?: string
          inr_amount: number
          merchant_order_no?: string | null
          network?: Database["public"]["Enums"]["network_type_enum"]
          order_type?: Database["public"]["Enums"]["order_type_enum"]
          payment_gateway_ref?: string | null
          payment_url?: string | null
          rate_applied: number
          status?: Database["public"]["Enums"]["order_status_enum"]
          updated_at?: string
          usdt_amount: number
          user_id: string
          user_payout_details?: string | null
          wallet_address?: string | null
        }
        Update: {
          assigned_upi_id?: string | null
          completed_at?: string | null
          created_at?: string
          gateway_order_no?: string | null
          id?: string
          inr_amount?: number
          merchant_order_no?: string | null
          network?: Database["public"]["Enums"]["network_type_enum"]
          order_type?: Database["public"]["Enums"]["order_type_enum"]
          payment_gateway_ref?: string | null
          payment_url?: string | null
          rate_applied?: number
          status?: Database["public"]["Enums"]["order_status_enum"]
          updated_at?: string
          usdt_amount?: number
          user_id?: string
          user_payout_details?: string | null
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ip_registrations: {
        Row: {
          id: string
          ip: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          ip: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          ip?: string
          user_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ip_registrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          role: Database["public"]["Enums"]["user_role_enum"]
          username: string
          phone: string | null
          discord_id: string | null
          created_ip: string | null
          is_banned: boolean
          is_admin?: boolean | null
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          role?: Database["public"]["Enums"]["user_role_enum"]
          username: string
          phone?: string | null
          discord_id?: string | null
          created_ip?: string | null
          is_banned?: boolean
          is_admin?: boolean | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role_enum"]
          username?: string
          phone?: string | null
          discord_id?: string | null
          created_ip?: string | null
          is_banned?: boolean
          is_admin?: boolean | null
        }
        Relationships: []
      }
      rates: {
        Row: {
          id: string
          updated_at: string
          updated_by: string | null
          usdt_buy_inr: number
          usdt_sell_inr: number
        }
        Insert: {
          id?: string
          updated_at?: string
          updated_by?: string | null
          usdt_buy_inr: number
          usdt_sell_inr: number
        }
        Update: {
          id?: string
          updated_at?: string
          updated_by?: string | null
          usdt_buy_inr?: number
          usdt_sell_inr?: number
        }
        Relationships: [
          {
            foreignKeyName: "rates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_configs: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      network_type_enum: "TRC20" | "BEP20"
      order_status_enum: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "AWAITING_VERIFICATION"
      order_type_enum: "BUY" | "SELL"
      user_role_enum: "USER" | "ADMIN"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]

export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T]
