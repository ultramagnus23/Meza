"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MenuEngineering, MenuItem } from "@/components/menu-engineering"; 

// Sample data
const SAMPLE_DATA: MenuItem[] = [
  { name: "Burger", price: 15, cost: 5, sold: 120, category: "Main" },
  { name: "Fries", price: 6, cost: 1, sold: 200, category: "Side" },
  { name: "Steak", price: 45, cost: 25, sold: 30, category: "Main" },
  { name: "Salad", price: 12, cost: 4, sold: 40, category: "Starter" },
  { name: "Soda", price: 3, cost: 0.5, sold: 300, category: "Drink" },
  { name: "Soup", price: 8, cost: 3, sold: 20, category: "Starter" },
];

export default function RestaurantAnalytics() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
      </div>
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="menu-engineering">Menu Engineering</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$45,231.89</div>
                <p className="text-xs text-muted-foreground">+20.1% from last month</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{SAMPLE_DATA.length}</div>
                <p className="text-xs text-muted-foreground">Menu items currently tracked</p>
              </CardContent>
            </Card>
            {/* Added a placeholder card so the grid looks balanced */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {SAMPLE_DATA.reduce((acc, item) => acc + item.sold, 0)}
                </div>
                <p className="text-xs text-muted-foreground">Units sold this period</p>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Sales Overview</CardTitle>
              </CardHeader>
              <CardContent className="pl-2">
                <div className="h-[200px] w-full flex items-center justify-center bg-slate-50 rounded-md border border-dashed">
                  <p className="text-sm text-muted-foreground">Overview Chart Placeholder</p>
                </div>
              </CardContent>
            </Card>
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[200px] w-full flex items-center justify-center bg-slate-50 rounded-md border border-dashed">
                  <p className="text-sm text-muted-foreground">Recent Sales List Placeholder</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="menu-engineering" className="space-y-4">
          <MenuEngineering items={SAMPLE_DATA} />
        </TabsContent>
      </Tabs>
    </div>
  );
}