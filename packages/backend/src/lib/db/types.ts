// ============================================
// BeautifyPRO Database Types
// Auto-generate with: npx supabase gen types typescript --project-id <id> > src/lib/db/types.ts
// This is a comprehensive manual definition matching our schema
// ============================================

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// ============================================
// ENUM TYPES
// ============================================

export type AppointmentStatus =
  | 'reserved'
  | 'requested'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'no_show';

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'refunded';

export type PaymentMethod =
  | 'stripe_card'
  | 'stripe_twint'
  | 'stripe'
  | 'twint'
  | 'card'
  | 'cash'
  | 'invoice'
  | 'terminal'
  | 'voucher'
  | 'manual_adjustment'
  | 'pay_at_venue';

export type PaymentStatus =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export type RoleName = 'admin' | 'manager' | 'mitarbeiter' | 'kunde' | 'hq';

export type ConsentCategory = 'marketing_email' | 'marketing_sms' | 'loyalty' | 'analytics';

export type NotificationChannel = 'email' | 'sms' | 'push';

export type WaitlistStatus = 'active' | 'notified' | 'converted' | 'cancelled';

export type BlockedTimeType = 'holiday' | 'vacation' | 'sick' | 'maintenance' | 'other';

export type StockMovementType =
  | 'purchase'
  | 'sale'
  | 'adjustment'
  | 'return'
  | 'damaged'
  | 'transfer';

export type ShippingMethodType = 'shipping' | 'pickup';

// ============================================
// DATABASE TYPE DEFINITION
// ============================================

