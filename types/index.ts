// OneDelivery v2 Types — MySQL backend (id = UUID string, not _id)

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: "customer" | "seller" | "driver" | "admin";
  profile_image?: string;
}

export interface Product {
  id: string;
  seller_id?: string;
  seller_name?: string;
  category_id?: string;
  category_name?: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  images: string[];
  status: "pending" | "approved" | "rejected";
  avg_rating: number;
  total_reviews: number;
  is_featured: boolean;
  featured_until?: string;
  created_at: string;
}

export interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  name: string;
  price: number;
  stock: number;
  images: string[];
  seller_name?: string;
  status: string;
}

export interface Cart {
  items: CartItem[];
  total: number;
  count: number;
}

export interface Address {
  id: string;
  label: string;
  full_name: string;
  street_address: string;
  city: string;
  region?: string;
  phone_number: string;
  lat?: number;
  lng?: number;
  is_default: boolean;
}

export interface OrderItem {
  id: string;
  product_id?: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

export interface Order {
  id: string;
  user_id: string;
  seller_id?: string;
  status: "awaiting_payment" | "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  subtotal: number;
  shipping_cost: number;
  tax: number;
  total_price: number;
  payment_status: "pending" | "processing" | "success" | "failed";
  payer_phone?: string;
  notes?: string;
  created_at: string;
  items?: OrderItem[];
  customer_name?: string;
  customer_phone?: string;
}

export interface RideRequest {
  id: string;
  customer_id: string;
  driver_id?: string;
  order_id?: string;
  vehicle_type: "bodaboda" | "bajaj" | "pickup" | "toyo";
  status: "searching" | "accepted" | "going_to_shop" | "picked_up" | "on_the_way" | "delivered" | "cancelled" | "no_driver";
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string;
  dropoff_lat: number;
  dropoff_lng: number;
  dropoff_address: string;
  fare: number;
  distance_km: number;
  driver_rating?: number;
  driver_lat?: number;
  driver_lng?: number;
  accepted_at?: string;
  delivered_at?: string;
  created_at: string;
  // Joined
  driver_name?: string;
  driver_image?: string;
  driver_phone?: string;
  plate_number?: string;
  driver_rating_avg?: number;
}

export interface VehicleOption {
  id: string;
  name: string;
  subtitle: string;
  icon: string;
  capacity: string;
  eta: string;
  color: string;
  fare: number;
  distanceKm: number;
  available: number;
}

export interface Conversation {
  id: string;
  type: string;
  order_id?: string;
  ride_id?: string;
  participants: string;
  unread_count: number;
  last_message?: string;
  last_message_at?: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  type: "text" | "image" | "system";
  image_url?: string;
  is_read: boolean;
  created_at: string;
  sender_name?: string;
  sender_image?: string;
  sender_role?: string;
}

export interface SellerProfile {
  id: string;
  user_id: string;
  shop_name: string;
  shop_description?: string;
  shop_phone?: string;
  shop_address?: string;
  shop_lat?: number;
  shop_lng?: number;
  shop_image?: string;
  plan: string;
  balance: number;
  total_sales: number;
  rating: number;
  is_approved: boolean;
}

export interface Package {
  id: string;
  name: string;
  type: "customer" | "seller" | "driver";
  price: number;
  duration_days: number;
  features: string[];
  is_free: boolean;
  is_active: boolean;
}

export interface Subscription {
  id: string;
  user_id: string;
  package_id: string;
  amount: number;
  status: "pending" | "active" | "failed" | "expired" | "cancelled";
  activated_at?: string;
  expires_at?: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  data?: any;
  is_read: boolean;
  created_at: string;
}
