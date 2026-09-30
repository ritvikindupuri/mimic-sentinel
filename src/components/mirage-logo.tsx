import { useEffect, useRef } from "react";

/** Mirage mark: a faceted diamond eye with a rippling heat-haze horizon inside. */
export function MirageMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
      <path d="M32 4 58 32 32 60 6 32Z" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M32 16 46 32 32 48 18 32Z" fill="currentColor" opacity="0.22" />
      <path d="M15 29c4-3 7-3 10 0s7 3 10 0 7-3 10 0 5 2 5 2" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M17 36c3.5-2.5 6-2.5 9 0s6 2.5 9 0 6-2.5 9 0" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity="0.55" />
      <circle cx="32" cy="32" r="3.2" fill="currentColor" />
    </svg>
  );
}

/** Extruded, tilt-reactive 3D rendition of the mark. */
export function MirageLogo3D() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--ry", `${x * 40}deg`);
        el.style.setProperty("--rx", `${-y * 30}deg`);
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);
  const layers = 18;
  return (
    <div className="logo3d-stage">
      <div ref={ref} className="logo3d-tilt">
        <div className="logo3d-spin">
          {Array.from({ length: layers }).map((_, i) => (
            <div
              key={i}
              className="logo3d-layer"
              style={{
                transform: `translateZ(${(i - layers / 2) * 1.6}px)`,
                opacity: i === layers - 1 ? 1 : 0.35 + (i / layers) * 0.4,
                filter: i === layers - 1 ? "none" : "brightness(0.45)",
              }}
            >
              <MirageMark className="h-full w-full" />
            </div>
          ))}
        </div>
      </div>
      <div className="logo3d-glow" />
    </div>
  );
}
