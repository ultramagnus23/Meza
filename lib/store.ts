import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Restaurant, DashboardMetrics } from './types'

interface AppState {
  selectedRestaurantId: string | null
  setSelectedRestaurantId: (id: string | null) => void

  selectedRestaurant: Restaurant | null
  setSelectedRestaurant: (restaurant: Restaurant | null) => void

  metrics: DashboardMetrics | null
  setMetrics: (metrics: DashboardMetrics | null) => void

  lastRefresh: string
  setLastRefresh: (timestamp: string) => void

  isLoading: boolean
  setIsLoading: (loading: boolean) => void

  theme: 'dark' | 'light'
  setTheme: (theme: 'dark' | 'light') => void
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      selectedRestaurantId: null,
      setSelectedRestaurantId: (id) => set({ selectedRestaurantId: id }),

      selectedRestaurant: null,
      setSelectedRestaurant: (restaurant) => set({ selectedRestaurant: restaurant }),

      metrics: null,
      setMetrics: (metrics) => set({ metrics }),

      lastRefresh: new Date().toISOString(),
      setLastRefresh: (timestamp) => set({ lastRefresh: timestamp }),

      isLoading: false,
      setIsLoading: (loading) => set({ isLoading: loading }),

      theme: 'dark',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'experience-intelligence-storage',
    },
  ),
)
