import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wallet, Apple } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithEmail, signUpWithEmail, setTeacher } from "@/lib/pocket-track/store";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";

// Only same-origin relative paths may be used as a post-sign-in destination.
function safeNext(next: string | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { next?: string } =>
    typeof s.next === "string" ? { next: s.next } : {},
  head: () => ({
    meta: [
      { title: "Sign in · Pocket Track" },
      { name: "description", content: "Teacher sign-in for Pocket Track — manage student pocket money securely." },
      { property: "og:title", content: "Sign in · Pocket Track" },
      { property: "og:description", content: "Teacher sign-in for Pocket Track." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const destination = safeNext(next);

  function goOn() {
    if (destination) {
      window.location.href = destination;
      return;
    }
    navigate({ to: "/dashboard" });
  }

  // Return here after the provider round-trip so the destination survives.
  function oauthRedirectUri() {
    const url = new URL("/auth", window.location.origin);
    if (destination) url.searchParams.set("next", destination);
    return url.toString();
  }

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [className, setClassName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Complete a social sign-in after a full-page redirect back to this route.
  useEffect(() => {
    const pendingClass = sessionStorage.getItem("pt.pendingClass");
    if (!pendingClass) return;
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      sessionStorage.removeItem("pt.pendingClass");
      const displayName =
        (data.user.user_metadata?.full_name as string | undefined) ?? data.user.email ?? "Teacher";
      setTeacher(displayName, pendingClass);
      goOn();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const result = await signUpWithEmail(email, className, password);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        if (result.needsConfirmation) {
          setInfo("Check your email to confirm your address, then sign in.");
          setMode("signin");
          return;
        }
        goOn();
        return;
      }
      const result = await signInWithEmail(email, className, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      goOn();
    } finally {
      setBusy(false);
    }
  }

  async function onApple() {
    if (!className.trim()) {
      setError("Enter the class you are in charge of before continuing with Apple");
      return;
    }
    setError(null);
    setAppleLoading(true);
    try {
      sessionStorage.setItem("pt.pendingClass", className.trim());
      const result = await lovable.auth.signInWithOAuth("apple", {
        redirect_uri: oauthRedirectUri(),
      });
      if (result.error) {
        setError("Apple sign-in failed. Please try again.");
        return;
      }
      if (result.redirected) return;
      const { data } = await supabase.auth.getUser();
      const displayName =
        (data.user?.user_metadata?.full_name as string | undefined) ?? data.user?.email ?? "Teacher";
      setTeacher(displayName, className.trim());
      goOn();
    } finally {
      setAppleLoading(false);
    }
  }

  async function onGoogle() {
    if (!className.trim()) {
      setError("Enter the class you are in charge of before continuing with Google");
      return;
    }
    setError(null);
    setGoogleLoading(true);
    try {
      sessionStorage.setItem("pt.pendingClass", className.trim());
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: oauthRedirectUri(),
      });
      if (result.error) {
        setError("Google sign-in failed. Please try again.");
        return;
      }
      if (result.redirected) return;
      const { data } = await supabase.auth.getUser();
      const displayName =
        (data.user?.user_metadata?.full_name as string | undefined) ?? data.user?.email ?? "Teacher";
      setTeacher(displayName, className.trim());
      goOn();
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex bg-brand-gradient text-primary-foreground p-12 flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
            <Wallet className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Pocket Track</span>
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Every shilling accounted for.
          </h1>
          <p className="text-white/80 max-w-md">
            Track student pocket money, reconcile M-Pesa deposits automatically, and give
            parents peace of mind — without ever touching their money.
          </p>
        </div>
        <p className="text-xs text-white/60">Your class records are saved securely to your account.</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-6">
          <div className="lg:hidden flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-brand-gradient flex items-center justify-center text-primary-foreground">
              <Wallet className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Pocket Track</span>
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              {mode === "signin" ? "Welcome back, teacher" : "Create your teacher account"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "signin" ? "Sign in to manage your class." : "Your class records stay private to you."}
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@school.ac.ke"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="class">Class in charge of</Label>
              <Input id="class" value={className} onChange={(e) => setClassName(e.target.value)} placeholder="e.g. Grade 6B" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2">
              {error}
            </div>
          )}
          {info && (
            <div className="rounded-md bg-success/10 text-success text-sm px-3 py-2">{info}</div>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>

          <p className="text-sm text-muted-foreground text-center">
            {mode === "signin" ? "New here? " : "Already have an account? "}
            <button
              type="button"
              className="text-primary font-medium hover:underline"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
                setInfo(null);
              }}
            >
              {mode === "signin" ? "Create an account" : "Sign in instead"}
            </button>
          </p>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              onClick={onGoogle}
              disabled={googleLoading || appleLoading}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
                <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z" />
                <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1z" />
                <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
              </svg>
              {googleLoading ? "Connecting…" : "Continue with Google"}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              onClick={onApple}
              disabled={appleLoading || googleLoading}
            >
              <Apple className="h-4 w-4" />
              {appleLoading ? "Connecting…" : "Continue with Apple"}
            </Button>
          </div>

        </form>
      </div>
    </div>
  );
}
