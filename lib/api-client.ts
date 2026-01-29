export async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "An error occurred" }))
    throw new Error(error.message || `API Error: ${response.status}`)
  }

  return response.json()
}

export const api = {
  // Orders
  getOrders: (params?: { startDate?: string; endDate?: string; channel?: string }) =>
    fetchAPI<any>(`/orders?${new URLSearchParams(params as any)}`),

  // Menu
  getMenuItems: () => fetchAPI<any>("/menu"),
  getMenuEngineering: () => fetchAPI<any>("/menu/engineering"),
  updateMenuItem: (id: string, data: any) => fetchAPI(`/menu/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  // Analytics
  getDecisions: () => fetchAPI<any>("/analytics/decisions"),
  updateDecision: (id: string, status: string) =>
    fetchAPI(`/analytics/decisions/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
  getChannelMetrics: () => fetchAPI<any>("/analytics/channels"),
  getServerPerformance: () => fetchAPI<any>("/analytics/servers"),
  getCapacityMetrics: () => fetchAPI<any>("/analytics/capacity"),
  getNewDishMetrics: () => fetchAPI<any>("/analytics/new-dishes"),
  getOpportunityCost: () => fetchAPI<any>("/analytics/opportunity-cost"),
  
  // New Analytics APIs
  getBostonMatrix: (params?: { restaurantId?: string; days?: number }) =>
    fetchAPI<any>(`/analytics/boston-matrix?${new URLSearchParams(params as any)}`),
  getDemandElasticity: (params?: { restaurantId?: string; menuItemId?: string; days?: number }) =>
    fetchAPI<any>(`/analytics/demand-elasticity?${new URLSearchParams(params as any)}`),
  getTheftDetection: (params?: { restaurantId?: string; days?: number }) =>
    fetchAPI<any>(`/analytics/theft-detection?${new URLSearchParams(params as any)}`),
  getPeakHours: (params?: { restaurantId?: string; days?: number }) =>
    fetchAPI<any>(`/analytics/peak-hours?${new URLSearchParams(params as any)}`),

  // Predictions
  getSupplyForecast: (params?: { restaurantId?: string; inventoryItemId?: string; days?: number }) =>
    fetchAPI<any>(`/predictions/supply-forecast?${new URLSearchParams(params as any)}`),
  runScenarioSimulation: (data: any) =>
    fetchAPI<any>("/predictions/scenario-simulator", { method: "POST", body: JSON.stringify(data) }),

  // Aggregators
  reconcileAggregator: (data: any) =>
    fetchAPI<any>("/aggregators/reconcile", { method: "POST", body: JSON.stringify(data) }),
  syncMenu: (data: any) =>
    fetchAPI<any>("/aggregators/menu-sync", { method: "POST", body: JSON.stringify(data) }),
  getMenuSyncStatus: (params?: { restaurantId?: string }) =>
    fetchAPI<any>(`/aggregators/menu-sync?${new URLSearchParams(params as any)}`),

  // Alerts
  createAlert: (data: any) =>
    fetchAPI<any>("/alerts/create", { method: "POST", body: JSON.stringify(data) }),
  getAlerts: (params?: { restaurantId?: string; type?: string; severity?: string; unreadOnly?: boolean }) =>
    fetchAPI<any>(`/alerts/list?${new URLSearchParams(params as any)}`),

  // Reports
  getDailySummary: (params?: { restaurantId?: string; date?: string; language?: string }) =>
    fetchAPI<any>(`/reports/daily-summary?${new URLSearchParams(params as any)}`),
  getGstExport: (params?: { restaurantId?: string; year?: number; month?: number; format?: string }) =>
    fetchAPI<any>(`/reports/gst-export?${new URLSearchParams(params as any)}`),

  // Scenarios
  createScenario: (data: any) => fetchAPI("/scenarios", { method: "POST", body: JSON.stringify(data) }),
  getScenarios: () => fetchAPI<any>("/scenarios"),
}
