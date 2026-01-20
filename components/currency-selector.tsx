"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getAllCurrencies, type Currency } from "@/lib/currency"
import { useCurrency } from "@/lib/hooks/use-currency"

export function CurrencySelector() {
  const { currency, setCurrency } = useCurrency()
  const currencies = getAllCurrencies()

  return (
    <Select value={currency} onValueChange={(value) => setCurrency(value as Currency)}>
      <SelectTrigger className="w-[140px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {currencies.map((curr) => (
          <SelectItem key={curr.code} value={curr.code}>
            {curr.symbol} {curr.code}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
