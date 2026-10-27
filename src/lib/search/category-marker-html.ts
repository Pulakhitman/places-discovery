import type { PlaceCategoryId } from "./categories";

/** Inline SVG paths matching `CategoryIcon` for Leaflet DivIcons. */
const PATHS: Record<PlaceCategoryId, string> = {
  parks: `
    <path d="M12 22v-7"/>
    <path d="M8 22h8"/>
    <path d="M12 15c-4 0-6-3-6-6 2 0 4 1 6 3 2-2 4-3 6-3 0 3-2 6-6 6Z"/>
    <path d="M12 9c-1.5-2-2-4-1.5-6 2 .5 3.5 2.5 3.5 5"/>
  `,
  playgrounds: `
    <circle cx="8" cy="6" r="2"/>
    <path d="M8 8v4l-3 6"/>
    <path d="M8 12l3 2 2 6"/>
    <path d="M14 4h6v4h-4l-2 4"/>
  `,
  shops: `
    <path d="M4 9h16l-1 11H5L4 9Z"/>
    <path d="M4 9 6 4h12l2 5"/>
    <path d="M9 13v4"/>
    <path d="M15 13v4"/>
  `,
  supermarkets: `
    <path d="M3 6h2l2.5 11h11l2-8H7"/>
    <circle cx="9" cy="20" r="1.5"/>
    <circle cx="17" cy="20" r="1.5"/>
  `,
  cafes: `
    <path d="M5 9h10v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9Z"/>
    <path d="M15 10h2a2.5 2.5 0 0 1 0 5h-2"/>
    <path d="M8 4v2"/>
    <path d="M11 3v3"/>
  `,
  restaurants: `
    <path d="M8 3v8a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3"/>
    <path d="M10 13v8"/>
    <path d="M16 3v18"/>
    <path d="M16 8h3"/>
  `,
  libraries: `
    <path d="M4 19V5a1 1 0 0 1 1-1h3v15H5a1 1 0 0 0-1 1Z"/>
    <path d="M9 4h6v15H9z"/>
    <path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 0-1 1h-3V4Z"/>
  `,
  schools: `
    <path d="M3 10 12 5l9 5-9 5-9-5Z"/>
    <path d="M7 12v5c0 1 2.5 3 5 3s5-2 5-3v-5"/>
    <path d="M21 10v6"/>
  `,
  custom: `
    <path d="M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10Z"/>
    <circle cx="12" cy="11" r="2"/>
  `,
};

export function categoryMarkerHtml(category: PlaceCategoryId): string {
  const paths = PATHS[category] ?? PATHS.custom;
  return `<span class="map-ph-pin" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${paths}</svg></span>`;
}
