import { PlacesWorkspace } from "@/components/workspace/PlacesWorkspace";

export default function HomePage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 -z-10"
        style={{ background: "var(--hero-glow)" }}
      />

      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <div>
          <p className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--ink)] sm:text-3xl">
            Places Discovery
          </p>
          <p className="mt-1 max-w-xl text-sm text-[var(--muted)] sm:text-base">
            One map. Hierarchical areas. OpenStreetMap discovery, with optional
            Google Places details via official APIs only.
          </p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 pb-8 sm:px-6 lg:min-h-0">
        <h1 className="sr-only">Places Discovery workspace</h1>
        <PlacesWorkspace />
      </main>

      <footer className="mx-auto w-full max-w-7xl px-4 pb-6 text-xs text-[var(--muted)] sm:px-6">
        Map data © OpenStreetMap contributors. Google content is display-only
        when enabled. No HTML scraping.
      </footer>
    </div>
  );
}
