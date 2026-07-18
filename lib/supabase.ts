import { createClient } from '@supabase/supabase-js'

// Real values must be set in the deployment platform (Vercel/Render env
// vars) or .env.local. The fallbacks below only exist so `next build` can
// evaluate route modules without real credentials (e.g. CI, preview
// builds); isSupabaseConfigured gates runtime behavior.
const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
// Supabase is transitioning from "anon" keys to "publishable" keys
// (sb_publishable_...). Both work identically with supabase-js; accept
// either env var name so dashboard copy-paste of the new naming works.
const envAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

export const isSupabaseConfigured =
  !!envUrl && /^https?:\/\//.test(envUrl) && !!envAnonKey

const supabaseUrl = isSupabaseConfigured ? (envUrl as string) : 'https://placeholder.supabase.co'
const supabaseAnonKey = isSupabaseConfigured ? (envAnonKey as string) : 'placeholder-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Per-request server client: forwards the caller's access token so
// auth.getUser()/auth.uid() and RLS resolve correctly. Never share a
// single client instance across requests on the server - session state
// must not leak between concurrent users.
export function getServerSupabase(req: Request) {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
    )
  }
  const authHeader = req.headers.get('authorization') ?? undefined
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: authHeader ? { headers: { Authorization: authHeader } } : {},
    auth: { persistSession: false },
  })
}

