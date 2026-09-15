import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, RefreshCw, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { getIngestToken, resetIngestToken } from "@/lib/pocket-track/store";

export const Route = createFileRoute("/_app/sms")({
  head: () => ({
    meta: [
      { title: "SMS forwarding · Pocket Track" },
      {
        name: "description",
        content:
          "Set up automatic M-Pesa SMS forwarding so parent deposits credit the right student in Pocket Track.",
      },
      { property: "og:title", content: "SMS forwarding · Pocket Track" },
      {
        property: "og:description",
        content: "Connect your phone's SMS forwarding app to Pocket Track.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SmsPage,
});

function SmsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    void getIngestToken().then(setToken);
  }, []);

  const url = origin ? `${origin}/api/public/sms` : "";

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy — select the text and copy it manually.");
    }
  }

  async function reset() {
    setToken(null);
    const next = await resetIngestToken();
    setToken(next);
    toast.success("New secret key created. Update it in your forwarding app.");
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" /> SMS forwarding
        </h1>
        <p className="text-muted-foreground mt-1">
          Let an SMS forwarding app on your phone send each M-Pesa confirmation here. Deposits from a
          known parent number credit that student straight away; anything else waits in your inbox.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your forwarding details</CardTitle>
          <CardDescription>Paste these two values into your SMS forwarding app.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sms-url">Web address (POST)</Label>
            <div className="flex gap-2">
              <Input id="sms-url" readOnly value={url} />
              <Button
                type="button"
                variant="outline"
                onClick={() => copy(url, "Web address")}
                aria-label="Copy web address"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sms-token">Secret key</Label>
            <div className="flex gap-2">
              <Input id="sms-token" readOnly value={token ?? "Loading…"} />
              <Button
                type="button"
                variant="outline"
                onClick={() => token && copy(token, "Secret key")}
                aria-label="Copy secret key"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" onClick={reset} aria-label="Create a new secret key">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Keep this private. Anyone with it can add deposits to your records.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How to set it up</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>1. Install any SMS forwarding app that can send a message to a web address.</p>
          <p>
            2. Set it to forward only messages from <span className="text-foreground font-medium">MPESA</span>.
          </p>
          <p>
            3. Use the web address above with the method <span className="text-foreground font-medium">POST</span>,
            content type <span className="text-foreground font-medium">application/json</span>, and this body:
          </p>
          <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto text-foreground">
{`{ "token": "${token ?? "YOUR_SECRET_KEY"}", "message": "<the full SMS text>" }`}
          </pre>
          <p>
            4. Send a test message, then open the M-Pesa Inbox or the student's page to confirm it arrived.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
