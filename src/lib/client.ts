// JWT-based API client and shared types (no Supabase)
import { api } from './api';

export { api };

export type Profile = {
  id: string;
  name: string;
  email?: string;
  mobile_number?: string;
  preferred_language?: string;
  address_line1?: string;
  address_line2?: string;
  district?: string;
  state?: string;
  country?: string;
  pincode?: string;
  role: 'admin' | 'super_admin' | 'farmer' | 'trader' | 'fpo' | 'corporate' | 'miller' | 'financer';
  entity_type: 'individual' | 'company';
  kyc_status: 'not_started' | 'pending' | 'verified' | 'rejected';
  kyc_verified_at?: string;
  kyc_data: Record<string, any>;
  business_name?: string;
  business_type?: 'private_limited' | 'partnership' | 'proprietorship' | 'llp';
  created_at: string;
  approval_status?: 'pending' | 'approved' | 'rejected';
  declined_reason?: string;
};

export type MandiPrice = {
  id: string;
  state: string;
  district: string;
  market: string;
  commodity: string;
  variety?: string;
  min_price: number;
  max_price: number;
  modal_price: number;
  price_date: string;
  created_at: string;
};

export type LogisticsShipment = {
  id: string;
  order_id: string;
  transporter_name?: string;
  vehicle_number?: string;
  driver_name?: string;
  driver_contact?: string;
  pickup_location: string;
  delivery_location: string;
  pickup_date?: string;
  expected_delivery_date?: string;
  actual_delivery_date?: string;
  status: 'pending' | 'in_transit' | 'delivered' | 'cancelled';
  tracking_updates: any[];
  created_at: string;
  updated_at: string;
};

export type WeatherData = {
  id: string;
  location: string;
  latitude?: number;
  longitude?: number;
  date: string;
  temperature_min?: number;
  temperature_max?: number;
  humidity?: number;
  rainfall?: number;
  wind_speed?: number;
  weather_condition?: string;
  forecast_data?: any;
  created_at: string;
};

export type QualityDeduction = {
  id: string;
  order_id: string;
  parameter_id: string;
  measured_value: number;
  standard_value: number;
  deduction_percentage: number;
  deduction_amount: number;
  remarks?: string;
  created_at: string;
};

export type QualityParameter = {
  id: string;
  commodity: string;
  param_name: string;
  unit: string;
  standard: string;
  remarks: string;
};

export type Offer = {
  id: string;
  seller_id: string;
  commodity: string;
  variety: string;
  quantity_mt: number;
  price_per_quintal: number;
  location: string;
  quality_report: Record<string, string>;
  status: 'Active' | 'Sold' | 'Inactive';
  min_trade_quantity_mt: number;
  payment_terms: 'Advance' | 'T+3 Days' | 'Against Delivery';
  offer_validity_days: number;
  delivery_location: string;
  logistics_option: 'Seller Arranged' | 'Buyer Arranged' | 'Platform Arranged';
  delivery_timeline_days: number;
  sauda_confirmation_date?: string;
  created_at: string;
  seller?: Profile;
};

export type Order = {
  id: string;
  offer_id: string;
  buyer_id: string;
  quantity_mt: number;
  status: 'Pending Approval' | 'Approved' | 'Approved - Awaiting Logistics' | 'Completed' | 'Rejected';
  final_price_per_quintal: number;
  deduction_amount: number;
  sauda_confirmation_date?: string;
  created_at: string;
  offer?: Offer;
  buyer?: Profile;
};
