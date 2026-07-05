export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          agencia: string | null
          archived: boolean
          color: string
          created_at: string
          icon: string
          id: string
          initial_balance_cents: number
          institution: string | null
          name: string
          numero_conta: string | null
          titularidade: string | null
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          agencia?: string | null
          archived?: boolean
          color?: string
          created_at?: string
          icon?: string
          id?: string
          initial_balance_cents?: number
          institution?: string | null
          name: string
          numero_conta?: string | null
          titularidade?: string | null
          type: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          agencia?: string | null
          archived?: boolean
          color?: string
          created_at?: string
          icon?: string
          id?: string
          initial_balance_cents?: number
          institution?: string | null
          name?: string
          numero_conta?: string | null
          titularidade?: string | null
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      attachments: {
        Row: {
          created_at: string
          file_name: string
          id: string
          mime_type: string
          size_bytes: number
          storage_key: string
          transaction_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          mime_type: string
          size_bytes: number
          storage_key: string
          transaction_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string
          size_bytes?: number
          storage_key?: string
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          category_id: string
          created_at: string
          id: string
          limit_cents: number
          month: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          limit_cents: number
          month: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          limit_cents?: number
          month?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string
          created_at: string
          icon: string
          id: string
          is_default: boolean
          kind: Database["public"]["Enums"]["category_kind"]
          name: string
          parent_id: string | null
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_default?: boolean
          kind: Database["public"]["Enums"]["category_kind"]
          name: string
          parent_id?: string | null
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          is_default?: boolean
          kind?: Database["public"]["Enums"]["category_kind"]
          name?: string
          parent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_cards: {
        Row: {
          account_id: string
          brand: string | null
          closing_day: number
          created_at: string
          due_day: number
          id: string
          last4: string | null
          limit_cents: number
          linked_account_id: string | null
          user_id: string
        }
        Insert: {
          account_id: string
          brand?: string | null
          closing_day: number
          created_at?: string
          due_day: number
          id?: string
          last4?: string | null
          limit_cents?: number
          linked_account_id?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          brand?: string | null
          closing_day?: number
          created_at?: string
          due_day?: number
          id?: string
          last4?: string | null
          limit_cents?: number
          linked_account_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_cards_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_cards_linked_account_id_fkey"
            columns: ["linked_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_contributions: {
        Row: {
          amount_cents: number
          created_at: string
          date: string
          goal_id: string
          id: string
          note: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          date: string
          goal_id: string
          id?: string
          note?: string | null
          type?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          date?: string
          goal_id?: string
          id?: string
          note?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_contributions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          account_id: string | null
          color: string
          contribution_frequency: string | null
          created_at: string
          deadline: string | null
          estimated_completion_date: string | null
          id: string
          name: string
          recurring_contribution_cents: number | null
          start_date: string | null
          status: Database["public"]["Enums"]["goal_status"]
          target_cents: number
          user_id: string
        }
        Insert: {
          account_id?: string | null
          color?: string
          contribution_frequency?: string | null
          created_at?: string
          deadline?: string | null
          estimated_completion_date?: string | null
          id?: string
          name: string
          recurring_contribution_cents?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["goal_status"]
          target_cents: number
          user_id: string
        }
        Update: {
          account_id?: string | null
          color?: string
          contribution_frequency?: string | null
          created_at?: string
          deadline?: string | null
          estimated_completion_date?: string | null
          id?: string
          name?: string
          recurring_contribution_cents?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["goal_status"]
          target_cents?: number
          user_id?: string
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          created_at: string
          duplicate_count: number
          file_name: string
          id: string
          imported_count: number
          source: Database["public"]["Enums"]["import_source"]
          user_id: string
        }
        Insert: {
          created_at?: string
          duplicate_count?: number
          file_name: string
          id?: string
          imported_count?: number
          source: Database["public"]["Enums"]["import_source"]
          user_id: string
        }
        Update: {
          created_at?: string
          duplicate_count?: number
          file_name?: string
          id?: string
          imported_count?: number
          source?: Database["public"]["Enums"]["import_source"]
          user_id?: string
        }
        Relationships: []
      }
      investment_entries: {
        Row: {
          amount_cents: number
          created_at: string
          date: string
          id: string
          investment_id: string
          note: string | null
          type: Database["public"]["Enums"]["investment_entry_type"]
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          date: string
          id?: string
          investment_id: string
          note?: string | null
          type: Database["public"]["Enums"]["investment_entry_type"]
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          date?: string
          id?: string
          investment_id?: string
          note?: string | null
          type?: Database["public"]["Enums"]["investment_entry_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investment_entries_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "investments"
            referencedColumns: ["id"]
          },
        ]
      }
      investments: {
        Row: {
          created_at: string
          current_value_cents: number
          id: string
          name: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_value_cents?: number
          id?: string
          name: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_value_cents?: number
          id?: string
          name?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          created_at: string
          credit_card_id: string
          due_date: string
          id: string
          paid_transaction_id: string | null
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["invoice_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          credit_card_id: string
          due_date: string
          id?: string
          paid_transaction_id?: string | null
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["invoice_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          credit_card_id?: string
          due_date?: string
          id?: string
          paid_transaction_id?: string | null
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_credit_card_id_fkey"
            columns: ["credit_card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_paid_tx_fk"
            columns: ["paid_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      net_worth_snapshots: {
        Row: {
          assets_cents: number
          created_at: string
          date: string
          id: string
          liabilities_cents: number
          user_id: string
        }
        Insert: {
          assets_cents: number
          created_at?: string
          date: string
          id?: string
          liabilities_cents: number
          user_id: string
        }
        Update: {
          assets_cents?: number
          created_at?: string
          date?: string
          id?: string
          liabilities_cents?: number
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read_at: string | null
          related_id: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          related_id?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          related_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      ofx_acctid_map: {
        Row: {
          acctid: string
          card_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          acctid: string
          card_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          acctid?: string
          card_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ofx_acctid_map_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          currency: string
          id: string
          name: string
          theme: string
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          currency?: string
          id: string
          name?: string
          theme?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          currency?: string
          id?: string
          name?: string
          theme?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      recurring_rules: {
        Row: {
          account_id: string
          active: boolean
          amount_cents: number
          category_id: string | null
          created_at: string
          description: string
          end_date: string | null
          frequency: Database["public"]["Enums"]["recurrence_frequency"]
          id: string
          interval: number
          next_run_date: string
          occurrences: number | null
          start_date: string
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          account_id: string
          active?: boolean
          amount_cents: number
          category_id?: string | null
          created_at?: string
          description: string
          end_date?: string | null
          frequency: Database["public"]["Enums"]["recurrence_frequency"]
          id?: string
          interval?: number
          next_run_date: string
          occurrences?: number | null
          start_date: string
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          account_id?: string
          active?: boolean
          amount_cents?: number
          category_id?: string | null
          created_at?: string
          description?: string
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["recurrence_frequency"]
          id?: string
          interval?: number
          next_run_date?: string
          occurrences?: number | null
          start_date?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_rules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      recurring_subscriptions: {
        Row: {
          active: boolean
          amount_cents: number
          category_id: string | null
          credit_card_id: string
          created_at: string
          description: string
          end_date: string | null
          frequency: Database["public"]["Enums"]["recurrence_frequency"]
          id: string
          interval: number
          next_billing_date: string
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          amount_cents: number
          category_id?: string | null
          credit_card_id: string
          created_at?: string
          description: string
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["recurrence_frequency"]
          id?: string
          interval?: number
          next_billing_date: string
          start_date: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          amount_cents?: number
          category_id?: string | null
          credit_card_id?: string
          created_at?: string
          description?: string
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["recurrence_frequency"]
          id?: string
          interval?: number
          next_billing_date?: string
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_subscriptions_credit_card_id_fkey"
            columns: ["credit_card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_subscriptions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_tags: {
        Row: {
          tag_id: string
          transaction_id: string
        }
        Insert: {
          tag_id: string
          transaction_id: string
        }
        Update: {
          tag_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_tags_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          amount_cents: number
          category_id: string | null
          created_at: string
          data_realizacao: string | null
          date: string
          description: string
          external_id: string | null
          fingerprint: string | null
          id: string
          import_batch_id: string | null
          installment_group_id: string | null
          installment_no: number | null
          installment_total: number | null
          invoice_id: string | null
          notes: string | null
          reconciled: boolean
          recurring_rule_id: string | null
          recurring_subscription_id: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          transfer_group_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
          user_id: string
          valor_previsto: number
          valor_realizado: number | null
        }
        Insert: {
          account_id: string
          amount_cents: number
          category_id?: string | null
          created_at?: string
          data_realizacao?: string | null
          date: string
          description: string
          external_id?: string | null
          fingerprint?: string | null
          id?: string
          import_batch_id?: string | null
          installment_group_id?: string | null
          installment_no?: number | null
          installment_total?: number | null
          invoice_id?: string | null
          notes?: string | null
          reconciled?: boolean
          recurring_rule_id?: string | null
          recurring_subscription_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          transfer_group_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id: string
          valor_previsto?: number
          valor_realizado?: number | null
        }
        Update: {
          account_id?: string
          amount_cents?: number
          category_id?: string | null
          created_at?: string
          data_realizacao?: string | null
          date?: string
          description?: string
          external_id?: string | null
          fingerprint?: string | null
          id?: string
          import_batch_id?: string | null
          installment_group_id?: string | null
          installment_no?: number | null
          installment_total?: number | null
          invoice_id?: string | null
          notes?: string | null
          reconciled?: boolean
          recurring_rule_id?: string | null
          recurring_subscription_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          transfer_group_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
          user_id?: string
          valor_previsto?: number
          valor_realizado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_recurring_rule_id_fkey"
            columns: ["recurring_rule_id"]
            isOneToOne: false
            referencedRelation: "recurring_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_recurring_subscription_id_fkey"
            columns: ["recurring_subscription_id"]
            isOneToOne: false
            referencedRelation: "recurring_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_settings: {
        Row: {
          created_at: string
          id: string
          iterations: number
          kdf: string
          salt: string
          updated_at: string
          user_id: string
          verifier: string
        }
        Insert: {
          created_at?: string
          id?: string
          iterations: number
          kdf?: string
          salt: string
          updated_at?: string
          user_id: string
          verifier: string
        }
        Update: {
          created_at?: string
          id?: string
          iterations?: number
          kdf?: string
          salt?: string
          updated_at?: string
          user_id?: string
          verifier?: string
        }
        Relationships: []
      }
      vault_items: {
        Row: {
          category: string | null
          created_at: string
          encrypted_api_key: string | null
          encrypted_notes: string | null
          encrypted_password: string | null
          encrypted_token: string | null
          expires_at: string | null
          favorite: boolean
          has_2fa: boolean
          id: string
          name: string
          recovery_email: string | null
          recovery_phone: string | null
          status: Database["public"]["Enums"]["vault_item_status"]
          tags: string[]
          type: Database["public"]["Enums"]["vault_item_type"]
          updated_at: string
          url: string | null
          user_id: string
          username: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          encrypted_api_key?: string | null
          encrypted_notes?: string | null
          encrypted_password?: string | null
          encrypted_token?: string | null
          expires_at?: string | null
          favorite?: boolean
          has_2fa?: boolean
          id?: string
          name: string
          recovery_email?: string | null
          recovery_phone?: string | null
          status?: Database["public"]["Enums"]["vault_item_status"]
          tags?: string[]
          type?: Database["public"]["Enums"]["vault_item_type"]
          updated_at?: string
          url?: string | null
          user_id: string
          username?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          encrypted_api_key?: string | null
          encrypted_notes?: string | null
          encrypted_password?: string | null
          encrypted_token?: string | null
          expires_at?: string | null
          favorite?: boolean
          has_2fa?: boolean
          id?: string
          name?: string
          recovery_email?: string | null
          recovery_phone?: string | null
          status?: Database["public"]["Enums"]["vault_item_status"]
          tags?: string[]
          type?: Database["public"]["Enums"]["vault_item_type"]
          updated_at?: string
          url?: string | null
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      vault_audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["vault_audit_action"]
          created_at: string
          id: string
          metadata: Json
          user_id: string
          vault_item_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["vault_audit_action"]
          created_at?: string
          id?: string
          metadata?: Json
          user_id: string
          vault_item_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["vault_audit_action"]
          created_at?: string
          id?: string
          metadata?: Json
          user_id?: string
          vault_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vault_audit_logs_vault_item_id_fkey"
            columns: ["vault_item_id"]
            isOneToOne: false
            referencedRelation: "vault_items"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_account_balances: {
        Args: Record<PropertyKey, never>
        Returns: { account_id: string; balance_cents: number }[]
      }
      get_invoice_totals: {
        Args: Record<PropertyKey, never>
        Returns: { invoice_id: string; total_cents: number }[]
      }
      seed_default_categories: { Args: { uid: string }; Returns: undefined }
    }
    Enums: {
      account_type: "checking" | "savings" | "cash" | "credit_card" | "investment"
      category_kind: "income" | "expense"
      goal_status: "active" | "achieved" | "archived" | "paused"
      import_source: "ofx" | "csv"
      investment_entry_type: "deposit" | "withdraw"
      invoice_status: "open" | "closed" | "paid"
      notification_type: "bill_due" | "budget_exceeded" | "goal_achieved" | "general"
      recurrence_frequency: "daily" | "weekly" | "monthly" | "yearly"
      transaction_status: "pending" | "cleared"
      transaction_type: "income" | "expense" | "transfer"
      vault_item_type:
        | "email"
        | "platform"
        | "bank"
        | "card"
        | "api"
        | "system"
        | "server"
        | "social"
        | "subscription"
        | "other"
      vault_item_status: "active" | "inactive" | "expired" | "revoked"
      vault_audit_action:
        | "created"
        | "updated"
        | "viewed_secret"
        | "copied_secret"
        | "deleted"
        | "master_password_changed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> =
  PublicSchema["Enums"][T]
