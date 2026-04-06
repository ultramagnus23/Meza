"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UtensilsCrossed,
  Layers,
  Users,
  Network,
  MessageSquare,
  Calculator,
  Settings,
  ChevronRight,
} from "lucide-react";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Overview" },
  { href: "/menu", icon: UtensilsCrossed, label: "Menu Engineering" },
  { href: "/channels", icon: Layers, label: "Channels" },
  { href: "/servers", icon: Users, label: "Servers" },
  { href: "/associations", icon: Network, label: "Associations" },
  { href: "/digest", icon: MessageSquare, label: "WhatsApp Digest" },
  { href: "/scenarios", icon: Calculator, label: "Scenarios" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <h1 className="text-2xl font-bold text-orange-600">Meza</h1>
          <p className="text-xs text-slate-500 mt-1">Restaurant Intelligence</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-orange-50 text-orange-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
                {isActive && <ChevronRight className="w-3 h-3 ml-auto" />}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-200">
          <p className="text-xs text-slate-400 text-center">
            © 2024 Meza · v1.0
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
