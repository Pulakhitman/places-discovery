import { LogoutButton } from "@/components/auth/LogoutButton";
import { PlacesWorkspace } from "@/components/workspace/PlacesWorkspace";
import { isAccessKeyConfigured } from "@/lib/auth/access-key";

export default function HomePage() {
  const showLogout = isAccessKeyConfigured();

  return (
    <div className="relative flex h-dvh min-h-0 flex-col overflow-hidden">
      <a href="#workspace" className="skip-link">
        Skip to workspace
      </a>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 -z-10"
        style={{ background: "var(--hero-glow)" }}
      />

      <header className="mx-auto flex w-full max-w-7xl shrink-0 items-center justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5">
        <div>
          <p className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--ink)] sm:text-3xl">
            Places Discovery
          </p>
          <p className="mt-1 max-w-xl text-sm text-[var(--muted)] sm:text-base">
            One map. Hierarchical areas. OpenStreetMap discovery, with optional
            Google Places details via official APIs only — no scraping.
          </p>
        </div>
        {showLogout ? <LogoutButton /> : null}
      </header>

      <main
        id="workspace"
        tabIndex={-1}
        className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col px-4 pb-3 outline-none sm:px-6"
      >
        <h1 className="sr-only">Places Discovery workspace</h1>
        <PlacesWorkspace />
      </main>

      <footer className="mx-auto w-full max-w-7xl shrink-0 px-4 pb-3 text-xs text-[var(--muted)] sm:px-6">
        Map data © OpenStreetMap contributors. Google content is display-only
        when enabled. No HTML scraping.
      </footer>
    </div>
  );
}