// Privileged server-only client for trusted backend jobs that have no
// restaurant-owner session to forward. Bypasses RLS by design - never
// expose SUPABASE_SERVICE_ROLE_KEY to the browser, and never call this
// from a route that handles a caller-supplied restaurant_id without
// itself checking authorization first.
export function getServiceSupabase() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!isSupabaseConfigured || !serviceKey) {
    throw new Error(
      'Service Supabase client is not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
    )
  }
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Database types for the diagnostic-tool schema (supabase/migrations/001_initial_schema.sql).
// The old platform's types (occupancy/experiments/environment/etc.) are
// preserved in full on the archive/legacy branch, not carried forward here.
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
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          location: string
          timezone?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          location?: string
          timezone?: string
          created_at?: string
          updated_at?: string
        }
      }
      venue_column_maps: {
        Row: {
          id: string
          restaurant_id: string
          // canonical field name -> source CSV column name
          mapping: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          mapping: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          mapping?: Json
          created_at?: string
          updated_at?: string
        }
      }
      ingestion_batches: {
        Row: {
          id: string
          restaurant_id: string
          filename: string | null
          uploaded_at: string
          rows_in: number
          rows_parsed: number
          rows_rejected: number
          // array of {row_number, reason} - never just a count
          rejection_reasons: Json
        }
        Insert: {
          id?: string
          restaurant_id: string
          filename?: string | null
          uploaded_at?: string
          rows_in?: number
          rows_parsed?: number
          rows_rejected?: number
          rejection_reasons?: Json
        }
        Update: {
          id?: string
          restaurant_id?: string
          filename?: string | null
          uploaded_at?: string
          rows_in?: number
          rows_parsed?: number
          rows_rejected?: number
          rejection_reasons?: Json
        }
      }
      bills: {
        Row: {
          id: string
          restaurant_id: string
          // Unique per (restaurant_id, external_bill_id) - the idempotency
          // key re-ingest upserts against. Never globally unique.
          external_bill_id: string
          opened_at: string
          settled_at: string | null
          table_ref: string | null
          gross: number
          discount: number
          payment_type: 'upi' | 'card' | 'cash' | 'other' | null
          created_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          external_bill_id: string
          opened_at: string
          settled_at?: string | null
          table_ref?: string | null
          gross: number
          discount?: number
          payment_type?: 'upi' | 'card' | 'cash' | 'other' | null
          created_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          external_bill_id?: string
          opened_at?: string
          settled_at?: string | null
          table_ref?: string | null
          gross?: number
          discount?: number
          payment_type?: 'upi' | 'card' | 'cash' | 'other' | null
          created_at?: string
        }
      }
      bill_items: {
        Row: {
          id: string
          bill_id: string
          item_name_raw: string
          item_name_norm: string | null
          category: string | null
          qty: number
          price: number
          created_at: string
        }
        Insert: {
          id?: string
          bill_id: string
          item_name_raw: string
          item_name_norm?: string | null
          category?: string | null
          qty?: number
          price: number
          created_at?: string
        }
        Update: {
          id?: string
          bill_id?: string
          item_name_raw?: string
          item_name_norm?: string | null
          category?: string | null
          qty?: number
          price?: number
          created_at?: string
        }
      }
      dish_costs: {
        Row: {
          id: string
          restaurant_id: string
          item: string
          cost: number
          price: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          item: string
          cost: number
          price: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          item?: string
          cost?: number
          price?: number
          created_at?: string
          updated_at?: string
        }
      }
      data_quality_profiles: {
        Row: {
          id: string
          restaurant_id: string
          computed_at: string
          timestamps_live: boolean | null
          timestamps_evidence: Json | null
          table_ref_coverage_pct: number | null
          item_name_consistency_pct: number | null
          history_depth_days: number | null
          weekly_volume: number | null
          // {"attach_rate": {"allowed": bool, "reason": string|null}, ...} -
          // the plain-language, owner-readable suppression reasons printed
          // verbatim on the one-pager.
          capability_mask: Json
        }
        Insert: {
          id?: string
          restaurant_id: string
          computed_at?: string
          timestamps_live?: boolean | null
          timestamps_evidence?: Json | null
          table_ref_coverage_pct?: number | null
          item_name_consistency_pct?: number | null
          history_depth_days?: number | null
          weekly_volume?: number | null
          capability_mask?: Json
        }
        Update: {
          id?: string
          restaurant_id?: string
          computed_at?: string
          timestamps_live?: boolean | null
          timestamps_evidence?: Json | null
          table_ref_coverage_pct?: number | null
          item_name_consistency_pct?: number | null
          history_depth_days?: number | null
          weekly_volume?: number | null
          capability_mask?: Json
        }
      }
      leak_findings: {
        Row: {
          id: string
          restaurant_id: string
          rule: string
          scope: string | null
          size_inr_month: number | null
          confidence: number | null
          // the inline evidence + arithmetic a reader can audit
          evidence: Json
          status: 'candidate' | 'insufficient_data' | 'suppressed'
          computed_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          rule: string
          scope?: string | null
          size_inr_month?: number | null
          confidence?: number | null
          evidence?: Json
          status?: 'candidate' | 'insufficient_data' | 'suppressed'
          computed_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          rule?: string
          scope?: string | null
          size_inr_month?: number | null
          confidence?: number | null
          evidence?: Json
          status?: 'candidate' | 'insufficient_data' | 'suppressed'
          computed_at?: string
        }
      }
      reports: {
        Row: {
          id: string
          restaurant_id: string
          // draft -> reviewed -> delivered. "delivered" requires an
          // explicit manual action - nothing auto-advances a report here.
          status: 'draft' | 'reviewed' | 'delivered'
          headline_finding_id: string | null
          // frozen one-pager content at generation time - auditable, not
          // silently re-computed if underlying data changes later.
          snapshot: Json
          generated_at: string
          reviewed_at: string | null
          delivered_at: string | null
        }
        Insert: {
          id?: string
          restaurant_id: string
          status?: 'draft' | 'reviewed' | 'delivered'
          headline_finding_id?: string | null
          snapshot?: Json
          generated_at?: string
          reviewed_at?: string | null
          delivered_at?: string | null
        }
        Update: {
          id?: string
          restaurant_id?: string
          status?: 'draft' | 'reviewed' | 'delivered'
          headline_finding_id?: string | null
          snapshot?: Json
          generated_at?: string
          reviewed_at?: string | null
          delivered_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
