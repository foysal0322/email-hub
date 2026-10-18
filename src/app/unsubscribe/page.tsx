"use client";

import { useSearchParams } from "next/navigation";
import { CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const success = searchParams.get("success") === "true";
  const email = searchParams.get("email");
  const error = searchParams.get("error");

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl p-8 text-center space-y-4">
        {success ? (
          <>
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-foreground">You Have Been Unsubscribed</h1>
            <p className="text-xs text-muted-foreground">
              {email ? (
                <>
                  <strong className="text-foreground">{email}</strong> has been removed from all future marketing and
                  campaign distributions.
                </>
              ) : (
                "Your address has been removed from future campaign distributions."
              )}
            </p>
            <div className="pt-4 border-t border-border">
              <span className="text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Recorded in global suppression registry</span>
              </span>
            </div>
          </>
        ) : error ? (
          <>
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Unsubscribe Link Expired or Invalid</h1>
            <p className="text-xs text-muted-foreground">
              We could not verify the authenticity of this unsubscribe token. If you wish to opt-out, please contact
              support or reply directly to the email.
            </p>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Email Preference Management</h1>
            <p className="text-xs text-muted-foreground">
              Please use the direct one-click link provided in your email footer to manage your preferences.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm">Loading...</div>}>
      <UnsubscribeContent />
    </Suspense>
  );
}
