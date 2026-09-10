// Generado desde el esquema de Supabase. Para regenerar:
//   npx supabase gen types typescript --project-id <PROJECT_ID> > src/lib/database.types.ts
// No editar a mano.

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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          archived: boolean
          color: string
          created_at: string
          goal_weekly_minutes: number | null
          id: string
          name: string
          parent_id: string | null
          position: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived?: boolean
          color?: string
          created_at?: string
          goal_weekly_minutes?: number | null
          id?: string
          name: string
          parent_id?: string | null
          position?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived?: boolean
          color?: string
          created_at?: string
          goal_weekly_minutes?: number | null
          id?: string
          name?: string
          parent_id?: string | null
          position?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_invitations: {
        Row: {
          billable: boolean
          created_at: string
          created_entry_id: string | null
          description: string
          edition_id: string | null
          end_at: string
          from_user: string
          id: string
          origin_entry_id: string | null
          project_id: string | null
          responded_at: string | null
          separated_at: string | null
          start_at: string
          status: string
          task_id: string | null
          to_user: string
          workspace_id: string
        }
        Insert: {
          billable?: boolean
          created_at?: string
          created_entry_id?: string | null
          description?: string
          edition_id?: string | null
          end_at: string
          from_user: string
          id?: string
          origin_entry_id?: string | null
          project_id?: string | null
          responded_at?: string | null
          separated_at?: string | null
          start_at: string
          status?: string
          task_id?: string | null
          to_user: string
          workspace_id: string
        }
        Update: {
          billable?: boolean
          created_at?: string
          created_entry_id?: string | null
          description?: string
          edition_id?: string | null
          end_at?: string
          from_user?: string
          id?: string
          origin_entry_id?: string | null
          project_id?: string | null
          responded_at?: string | null
          separated_at?: string | null
          start_at?: string
          status?: string
          task_id?: string | null
          to_user?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entry_invitations_created_entry_id_fkey"
            columns: ["created_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_invitations_created_entry_id_fkey"
            columns: ["created_entry_id"]
            isOneToOne: false
            referencedRelation: "v_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_invitations_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "project_editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_invitations_from_user_fkey"
            columns: ["from_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_invitations_origin_entry_id_fkey"
            columns: ["origin_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_invitations_origin_entry_id_fkey"
            columns: ["origin_entry_id"]
            isOneToOne: false
            referencedRelation: "v_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_invitations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_invitations_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_invitations_to_user_fkey"
            columns: ["to_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entry_invitations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      google_connections: {
        Row: {
          calendar_id: string
          connected_at: string
          last_synced_at: string | null
          refresh_token: string
          user_id: string
        }
        Insert: {
          calendar_id?: string
          connected_at?: string
          last_synced_at?: string | null
          refresh_token: string
          user_id: string
        }
        Update: {
          calendar_id?: string
          connected_at?: string
          last_synced_at?: string | null
          refresh_token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["user_role"]
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          full_name?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_editions: {
        Row: {
          archived: boolean
          budget_hours: number | null
          created_at: string
          ends_on: string | null
          id: string
          name: string
          position: number
          project_id: string
          starts_on: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived?: boolean
          budget_hours?: number | null
          created_at?: string
          ends_on?: string | null
          id?: string
          name: string
          position?: number
          project_id: string
          starts_on?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived?: boolean
          budget_hours?: number | null
          created_at?: string
          ends_on?: string | null
          id?: string
          name?: string
          position?: number
          project_id?: string
          starts_on?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_editions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_editions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_favorites: {
        Row: {
          created_at: string
          project_id: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          project_id: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          project_id?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_favorites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_favorites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_results: {
        Row: {
          created_at: string
          edition_id: string | null
          ends_on: string
          expenses: number
          id: string
          income: number
          label: string
          notes: string
          project_id: string
          starts_on: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          edition_id?: string | null
          ends_on: string
          expenses?: number
          id?: string
          income?: number
          label?: string
          notes?: string
          project_id: string
          starts_on: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          edition_id?: string | null
          ends_on?: string
          expenses?: number
          id?: string
          income?: number
          label?: string
          notes?: string
          project_id?: string
          starts_on?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_results_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "project_editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_results_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_results_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          archived: boolean
          billable_default: boolean
          budget_hours: number | null
          category_id: string | null
          color: string
          created_at: string
          default_edition_id: string | null
          id: string
          kind: Database["public"]["Enums"]["project_kind"] | null
          name: string
          target_hourly_rate: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived?: boolean
          billable_default?: boolean
          budget_hours?: number | null
          category_id?: string | null
          color?: string
          created_at?: string
          default_edition_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["project_kind"] | null
          name: string
          target_hourly_rate?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived?: boolean
          billable_default?: boolean
          budget_hours?: number | null
          category_id?: string | null
          color?: string
          created_at?: string
          default_edition_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["project_kind"] | null
          name?: string
          target_hourly_rate?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_default_edition_id_fkey"
            columns: ["default_edition_id"]
            isOneToOne: false
            referencedRelation: "project_editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      rates: {
        Row: {
          created_at: string
          effective_from: string
          hourly_rate: number
          id: string
          project_id: string | null
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          effective_from?: string
          hourly_rate: number
          id?: string
          project_id?: string | null
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          effective_from?: string
          hourly_rate?: number
          id?: string
          project_id?: string | null
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_split_shares: {
        Row: {
          percent: number
          split_id: string
          user_id: string
        }
        Insert: {
          percent: number
          split_id: string
          user_id: string
        }
        Update: {
          percent?: number
          split_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_split_shares_split_id_fkey"
            columns: ["split_id"]
            isOneToOne: false
            referencedRelation: "revenue_splits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_split_shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_splits: {
        Row: {
          created_at: string
          edition_id: string | null
          id: string
          mode: string
          project_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          edition_id?: string | null
          id?: string
          mode: string
          project_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          edition_id?: string | null
          id?: string
          mode?: string
          project_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_splits_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "project_editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_splits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_splits_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          archived: boolean
          color: string
          created_at: string
          id: string
          name: string
          workspace_id: string
        }
        Insert: {
          archived?: boolean
          color?: string
          created_at?: string
          id?: string
          name: string
          workspace_id: string
        }
        Update: {
          archived?: boolean
          color?: string
          created_at?: string
          id?: string
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          archived: boolean
          created_at: string
          id: string
          name: string
          project_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          id?: string
          name: string
          project_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          id?: string
          name?: string
          project_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          billable: boolean
          created_at: string
          description: string
          duration_seconds: number | null
          edition_id: string | null
          end_at: string | null
          external_id: string | null
          id: string
          local_date: string | null
          locked: boolean
          project_id: string | null
          source: string
          start_at: string
          task_id: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          billable?: boolean
          created_at?: string
          description?: string
          duration_seconds?: number | null
          edition_id?: string | null
          end_at?: string | null
          external_id?: string | null
          id?: string
          local_date?: string | null
          locked?: boolean
          project_id?: string | null
          source?: string
          start_at: string
          task_id?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          billable?: boolean
          created_at?: string
          description?: string
          duration_seconds?: number | null
          edition_id?: string | null
          end_at?: string | null
          external_id?: string | null
          id?: string
          local_date?: string | null
          locked?: boolean
          project_id?: string | null
          source?: string
          start_at?: string
          task_id?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "project_editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entry_tags: {
        Row: {
          entry_id: string
          tag_id: string
        }
        Insert: {
          entry_id: string
          tag_id: string
        }
        Update: {
          entry_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entry_tags_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entry_tags_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "v_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entry_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          note: string | null
          trial_days: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          note?: string | null
          trial_days: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          note?: string | null
          trial_days?: number
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          active: boolean
          created_at: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_seats: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          id: string
          name: string
          workspace_id: string
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          id?: string
          name: string
          workspace_id: string
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          id?: string
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_seats_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_seats_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_code: string | null
          trial_ends_at: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_code?: string | null
          trial_ends_at?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_code?: string | null
          trial_ends_at?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          allowed_domains: string[]
          created_at: string
          created_by: string | null
          goal_daily_minutes: number | null
          goal_weekly_minutes: number | null
          id: string
          join_code: string | null
          name: string
          require_description: boolean
          require_project: boolean
          slug: string
          tag_mode: string
          target_hourly_rate: number | null
          text_case: string
          timezone: string
          updated_at: string
        }
        Insert: {
          allowed_domains?: string[]
          created_at?: string
          created_by?: string | null
          goal_daily_minutes?: number | null
          goal_weekly_minutes?: number | null
          id?: string
          join_code?: string | null
          name: string
          require_description?: boolean
          require_project?: boolean
          slug: string
          tag_mode?: string
          target_hourly_rate?: number | null
          text_case?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          allowed_domains?: string[]
          created_at?: string
          created_by?: string | null
          goal_daily_minutes?: number | null
          goal_weekly_minutes?: number | null
          id?: string
          join_code?: string | null
          name?: string
          require_description?: boolean
          require_project?: boolean
          slug?: string
          tag_mode?: string
          target_hourly_rate?: number | null
          text_case?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_entries: {
        Row: {
          amount: number | null
          billable: boolean | null
          category_id: string | null
          category_name: string | null
          compartida_con: Json | null
          description: string | null
          duration_seconds: number | null
          edition_id: string | null
          edition_name: string | null
          end_at: string | null
          hours: number | null
          id: string | null
          local_date: string | null
          locked: boolean | null
          project_color: string | null
          project_id: string | null
          project_name: string | null
          start_at: string | null
          subcategory_name: string | null
          tags: string[] | null
          task_id: string | null
          task_name: string | null
          updated_by: string | null
          updated_by_name: string | null
          user_id: string | null
          user_name: string | null
          venida_de: string | null
          venida_de_id: string | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "project_editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      aplicar_codigo_prueba: {
        Args: { p_codigo: string; p_workspace: string }
        Returns: string
      }
      available_workspaces: {
        Args: never
        Returns: {
          id: string
          motivo: string
          name: string
          role: Database["public"]["Enums"]["user_role"]
          slug: string
        }[]
      }
      can_edit_entry: { Args: { p_entry: string }; Returns: boolean }
      can_read_entry: { Args: { p_entry: string }; Returns: boolean }
      can_see_all: { Args: { p_workspace: string }; Returns: boolean }
      create_workspace: {
        Args: { p_name: string; p_plantilla?: boolean; p_timezone: string }
        Returns: {
          allowed_domains: string[]
          created_at: string
          created_by: string | null
          goal_daily_minutes: number | null
          goal_weekly_minutes: number | null
          id: string
          join_code: string | null
          name: string
          require_description: boolean
          require_project: boolean
          slug: string
          tag_mode: string
          target_hourly_rate: number | null
          text_case: string
          timezone: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "workspaces"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      espacio_por_codigo: {
        Args: { p_codigo: string }
        Returns: {
          id: string
          name: string
          plazas: Json
        }[]
      }
      estilo_del_espacio: { Args: { p_workspace: string }; Returns: string }
      is_admin: { Args: { p_workspace: string }; Returns: boolean }
      is_member: { Args: { p_workspace: string }; Returns: boolean }
      join_workspace: {
        Args: { p_workspace: string }
        Returns: {
          active: boolean
          created_at: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "workspace_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mis_invitaciones: {
        Args: { p_workspace: string }
        Returns: {
          billable: boolean
          created_at: string
          de: string
          description: string
          end_at: string
          id: string
          project_color: string
          project_name: string
          start_at: string
        }[]
      }
      my_email: { Args: never; Returns: string }
      my_role: {
        Args: { p_workspace: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      normalizar_texto_existente: {
        Args: { p_workspace: string }
        Returns: number
      }
      renombrar_miembro: {
        Args: { p_nombre: string; p_user: string; p_workspace: string }
        Returns: string
      }
      resolve_rate: {
        Args: {
          p_date: string
          p_project: string
          p_user: string
          p_workspace: string
        }
        Returns: number
      }
      responder_invitacion: {
        Args: { p_aceptar: boolean; p_invitacion: string }
        Returns: {
          billable: boolean
          created_at: string
          created_entry_id: string | null
          description: string
          edition_id: string | null
          end_at: string
          from_user: string
          id: string
          origin_entry_id: string | null
          project_id: string | null
          responded_at: string | null
          separated_at: string | null
          start_at: string
          status: string
          task_id: string | null
          to_user: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "entry_invitations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resumen_proyectos: {
        Args: { p_workspace: string }
        Returns: {
          entradas: number
          importe: number
          project_id: string
          segundos: number
          segundos_facturables: number
          ultima: string
        }[]
      }
      shares_workspace: { Args: { p_user: string }; Returns: boolean }
      start_timer: {
        Args: {
          p_billable?: boolean
          p_description?: string
          p_edition_id?: string
          p_project_id?: string
          p_tag_ids?: string[]
          p_task_id?: string
          p_workspace_id: string
        }
        Returns: {
          billable: boolean
          created_at: string
          description: string
          duration_seconds: number | null
          edition_id: string | null
          end_at: string | null
          external_id: string | null
          id: string
          local_date: string | null
          locked: boolean
          project_id: string | null
          source: string
          start_at: string
          task_id: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "time_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      stop_timer: {
        Args: never
        Returns: {
          billable: boolean
          created_at: string
          description: string
          duration_seconds: number | null
          edition_id: string | null
          end_at: string | null
          external_id: string | null
          id: string
          local_date: string | null
          locked: boolean
          project_id: string | null
          source: string
          start_at: string
          task_id: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "time_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      unirse_con_codigo: {
        Args: { p_codigo: string; p_plaza?: string }
        Returns: {
          active: boolean
          created_at: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "workspace_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      project_kind: "evento" | "b2b" | "oportunidad" | "b2c"
      user_role: "admin" | "manager" | "member"
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
      project_kind: ["evento", "b2b", "oportunidad", "b2c"],
      user_role: ["admin", "manager", "member"],
    },
  },
} as const
