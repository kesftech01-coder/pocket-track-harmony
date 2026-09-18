import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, Inbox, LogOut, Wallet, MessageSquarePlus, Receipt, Smartphone, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getTeacher, signOut, getUnmatched, loadAll, subscribeToCloudChanges, setTeacher } from "@/lib/pocket-track/store";
import { useStoreSync } from "@/lib/pocket-track/use-store";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export const Route = createFileRoute("/_app")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      throw redirect({ to: "/auth", search: { next: location.href } });
    }
    return { user: data.user };
  },
  component: AppLayout,
});

function AppLayout() {
  useStoreSync();
  const navigate = useNavigate();
  const teacher = getTeacher();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const unmatchedCount = getUnmatched().filter((m) => !m.resolved).length;

  useEffect(() => {
    void loadAll();
    const unsubscribe = subscribeToCloudChanges();
    if (!getTeacher()) {
      void supabase.auth.getUser().then(({ data }) => {
        if (!data.user) return;
        const displayName =
          (data.user.user_metadata?.full_name as string | undefined) ?? data.user.email ?? "Teacher";
        setTeacher(displayName, "My class");
      });
    }
    return unsubscribe;
  }, []);

  const nav = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/bulk", label: "Bulk disbursement", icon: Receipt },
    { to: "/admin", label: "Administration", icon: Users },
    { to: "/mpesa", label: "M-Pesa Inbox", icon: Inbox, badge: unmatchedCount },
    { to: "/sms", label: "SMS forwarding", icon: Smartphone },
    { to: "/broadcast", label: "SMS broadcast", icon: Megaphone },
    { to: "/simulate", label: "Simulate SMS", icon: MessageSquarePlus },
  ] as const;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-brand-gradient flex items-center justify-center text-primary-foreground">
              <Wallet className="h-4.5 w-4.5" />
            </div>
            <div className="leading-tight">
              <div className="font-semibold tracking-tight">Pocket Track</div>
              <div className="text-xs text-muted-foreground">
                {teacher ? `${teacher.className} · ${teacher.name}` : "Loading…"}
              </div>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await signOut();
              navigate({ to: "/auth" });
            }}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
        <nav className="mx-auto max-w-7xl px-4 sm:px-6 flex gap-1 overflow-x-auto">
          {nav.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`inline-flex items-center gap-2 whitespace-nowrap px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
                {"badge" in item && item.badge ? (
                  <Badge variant="secondary" className="ml-1 bg-accent text-accent-foreground">
                    {item.badge}
                  </Badge>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
        <Outlet />
      </main>
      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        Pocket Track never touches parent funds. Money stays with the teacher's M-Pesa account.
      </footer>
    </div>
  );
}
