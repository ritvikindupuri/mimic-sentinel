import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { MirageLogo3D, MirageMark } from "@/components/mirage-logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mirage — Generative Deception Honeynet" },
      { name: "description", content: "AI hosts that fool attackers and turn every keystroke into alerts and indicators." },
      { property: "og:title", content: "Mirage — Generative Deception Honeynet" },
      { property: "og:description", content: "A honeynet attackers can't fingerprint." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function useReveal() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("is-visible")),
      { threshold: 0.2 },
    );
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

const moments = [
  { k: "01", title: "It improvises.", line: "Every command answered like a real host." },
  { k: "02", title: "It watches.", line: "Each keystroke mapped to MITRE, live." },
  { k: "03", title: "It reports.", line: "Alerts and IOCs, straight to your SIEM." },
];

function Landing() {
  useReveal();
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/40 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2 font-display text-sm font-semibold tracking-tight">
            <MirageMark className="h-5 w-5 text-primary" />
            Mirage
          </div>
          <Link to="/auth" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
            Sign in
          </Link>
        </div>
      </header>

      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-12 text-center">
        <div className="hero-aurora" />
        <div className="animate-hero-in [animation-delay:100ms]">
          <MirageLogo3D />
        </div>
        <h1 className="animate-hero-in mt-4 font-display text-6xl font-semibold tracking-tighter [animation-delay:350ms] md:text-8xl">
          Mirage
        </h1>
        <p className="animate-hero-in mt-4 text-xl text-muted-foreground [animation-delay:550ms] md:text-2xl">
          The honeynet they can't see through.
        </p>
        <div className="animate-hero-in mt-10 flex items-center gap-6 [animation-delay:750ms]">
          <Link
            to="/auth"
            className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-transform duration-300 hover:scale-105"
          >
            Enter the console
          </Link>
          <a href="#how" className="text-sm text-primary transition-opacity hover:opacity-70">
            See how ›
          </a>
        </div>
        <div className="scroll-cue absolute bottom-8 h-10 w-px bg-gradient-to-b from-transparent to-muted-foreground/60" />
      </section>

      <section id="how" className="mx-auto max-w-5xl px-6 py-40">
        <h2 className="reveal text-center font-display text-4xl font-semibold tracking-tight md:text-6xl">
          Two commands.
          <br />
          <span className="text-muted-foreground">That's all it takes to spot a fake.</span>
        </h2>

        <div className="reveal mx-auto mt-24 max-w-3xl overflow-hidden rounded-2xl border border-border bg-terminal shadow-2xl [transition-delay:150ms]">
          <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-muted" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted" />
          </div>
          <pre className="whitespace-pre-wrap p-6 text-left font-mono text-sm leading-relaxed text-terminal-foreground">
            <span className="typing">{`$ systemctl status nginx | head -3
● nginx.service - A high performance web server
     Active: active (running) since Tue 09:14:02 UTC; 3 days ago`}</span>
          </pre>
          <div className="border-t border-border bg-destructive/10 px-6 py-3 font-mono text-xs text-destructive">
            ● T1082 System Discovery — logged
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-px px-6 pb-40 md:grid-cols-3">
        {moments.map((m, i) => (
          <div key={m.k} className="reveal p-8" style={{ transitionDelay: `${i * 120}ms` }}>
            <div className="font-mono text-xs text-primary">{m.k}</div>
            <h3 className="mt-4 font-display text-3xl font-semibold tracking-tight">{m.title}</h3>
            <p className="mt-2 text-muted-foreground">{m.line}</p>
          </div>
        ))}
      </section>

      <section className="flex flex-col items-center px-6 pb-40 text-center">
        <MirageMark className="reveal h-14 w-14 text-primary" />
        <h2 className="reveal mt-8 font-display text-5xl font-semibold tracking-tighter md:text-7xl">Let them in.</h2>
        <Link
          to="/auth"
          className="reveal mt-10 rounded-full bg-primary px-8 py-3 text-sm font-medium text-primary-foreground transition-transform duration-300 hover:scale-105"
        >
          Get started
        </Link>
      </section>

      <footer className="border-t border-border/40 py-8 text-center text-xs text-muted-foreground">Mirage · Generative deception</footer>
    </div>
  );
}
