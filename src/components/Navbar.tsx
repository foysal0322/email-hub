"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  CheckCircle,
  AlertTriangle,
  LogOut,
  Send,
  Plus,
  RefreshCw,
  Sun,
  Moon,
  Server,
} from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [workerRunning, setWorkerRunning] = useState(false);
  const [smtpStatus, setSmtpStatus] = useState<"ok" | "testing" | "error" | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Check initial health
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  async function checkHealth() {
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      setWorkerRunning(data.queue?.isRunning || false);
      if (data.status === "healthy") {
        setSmtpStatus("ok");
      }
    } catch {
      setSmtpStatus("error");
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    }
  }

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }

  if (pathname === "/login" || pathname.startsWith("/unsubscribe")) {
    return null;
  }

  return (
    <header className="h-16 px-6 border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between">
      {/* Left: Quick Actions */}
      <div className="flex items-center gap-3">
        <Link
          href="/campaigns/new"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Campaign</span>
        </Link>
        <Link
          href="/single-email"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-background hover:bg-muted/70 text-foreground transition-all"
        >
          <Send className="w-3.5 h-3.5 text-muted-foreground" />
          <span>Quick Send</span>
        </Link>
      </div>

      {/* Right: Status Indicators & Account */}
      <div className="flex items-center gap-4">
        {/* Worker Status Badge */}
        <div
          className={`flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border ${
            workerRunning
              ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
              : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              workerRunning ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
            }`}
          />
          <span>{workerRunning ? "Worker Sending..." : "Queue Ready"}</span>
        </div>

        {/* AWS SMTP Status Indicator */}
        <Link
          href="/settings"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground hover:text-foreground transition-all"
          title="AWS Mail-Manager SMTP Status"
        >
          <Server className="w-3.5 h-3.5" />
          <span>SES 587</span>
        </Link>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          title="Toggle Theme"
        >
          {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>

        {/* Admin Avatar & Logout */}
        <div className="flex items-center gap-2 pl-2 border-l border-border">
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
            AD
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
