import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wallet, Apple } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, setTeacher } from "@/lib/pocket-track/store";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";

// Only same-origin relative paths may be used as a post-sign-in destination.
function safeNext(next: string | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : undefined,
  }),
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
  const [name, setName] = useState("");
  const [className, setClassName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [appleLoading, setAppleLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Complete Apple sign-in after a full-page redirect back to this route.
  useEffect(() => {
    const pendingClass = sessionStorage.getItem("pt.pendingClass");
    if (!pendingClass) return;
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      sessionStorage.removeItem("pt.pendingClass");
      const displayName =
        (data.user.user_metadata?.full_name as string | undefined) ?? data.user.email ?? "Teacher";
      setTeacher(displayName, pendingClass);
      navigate({ to: "/dashboard" });
    });
  }, [navigate]);


  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = signIn(name, className, password);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    navigate({ to: "/dashboard" });
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
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setError("Apple sign-in failed. Please try again.");
        return;
      }
      if (result.redirected) return;
      const { data } = await supabase.auth.getUser();
      const displayName =
        (data.user?.user_metadata?.full_name as string | undefined) ??
        data.user?.email ??
        name.trim() ??
        "Teacher";
      setTeacher(displayName, className.trim());
      navigate({ to: "/dashboard" });
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
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setError("Google sign-in failed. Please try again.");
        return;
      }
      if (result.redirected) return;
      const { data } = await supabase.auth.getUser();
      const displayName =
        (data.user?.user_metadata?.full_name as string | undefined) ??
        data.user?.email ??
        name.trim() ??
        "Teacher";
      setTeacher(displayName, className.trim());
      navigate({ to: "/dashboard" });
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
        <p className="text-xs text-white/60">MVP · Local demo build</p>
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
            <h2 className="text-2xl font-semibold tracking-tight">Welcome back, teacher</h2>
            <p className="text-sm text-muted-foreground mt-1">Sign in to manage your class.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Teacher name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mr. Kariuki" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="class">Class in charge of</Label>
              <Input id="class" value={className} onChange={(e) => setClassName(e.target.value)} placeholder="e.g. Grade 6B" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
              <p className="text-xs text-muted-foreground">Demo password: <code className="font-mono">teacher123</code></p>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" size="lg">Sign in</Button>

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
