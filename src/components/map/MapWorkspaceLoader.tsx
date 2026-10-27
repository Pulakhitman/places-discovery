"use client";

import dynamic from "next/dynamic";
import type { MapCenter } from "@/lib/location/types";

const MapWorkspace = dynamic(
  () =>
    import("./MapWorkspace").then((m) => m.MapWorkspace),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex h-full min-h-[280px] items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface-2)] text-sm text-[var(--muted)]"
        role="status"
      >
        Loading map…
      </div>
    ),
  },
);

type Props = {
  center: MapCenter | null;
  radiusKm: number;
  boundingBox?: [number, number, number, number];
  onCenterChange: (center: MapCenter) => void;
};

export function MapWorkspaceLoader(props: Props) {
  return <MapWorkspace {...props} />;
}
