export type Restaurant = {
  id: string
  owner_id: string
  name: string
  location: string
  timezone: string
  max_capacity: number | null
  created_at: string
  updated_at: string
}

export type OccupancySnapshot = {
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

export type TableSession = {
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

export type EnvironmentSnapshot = {
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

export type OperationalSnapshot = {
  id: string
  restaurant_id: string
  timestamp: string
  staff_count: number | null
  kitchen_load: number | null
  service_time: number | null
  order_prep_time: number | null
}

export type Experiment = {
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

export type ExperimentResult = {
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

export type Recommendation = {
  id: string
  restaurant_id: string
  timestamp: string
  recommendation: string
  confidence: number | null
  expected_revenue_impact: number | null
  implemented: boolean
  implemented_at: string | null
}

export type PosOrder = {
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

export type PosOrderItem = {
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

export type DailyStats = {
  date: string
  total_revenue: number
  total_orders: number
  avg_order_value: number
  total_people: number
  avg_occupancy: number
  avg_dwell_time: number
}

export type CorrelationResult = {
  variable: string
  correlation: number
  p_value: number
  confidence: number
  effect_size: string
}

export type DashboardMetrics = {
  current_occupancy: number
  today_revenue: number
  today_orders: number
  avg_order_value: number
  avg_dwell_time: number
  avg_queue_length: number
  active_experiments: number
  pending_recommendations: number
}