export type Database = {
  public: {
    Tables: {
      // ----------------------------------------
      // CORE TABLES
      // ----------------------------------------
      salons: {
        Row: {
          id: string;
          name: string;
          slug: string;
          address: string | null;
          zip_code: string | null;
          city: string | null;
          country: string;
          phone: string | null;
          email: string | null;
          website: string | null;
          timezone: string;
          currency: string;
          default_vat_rate: number;
          settings_json: Json | null;
          theme_config: Json | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          address?: string | null;
          zip_code?: string | null;
          city?: string | null;
          country?: string;
          phone?: string | null;
          email?: string | null;
          website?: string | null;
          timezone?: string;
          currency?: string;
          default_vat_rate?: number;
          settings_json?: Json | null;
          theme_config?: Json | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          address?: string | null;
          zip_code?: string | null;
          city?: string | null;
          country?: string;
          phone?: string | null;
          email?: string | null;
          website?: string | null;
          timezone?: string;
          currency?: string;
          default_vat_rate?: number;
          settings_json?: Json | null;
          theme_config?: Json | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };

      profiles: {
        Row: {
          id: string;
          email: string;
          first_name: string | null;
          last_name: string | null;
          display_name: string | null;
          phone: string | null;
          avatar_url: string | null;
          preferred_language: string;
          is_active: boolean;
          is_deleted: boolean;
          deleted_at: string | null;
          email_verified: boolean;
          phone_verified: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          first_name?: string | null;
          last_name?: string | null;
          display_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          preferred_language?: string;
          is_active?: boolean;
          is_deleted?: boolean;
          deleted_at?: string | null;
          email_verified?: boolean;
          phone_verified?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          first_name?: string | null;
          last_name?: string | null;
          display_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          preferred_language?: string;
          is_active?: boolean;
          is_deleted?: boolean;
          deleted_at?: string | null;
          email_verified?: boolean;
          phone_verified?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };

      user_roles: {
        Row: {
          id: string;
          profile_id: string;
          salon_id: string | null;
          role_name: RoleName;
          assigned_by: string | null;
          assigned_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          salon_id?: string | null;
          role_name: RoleName;
          assigned_by?: string | null;
          assigned_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          salon_id?: string | null;
          role_name?: RoleName;
          assigned_by?: string | null;
          assigned_at?: string;
          created_at?: string;
        };
      };

      // ----------------------------------------
      // CUSTOMER & STAFF
      // ----------------------------------------
      customers: {
        Row: {
          id: string;
          salon_id: string;
          profile_id: string | null;
          first_name: string;
          last_name: string;
          email: string | null;
          phone: string | null;
          birthday: string | null;
          preferred_contact: string;
          notes: string | null;
          hair_notes: string | null;
          accepts_marketing: boolean;
          is_active: boolean;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
          last_visit_at: string | null;
        };
        Insert: {
          id?: string;
          salon_id: string;
          profile_id?: string | null;
          first_name: string;
          last_name: string;
          email?: string | null;
          phone?: string | null;
          birthday?: string | null;
          preferred_contact?: string;
          notes?: string | null;
          hair_notes?: string | null;
          accepts_marketing?: boolean;
          is_active?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          last_visit_at?: string | null;
        };
        Update: {
          id?: string;
          salon_id?: string;
          profile_id?: string | null;
          first_name?: string;
          last_name?: string;
          email?: string | null;
          phone?: string | null;
          birthday?: string | null;
          preferred_contact?: string;
          notes?: string | null;
          hair_notes?: string | null;
          accepts_marketing?: boolean;
          is_active?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          last_visit_at?: string | null;
        };
      };

      staff: {
        Row: {
          id: string;
          salon_id: string;
          profile_id: string;
          display_name: string;
          job_title: string | null;
          bio: string | null;
          avatar_url: string | null;
          email: string | null;
          phone: string | null;
          color: string | null;
          role: 'admin' | 'manager' | 'staff' | 'hq' | null;
          employment_type: 'full_time' | 'part_time' | 'contractor' | 'apprentice' | null;
          hire_date: string | null;
          termination_date: string | null;
          specialties: string[] | null;
          specializations: string[] | null;
          is_bookable: boolean;
          booking_lead_time_minutes: number;
          max_daily_appointments: number | null;
          default_schedule: Json;
          sort_order: number;
          commission_rate: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          salon_id: string;
          profile_id?: string | null;
          display_name: string;
          job_title?: string | null;
          bio?: string | null;
          avatar_url?: string | null;
          email?: string | null;
          phone?: string | null;
          color?: string | null;
          role?: 'admin' | 'manager' | 'staff' | 'hq' | null;
          employment_type?: 'full_time' | 'part_time' | 'contractor' | 'apprentice' | null;
          hire_date?: string | null;
          termination_date?: string | null;
          specialties?: string[] | null;
          specializations?: string[] | null;
          is_bookable?: boolean;
          booking_lead_time_minutes?: number;
          max_daily_appointments?: number | null;
          default_schedule?: Json;
          sort_order?: number;
          commission_rate?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          salon_id?: string;
          profile_id?: string | null;
          display_name?: string;
          job_title?: string | null;
          bio?: string | null;
          avatar_url?: string | null;
          email?: string | null;
          phone?: string | null;
          color?: string | null;
          role?: 'admin' | 'manager' | 'staff' | 'hq' | null;
          employment_type?: 'full_time' | 'part_time' | 'contractor' | 'apprentice' | null;
          hire_date?: string | null;
          termination_date?: string | null;
          specialties?: string[] | null;
          specializations?: string[] | null;
          is_bookable?: boolean;
          booking_lead_time_minutes?: number;
          max_daily_appointments?: number | null;
          default_schedule?: Json;
          sort_order?: number;
          commission_rate?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };

      // ----------------------------------------
      // SERVICES
      // ----------------------------------------
      service_categories: {
        Row: {
          id: string;
          salon_id: string;
          name: string;
          slug: string;
          description: string | null;
          icon: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          salon_id: string;
          name: string;
          slug: string;
          description?: string | null;
          icon?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          salon_id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          icon?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };

      services: {
        Row: {
          id: string;
          salon_id: string;
          category_id: string | null;
          name: string;
          slug: string;
          description: string | null;
          short_description: string | null;
          duration_minutes: number;
          buffer_before_minutes: number;
          buffer_after_minutes: number;
          price_cents: number;
          price_from: boolean;
          has_length_variants: boolean;
          is_bookable_online: boolean;
          requires_deposit: boolean;
          deposit_amount_cents: number | null;
          deposit_required: boolean | null;
          deposit_type: string | null;
          deposit_amount: number | null;
          deposit_refundable_until: number | null;
          sort_order: number;
          image_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          salon_id: string;
          category_id?: string | null;
          name: string;
          slug: string;
          description?: string | null;
          short_description?: string | null;
          duration_minutes: number;
          buffer_before_minutes?: number;
          buffer_after_minutes?: number;
          price_cents: number;
          price_from?: boolean;
          has_length_variants?: boolean;
          is_bookable_online?: boolean;
          requires_deposit?: boolean;
          deposit_amount_cents?: number | null;
          deposit_required?: boolean | null;
          deposit_type?: string | null;
          deposit_amount?: number | null;
          deposit_refundable_until?: number | null;
          sort_order?: number;
          image_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          salon_id?: string;
          category_id?: string | null;
          name?: string;
          slug?: string;
          description?: string | null;
          short_description?: string | null;
          duration_minutes?: number;
          buffer_before_minutes?: number;
          buffer_after_minutes?: number;
          price_cents?: number;
          price_from?: boolean;
          has_length_variants?: boolean;
          is_bookable_online?: boolean;
          requires_deposit?: boolean;
          deposit_amount_cents?: number | null;
          deposit_required?: boolean | null;
          deposit_type?: string | null;
          deposit_amount?: number | null;
          deposit_refundable_until?: number | null;
          sort_order?: number;
          image_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };

      service_length_variants: {
        Row: {
          id: string;
          service_id: string;
          name: string;
          description: string | null;
          duration_minutes: number | null;
          price_cents: number;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          service_id: string;
          name: string;
          description?: string | null;
          duration_minutes?: number | null;
          price_cents: number;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          service_id?: string;
          name?: string;
          description?: string | null;
          duration_minutes?: number | null;
          price_cents?: number;
          sort_order?: number;
          created_at?: string;
        };
      };

      addon_services: {
        Row: {
          id: string;
          salon_id: string;
          name: string;
          description: string | null;
          duration_minutes: number;
          price_cents: number;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          salon_id: string;
          name: string;
          description?: string | null;
          duration_minutes?: number;
          price_cents: number;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          salon_id?: string;
          name?: string;
          description?: string | null;
          duration_minutes?: number;
          price_cents?: number;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };

      service_addon_compatibility: {
        Row: {
          id: string;
          service_id: string;
          addon_service_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          service_id: string;
          addon_service_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          service_id?: string;
          addon_service_id?: string;
          created_at?: string;
        };
      };

      // ----------------------------------------
      // APPOINTMENTS
      // ----------------------------------------
      appointments: {
        Row: {
          id: string;
          salon_id: string;
          customer_id: string | null;
          staff_id: string | null;
          start_time: string;
          end_time: string;
          duration_minutes: number;
          status: AppointmentStatus;
          booking_number: string | null;
          customer_name: string | null;
          customer_email: string | null;
          customer_phone: string | null;
          reserved_at: string | null;
          reservation_expires_at: string | null;
          confirmed_at: string | null;
          confirmed_by: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          cancellation_reason: string | null;
          completed_at: string | null;
          completed_by: string | null;
          marked_no_show_at: string | null;
          marked_no_show_by: string | null;
          subtotal_cents: number;
          discount_cents: number;
          total_cents: number;
          notes: string | null;
          customer_notes: string | null;
          internal_notes: string | null;
          booked_online: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          // Approval tracking
          is_approved: boolean;
          approved_at: string | null;
          approved_by: string | null;
          // Payment tracking
          paid_amount_cents: number;
          paid_at: string | null;
          paid_by: string | null;
          payment_notes: string | null;
        };
        Insert: {
          id?: string;
          salon_id: string;
          customer_id?: string | null;
          staff_id?: string | null;
          start_time: string;
          end_time: string;
          duration_minutes: number;
          status?: AppointmentStatus;
          booking_number?: string | null;
          customer_name?: string | null;
          customer_email?: string | null;
          customer_phone?: string | null;
          reserved_at?: string | null;
          reservation_expires_at?: string | null;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          cancellation_reason?: string | null;
          completed_at?: string | null;
          completed_by?: string | null;
          marked_no_show_at?: string | null;
          marked_no_show_by?: string | null;
          subtotal_cents?: number;
          discount_cents?: number;
          total_cents?: number;
          notes?: string | null;
          customer_notes?: string | null;
          internal_notes?: string | null;
          booked_online?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          // Approval tracking
          is_approved?: boolean;
          approved_at?: string | null;
          approved_by?: string | null;
          // Payment tracking
          paid_amount_cents?: number;
          paid_at?: string | null;
          paid_by?: string | null;
          payment_notes?: string | null;
        };
        Update: {
          id?: string;
          salon_id?: string;
          customer_id?: string | null;
          staff_id?: string | null;
          start_time?: string;
          end_time?: string;
          duration_minutes?: number;
          status?: AppointmentStatus;
          booking_number?: string | null;
          customer_name?: string | null;
          customer_email?: string | null;
          customer_phone?: string | null;
          reserved_at?: string | null;
          reservation_expires_at?: string | null;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          cancellation_reason?: string | null;
          completed_at?: string | null;
          completed_by?: string | null;
          marked_no_show_at?: string | null;
          marked_no_show_by?: string | null;
          subtotal_cents?: number;
          discount_cents?: number;
          total_cents?: number;
          notes?: string | null;
          customer_notes?: string | null;
          internal_notes?: string | null;
          booked_online?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          // Approval tracking
          is_approved?: boolean;
          approved_at?: string | null;
          approved_by?: string | null;
          // Payment tracking
          paid_amount_cents?: number;
          paid_at?: string | null;
          paid_by?: string | null;
          payment_notes?: string | null;
        };
      };

      appointment_services: {
        Row: {
          id: string;
          appointment_id: string;
          service_id: string;
          service_name: string;
          duration_minutes: number;
          price_cents: number;
          length_variant_id: string | null;
          length_variant_name: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          appointment_id: string;
          service_id: string;
          service_name: string;
          duration_minutes: number;
          price_cents: number;
          length_variant_id?: string | null;
          length_variant_name?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          appointment_id?: string;
          service_id?: string;
          service_name?: string;
          duration_minutes?: number;
          price_cents?: number;
          length_variant_id?: string | null;
          length_variant_name?: string | null;
          sort_order?: number;
          created_at?: string;
        };
      };

      booking_rules: {
        Row: {
          id: string;
          salon_id: string;
          min_notice_hours: number;
          max_advance_days: number;
          buffer_minutes: number;
          allow_same_day_booking: boolean;
          require_phone_for_booking: boolean;
          require_appointment_approval: boolean;
          allow_customer_cancellation: boolean;
          cancellation_deadline_hours: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          salon_id: string;
          min_notice_hours?: number;
          max_advance_days?: number;
          buffer_minutes?: number;
          allow_same_day_booking?: boolean;
          require_phone_for_booking?: boolean;
          require_appointment_approval?: boolean;
          allow_customer_cancellation?: boolean;
          cancellation_deadline_hours?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          salon_id?: string;
          min_notice_hours?: number;
          max_advance_days?: number;
          buffer_minutes?: number;
          allow_same_day_booking?: boolean;
          require_phone_for_booking?: boolean;
          require_appointment_approval?: boolean;
          allow_customer_cancellation?: boolean;
          cancellation_deadline_hours?: number;
          created_at?: string;
          updated_at?: string;
        };
      };

      appointment_deposits: {
        Row: {
          id: string;
          appointment_id: string;
          salon_id: string;
          customer_id: string;
          amount_cents: number;
          currency: string;
          stripe_payment_intent_id: string | null;
          stripe_charge_id: string | null;
          status: string;
          refund_amount_cents: number | null;
          refund_reason: string | null;
          refunded_at: string | null;
          refunded_by: string | null;
          paid_at: string | null;
          applied_at: string | null;
          forfeited_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          appointment_id: string;
          salon_id: string;
          customer_id: string;
          amount_cents: number;
          currency?: string;
          stripe_payment_intent_id?: string | null;
          stripe_charge_id?: string | null;
          status?: string;
          refund_amount_cents?: number | null;
          refund_reason?: string | null;
          refunded_at?: string | null;
          refunded_by?: string | null;
          paid_at?: string | null;
          applied_at?: string | null;
          forfeited_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          appointment_id?: string;
          salon_id?: string;
          customer_id?: string;
          amount_cents?: number;
          currency?: string;
          stripe_payment_intent_id?: string | null;
          stripe_charge_id?: string | null;
          status?: string;
          refund_amount_cents?: number | null;
          refund_reason?: string | null;
          refunded_at?: string | null;
          refunded_by?: string | null;
          paid_at?: string | null;
          applied_at?: string | null;
          forfeited_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      deposit_policies: {
        Row: {
          id: string;
          salon_id: string;
          name: string;
          description: string | null;
          default_type: string;
          default_amount: number;
          min_service_price_cents: number;
          full_refund_hours: number;
          partial_refund_hours: number;
          partial_refund_percent: number;
          no_show_forfeit: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          salon_id: string;
          name: string;
          description?: string | null;
          default_type?: string;
          default_amount?: number;
          min_service_price_cents?: number;
          full_refund_hours?: number;
          partial_refund_hours?: number;
          partial_refund_percent?: number;
          no_show_forfeit?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          salon_id?: string;
          name?: string;
          description?: string | null;
          default_type?: string;
          default_amount?: number;
          min_service_price_cents?: number;
          full_refund_hours?: number;
          partial_refund_hours?: number;
          partial_refund_percent?: number;
          no_show_forfeit?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };

      // ----------------------------------------
      // PRODUCTS
      // ----------------------------------------
      products: {
        Row: {
          id: string;
          salon_id: string;
          category_id: string | null;
          name: string;
          slug: string;
          description: string | null;
          short_description: string | null;
          brand: string | null;
          sku: string | null;
          price_cents: number;
          compare_at_price_cents: number | null;
          cost_price_cents: number | null;
          vat_rate: number;
          track_inventory: boolean;
          stock_quantity: number;
          low_stock_threshold: number;
          allow_backorder: boolean;
          weight_grams: number | null;
          requires_shipping: boolean;
          sort_order: number;
          is_featured: boolean;
          is_active: boolean;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          salon_id: string;
          category_id?: string | null;
          name: string;
          slug: string;
          description?: string | null;
          short_description?: string | null;
          brand?: string | null;
          sku?: string | null;
          price_cents: number;
          compare_at_price_cents?: number | null;
          cost_price_cents?: number | null;
          vat_rate?: number;
          track_inventory?: boolean;
          stock_quantity?: number;
          low_stock_threshold?: number;
          allow_backorder?: boolean;
          weight_grams?: number | null;
          requires_shipping?: boolean;
          sort_order?: number;
          is_featured?: boolean;
          is_active?: boolean;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          salon_id?: string;
          category_id?: string | null;
          name?: string;
          slug?: string;
          description?: string | null;
          short_description?: string | null;
          brand?: string | null;
          sku?: string | null;
          price_cents?: number;
          compare_at_price_cents?: number | null;
          cost_price_cents?: number | null;
          vat_rate?: number;
          track_inventory?: boolean;
          stock_quantity?: number;
          low_stock_threshold?: number;
          allow_backorder?: boolean;
          weight_grams?: number | null;
          requires_shipping?: boolean;
          sort_order?: number;
          is_featured?: boolean;
          is_active?: boolean;
          is_published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };

      product_categories: {
        Row: {
          id: string;
          salon_id: string;
          name: string;
          slug: string;
          description: string | null;
          image_url: string | null;
          parent_id: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          salon_id: string;
          name: string;
          slug: string;
          description?: string | null;
          image_url?: string | null;
          parent_id?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          salon_id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          image_url?: string | null;
          parent_id?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };

      // ----------------------------------------
      // GALLERY
      // ----------------------------------------
      gallery_categories: {
        Row: {
          id: string;
          salon_id: string;
          name: string;
          slug: string;
          description: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          salon_id: string;
          name: string;
          slug: string;
          description?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          salon_id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };

      gallery_images: {
        Row: {
          id: string;
          salon_id: string;
          category_id: string | null;
          url: string;
          alt_text: string | null;
          title: string | null;
          description: string | null;
          storage_path: string | null;
          sort_order: number;
          is_active: boolean;
          show_on_homepage: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          salon_id: string;
          category_id?: string | null;
          url: string;
          alt_text?: string | null;
          title?: string | null;
          description?: string | null;
          storage_path?: string | null;
          sort_order?: number;
          is_active?: boolean;
          show_on_homepage?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          salon_id?: string;
          category_id?: string | null;
          url?: string;
          alt_text?: string | null;
          title?: string | null;
          description?: string | null;
          storage_path?: string | null;
          sort_order?: number;
          is_active?: boolean;
          show_on_homepage?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };

      // ----------------------------------------
      // ORDERS
      // ----------------------------------------
      orders: {
        Row: {
          id: string;
          salon_id: string;
          customer_id: string | null;
          order_number: string;
          status: OrderStatus;
          payment_method: PaymentMethod;
          payment_status: PaymentStatus;
          subtotal_cents: number;
          discount_cents: number;
          shipping_cents: number;
          tax_cents: number;
          total_cents: number;
          tax_rate: number | null;
          voucher_id: string | null;
          voucher_discount_cents: number;
          shipping_method: ShippingMethodType | null;
          shipping_address: Json | null;
          pickup_date: string | null;
          pickup_time: string | null;
          tracking_number: string | null;
          shipped_at: string | null;
          delivered_at: string | null;
          customer_email: string;
          customer_name: string | null;
          customer_phone: string | null;
          customer_notes: string | null;
          internal_notes: string | null;
          source: string;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
          cancelled_at: string | null;
        };
        Insert: {
          id?: string;
          salon_id: string;
          customer_id?: string | null;
          order_number: string;
          status?: OrderStatus;
          payment_method?: PaymentMethod;
          payment_status?: PaymentStatus;
          subtotal_cents?: number;
          discount_cents?: number;
          shipping_cents?: number;
          tax_cents?: number;
          total_cents?: number;
          tax_rate?: number | null;
          voucher_id?: string | null;
          voucher_discount_cents?: number;
          shipping_method?: ShippingMethodType | null;
          shipping_address?: Json | null;
          pickup_date?: string | null;
          pickup_time?: string | null;
          tracking_number?: string | null;
          shipped_at?: string | null;
          delivered_at?: string | null;
          customer_email: string;
          customer_name?: string | null;
          customer_phone?: string | null;
          customer_notes?: string | null;
          internal_notes?: string | null;
          source?: string;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
          cancelled_at?: string | null;
        };
        Update: {
          id?: string;
          salon_id?: string;
          customer_id?: string | null;
          order_number?: string;
          status?: OrderStatus;
          payment_method?: PaymentMethod;
          payment_status?: PaymentStatus;
          subtotal_cents?: number;
          discount_cents?: number;
          shipping_cents?: number;
          tax_cents?: number;
          total_cents?: number;
          tax_rate?: number | null;
          voucher_id?: string | null;
          voucher_discount_cents?: number;
          shipping_method?: ShippingMethodType | null;
          shipping_address?: Json | null;
          pickup_date?: string | null;
          pickup_time?: string | null;
          tracking_number?: string | null;
          shipped_at?: string | null;
          delivered_at?: string | null;
          customer_email?: string;
          customer_name?: string | null;
          customer_phone?: string | null;
          customer_notes?: string | null;
          internal_notes?: string | null;
          source?: string;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
          cancelled_at?: string | null;
        };
      };

      order_items: {
        Row: {
          id: string;
          order_id: string;
          item_type: string;
          product_id: string | null;
          variant_id: string | null;
          item_name: string;
          item_sku: string | null;
          item_description: string | null;
          quantity: number;
          unit_price_cents: number;
          discount_cents: number;
          total_cents: number;
          tax_rate: number | null;
          tax_cents: number;
          voucher_id: string | null;
          voucher_recipient_email: string | null;
          voucher_recipient_name: string | null;
          voucher_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          item_type?: string;
          product_id?: string | null;
          variant_id?: string | null;
          item_name: string;
          item_sku?: string | null;
          item_description?: string | null;
          quantity?: number;
          unit_price_cents: number;
          discount_cents?: number;
          total_cents: number;
          tax_rate?: number | null;
          tax_cents?: number;
          voucher_id?: string | null;
          voucher_recipient_email?: string | null;
          voucher_recipient_name?: string | null;
          voucher_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          item_type?: string;
          product_id?: string | null;
          variant_id?: string | null;
          item_name?: string;
          item_sku?: string | null;
          item_description?: string | null;
          quantity?: number;
          unit_price_cents?: number;
          discount_cents?: number;
          total_cents?: number;
          tax_rate?: number | null;
          tax_cents?: number;
          voucher_id?: string | null;
          voucher_recipient_email?: string | null;
          voucher_recipient_name?: string | null;
          voucher_message?: string | null;
          created_at?: string;
        };
      };

      // ----------------------------------------
      // PAYMENTS
      // ----------------------------------------
      payments: {
        Row: {
          id: string;
          salon_id: string;
          reference_type: string;
          reference_id: string;
          amount_cents: number;
          currency: string;
          payment_method: PaymentMethod;
          status: PaymentStatus;
          stripe_payment_intent_id: string | null;
          stripe_charge_id: string | null;
          stripe_customer_id: string | null;
          payment_method_details: Json | null;
          error_code: string | null;
          error_message: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
          succeeded_at: string | null;
          failed_at: string | null;
        };
        Insert: {
          id?: string;
          salon_id: string;
          reference_type: string;
          reference_id: string;
          amount_cents: number;
          currency?: string;
          payment_method: PaymentMethod;
          status?: PaymentStatus;
          stripe_payment_intent_id?: string | null;
          stripe_charge_id?: string | null;
          stripe_customer_id?: string | null;
          payment_method_details?: Json | null;
          error_code?: string | null;
          error_message?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          succeeded_at?: string | null;
          failed_at?: string | null;
        };
        Update: {
          id?: string;
          salon_id?: string;
          reference_type?: string;
          reference_id?: string;
          amount_cents?: number;
          currency?: string;
          payment_method?: PaymentMethod;
          status?: PaymentStatus;
          stripe_payment_intent_id?: string | null;
          stripe_charge_id?: string | null;
          stripe_customer_id?: string | null;
          payment_method_details?: Json | null;
          error_code?: string | null;
          error_message?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
          succeeded_at?: string | null;
          failed_at?: string | null;
        };
      };

      // ----------------------------------------
      // VOUCHERS
      // ----------------------------------------
      vouchers: {
        Row: {
          id: string;
          salon_id: string;
          code: string;
          type: string;
          initial_value_cents: number;
          remaining_value_cents: number;
          valid_from: string;
          valid_until: string | null;
          is_single_use: boolean;
          purchased_by_customer_id: string | null;
          recipient_email: string | null;
          recipient_name: string | null;
          personal_message: string | null;
          is_active: boolean;
          redeemed_at: string | null;
          redeemed_by_customer_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          salon_id: string;
          code: string;
          type?: string;
          initial_value_cents: number;
          remaining_value_cents: number;
          valid_from?: string;
          valid_until?: string | null;
          is_single_use?: boolean;
          purchased_by_customer_id?: string | null;
          recipient_email?: string | null;
          recipient_name?: string | null;
          personal_message?: string | null;
          is_active?: boolean;
          redeemed_at?: string | null;
          redeemed_by_customer_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          salon_id?: string;
          code?: string;
          type?: string;
          initial_value_cents?: number;
          remaining_value_cents?: number;
          valid_from?: string;
          valid_until?: string | null;
          is_single_use?: boolean;
          purchased_by_customer_id?: string | null;
          recipient_email?: string | null;
          recipient_name?: string | null;
          personal_message?: string | null;
          is_active?: boolean;
          redeemed_at?: string | null;
          redeemed_by_customer_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      // ----------------------------------------
      // STAFF AVAILABILITY & SKILLS
      // ----------------------------------------
      staff_service_skills: {
        Row: {
          id: string;
          staff_id: string;
          service_id: string;
          skill_level: number | null;
          custom_price_cents: number | null;
          custom_duration_minutes: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          staff_id: string;
          service_id: string;
          skill_level?: number | null;
          custom_price_cents?: number | null;
          custom_duration_minutes?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          staff_id?: string;
          service_id?: string;
          skill_level?: number | null;
          custom_price_cents?: number | null;
          custom_duration_minutes?: number | null;
          created_at?: string;
        };
      };

      staff_skills: {
        Row: {
          id: string;
          staff_id: string;
          service_id: string;
          proficiency_level: 'beginner' | 'standard' | 'expert' | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          staff_id: string;
          service_id: string;
          proficiency_level?: 'beginner' | 'standard' | 'expert' | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          staff_id?: string;
          service_id?: string;
          proficiency_level?: 'beginner' | 'standard' | 'expert' | null;
          created_at?: string;
        };
      };

      staff_working_hours: {
        Row: {
          id: string;
          staff_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          is_active: boolean | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          staff_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          is_active?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          staff_id?: string;
          day_of_week?: number;
          start_time?: string;
          end_time?: string;
          is_active?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      staff_absences: {
        Row: {
          id: string;
          salon_id: string;
          staff_id: string;
          start_date: string;
          end_date: string;
          absence_type: 'vacation' | 'sick' | 'personal' | 'training' | 'other';
          status: 'pending' | 'approved' | 'rejected' | null;
          notes: string | null;
          approved_by: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          salon_id: string;
          staff_id: string;
          start_date: string;
          end_date: string;
          absence_type?: 'vacation' | 'sick' | 'personal' | 'training' | 'other';
          status?: 'pending' | 'approved' | 'rejected' | null;
          notes?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          salon_id?: string;
          staff_id?: string;
          start_date?: string;
          end_date?: string;
          absence_type?: 'vacation' | 'sick' | 'personal' | 'training' | 'other';
          status?: 'pending' | 'approved' | 'rejected' | null;
          notes?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      staff_blocks: {
        Row: {
          id: string;
          salon_id: string;
          staff_id: string;
          start_time: string;
          end_time: string;
          reason: string | null;
          is_all_day: boolean | null;
          is_recurring: boolean | null;
          recurrence_pattern: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          salon_id: string;
          staff_id: string;
          start_time: string;
          end_time: string;
          reason?: string | null;
          is_all_day?: boolean | null;
          is_recurring?: boolean | null;
          recurrence_pattern?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          salon_id?: string;
          staff_id?: string;
          start_time?: string;
          end_time?: string;
          reason?: string | null;
          is_all_day?: boolean | null;
          is_recurring?: boolean | null;
          recurrence_pattern?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      // ----------------------------------------
      // SETTINGS
      // ----------------------------------------
      settings: {
        Row: {
          id: string;
          salon_id: string | null;
          key: string;
          category: string;
          value: Json;
          value_type: string;
          description: string | null;
          is_public: boolean;
          is_editable: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          salon_id?: string | null;
          key: string;
          category?: string;
          value: Json;
          value_type?: string;
          description?: string | null;
          is_public?: boolean;
          is_editable?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          salon_id?: string | null;
          key?: string;
          category?: string;
          value?: Json;
          value_type?: string;
          description?: string | null;
          is_public?: boolean;
          is_editable?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };

      // ----------------------------------------
      // OPENING HOURS
      // ----------------------------------------
      opening_hours: {
        Row: {
          id: string;
          salon_id: string;
          day_of_week: number;
          open_time: string;
          close_time: string;
          is_open: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          salon_id: string;
          day_of_week: number;
          open_time: string;
          close_time: string;
          is_open?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          salon_id?: string;
          day_of_week?: number;
          open_time?: string;
          close_time?: string;
          is_open?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
    };

    Views: {
      v_active_customers: {
        Row: {
          id: string;
          salon_id: string;
          profile_id: string;
          first_name: string;
          last_name: string;
          full_name: string;
          email: string;
          profile_phone: string | null;
          total_appointments: number;
          last_appointment_date: string | null;
        };
      };
      v_bookable_staff: {
        Row: {
          id: string;
          salon_id: string;
          profile_id: string;
          display_name: string;
          email: string;
          profile_phone: string | null;
        };
      };
      v_published_products: {
        Row: {
          id: string;
          salon_id: string;
          name: string;
          slug: string;
          price_cents: number;
          price_chf: number;
          compare_at_price_chf: number | null;
          category_name: string | null;
          category_slug: string | null;
          primary_image_url: string | null;
          is_in_stock: boolean;
        };
      };
      v_published_gallery: {
        Row: {
          id: string;
          salon_id: string;
          category_id: string | null;
          url: string;
          alt_text: string | null;
          title: string | null;
          description: string | null;
          storage_path: string | null;
          sort_order: number;
          is_active: boolean;
          show_on_homepage: boolean;
          created_at: string;
          updated_at: string;
          category_name: string | null;
          category_slug: string | null;
          category_sort_order: number | null;
        };
      };
    };

    Functions: {
      get_user_salon_ids: {
        Args: { user_id: string };
        Returns: string[];
      };
      has_role: {
        Args: { user_id: string; check_role: RoleName; check_salon_id?: string };
        Returns: boolean;
      };
      is_staff: {
        Args: { user_id: string; check_salon_id: string };
        Returns: boolean;
      };
      is_admin: {
        Args: { user_id: string; check_salon_id: string };
        Returns: boolean;
      };
      is_slot_available: {
        Args: {
          p_salon_id: string;
          p_staff_id: string;
          p_start_time: string;
          p_end_time: string;
          p_exclude_appointment_id?: string;
        };
        Returns: boolean;
      };
      create_reservation: {
        Args: {
          p_salon_id: string;
          p_customer_id: string;
          p_staff_id: string;
          p_start_time: string;
          p_duration_minutes: number;
          p_timeout_minutes?: number;
        };
        Returns: string;
      };
      confirm_appointment: {
        Args: { p_appointment_id: string; p_confirmed_by?: string };
        Returns: boolean;
      };
      cancel_appointment: {
        Args: { p_appointment_id: string; p_cancelled_by: string; p_reason?: string };
        Returns: boolean;
      };
      validate_voucher: {
        Args: { p_salon_id: string; p_code: string };
        Returns: {
          voucher_id: string;
          remaining_value_cents: number;
          is_valid: boolean;
          invalid_reason: string | null;
        }[];
      };
    };

    Enums: {
      appointment_status: AppointmentStatus;
      order_status: OrderStatus;
      payment_method: PaymentMethod;
      payment_status: PaymentStatus;
      role_name: RoleName;
      consent_category: ConsentCategory;
      notification_channel: NotificationChannel;
      waitlist_status: WaitlistStatus;
      blocked_time_type: BlockedTimeType;
      stock_movement_type: StockMovementType;
      shipping_method_type: ShippingMethodType;
    };
  };
};

// ============================================
// HELPER TYPES
// ============================================

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];
export type Views<T extends keyof Database['public']['Views']> =
  Database['public']['Views'][T]['Row'];

// Convenience type aliases
export type Salon = Tables<'salons'>;
export type Profile = Tables<'profiles'>;
export type UserRole = Tables<'user_roles'>;
export type Customer = Tables<'customers'>;
export type Staff = Tables<'staff'>;
export type StaffAbsenceRow = Tables<'staff_absences'>;
export type StaffBlock = Tables<'staff_blocks'>;
export type StaffServiceSkill = Tables<'staff_service_skills'>;
export type StaffSkill = Tables<'staff_skills'>;
export type StaffWorkingHours = Tables<'staff_working_hours'>;
export type Service = Tables<'services'>;
export type ServiceCategory = Tables<'service_categories'>;
export type AddonServiceRow = Tables<'addon_services'>;
export type ServiceAddonCompatibility = Tables<'service_addon_compatibility'>;
export type Appointment = Tables<'appointments'>;
export type AppointmentService = Tables<'appointment_services'>;
export type BookingRulesRow = Tables<'booking_rules'>;
export type AppointmentDeposit = Tables<'appointment_deposits'>;
export type DepositPolicy = Tables<'deposit_policies'>;
export type Product = Tables<'products'>;
export type ProductCategory = Tables<'product_categories'>;
export type Order = Tables<'orders'> & {
  refunded_cents?: number | null;
  cancellation_reason?: string | null;
};
export type OrderItem = Tables<'order_items'>;
export type Payment = Tables<'payments'> & {
  order_id?: string | null;
  customer_id?: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_session_id?: string | null;
  refunded_cents?: number | null;
  processed_at?: string | null;
  processed_by?: string | null;
  failure_reason?: string | null;
  stripe_error?: string | null;
};
export type Refund = {
  id: string;
  payment_id: string;
  order_id: string;
  salon_id: string;
  amount_cents: number;
  currency: string;
  reason: string;
  status: string;
  stripe_refund_id: string | null;
  refunded_by: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at?: string | null;
};
export type ProductVariant = Record<string, any>;
export type StockMovement = Record<string, any>;
export type ScheduleOverride = Record<string, any>;
export type Voucher = Tables<'vouchers'> & {
  expires_at?: string | null;
  remaining_balance_cents?: number | null;
  redeemed_by_order_id?: string | null;
};
export type Setting = Tables<'settings'>;
export type OpeningHours = Tables<'opening_hours'>;
export type GalleryCategory = Tables<'gallery_categories'>;
export type GalleryImage = Tables<'gallery_images'>;
