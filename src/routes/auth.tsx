import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Wallet, Apple } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, setTeacher } from "@/lib/pocket-track/store";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
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
        </form>
      </div>
    </div>
  );
}
