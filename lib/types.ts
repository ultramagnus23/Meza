// Currency types
export type Currency = "INR" | "USD" | "EUR" | "GBP" | "AUD" | "CAD" | "SGD" | "AED"

export interface CurrencyRate {
  code: Currency
  symbol: string
  rate: number
  name: string
}

// Menu Item models
export interface MenuItem {
  id: string
  name: string
  category: string
  price: number
  costPrice: number
  prepTimeMin: number
  isActive: boolean
  createdAt: string
}

export interface MenuItemEngineering extends MenuItem {
  classification: "STAR" | "PLOWHORSE" | "PUZZLE" | "DOG"
  totalSold: number
  revenue: number
  margin: number
}

// Order models
export type Channel = "DINE_IN" | "TAKEAWAY" | "ZOMATO" | "SWIGGY" | "DIRECT_DELIVERY" | "OTHER"
export type PosType = "PETPOOJA" | "URBANPIPER" | "SQUARE" | "MANUAL" | "CSV_IMPORT"
export type UserRole = "OWNER" | "MANAGER" | "VIEWER"
export type DigestStatus = "SENT" | "FAILED" | "PENDING"

export interface Order {
  id: string
  restaurantId: string
  externalId?: string
  channel: Channel
  serverId?: string
  tableNumber?: string
  subtotal: number
  tax: number
  discount: number
  total: number
  partySize?: number
  orderedAt: string
  completedAt?: string
  createdAt: string
}

export interface OrderItem {
  id: string
  orderId: string
  menuItemId: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

// Server performance models
export interface Server {
  id: string
  restaurantId: string
  name: string
  isActive: boolean
  createdAt: string
}

export interface ServerStats extends Server {
  totalOrders: number
  totalRevenue: number
  avgCheckSize: number
  upsellScore: number
}

// Channel metrics
export interface ChannelMetrics {
  channel: Channel
  totalOrders: number
  totalRevenue: number
  avgOrderValue: number
  totalDiscount: number
  netRevenue: number
}

// Restaurant model
export interface Restaurant {
  id: string
  name: string
  city: string
  timezone: string
  currency: string
  totalSeats: number
  hoursOpen: number
  posSystem: PosType
  posWebhookSecret?: string
  createdAt: string
  updatedAt: string
}

// Item Association (Apriori)
export interface ItemAssociation {
  id: string
  restaurantId: string
  itemAId: string
  itemBId: string
  itemAName: string
  itemBName: string
  support: number
  confidence: number
  lift: number
  occurrences: number
  computedAt: string
}

// Digest
export interface DigestConfig {
  id: string
  restaurantId: string
  isEnabled: boolean
  sendTime: string
  timezone: string
  lookbackDays: number
  maxInsights: number
  includeRevenue: boolean
  includeMenu: boolean
  includeChannel: boolean
  includeServer: boolean
}

export interface DigestLog {
  id: string
  restaurantId: string
  sentAt: string
  recipientPhone: string
  status: DigestStatus
  whatsappMsgId?: string
  messageBody: string
  insightCount: number
  errorMessage?: string
}

// Daily snapshot
export interface DailySnapshot {
  id: string
  restaurantId: string
  date: string
  totalRevenue: number
  totalOrders: number
  avgOrderValue: number
  revpash: number
  topItemId?: string
  topChannelName?: string
  coverCount: number
  createdAt: string
}

// Legacy types kept for backward compatibility
export interface ScenarioChange {
  type: "menu_price" | "menu_remove" | "menu_add" | "channel_mix" | "staffing" | "hours"
  target: string
  value: unknown
  description: string
}

export interface Analytics {
  period: "day" | "week" | "month" | "quarter" | "year"
  startDate: string
  endDate: string
  totalRevenue: number
  totalOrders: number
  avgOrderValue: number
  grossMargin: number
  netMargin: number
  topItems: Array<{ itemId: string; name: string; revenue: number; orders: number }>
  topServers: Array<{ serverId: string; name: string; revenue: number; orders: number }>
  channelBreakdown: ChannelMetrics[]
}
