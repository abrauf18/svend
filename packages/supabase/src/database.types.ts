export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          created_at: string | null
          created_by: string | null
          email: string | null
          id: string
          is_personal_account: boolean
          name: string
          picture_url: string | null
          primary_owner_user_id: string
          public_data: Json
          slug: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          is_personal_account?: boolean
          name: string
          picture_url?: string | null
          primary_owner_user_id?: string
          public_data?: Json
          slug?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          is_personal_account?: boolean
          name?: string
          picture_url?: string | null
          primary_owner_user_id?: string
          public_data?: Json
          slug?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      acct_fin_profile: {
        Row: {
          account_id: string
          age: number | null
          created_at: string | null
          current_debt: Database["public"]["Enums"]["debt_type_enum"][] | null
          current_debt_other: string | null
          dependents: number | null
          full_name: string | null
          goal_timeline:
            | Database["public"]["Enums"]["goal_timeline_enum"]
            | null
          id: string
          income_level: Database["public"]["Enums"]["income_level_enum"] | null
          marital_status:
            | Database["public"]["Enums"]["marital_status_enum"]
            | null
          marital_status_other: string | null
          monthly_contribution:
            | Database["public"]["Enums"]["monthly_contribution_enum"]
            | null
          primary_financial_goals:
            | Database["public"]["Enums"]["financial_goal_enum"][]
            | null
          savings: Database["public"]["Enums"]["savings_enum"] | null
          state: Database["public"]["Enums"]["fin_profile_state_enum"] | null
          updated_at: string | null
        }
        Insert: {
          account_id: string
          age?: number | null
          created_at?: string | null
          current_debt?: Database["public"]["Enums"]["debt_type_enum"][] | null
          current_debt_other?: string | null
          dependents?: number | null
          full_name?: string | null
          goal_timeline?:
            | Database["public"]["Enums"]["goal_timeline_enum"]
            | null
          id?: string
          income_level?: Database["public"]["Enums"]["income_level_enum"] | null
          marital_status?:
            | Database["public"]["Enums"]["marital_status_enum"]
            | null
          marital_status_other?: string | null
          monthly_contribution?:
            | Database["public"]["Enums"]["monthly_contribution_enum"]
            | null
          primary_financial_goals?:
            | Database["public"]["Enums"]["financial_goal_enum"][]
            | null
          savings?: Database["public"]["Enums"]["savings_enum"] | null
          state?: Database["public"]["Enums"]["fin_profile_state_enum"] | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string
          age?: number | null
          created_at?: string | null
          current_debt?: Database["public"]["Enums"]["debt_type_enum"][] | null
          current_debt_other?: string | null
          dependents?: number | null
          full_name?: string | null
          goal_timeline?:
            | Database["public"]["Enums"]["goal_timeline_enum"]
            | null
          id?: string
          income_level?: Database["public"]["Enums"]["income_level_enum"] | null
          marital_status?:
            | Database["public"]["Enums"]["marital_status_enum"]
            | null
          marital_status_other?: string | null
          monthly_contribution?:
            | Database["public"]["Enums"]["monthly_contribution_enum"]
            | null
          primary_financial_goals?:
            | Database["public"]["Enums"]["financial_goal_enum"][]
            | null
          savings?: Database["public"]["Enums"]["savings_enum"] | null
          state?: Database["public"]["Enums"]["fin_profile_state_enum"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acct_fin_profile_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acct_fin_profile_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acct_fin_profile_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_customers: {
        Row: {
          account_id: string
          customer_id: string
          email: string | null
          id: number
          provider: Database["public"]["Enums"]["billing_provider"]
        }
        Insert: {
          account_id: string
          customer_id: string
          email?: string | null
          id?: number
          provider: Database["public"]["Enums"]["billing_provider"]
        }
        Update: {
          account_id?: string
          customer_id?: string
          email?: string | null
          id?: number
          provider?: Database["public"]["Enums"]["billing_provider"]
        }
        Relationships: [
          {
            foreignKeyName: "billing_customers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_customers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_customers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_fin_account_recurring_transactions: {
        Row: {
          budget_id: string
          created_at: string | null
          fin_account_recurring_transaction_id: string
          notes: string | null
          svend_category_id: string | null
          tag_ids: string[] | null
          updated_at: string | null
        }
        Insert: {
          budget_id: string
          created_at?: string | null
          fin_account_recurring_transaction_id: string
          notes?: string | null
          svend_category_id?: string | null
          tag_ids?: string[] | null
          updated_at?: string | null
        }
        Update: {
          budget_id?: string
          created_at?: string | null
          fin_account_recurring_transaction_id?: string
          notes?: string | null
          svend_category_id?: string | null
          tag_ids?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_fin_account_recurring__fin_account_recurring_transa_fkey"
            columns: ["fin_account_recurring_transaction_id"]
            isOneToOne: false
            referencedRelation: "fin_account_recurring_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_fin_account_recurring_transaction_svend_category_id_fkey"
            columns: ["svend_category_id"]
            isOneToOne: false
            referencedRelation: "built_in_categories"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "budget_fin_account_recurring_transaction_svend_category_id_fkey"
            columns: ["svend_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_fin_account_recurring_transactions_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_fin_account_transactions: {
        Row: {
          budget_id: string
          created_at: string | null
          fin_account_transaction_id: string
          merchant_name: string | null
          notes: string | null
          payee: string | null
          svend_category_id: string
          tag_ids: string[] | null
          updated_at: string | null
        }
        Insert: {
          budget_id: string
          created_at?: string | null
          fin_account_transaction_id: string
          merchant_name?: string | null
          notes?: string | null
          payee?: string | null
          svend_category_id: string
          tag_ids?: string[] | null
          updated_at?: string | null
        }
        Update: {
          budget_id?: string
          created_at?: string | null
          fin_account_transaction_id?: string
          merchant_name?: string | null
          notes?: string | null
          payee?: string | null
          svend_category_id?: string
          tag_ids?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_fin_account_transactions_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_fin_account_transactions_fin_account_transaction_id_fkey"
            columns: ["fin_account_transaction_id"]
            isOneToOne: false
            referencedRelation: "fin_account_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_fin_account_transactions_svend_category_id_fkey"
            columns: ["svend_category_id"]
            isOneToOne: false
            referencedRelation: "built_in_categories"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "budget_fin_account_transactions_svend_category_id_fkey"
            columns: ["svend_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_fin_accounts: {
        Row: {
          budget_id: string | null
          id: string
          manual_account_id: string | null
          plaid_account_id: string | null
        }
        Insert: {
          budget_id?: string | null
          id?: string
          manual_account_id?: string | null
          plaid_account_id?: string | null
        }
        Update: {
          budget_id?: string | null
          id?: string
          manual_account_id?: string | null
          plaid_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_fin_accounts_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_fin_accounts_manual_account_id_fkey"
            columns: ["manual_account_id"]
            isOneToOne: false
            referencedRelation: "manual_fin_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_fin_accounts_plaid_account_id_fkey"
            columns: ["plaid_account_id"]
            isOneToOne: false
            referencedRelation: "plaid_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_goals: {
        Row: {
          amount: number
          budget_id: string
          created_at: string
          debt_interest_rate: number | null
          debt_payment_component:
            | Database["public"]["Enums"]["budget_goal_debt_payment_component_enum"]
            | null
          debt_type: Database["public"]["Enums"]["debt_type_enum"] | null
          description: string | null
          fin_account_id: string
          id: string
          name: string
          spending_recommendations: Json
          spending_tracking: Json
          target_date: string
          type: Database["public"]["Enums"]["budget_goal_type_enum"]
          updated_at: string
        }
        Insert: {
          amount: number
          budget_id: string
          created_at?: string
          debt_interest_rate?: number | null
          debt_payment_component?:
            | Database["public"]["Enums"]["budget_goal_debt_payment_component_enum"]
            | null
          debt_type?: Database["public"]["Enums"]["debt_type_enum"] | null
          description?: string | null
          fin_account_id: string
          id?: string
          name: string
          spending_recommendations?: Json
          spending_tracking?: Json
          target_date: string
          type: Database["public"]["Enums"]["budget_goal_type_enum"]
          updated_at?: string
        }
        Update: {
          amount?: number
          budget_id?: string
          created_at?: string
          debt_interest_rate?: number | null
          debt_payment_component?:
            | Database["public"]["Enums"]["budget_goal_debt_payment_component_enum"]
            | null
          debt_type?: Database["public"]["Enums"]["debt_type_enum"] | null
          description?: string | null
          fin_account_id?: string
          id?: string
          name?: string
          spending_recommendations?: Json
          spending_tracking?: Json
          target_date?: string
          type?: Database["public"]["Enums"]["budget_goal_type_enum"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_goals_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_goals_fin_account_id_fkey"
            columns: ["fin_account_id"]
            isOneToOne: false
            referencedRelation: "budget_fin_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_tags: {
        Row: {
          budget_id: string
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          budget_id: string
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          budget_id?: string
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_tags_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          budget_type: Database["public"]["Enums"]["budget_type"]
          created_at: string | null
          current_onboarding_step: Database["public"]["Enums"]["budget_onboarding_step_enum"]
          end_date: string | null
          id: string
          is_active: boolean
          spending_recommendations: Json
          spending_tracking: Json
          start_date: string
          team_account_id: string
          updated_at: string | null
        }
        Insert: {
          budget_type?: Database["public"]["Enums"]["budget_type"]
          created_at?: string | null
          current_onboarding_step?: Database["public"]["Enums"]["budget_onboarding_step_enum"]
          end_date?: string | null
          id?: string
          is_active?: boolean
          spending_recommendations?: Json
          spending_tracking?: Json
          start_date?: string
          team_account_id: string
          updated_at?: string | null
        }
        Update: {
          budget_type?: Database["public"]["Enums"]["budget_type"]
          created_at?: string | null
          current_onboarding_step?: Database["public"]["Enums"]["budget_onboarding_step_enum"]
          end_date?: string | null
          id?: string
          is_active?: boolean
          spending_recommendations?: Json
          spending_tracking?: Json
          start_date?: string
          team_account_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budgets_team_account_id_fkey"
            columns: ["team_account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_team_account_id_fkey"
            columns: ["team_account_id"]
            isOneToOne: true
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_team_account_id_fkey"
            columns: ["team_account_id"]
            isOneToOne: true
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          budget_id: string | null
          composite_data: Json | null
          created_at: string | null
          description: string | null
          group_id: string
          id: string
          is_composite: boolean
          is_discretionary: boolean
          name: string
          updated_at: string | null
        }
        Insert: {
          budget_id?: string | null
          composite_data?: Json | null
          created_at?: string | null
          description?: string | null
          group_id: string
          id?: string
          is_composite?: boolean
          is_discretionary?: boolean
          name: string
          updated_at?: string | null
        }
        Update: {
          budget_id?: string | null
          composite_data?: Json | null
          created_at?: string | null
          description?: string | null
          group_id?: string
          id?: string
          is_composite?: boolean
          is_discretionary?: boolean
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "built_in_categories"
            referencedColumns: ["group_id"]
          },
          {
            foreignKeyName: "categories_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "category_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      category_groups: {
        Row: {
          budget_id: string | null
          created_at: string | null
          description: string | null
          id: string
          is_enabled: boolean
          name: string
          updated_at: string | null
        }
        Insert: {
          budget_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean
          name: string
          updated_at?: string | null
        }
        Update: {
          budget_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_enabled?: boolean
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "category_groups_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      config: {
        Row: {
          billing_provider: Database["public"]["Enums"]["billing_provider"]
          enable_account_billing: boolean
          enable_team_account_billing: boolean
          enable_team_accounts: boolean
        }
        Insert: {
          billing_provider?: Database["public"]["Enums"]["billing_provider"]
          enable_account_billing?: boolean
          enable_team_account_billing?: boolean
          enable_team_accounts?: boolean
        }
        Update: {
          billing_provider?: Database["public"]["Enums"]["billing_provider"]
          enable_account_billing?: boolean
          enable_team_account_billing?: boolean
          enable_team_accounts?: boolean
        }
        Relationships: []
      }
      feature_usage: {
        Row: {
          account_id: string
          created_at: string | null
          feature: string
          id: string
          updated_at: string | null
          usage: Json
        }
        Insert: {
          account_id: string
          created_at?: string | null
          feature: string
          id?: string
          updated_at?: string | null
          usage?: Json
        }
        Update: {
          account_id?: string
          created_at?: string | null
          feature?: string
          id?: string
          updated_at?: string | null
          usage?: Json
        }
        Relationships: [
          {
            foreignKeyName: "feature_usage_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_usage_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feature_usage_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_account_recurring_transactions: {
        Row: {
          created_at: string | null
          fin_account_transaction_ids: string[] | null
          id: string
          manual_account_id: string | null
          plaid_account_id: string | null
          plaid_category_confidence: string | null
          plaid_category_detailed: string | null
          plaid_raw_data: Json | null
          plaid_tx_id: string | null
          svend_category_id: string
          updated_at: string | null
          user_tx_id: string
        }
        Insert: {
          created_at?: string | null
          fin_account_transaction_ids?: string[] | null
          id?: string
          manual_account_id?: string | null
          plaid_account_id?: string | null
          plaid_category_confidence?: string | null
          plaid_category_detailed?: string | null
          plaid_raw_data?: Json | null
          plaid_tx_id?: string | null
          svend_category_id: string
          updated_at?: string | null
          user_tx_id: string
        }
        Update: {
          created_at?: string | null
          fin_account_transaction_ids?: string[] | null
          id?: string
          manual_account_id?: string | null
          plaid_account_id?: string | null
          plaid_category_confidence?: string | null
          plaid_category_detailed?: string | null
          plaid_raw_data?: Json | null
          plaid_tx_id?: string | null
          svend_category_id?: string
          updated_at?: string | null
          user_tx_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_account_recurring_transactions_manual_account_id_fkey"
            columns: ["manual_account_id"]
            isOneToOne: false
            referencedRelation: "manual_fin_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_account_recurring_transactions_plaid_account_id_fkey"
            columns: ["plaid_account_id"]
            isOneToOne: false
            referencedRelation: "plaid_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_account_recurring_transactions_svend_category_id_fkey"
            columns: ["svend_category_id"]
            isOneToOne: false
            referencedRelation: "built_in_categories"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "fin_account_recurring_transactions_svend_category_id_fkey"
            columns: ["svend_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_account_transactions: {
        Row: {
          amount: number
          created_at: string | null
          date: string
          id: string
          iso_currency_code: string | null
          manual_account_id: string | null
          merchant_name: string | null
          payee: string | null
          plaid_account_id: string | null
          plaid_category_confidence: string | null
          plaid_category_detailed: string | null
          plaid_raw_data: Json | null
          plaid_tx_id: string | null
          svend_category_id: string
          tx_status: Database["public"]["Enums"]["transaction_status_enum"]
          updated_at: string | null
          user_tx_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          date: string
          id?: string
          iso_currency_code?: string | null
          manual_account_id?: string | null
          merchant_name?: string | null
          payee?: string | null
          plaid_account_id?: string | null
          plaid_category_confidence?: string | null
          plaid_category_detailed?: string | null
          plaid_raw_data?: Json | null
          plaid_tx_id?: string | null
          svend_category_id: string
          tx_status?: Database["public"]["Enums"]["transaction_status_enum"]
          updated_at?: string | null
          user_tx_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          date?: string
          id?: string
          iso_currency_code?: string | null
          manual_account_id?: string | null
          merchant_name?: string | null
          payee?: string | null
          plaid_account_id?: string | null
          plaid_category_confidence?: string | null
          plaid_category_detailed?: string | null
          plaid_raw_data?: Json | null
          plaid_tx_id?: string | null
          svend_category_id?: string
          tx_status?: Database["public"]["Enums"]["transaction_status_enum"]
          updated_at?: string | null
          user_tx_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_account_transactions_manual_account_id_fkey"
            columns: ["manual_account_id"]
            isOneToOne: false
            referencedRelation: "manual_fin_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_account_transactions_plaid_account_id_fkey"
            columns: ["plaid_account_id"]
            isOneToOne: false
            referencedRelation: "plaid_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_account_transactions_svend_category_id_fkey"
            columns: ["svend_category_id"]
            isOneToOne: false
            referencedRelation: "built_in_categories"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "fin_account_transactions_svend_category_id_fkey"
            columns: ["svend_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          account_id: string
          created_at: string
          email: string
          expires_at: string
          id: number
          invite_token: string
          invited_by: string
          role: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: number
          invite_token: string
          invited_by: string
          role: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: number
          invite_token?: string
          invited_by?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_role_fkey"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["name"]
          },
        ]
      }
      manual_fin_accounts: {
        Row: {
          balance_available: number | null
          balance_current: number | null
          balance_limit: number | null
          created_at: string | null
          id: string
          institution_id: string
          iso_currency_code: string | null
          mask: string | null
          name: string
          official_name: string | null
          owner_account_id: string
          subtype: string | null
          type: Database["public"]["Enums"]["fin_account_type_enum"]
          updated_at: string | null
        }
        Insert: {
          balance_available?: number | null
          balance_current?: number | null
          balance_limit?: number | null
          created_at?: string | null
          id?: string
          institution_id: string
          iso_currency_code?: string | null
          mask?: string | null
          name: string
          official_name?: string | null
          owner_account_id: string
          subtype?: string | null
          type: Database["public"]["Enums"]["fin_account_type_enum"]
          updated_at?: string | null
        }
        Update: {
          balance_available?: number | null
          balance_current?: number | null
          balance_limit?: number | null
          created_at?: string | null
          id?: string
          institution_id?: string
          iso_currency_code?: string | null
          mask?: string | null
          name?: string
          official_name?: string | null
          owner_account_id?: string
          subtype?: string | null
          type?: Database["public"]["Enums"]["fin_account_type_enum"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manual_fin_accounts_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "manual_fin_institutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_fin_accounts_owner_account_id_fkey"
            columns: ["owner_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_fin_accounts_owner_account_id_fkey"
            columns: ["owner_account_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_fin_accounts_owner_account_id_fkey"
            columns: ["owner_account_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_fin_institutions: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_account_id: string
          symbol: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_account_id: string
          symbol: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_account_id?: string
          symbol?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_fin_institutions_owner_account_id_fkey"
            columns: ["owner_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_fin_institutions_owner_account_id_fkey"
            columns: ["owner_account_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_fin_institutions_owner_account_id_fkey"
            columns: ["owner_account_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          account_id: string
          body: string
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          dismissed: boolean
          expires_at: string | null
          id: number
          link: string | null
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          account_id: string
          body: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          dismissed?: boolean
          expires_at?: string | null
          id?: never
          link?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          account_id?: string
          body?: string
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          dismissed?: boolean
          expires_at?: string | null
          id?: never
          link?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          price_amount: number | null
          product_id: string
          quantity: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          id: string
          order_id: string
          price_amount?: number | null
          product_id: string
          quantity?: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          price_amount?: number | null
          product_id?: string
          quantity?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          account_id: string
          billing_customer_id: number
          billing_provider: Database["public"]["Enums"]["billing_provider"]
          created_at: string
          currency: string
          id: string
          status: Database["public"]["Enums"]["payment_status"]
          total_amount: number
          updated_at: string
        }
        Insert: {
          account_id: string
          billing_customer_id: number
          billing_provider: Database["public"]["Enums"]["billing_provider"]
          created_at?: string
          currency: string
          id: string
          status: Database["public"]["Enums"]["payment_status"]
          total_amount: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          billing_customer_id?: number
          billing_provider?: Database["public"]["Enums"]["billing_provider"]
          created_at?: string
          currency?: string
          id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_billing_customer_id_fkey"
            columns: ["billing_customer_id"]
            isOneToOne: false
            referencedRelation: "billing_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      plaid_accounts: {
        Row: {
          balance_available: number | null
          balance_current: number | null
          balance_limit: number | null
          created_at: string | null
          id: string
          iso_currency_code: string | null
          mask: string | null
          name: string
          official_name: string | null
          owner_account_id: string
          plaid_account_id: string
          plaid_conn_item_id: string
          plaid_persistent_account_id: string | null
          subtype: string | null
          type: Database["public"]["Enums"]["fin_account_type_enum"]
          updated_at: string | null
        }
        Insert: {
          balance_available?: number | null
          balance_current?: number | null
          balance_limit?: number | null
          created_at?: string | null
          id?: string
          iso_currency_code?: string | null
          mask?: string | null
          name: string
          official_name?: string | null
          owner_account_id: string
          plaid_account_id: string
          plaid_conn_item_id: string
          plaid_persistent_account_id?: string | null
          subtype?: string | null
          type: Database["public"]["Enums"]["fin_account_type_enum"]
          updated_at?: string | null
        }
        Update: {
          balance_available?: number | null
          balance_current?: number | null
          balance_limit?: number | null
          created_at?: string | null
          id?: string
          iso_currency_code?: string | null
          mask?: string | null
          name?: string
          official_name?: string | null
          owner_account_id?: string
          plaid_account_id?: string
          plaid_conn_item_id?: string
          plaid_persistent_account_id?: string | null
          subtype?: string | null
          type?: Database["public"]["Enums"]["fin_account_type_enum"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plaid_accounts_owner_account_id_fkey"
            columns: ["owner_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plaid_accounts_owner_account_id_fkey"
            columns: ["owner_account_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plaid_accounts_owner_account_id_fkey"
            columns: ["owner_account_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plaid_accounts_plaid_conn_item_id_fkey"
            columns: ["plaid_conn_item_id"]
            isOneToOne: false
            referencedRelation: "plaid_connection_items"
            referencedColumns: ["id"]
          },
        ]
      }
      plaid_connection_items: {
        Row: {
          access_token: string
          created_at: string | null
          id: string
          institution_id: string
          institution_logo_storage_name: string | null
          institution_name: string
          next_cursor: string | null
          owner_account_id: string
          plaid_item_id: string
          updated_at: string | null
        }
        Insert: {
          access_token: string
          created_at?: string | null
          id?: string
          institution_id: string
          institution_logo_storage_name?: string | null
          institution_name: string
          next_cursor?: string | null
          owner_account_id: string
          plaid_item_id: string
          updated_at?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string | null
          id?: string
          institution_id?: string
          institution_logo_storage_name?: string | null
          institution_name?: string
          next_cursor?: string | null
          owner_account_id?: string
          plaid_item_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plaid_connection_items_owner_account_id_fkey"
            columns: ["owner_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plaid_connection_items_owner_account_id_fkey"
            columns: ["owner_account_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plaid_connection_items_owner_account_id_fkey"
            columns: ["owner_account_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_entitlements: {
        Row: {
          created_at: string | null
          entitlement: Json
          feature: string
          id: string
          updated_at: string | null
          variant_id: string
        }
        Insert: {
          created_at?: string | null
          entitlement: Json
          feature: string
          id?: string
          updated_at?: string | null
          variant_id: string
        }
        Update: {
          created_at?: string | null
          entitlement?: Json
          feature?: string
          id?: string
          updated_at?: string | null
          variant_id?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          id: number
          permission: Database["public"]["Enums"]["app_permissions"]
          role: string
        }
        Insert: {
          id?: number
          permission: Database["public"]["Enums"]["app_permissions"]
          role: string
        }
        Update: {
          id?: number
          permission?: Database["public"]["Enums"]["app_permissions"]
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_fkey"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["name"]
          },
        ]
      }
      roles: {
        Row: {
          hierarchy_level: number
          name: string
        }
        Insert: {
          hierarchy_level: number
          name: string
        }
        Update: {
          hierarchy_level?: number
          name?: string
        }
        Relationships: []
      }
      subscription_items: {
        Row: {
          created_at: string
          id: string
          interval: string
          interval_count: number
          price_amount: number | null
          product_id: string
          quantity: number
          subscription_id: string
          type: Database["public"]["Enums"]["subscription_item_type"]
          updated_at: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          id: string
          interval: string
          interval_count: number
          price_amount?: number | null
          product_id: string
          quantity?: number
          subscription_id: string
          type: Database["public"]["Enums"]["subscription_item_type"]
          updated_at?: string
          variant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          interval?: string
          interval_count?: number
          price_amount?: number | null
          product_id?: string
          quantity?: number
          subscription_id?: string
          type?: Database["public"]["Enums"]["subscription_item_type"]
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_items_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          account_id: string
          active: boolean
          billing_customer_id: number
          billing_provider: Database["public"]["Enums"]["billing_provider"]
          cancel_at_period_end: boolean
          created_at: string
          currency: string
          id: string
          period_ends_at: string
          period_starts_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          trial_starts_at: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          active: boolean
          billing_customer_id: number
          billing_provider: Database["public"]["Enums"]["billing_provider"]
          cancel_at_period_end: boolean
          created_at?: string
          currency: string
          id: string
          period_ends_at: string
          period_starts_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          trial_starts_at?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          active?: boolean
          billing_customer_id?: number
          billing_provider?: Database["public"]["Enums"]["billing_provider"]
          cancel_at_period_end?: boolean
          created_at?: string
          currency?: string
          id?: string
          period_ends_at?: string
          period_starts_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          trial_starts_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_billing_customer_id_fkey"
            columns: ["billing_customer_id"]
            isOneToOne: false
            referencedRelation: "billing_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      team_memberships: {
        Row: {
          created_at: string
          created_by: string | null
          team_account_id: string
          team_role: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          team_account_id: string
          team_role: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          team_account_id?: string
          team_role?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_memberships_team_account_id_fkey"
            columns: ["team_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_memberships_team_account_id_fkey"
            columns: ["team_account_id"]
            isOneToOne: false
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_memberships_team_account_id_fkey"
            columns: ["team_account_id"]
            isOneToOne: false
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_memberships_team_role_fkey"
            columns: ["team_role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["name"]
          },
        ]
      }
      user_onboarding: {
        Row: {
          created_at: string | null
          state: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          state?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          state?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_onboarding_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_onboarding_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_account_workspace"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_onboarding_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      built_in_categories: {
        Row: {
          category_created_at: string | null
          category_description: string | null
          category_id: string | null
          category_is_discretionary: boolean | null
          category_name: string | null
          category_updated_at: string | null
          group_created_at: string | null
          group_description: string | null
          group_id: string | null
          group_is_enabled: boolean | null
          group_name: string | null
          group_updated_at: string | null
        }
        Relationships: []
      }
      user_account_workspace: {
        Row: {
          id: string | null
          name: string | null
          picture_url: string | null
          subscription_status:
            | Database["public"]["Enums"]["subscription_status"]
            | null
        }
        Relationships: []
      }
      user_accounts: {
        Row: {
          id: string | null
          name: string | null
          picture_url: string | null
          role: string | null
          slug: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_memberships_team_role_fkey"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["name"]
          },
        ]
      }
    }
    Functions: {
      accept_invitation: {
        Args: {
          token: string
          user_id: string
        }
        Returns: string
      }
      add_budget_plaid_account: {
        Args: {
          p_budget_id: string
          p_plaid_conn_item_id: string
          p_plaid_account_id: string
          p_account_id: string
          p_name: string
          p_type: Database["public"]["Enums"]["fin_account_type_enum"]
          p_balance_available?: number
          p_balance_current?: number
          p_balance_limit?: number
          p_iso_currency_code?: string
          p_mask?: string
          p_official_name?: string
          p_plaid_persistent_account_id?: string
          p_subtype?: string
        }
        Returns: Database["public"]["CompositeTypes"]["budget_plaid_account_result"]
      }
      add_invitations_to_account: {
        Args: {
          account_slug: string
          invitations: Database["public"]["CompositeTypes"]["invitation"][]
        }
        Returns: Database["public"]["Tables"]["invitations"]["Row"][]
      }
      can_action_account_member: {
        Args: {
          target_team_account_id: string
          target_user_id: string
        }
        Returns: boolean
      }
      can_use_feature: {
        Args: {
          p_account_id: string
          p_feature: string
        }
        Returns: boolean
      }
      create_budget_category_group: {
        Args: {
          p_budget_id: string
          p_name: string
          p_description?: string
        }
        Returns: {
          id: string
          name: string
          description: string
          budget_id: string
          is_enabled: boolean
          created_at: string
          updated_at: string
        }[]
      }
      create_budget_fin_account_recurring_transactions: {
        Args: {
          p_budget_id: string
          p_transactions: Database["public"]["CompositeTypes"]["budget_recurring_transaction_input"][]
        }
        Returns: string[]
      }
      create_budget_fin_account_transactions: {
        Args: {
          p_budget_id: string
          p_transactions: Database["public"]["CompositeTypes"]["budget_transaction_input"][]
        }
        Returns: string[]
      }
      create_budget_tag: {
        Args: {
          p_budget_id: string
          p_tag_name: string
        }
        Returns: {
          budget_id: string
          created_at: string | null
          id: string
          name: string
        }
      }
      create_invitation: {
        Args: {
          account_id: string
          email: string
          role: string
        }
        Returns: {
          account_id: string
          created_at: string
          email: string
          expires_at: string
          id: number
          invite_token: string
          invited_by: string
          role: string
          updated_at: string
        }
      }
      create_team_account: {
        Args: {
          primary_owner_user_id: string
          account_name: string
        }
        Returns: {
          created_at: string | null
          created_by: string | null
          email: string | null
          id: string
          is_personal_account: boolean
          name: string
          picture_url: string | null
          primary_owner_user_id: string
          public_data: Json
          slug: string | null
          updated_at: string | null
          updated_by: string | null
        }
      }
      delete_manual_accounts_and_transactions: {
        Args: {
          p_manual_account_ids: string[]
        }
        Returns: undefined
      }
      delete_manual_institutions_accounts_and_transactions: {
        Args: {
          p_manual_institution_ids: string[]
        }
        Returns: undefined
      }
      delete_transactions: {
        Args: {
          p_transaction_ids: string[]
        }
        Returns: {
          deleted_transaction_id: string
        }[]
      }
      get_account_invitations: {
        Args: {
          account_slug: string
        }
        Returns: {
          id: number
          email: string
          account_id: string
          invited_by: string
          role: string
          created_at: string
          updated_at: string
          expires_at: string
          inviter_name: string
          inviter_email: string
        }[]
      }
      get_account_members: {
        Args: {
          account_slug: string
        }
        Returns: {
          id: string
          user_id: string
          team_account_id: string
          role: string
          role_hierarchy_level: number
          primary_owner_user_id: string
          name: string
          email: string
          picture_url: string
          created_at: string
          updated_at: string
        }[]
      }
      get_budget_by_team_account_slug: {
        Args: {
          p_team_account_slug: string
        }
        Returns: {
          id: string
          team_account_id: string
          budget_type: string
          spending_tracking: Json
          spending_recommendations: Json
          is_active: boolean
          start_date: string
          end_date: string
          current_onboarding_step: Database["public"]["Enums"]["budget_onboarding_step_enum"]
          created_at: string
          updated_at: string
          linked_accounts: Json
          goals: Json
        }[]
      }
      get_budget_categories: {
        Args: {
          p_budget_id: string
        }
        Returns: {
          budget_id: string
          group_id: string
          group_name: string
          group_description: string
          group_is_enabled: boolean
          group_created_at: string
          group_updated_at: string
          category_id: string
          category_name: string
          category_description: string
          category_is_discretionary: boolean
          category_is_composite: boolean
          category_composite_data: Json
          category_created_at: string
          category_updated_at: string
        }[]
      }
      get_budget_plaid_items: {
        Args: {
          p_team_account_slug: string
        }
        Returns: {
          id: string
          budget_id: string
          access_token: string
          next_cursor: string
          plaid_accounts: Json
        }[]
      }
      get_budget_recurring_transactions_by_budget_id: {
        Args: {
          p_budget_id: string
        }
        Returns: {
          id: string
          user_tx_id: string
          plaid_tx_id: string
          budget_fin_account_id: string
          svend_category_group_id: string
          svend_category_group: string
          svend_category_id: string
          svend_category: string
          notes: string
          tags: Json
          fin_account_transaction_ids: string[]
          plaid_raw_data: Json
          created_at: string
          updated_at: string
        }[]
      }
      get_budget_recurring_transactions_by_team_account_slug: {
        Args: {
          p_team_account_slug: string
        }
        Returns: {
          id: string
          user_tx_id: string
          plaid_tx_id: string
          budget_fin_account_id: string
          svend_category_group_id: string
          svend_category_group: string
          svend_category_id: string
          svend_category: string
          notes: string
          tags: Json
          fin_account_transaction_ids: string[]
          plaid_raw_data: Json
          created_at: string
          updated_at: string
        }[]
      }
      get_budget_tags_by_team_account_slug: {
        Args: {
          p_team_account_slug: string
        }
        Returns: {
          id: string
          budget_id: string
          name: string
          created_at: string
        }[]
      }
      get_budget_transactions_by_team_account_slug: {
        Args: {
          p_team_account_slug: string
        }
        Returns: {
          id: string
          user_tx_id: string
          plaid_tx_id: string
          date: string
          amount: number
          iso_currency_code: string
          svend_category_group_id: string
          svend_category_group: string
          svend_category_id: string
          svend_category: string
          merchant_name: string
          payee: string
          notes: string
          budget_fin_account_id: string
          tags: Json
          attachments_storage_names: string[]
          is_composite: boolean
          composite_data: Json
        }[]
      }
      get_budget_transactions_within_range_by_budget_id: {
        Args: {
          p_budget_id: string
          p_start_date: string
          p_end_date: string
        }
        Returns: {
          id: string
          user_tx_id: string
          plaid_tx_id: string
          date: string
          amount: number
          iso_currency_code: string
          svend_category_group_id: string
          svend_category_group: string
          svend_category_id: string
          svend_category: string
          merchant_name: string
          payee: string
          notes: string
          budget_fin_account_id: string
          tags: Json
          attachments_storage_names: string[]
          is_composite: boolean
          composite_data: Json
        }[]
      }
      get_config: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_entitlement: {
        Args: {
          p_account_id: string
          p_feature: string
        }
        Returns: Json
      }
      get_upper_system_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      has_active_subscription: {
        Args: {
          target_account_id: string
        }
        Returns: boolean
      }
      has_budget_permission: {
        Args: {
          user_id: string
          budget_id: string
          permission_name: Database["public"]["Enums"]["app_permissions"]
        }
        Returns: boolean
      }
      has_more_elevated_role: {
        Args: {
          target_user_id: string
          target_account_id: string
          role_name: string
        }
        Returns: boolean
      }
      has_role_on_team: {
        Args: {
          team_account_id: string
          team_role?: string
          user_id?: string
        }
        Returns: boolean
      }
      has_same_role_hierarchy_level: {
        Args: {
          target_user_id: string
          target_account_id: string
          role_name: string
        }
        Returns: boolean
      }
      has_team_permission: {
        Args: {
          user_id: string
          team_account_id: string
          permission_name: Database["public"]["Enums"]["app_permissions"]
        }
        Returns: boolean
      }
      is_account_owner: {
        Args: {
          account_id: string
        }
        Returns: boolean
      }
      is_any_team_member: {
        Args: {
          user_id: string
        }
        Returns: boolean
      }
      is_set: {
        Args: {
          field_name: string
        }
        Returns: boolean
      }
      is_team_member: {
        Args: {
          team_account_id: string
          user_id: string
        }
        Returns: boolean
      }
      team_account_workspace: {
        Args: {
          account_slug: string
        }
        Returns: {
          id: string
          name: string
          picture_url: string
          slug: string
          role: string
          role_hierarchy_level: number
          primary_owner_user_id: string
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          permissions: Database["public"]["Enums"]["app_permissions"][]
          budget_id: string
        }[]
      }
      transfer_team_account_ownership: {
        Args: {
          target_account_id: string
          new_owner_id: string
        }
        Returns: undefined
      }
      update_account_profile: {
        Args: {
          p_user_id: string
          p_full_name: string
          p_age: number
          p_marital_status: Database["public"]["Enums"]["marital_status_enum"]
          p_dependents: number
        }
        Returns: undefined
      }
      update_feature_usage: {
        Args: {
          p_account_id: string
          p_feature: string
          p_usage: Json
        }
        Returns: undefined
      }
      update_fin_account_transaction: {
        Args: {
          p_transaction_id: string
          p_category_id?: string
          p_merchant_name?: string
          p_notes?: string
        }
        Returns: boolean
      }
      update_onboarding_transaction: {
        Args: {
          p_transaction_input: Database["public"]["CompositeTypes"]["onboarding_transaction_input"]
        }
        Returns: string[]
      }
      upsert_order: {
        Args: {
          target_account_id: string
          target_customer_id: string
          target_order_id: string
          status: Database["public"]["Enums"]["payment_status"]
          billing_provider: Database["public"]["Enums"]["billing_provider"]
          total_amount: number
          currency: string
          line_items: Json
        }
        Returns: {
          account_id: string
          billing_customer_id: number
          billing_provider: Database["public"]["Enums"]["billing_provider"]
          created_at: string
          currency: string
          id: string
          status: Database["public"]["Enums"]["payment_status"]
          total_amount: number
          updated_at: string
        }
      }
      upsert_subscription: {
        Args: {
          target_account_id: string
          target_customer_id: string
          target_subscription_id: string
          active: boolean
          status: Database["public"]["Enums"]["subscription_status"]
          billing_provider: Database["public"]["Enums"]["billing_provider"]
          cancel_at_period_end: boolean
          currency: string
          period_starts_at: string
          period_ends_at: string
          line_items: Json
          trial_starts_at?: string
          trial_ends_at?: string
        }
        Returns: {
          account_id: string
          active: boolean
          billing_customer_id: number
          billing_provider: Database["public"]["Enums"]["billing_provider"]
          cancel_at_period_end: boolean
          created_at: string
          currency: string
          id: string
          period_ends_at: string
          period_starts_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          trial_starts_at: string | null
          updated_at: string
        }
      }
    }
    Enums: {
      app_permissions:
        | "roles.manage"
        | "billing.manage"
        | "settings.manage"
        | "members.manage"
        | "invites.manage"
        | "budgets.read"
        | "budgets.write"
      billing_provider: "stripe" | "lemon-squeezy" | "paddle"
      budget_goal_debt_payment_component_enum:
        | "principal"
        | "interest"
        | "principal_interest"
      budget_goal_type_enum: "debt" | "savings" | "investment"
      budget_onboarding_step_enum:
        | "start"
        | "plaid"
        | "profile_goals"
        | "analyze_spending"
        | "analyze_spending_in_progress"
        | "budget_setup"
        | "invite_members"
        | "end"
      budget_type: "personal" | "business"
      debt_type_enum:
        | "Credit Cards"
        | "Student Loans"
        | "Personal Loans"
        | "Mortgage"
        | "Auto Loans"
        | "Business Loans"
        | "Other"
      fin_account_type_enum:
        | "depository"
        | "credit"
        | "loan"
        | "investment"
        | "other"
      fin_profile_state_enum: "florida" | "california"
      financial_goal_enum:
        | "Debt - Loans"
        | "Debt - Credit Cards"
        | "Save - Build an emergency fund"
        | "Save - Save for a house"
        | "Save - Save for retirement"
        | "Save - Save for children's education"
        | "Save - Save for vacation or a large purchase"
        | "Invest in stocks or bonds"
        | "Donate to charity or tithe regularly"
        | "Manage your money better"
      goal_timeline_enum: "6 months" | "1 year" | "3 years" | "5 years or more"
      income_level_enum:
        | "Less than $25,000"
        | "$25,000 - $50,000"
        | "$50,000 - $75,000"
        | "$75,000 - $100,000"
        | "More than $100,000"
      marital_status_enum: "Single" | "Married" | "Married with Kids" | "Other"
      monthly_contribution_enum:
        | "Less than $100"
        | "$100 - $250"
        | "$250 - $500"
        | "$500 - $1,000"
        | "More than $1,000"
      notification_channel: "in_app" | "email"
      notification_type: "info" | "warning" | "error"
      onboarding_step_enum:
        | "start"
        | "plaid"
        | "manual"
        | "profile_goals"
        | "analyze_spending"
        | "analyze_spending_in_progress"
        | "budget_setup"
        | "end"
      payment_status: "pending" | "succeeded" | "failed"
      savings_enum:
        | "Less than $1,000"
        | "$1,000 - $5,000"
        | "$5,000 - $10,000"
        | "$10,000 - $25,000"
        | "More than $25,000"
      subscription_item_type: "flat" | "per_seat" | "metered"
      subscription_status:
        | "active"
        | "trialing"
        | "past_due"
        | "canceled"
        | "unpaid"
        | "incomplete"
        | "incomplete_expired"
        | "paused"
      transaction_status_enum: "pending" | "posted"
    }
    CompositeTypes: {
      budget_plaid_account_result: {
        plaid_account_id: string | null
        budget_fin_account_id: string | null
        created_at: string | null
        updated_at: string | null
      }
      budget_recurring_transaction_input: {
        budget_fin_account_id: string | null
        user_tx_id: string | null
        plaid_tx_id: string | null
        fin_account_transaction_ids: string[] | null
        svend_category_id: string | null
        plaid_category_detailed: string | null
        plaid_category_confidence: string | null
        plaid_raw_data: Json | null
      }
      budget_transaction_input: {
        user_tx_id: string | null
        plaid_tx_id: string | null
        budget_fin_account_id: string | null
        amount: number | null
        date: string | null
        svend_category_id: string | null
        merchant_name: string | null
        payee: string | null
        iso_currency_code: string | null
        plaid_category_detailed: string | null
        plaid_category_confidence: string | null
        plaid_raw_data: Json | null
      }
      invitation: {
        email: string | null
        role: string | null
      }
      onboarding_transaction_input: {
        amount: number | null
        date: string | null
        svend_category_id: string | null
        manual_account_id: string | null
        id: string | null
        user_tx_id: string | null
        merchant_name: string | null
      }
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_insert_object: {
        Args: {
          bucketid: string
          name: string
          owner: string
          metadata: Json
        }
        Returns: undefined
      }
      extension: {
        Args: {
          name: string
        }
        Returns: string
      }
      filename: {
        Args: {
          name: string
        }
        Returns: string
      }
      foldername: {
        Args: {
          name: string
        }
        Returns: string[]
      }
      get_size_by_bucket: {
        Args: Record<PropertyKey, never>
        Returns: {
          size: number
          bucket_id: string
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          prefix_param: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
        }
        Returns: {
          key: string
          id: string
          created_at: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          bucket_id: string
          prefix_param: string
          delimiter_param: string
          max_keys?: number
          start_after?: string
          next_token?: string
        }
        Returns: {
          name: string
          id: string
          metadata: Json
          updated_at: string
        }[]
      }
      operation: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      search: {
        Args: {
          prefix: string
          bucketname: string
          limits?: number
          levels?: number
          offsets?: number
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          name: string
          id: string
          updated_at: string
          created_at: string
          last_accessed_at: string
          metadata: Json
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

