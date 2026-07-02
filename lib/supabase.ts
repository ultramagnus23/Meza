import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Per-request server client: forwards the caller's access token so
// auth.getUser()/auth.uid() and RLS resolve correctly. Never share a
// single client instance across requests on the server - session state
// must not leak between concurrent users.
export function getServerSupabase(req: Request) {
  const authHeader = req.headers.get('authorization') ?? undefined
  return createClient(supabaseUrl as string, supabaseAnonKey as string, {
    global: authHeader ? { headers: { Authorization: authHeader } } : {},
    auth: { persistSession: false },
  })
}

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
      restaurants: {
        Row: {
          id: string
          owner_id: string
          name: string
          location: string
          timezone: string
          max_capacity: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          location: string
          timezone?: string
          max_capacity?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          location?: string
          timezone?: string
          max_capacity?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      occupancy_snapshots: {
        Row: {
          id: string
          restaurant_id: string
          timestamp: string
          occupancy_percentage: number | null
          occupied_tables: number | null
          available_tables: number | null
          people_count: number | null
          queue_length: number | null
          wait_time: number | null
          total_tables: number | null
        }
        Insert: {
          id?: string
          restaurant_id: string
          timestamp?: string
          occupancy_percentage?: number | null
          occupied_tables?: number | null
          available_tables?: number | null
          people_count?: number | null
          queue_length?: number | null
          wait_time?: number | null
          total_tables?: number | null
        }
        Update: {
          id?: string
          restaurant_id?: string
          timestamp?: string
          occupancy_percentage?: number | null
          occupied_tables?: number | null
          available_tables?: number | null
          people_count?: number | null
          queue_length?: number | null
          wait_time?: number | null
          total_tables?: number | null
        }
      }
      table_sessions: {
        Row: {
          id: string
          restaurant_id: string
          table_number: number
          party_size: number | null
          start_time: string
          end_time: string | null
          dwell_time: number | null
          order_value: number | null
          item_count: number | null
          dessert_count: number
          drink_count: number
        }
        Insert: {
          id?: string
          restaurant_id: string
          table_number: number
          party_size?: number | null
          start_time: string
          end_time?: string | null
          dwell_time?: number | null
          order_value?: number | null
          item_count?: number | null
          dessert_count?: number
          drink_count?: number
        }
        Update: {
          id?: string
          restaurant_id?: string
          table_number?: number
          party_size?: number | null
          start_time?: string
          end_time?: string | null
          dwell_time?: number | null
          order_value?: number | null
          item_count?: number | null
          dessert_count?: number
          drink_count?: number
        }
      }
      environment_snapshots: {
        Row: {
          id: string
          restaurant_id: string
          timestamp: string
          temperature: number | null
          humidity: number | null
          weather: string | null
          rainfall: boolean
          music_genre: string | null
          music_volume: number | null
          lighting_brightness: number | null
          lighting_temperature: number | null
          promotion_active: boolean
          special_event: string | null
          staff_count: number | null
        }
        Insert: {
          id?: string
          restaurant_id: string
          timestamp?: string
          temperature?: number | null
          humidity?: number | null
          weather?: string | null
          rainfall?: boolean
          music_genre?: string | null
          music_volume?: number | null
          lighting_brightness?: number | null
          lighting_temperature?: number | null
          promotion_active?: boolean
          special_event?: string | null
          staff_count?: number | null
        }
        Update: {
          id?: string
          restaurant_id?: string
          timestamp?: string
          temperature?: number | null
          humidity?: number | null
          weather?: string | null
          rainfall?: boolean
          music_genre?: string | null
          music_volume?: number | null
          lighting_brightness?: number | null
          lighting_temperature?: number | null
          promotion_active?: boolean
          special_event?: string | null
          staff_count?: number | null
        }
      }
      operational_snapshots: {
        Row: {
          id: string
          restaurant_id: string
          timestamp: string
          staff_count: number | null
          kitchen_load: number | null
          service_time: number | null
          order_prep_time: number | null
        }
        Insert: {
          id?: string
          restaurant_id: string
          timestamp?: string
          staff_count?: number | null
          kitchen_load?: number | null
          service_time?: number | null
          order_prep_time?: number | null
        }
        Update: {
          id?: string
          restaurant_id?: string
          timestamp?: string
          staff_count?: number | null
          kitchen_load?: number | null
          service_time?: number | null
          order_prep_time?: number | null
        }
      }
      experiments: {
        Row: {
          id: string
          restaurant_id: string
          experiment_name: string
          hypothesis: string
          variable_changed: string
          control_condition: string | null
          test_condition: string | null
          start_time: string
          end_time: string | null
          status: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          experiment_name: string
          hypothesis: string
          variable_changed: string
          control_condition?: string | null
          test_condition?: string | null
          start_time: string
          end_time?: string | null
          status?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          experiment_name?: string
          hypothesis?: string
          variable_changed?: string
          control_condition?: string | null
          test_condition?: string | null
          start_time?: string
          end_time?: string | null
          status?: string
        }
      }
      experiment_results: {
        Row: {
          id: string
          experiment_id: string
          revenue_delta: number | null
          average_order_value_delta: number | null
          dwell_time_delta: number | null
          dessert_delta: number | null
          drink_delta: number | null
          confidence_score: number | null
          measured_at: string
        }
        Insert: {
          id?: string
          experiment_id: string
          revenue_delta?: number | null
          average_order_value_delta?: number | null
          dwell_time_delta?: number | null
          dessert_delta?: number | null
          drink_delta?: number | null
          confidence_score?: number | null
          measured_at?: string
        }
        Update: {
          id?: string
          experiment_id?: string
          revenue_delta?: number | null
          average_order_value_delta?: number | null
          dwell_time_delta?: number | null
          dessert_delta?: number | null
          drink_delta?: number | null
          confidence_score?: number | null
          measured_at?: string
        }
      }
      recommendations: {
        Row: {
          id: string
          restaurant_id: string
          timestamp: string
          recommendation: string
          confidence: number | null
          expected_revenue_impact: number | null
          implemented: boolean
          implemented_at: string | null
        }
        Insert: {
          id?: string
          restaurant_id: string
          timestamp?: string
          recommendation: string
          confidence?: number | null
          expected_revenue_impact?: number | null
          implemented?: boolean
          implemented_at?: string | null
        }
        Update: {
          id?: string
          restaurant_id?: string
          timestamp?: string
          recommendation?: string
          confidence?: number | null
          expected_revenue_impact?: number | null
          implemented?: boolean
          implemented_at?: string | null
        }
      }
      pos_orders: {
        Row: {
          id: string
          restaurant_id: string
          external_id: string | null
          timestamp: string
          order_type: string
          channel: string
          subtotal: number
          tax: number
          discount: number
          total_amount: number
          payment_method: string | null
          guest_count: number | null
          table_number: number | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          external_id?: string | null
          timestamp?: string
          order_type?: string
          channel?: string
          subtotal?: number
          tax?: number
          discount?: number
          total_amount: number
          payment_method?: string | null
          guest_count?: number | null
          table_number?: number | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          external_id?: string | null
          timestamp?: string
          order_type?: string
          channel?: string
          subtotal?: number
          tax?: number
          discount?: number
          total_amount?: number
          payment_method?: string | null
          guest_count?: number | null
          table_number?: number | null
          status?: string
          created_at?: string
        }
      }
      pos_order_items: {
        Row: {
          id: string
          order_id: string
          item_name: string
          category: string | null
          quantity: number
          price: number
          total: number
          is_dessert: boolean
          is_drink: boolean
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          item_name: string
          category?: string | null
          quantity: number
          price: number
          total: number
          is_dessert?: boolean
          is_drink?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          item_name?: string
          category?: string | null
          quantity?: number
          price?: number
          total?: number
          is_dessert?: boolean
          is_drink?: boolean
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_restaurant_ids_for_user: {
        Args: Record<string, never>
        Returns: string[]
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
