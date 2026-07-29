export interface Salon {
  id: string;
  name: string;
  slug: string;
  owner_email: string;
  owner_id: string;
  plan: string;
  created_at: string;
  business_type?: string | null;
  timezone?: string | null;
  country?: string | null;
}

export interface Appointment {
  id: string;
  salon_id: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  service_id: string | null;
  staff_id: string | null;
  date_time: string;
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed' | 'no_show';
  created_at: string;
  services?: { name: string; price: number; price_is_from?: boolean } | null;
  staff?: { name: string } | null;
  notes?: string | null;
}

export interface StaffMember {
  id: string;
  salon_id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  services: string[];
  working_hours: Record<string, { enabled: boolean; start: string; end: string }>;
  created_at?: string;
}

export type GenderRestriction = 'all' | 'female' | 'male';

export interface ServiceCategory {
  id: string;
  salon_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface Service {
  id: string;
  salon_id: string;
  name: string;
  price: number;
  duration?: number;
  duration_minutes?: number;
  description?: string;
  category?: string | null; // legacy free-text field — superseded by category_id, do not remove
  category_id?: string | null;
  sort_order?: number;
  gender_restriction?: GenderRestriction;
  price_is_from?: boolean;
}

export interface Offer {
  id: string;
  salon_id: string;
  title: string;
  description: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  valid_until: string | null;
  active: boolean;
  created_at: string;
}

export type AppointmentStatus = 'confirmed' | 'pending' | 'cancelled' | 'completed' | 'no_show';

export interface Client {
  id: string;
  salon_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  date_of_birth: string | null;
  last_visit_at: string | null;
  source: 'manual' | 'import' | 'booking';
  marketing_opt_out: boolean;
  created_at: string;
  updated_at: string;
}
