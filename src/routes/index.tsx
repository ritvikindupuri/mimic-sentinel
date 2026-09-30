import { createFileRoute, Link } from "@tanstack/react-router";
import { Radar, ShieldAlert, TerminalSquare, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mirage — Generative Deception Honeynet" },
      {
        name: "description",
        content: "AI personas that answer attackers like real hosts, while every keystroke becomes SIEM alerts and IOCs.",
      },
      { property: "og:title", content: "Mirage — Generative Deception Honeynet" },
      {
        property: "og:description",
        content: "High-interaction honeynet that can't be fingerprinted like static honeypots.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: TerminalSquare, title: "Generative hosts", text: "Personas answer systemctl, iptables, kubectl and complex pipelines with coherent, stateful output." },
  { icon: ShieldAlert, title: "Live forensics", text: "Every command is scored and mapped to MITRE ATT&CK the moment it lands." },
  { icon: Fingerprint, title: "IOC extraction", text: "IPs, URLs, hashes, dropped files and stolen credentials — exportable to your SIEM." },
  { icon: Radar, title: "Sensor-ready", text: "Point real SSH, HTTP or API sensors at the intake endpoint with a per-sensor key." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 font-display text-lg font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded bg-primary font-mono text-sm text-primary-foreground">M</span>
          Mirage
        </div>
        <Button asChild variant="outline">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-16">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Generative deception</p>
        <h1 className="mt-4 max-w-3xl font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
          A honeynet that answers like the real thing.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Static honeypots get spotted in two commands. Mirage personas improvise realistic, context-aware responses on the fly —
          while the sandbox records every keystroke and turns it into alerts and indicators.
        </p>
        <div className="mt-8 flex gap-3">
          <Button asChild size="lg">
            <Link to="/auth">Open the console</Link>
          </Button>
        </div>

        <div className="mt-16 overflow-hidden rounded-lg border border-border bg-terminal font-mono text-sm shadow-2xl">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-xs text-muted-foreground">
            ops@k8s-bastion-prod-01
          </div>
          <pre className="whitespace-pre-wrap p-4 text-terminal-foreground">{`$ kubectl get pods -n payments | grep -v Running
NAME                              READY   STATUS             RESTARTS   AGE
payments-api-7c9d8f6b5-x2lq9      0/1     CrashLoopBackOff   14         3h12m
$ cat ~/.aws/credentials | head -3
[platform-admin]
aws_access_key_id = AKIA4X7Q2ZJ5EXAMPLE9`}</pre>
          <div className="border-t border-border bg-destructive/10 px-4 py-2 text-xs text-destructive">
            ALERT · high · T1552.001 Credentials In Files — attacker read cloud credentials
          </div>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-lg border border-border bg-card p-5">
              <f.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 font-display font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
