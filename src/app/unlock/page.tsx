import { Suspense } from "react";
import { redirect } from "next/navigation";
import { UnlockForm } from "@/components/auth/UnlockForm";
import { isAccessKeyConfigured } from "@/lib/auth/access-key";

export default function UnlockPage() {
  if (!isAccessKeyConfigured()) {
    redirect("/");
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 -z-10"
        style={{ background: "var(--hero-glow)" }}
      />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12 sm:px-6">
        <p className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--ink)]">
          Places Discovery
        </p>
        <h1 className="mt-3 text-xl font-semibold text-[var(--ink)]">
          Enter access key
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          This app is locked. Use the shared key Pulak assigned you. The key
          stays on the server — your browser only keeps a signed-in cookie.
        </p>
        <Suspense
          fallback={
            <p className="mt-6 text-sm text-[var(--muted)]">Loading…</p>
          }
        >
          <UnlockForm />
        </Suspense>
      </main>
    </div>
  );
}
