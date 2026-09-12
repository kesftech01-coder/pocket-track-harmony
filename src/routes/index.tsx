import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BellRing,
  Check,
  FileClock,
  LockKeyhole,
  MessageSquareText,
  Phone,
  ReceiptText,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import teacherImage from "@/assets/pocket-track-teacher.jpg";

const canonicalUrl = "https://pocket-track-harmony.lovable.app/";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pocket Track — Student Pocket Money Records" },
      {
        name: "description",
        content:
          "Help teachers track student pocket money, reconcile M-Pesa deposits, and keep clear disbursement records.",
      },
      { property: "og:title", content: "Pocket Track — Student Pocket Money Records" },
      {
        property: "og:description",
        content: "Clear student balances and M-Pesa records for every teacher-managed class.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: canonicalUrl },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: canonicalUrl }],
  }),
  component: LandingPage,
});

const workflow = [
  {
    icon: Users,
    step: "01",
    title: "Register your students",
    description: "Add each learner's admission number, class, and linked parent phone number.",
  },
  {
    icon: MessageSquareText,
    step: "02",
    title: "Receive an M-Pesa message",
    description: "Pocket Track matches the sender's phone number to the right student record.",
  },
  {
    icon: ReceiptText,
    step: "03",
    title: "Keep every record clear",
    description: "Balances and disbursements stay together, ready for a quick review at any time.",
  },
];

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="absolute inset-x-0 top-0 z-20 border-b border-primary-foreground/15">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5 text-primary-foreground" aria-label="Pocket Track home">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-foreground/12 ring-1 ring-primary-foreground/20">
              <Wallet className="h-4.5 w-4.5" />
            </span>
            <span className="text-base font-semibold">Pocket Track</span>
          </Link>
          <Button asChild variant="outline" className="border-primary-foreground/30 bg-primary-foreground/8 text-primary-foreground shadow-none hover:bg-primary-foreground hover:text-primary">
            <Link to="/auth">Teacher sign in</Link>
          </Button>
        </div>
      </header>

      <main>
        <section className="relative flex min-h-[88svh] items-end overflow-hidden bg-primary">
          <img
            src={teacherImage}
            alt="Teacher reviewing student pocket money records on her phone"
            width={1600}
            height={1000}
            className="absolute inset-0 h-full w-full object-cover object-[67%_center]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--primary)_0%,color-mix(in_oklch,var(--primary)_92%,transparent)_40%,color-mix(in_oklch,var(--primary)_25%,transparent)_72%,color-mix(in_oklch,var(--primary)_8%,transparent)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(0deg,color-mix(in_oklch,var(--primary)_70%,transparent)_0%,transparent_55%)]" />

          <div className="relative mx-auto w-full max-w-7xl px-4 pb-14 pt-32 sm:px-6 sm:pb-18 lg:px-8 lg:pb-20">
            <div className="max-w-2xl text-primary-foreground">
              <div className="mb-5 flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="h-4 w-4 text-accent" />
                <span>Built for teachers managing student pocket money</span>
              </div>
              <h1 className="max-w-xl text-4xl font-semibold leading-[1.08] sm:text-5xl lg:text-6xl">
                Every shilling accounted for.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-primary-foreground/80 sm:text-lg">
                Track student balances, match parent M-Pesa deposits, and record disbursements—without Pocket Track ever touching the money.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild size="lg" className="bg-accent text-accent-foreground shadow-soft hover:bg-accent/90">
                  <Link to="/auth">
                    Sign in as a teacher <ArrowRight />
                  </Link>
                </Button>
                <div className="flex items-center gap-2 text-sm text-primary-foreground/75">
                  <LockKeyhole className="h-4 w-4" /> Money stays in your M-Pesa account
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b bg-card">
          <div className="mx-auto grid max-w-7xl divide-y px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6 lg:px-8">
            <TrustPoint icon={Phone} title="Phone-linked deposits" text="Match senders to student records" />
            <TrustPoint icon={BellRing} title="Unmatched alerts" text="Place unknown deposits correctly" />
            <TrustPoint icon={FileClock} title="Term-long records" text="Review each disbursement clearly" />
          </div>
        </section>

        <section className="py-18 sm:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-primary">A simpler daily routine</p>
              <h2 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">From parent deposit to student balance</h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                Keep the class ledger organised while the actual funds remain safely in the teacher's account.
              </p>
            </div>

            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {workflow.map(({ icon: Icon, step, title, description }) => (
                <article key={step} className="border-t-2 border-primary pt-6">
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-md bg-secondary text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-semibold text-muted-foreground">{step}</span>
                  </div>
                  <h3 className="mt-7 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-secondary py-18 sm:py-24">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_0.8fr] lg:items-center lg:px-8">
            <div>
              <p className="text-sm font-semibold text-primary">Clear by design</p>
              <h2 className="mt-2 max-w-xl text-3xl font-semibold leading-tight sm:text-4xl">Know where every student stands</h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
                One place for student details, current balances, and the full history of money issued throughout the term.
              </p>
            </div>
            <ul className="grid gap-4 text-sm">
              {["Searchable student records", "Single and bulk disbursements", "Automatic matching by parent phone", "Manual placement for unknown senders"].map((item) => (
                <li key={item} className="flex items-center gap-3 border-b border-primary/15 pb-4">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <span className="font-medium">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="bg-primary py-14 text-primary-foreground">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 sm:px-6 md:flex-row md:items-center lg:px-8">
            <div>
              <h2 className="text-2xl font-semibold">Ready to manage your class?</h2>
              <p className="mt-1 text-sm text-primary-foreground/70">Sign in and see every student's record in one place.</p>
            </div>
            <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/auth">Teacher sign in <ArrowRight /></Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="bg-card py-7">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 font-semibold text-foreground"><Wallet className="h-4 w-4 text-primary" /> Pocket Track</div>
          <p>Records the movement of pocket money. Never holds or transfers parent funds.</p>
        </div>
      </footer>
    </div>
  );
}

function TrustPoint({ icon: Icon, title, text }: { icon: React.ComponentType<{ className?: string }>; title: string; text: string }) {
  return (
    <div className="flex items-center gap-3 py-6 sm:px-6 first:sm:pl-0 last:sm:pr-0">
      <Icon className="h-5 w-5 shrink-0 text-primary" />
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{text}</div>
      </div>
    </div>
  );
}