import { supabase } from './supabase'
import type { CameraRegion, CameraTableRegion } from './supabase'

export async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession()

  const isFormData = options?.body instanceof FormData

  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An error occurred' }))
    throw new Error(error.message || `API Error: ${response.status}`)
  }

  return response.json()
}

export const api = {
  // Restaurants
  getRestaurants: () => fetchAPI<any>('/restaurants'),
  createRestaurant: (data: { name: string; location: string; timezone?: string; max_capacity?: number }) =>
    fetchAPI<any>('/restaurants', { method: 'POST', body: JSON.stringify(data) }),
  getRestaurant: (id: string) => fetchAPI<any>(`/restaurants/${id}`),
  updateRestaurant: (id: string, data: any) =>
    fetchAPI<any>(`/restaurants/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Occupancy
  getOccupancy: (params?: { restaurantId?: string; days?: number; hour?: number }) =>
    fetchAPI<any>(`/occupancy?${new URLSearchParams(params as any)}`),
  insertOccupancy: (data: any) =>
    fetchAPI<any>('/occupancy', { method: 'POST', body: JSON.stringify(data) }),
  bulkInsertOccupancy: (data: any[]) =>
    fetchAPI<any>('/occupancy/bulk', { method: 'POST', body: JSON.stringify(data) }),

  // POS Orders
  getOrders: (params?: { restaurantId?: string; days?: number; startDate?: string; endDate?: string }) =>
    fetchAPI<any>(`/pos-orders?${new URLSearchParams(params as any)}`),
  uploadOrders: (formData: FormData) =>
    fetchAPI<any>('/pos-orders', { method: 'POST', body: formData }),
  insertOrder: (data: any) =>
    fetchAPI<any>('/pos-orders', { method: 'POST', body: JSON.stringify(data) }),

  // Environment
  getEnvironment: (params?: { restaurantId?: string; days?: number }) =>
    fetchAPI<any>(`/environment?${new URLSearchParams(params as any)}`),
  insertEnvironment: (data: any) =>
    fetchAPI<any>('/environment', { method: 'POST', body: JSON.stringify(data) }),
  bulkInsertEnvironment: (data: any[]) =>
    fetchAPI<any>('/environment/bulk', { method: 'POST', body: JSON.stringify(data) }),

  // Operational
  getOperational: (params?: { restaurantId?: string; days?: number }) =>
    fetchAPI<any>(`/operational?${new URLSearchParams(params as any)}`),
  insertOperational: (data: any) =>
    fetchAPI<any>('/operational', { method: 'POST', body: JSON.stringify(data) }),

  // Table Sessions
  getTableSessions: (params?: { restaurantId?: string; days?: number; tableNumber?: number }) =>
    fetchAPI<any>(`/table-sessions?${new URLSearchParams(params as any)}`),
  insertTableSession: (data: any) =>
    fetchAPI<any>('/table-sessions', { method: 'POST', body: JSON.stringify(data) }),

  // Revenue Analytics
  getRevenueByDay: (params?: { restaurantId?: string; days?: number }) =>
    fetchAPI<any>(`/revenue?endpoint=by-day&${new URLSearchParams(params as any)}`),
  getRevenueSummary: (params?: { restaurantId?: string; days?: number }) =>
    fetchAPI<any>(`/revenue?endpoint=summary&${new URLSearchParams(params as any)}`),
  getRevenueByHour: (params?: { restaurantId?: string; days?: number }) =>
    fetchAPI<any>(`/revenue?endpoint=by-hour&${new URLSearchParams(params as any)}`),

  // Dashboard
  getDashboard: (params?: { restaurantId?: string }) =>
    fetchAPI<any>(`/dashboard?${new URLSearchParams(params as any)}`),

  // Experiments
  getExperiments: (params?: { restaurantId?: string; status?: string }) =>
    fetchAPI<any>(`/experiments?${new URLSearchParams(params as any)}`),
  createExperiment: (data: any) =>
    fetchAPI<any>('/experiments', { method: 'POST', body: JSON.stringify(data) }),
  updateExperiment: (id: string, data: any) =>
    fetchAPI<any>(`/experiments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteExperiment: (id: string) =>
    fetchAPI<any>(`/experiments/${id}`, { method: 'DELETE' }),

  // Recommendations
  getRecommendations: (params?: { restaurantId?: string; limit?: number; implemented?: boolean }) =>
    fetchAPI<any>(`/recommendations?${new URLSearchParams(params as any)}`),
  createRecommendation: (data: any) =>
    fetchAPI<any>('/recommendations', { method: 'POST', body: JSON.stringify(data) }),
  updateRecommendation: (id: string, data: any) =>
    fetchAPI<any>(`/recommendations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  dismissRecommendation: (id: string) =>
    fetchAPI<any>(`/recommendations/${id}`, { method: 'DELETE' }),

  // Cameras
  getCameras: (params: { restaurantId: string }) =>
    fetchAPI<any>(`/cameras?${new URLSearchParams(params as any)}`),
  createCamera: (data: {
    restaurant_id: string
    name: string
    rtsp_url: string
    snapshot_interval_seconds?: number
    fps?: number
    table_regions?: CameraTableRegion[]
    queue_region?: CameraRegion | null
  }) => fetchAPI<any>('/cameras', { method: 'POST', body: JSON.stringify(data) }),
  updateCamera: (id: string, data: any) =>
    fetchAPI<any>(`/cameras/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCamera: (id: string) =>
    fetchAPI<any>(`/cameras/${id}`, { method: 'DELETE' }),

  // Auth
  getSession: () => fetchAPI<any>('/auth/session'),
  signIn: (email: string, password: string) =>
    fetchAPI<any>('/auth/signin', { method: 'POST', body: JSON.stringify({ email, password }) }),
  signUp: (email: string, password: string) =>
    fetchAPI<any>('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) }),
  signOut: () =>
    fetchAPI<any>('/auth/signout', { method: 'POST' }),
}
