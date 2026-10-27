"use client";

import dynamic from "next/dynamic";
import type { MapCenter } from "@/lib/location/types";
import type { OsmPlace } from "@/lib/places/types";
import type { SearchMode } from "@/lib/search/categories";
import type { MapPlaceholderPin } from "@/lib/search/placeholders";

const MapWorkspace = dynamic(
  () => import("./MapWorkspace").then((m) => m.MapWorkspace),
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
  searchMode?: SearchMode;
  boundingBox?: [number, number, number, number];
  zoom?: number;
  places?: OsmPlace[];
  placeholders?: MapPlaceholderPin[];
  selectedPlaceId?: string | null;
  onCenterChange: (center: MapCenter) => void;
  onSelectPlace?: (id: string | null) => void;
  onOpenDetails?: () => void;
};

export function MapWorkspaceLoader(props: Props) {
  return <MapWorkspace {...props} />;
}
