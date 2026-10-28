"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) {
    return "/";
  }
  return raw;
}

export function UnlockForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/auth/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(data?.error ?? "Could not unlock");
        return;
      }
      router.replace(safeNextPath(searchParams.get("next")));
      router.refresh();
    } catch {
      setError("Network error — try again");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <label htmlFor="access-key" className="mb-1.5 block text-sm font-medium">
          Access key
        </label>
        <input
          id="access-key"
          name="access-key"
          type="password"
          autoComplete="current-password"
          required
          value={key}
          onChange={(event) => setKey(event.target.value)}
          className="field"
          placeholder="Enter the shared key"
          disabled={pending}
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Checking…" : "Unlock"}
      </button>
    </form>
  );
}
