"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Send,
  Users,
  FolderTree,
  Upload,
  FileCode,
  Mail,
  ShieldBan,
  CheckCircle2,
  BarChart3,
  History,
  Settings,
  Sparkles,
} from "lucide-react";

const navigationItems = [
  { name: "Overview", href: "/", icon: LayoutDashboard },
  { name: "Campaigns", href: "/campaigns", icon: Send },
  { name: "Contacts", href: "/contacts", icon: Users },
  { name: "Contact Lists", href: "/contact-lists", icon: FolderTree },
  { name: "Imports", href: "/contacts/import", icon: Upload },
  { name: "Email Templates", href: "/templates", icon: FileCode },
  { name: "Single Email", href: "/single-email", icon: Mail },
  { name: "Suppression List", href: "/suppression", icon: ShieldBan },
  { name: "Email Validation", href: "/validation", icon: CheckCircle2 },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Activity Logs", href: "/activity-logs", icon: History },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  // Hide sidebar on public pages like login and unsubscribe
  if (pathname === "/login" || pathname.startsWith("/unsubscribe")) {
    return null;
  }

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col flex-shrink-0 min-h-screen">
      {/* Brand Logo Header */}
      <div className="h-16 px-6 border-b border-border flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Send className="w-5 h-5 -rotate-12" />
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
              EmailHub
            </span>
            <span className="block text-[10px] uppercase font-semibold text-blue-600 dark:text-blue-400 tracking-wider">
              AWS SES Deliverability
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Workspace
        </div>

        {navigationItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-primary-foreground" : "text-muted-foreground"}`} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* System Status Footer */}
      <div className="p-4 border-t border-border bg-muted/30">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-medium text-foreground">SES Engine Active</span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1 truncate">
          ujz58nc6cr4g...mail-manager
        </p>
      </div>
    </aside>
  );
}
