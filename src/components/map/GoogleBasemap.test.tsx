// @vitest-environment jsdom

import type { ComponentProps } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MapCenter } from "@/lib/location/types";
import type { OsmPlace } from "@/lib/places/types";
import { categoryMarkerHtml } from "@/lib/search/category-marker-html";
import { buildMapPlaceholders } from "@/lib/search/placeholders";
import { GoogleBasemap } from "./GoogleBasemap";

type Props = ComponentProps<typeof GoogleBasemap>;
type GoogleMaps = NonNullable<Window["google"]>;
type GoogleMap = InstanceType<GoogleMaps["maps"]["Map"]>;
type GoogleOverlay = InstanceType<GoogleMaps["maps"]["OverlayView"]>;

function createGoogleMock() {
  const maps: MockMap[] = [];
  const markers: MockOverlay[] = [];
  const shapes: MockShape[] = [];

  class MockMap {
    setCenter = vi.fn();
    panTo = vi.fn();
    setZoom = vi.fn();
    getCenter = vi.fn(() => undefined);
    getZoom = vi.fn(() => undefined);
    fitBounds = vi.fn();
    panes = {
      markerLayer: document.createElement("div"),
      overlayMouseTarget: document.createElement("div"),
    };

    constructor(host: HTMLElement, readonly options: Record<string, unknown>) {
      host.append(this.panes.markerLayer, this.panes.overlayMouseTarget);
      maps.push(this);
    }
  }

  class MockOverlay {
    static preventMapHitsAndGesturesFrom = vi.fn();
    onAdd = () => {};
    draw = () => {};
    onRemove = () => {};
    map: GoogleMap | null = null;
    project = vi.fn<(position: MapCenter) => { x: number; y: number } | null>(
      (position) => ({ x: position.lng * 10, y: position.lat * 10 }),
    );
    getProjection = vi.fn<GoogleOverlay["getProjection"]>(() => ({
      fromLatLngToDivPixel: this.project,
    }));
    getPanes = () => maps.find((map) => map === this.map)?.panes ?? null;
    setMap = vi.fn((map: GoogleMap | null) => {
      this.map = map;
      if (map) {
        this.onAdd();
        this.draw();
      } else {
        this.onRemove();
      }
    });

    constructor() {
      markers.push(this);
    }
  }

  class MockShape {
    map: GoogleMap | null;
    setMap = vi.fn((map: GoogleMap | null) => {
      this.map = map;
    });

    constructor(
      readonly kind: "circle" | "rectangle",
      readonly options: Record<string, unknown>,
    ) {
      this.map = options.map as GoogleMap;
      shapes.push(this);
    }
  }

  class MockCircle extends MockShape {
    constructor(options: Record<string, unknown>) {
      super("circle", options);
    }
  }

  class MockRectangle extends MockShape {
    constructor(options: Record<string, unknown>) {
      super("rectangle", options);
    }
  }

  const google = {
    maps: {
      Map: MockMap,
      Circle: MockCircle,
      Rectangle: MockRectangle,
      OverlayView: MockOverlay,
      event: {
        addListener: vi.fn<GoogleMaps["maps"]["event"]["addListener"]>(),
        clearInstanceListeners: vi.fn(),
      },
    },
  } satisfies GoogleMaps;
  return { google, maps, markers, shapes };
}

const center = { lat: 51.5, lng: -0.12 };
const placeholders = buildMapPlaceholders(center, "cafes", 5);
const place: OsmPlace = {
  id: "osm:node/1",
  source: "osm",
  osmType: "node",
  osmId: 1,
  name: "Central Café",
  isUnnamed: false,
  categoryId: "cafes",
  categoryLabel: "Cafés",
  lat: 51.51,
  lng: -0.1,
  distanceM: 100,
  address: "10 Main Street",
  tags: {},
  sources: { osm: true },
};

function makeProps(overrides: Partial<Props> = {}): Props {
  return {
    apiKey: "test-browser-key",
    center,
    zoom: 12,
    radiusKm: 5,
    searchMode: "radius",
    places: [],
    placeholders,
    selectedPlaceId: null,
    onCenterChange: vi.fn(),
    onSelectPlace: vi.fn(),
    onOpenDetails: vi.fn(),
    ...overrides,
  };
}

function normalizedMarkerHtml(...args: Parameters<typeof categoryMarkerHtml>) {
  const host = document.createElement("div");
  host.innerHTML = categoryMarkerHtml(...args);
  return host.innerHTML;
}

let mock: ReturnType<typeof createGoogleMock>;

beforeEach(() => {
  mock = createGoogleMock();
  window.google = mock.google;
});

afterEach(() => {
  cleanup();
  delete window.google;
  delete window.__pdGoogleMapsPromise;
  document.querySelectorAll("script[data-pd-google-maps]").forEach((script) => {
    script.remove();
  });
});

describe("GoogleBasemap", () => {
  it("renders permanent, noninteractive sample pins with the shared OSM icons", async () => {
    const props = makeProps();
    render(<GoogleBasemap {...props} />);
    await waitFor(() => expect(mock.markers).toHaveLength(placeholders.length));

    const pins = mock.maps[0].panes.markerLayer.children;
    expect(pins).toHaveLength(placeholders.length);
    placeholders.forEach((pin, index) => {
      const node = pins[index] as HTMLElement;
      expect(node.tagName).toBe("DIV");
      expect(node.style.pointerEvents).toBe("none");
      expect(node.getAttribute("tabindex")).toBeNull();
      expect(node.style.zIndex).toBe("200");
      expect(node.firstElementChild?.outerHTML).toBe(
        normalizedMarkerHtml(pin.category, "placeholder"),
      );
      expect(node.querySelector("[role=tooltip]")?.textContent).toBe(
        `${pin.title} · sample`,
      );
      expect(mock.markers[index].project).toHaveBeenCalledWith({
        lat: pin.lat,
        lng: pin.lng,
      });
      fireEvent.click(node);
    });
    expect(screen.getAllByRole("tooltip")).toHaveLength(placeholders.length);
    expect(screen.queryByRole("button")).toBeNull();
    expect(props.onSelectPlace).not.toHaveBeenCalled();
    expect(props.onOpenDetails).not.toHaveBeenCalled();
    expect(mock.google.maps.OverlayView.preventMapHitsAndGesturesFrom).not.toHaveBeenCalled();
    const legend = screen.getByText(/Google Maps basemap/);
    expect(legend.textContent).toContain("Dashed icons = sample cafes");
    expect(legend.textContent).toContain("© Google");
    expect(legend.className).toContain("bottom-8");
    expect(mock.shapes[0].options.radius).toBe(5000);
  });

  it("replaces samples with results and restores them when results are removed", async () => {
    const props = makeProps();
    const view = render(<GoogleBasemap {...props} />);
    await waitFor(() => expect(mock.markers).toHaveLength(placeholders.length));
    const samples = [...mock.markers];

    view.rerender(<GoogleBasemap {...props} places={[place]} />);
    await screen.findByRole("button", { name: place.name });
    expect(mock.maps[0].panes.markerLayer.children).toHaveLength(0);
    expect(screen.queryByText(/· sample$/)).toBeNull();
    samples.forEach((sample) => expect(sample.setMap).toHaveBeenLastCalledWith(null));
    const result = mock.markers.at(-1)!;

    view.rerender(<GoogleBasemap {...props} />);
    expect(screen.getAllByRole("tooltip")).toHaveLength(placeholders.length);
    expect(screen.queryByRole("button", { name: place.name })).toBeNull();
    expect(result.setMap).toHaveBeenLastCalledWith(null);
    expect(mock.maps).toHaveLength(1);
  });

  it("selects result pins without changing center or auto-opening details", async () => {
    const props = makeProps({ places: [place] });
    render(<GoogleBasemap {...props} />);
    const pin = await screen.findByRole("button", { name: place.name });
    const tooltip = pin.querySelector<HTMLSpanElement>("[role=tooltip]")!;
    expect(pin.firstElementChild?.outerHTML).toBe(
      normalizedMarkerHtml(place.categoryId, "result"),
    );
    expect(pin.getAttribute("aria-pressed")).toBe("false");
    expect(pin.style.width).toBe("30px");
    expect(pin.style.zIndex).toBe("400");
    expect(tooltip.hidden).toBe(true);

    fireEvent.mouseEnter(pin);
    expect(tooltip.hidden).toBe(false);
    fireEvent.mouseLeave(pin);
    expect(tooltip.hidden).toBe(true);
    fireEvent.focus(pin);
    expect(tooltip.hidden).toBe(false);
    fireEvent.blur(pin);
    expect(tooltip.hidden).toBe(true);

    const bubbledClick = vi.fn();
    mock.maps[0].panes.overlayMouseTarget.addEventListener("click", bubbledClick);
    fireEvent.click(pin);
    expect(props.onSelectPlace).toHaveBeenCalledWith(place.id);
    expect(props.onOpenDetails).not.toHaveBeenCalled();
    expect(props.onCenterChange).not.toHaveBeenCalled();
    expect(bubbledClick).not.toHaveBeenCalled();
    expect(mock.google.maps.OverlayView.preventMapHitsAndGesturesFrom).toHaveBeenCalledWith(pin);
  });

  it("highlights and pans to selected results with permanent labels and Details/Clear", async () => {
    const props = makeProps({ places: [place] });
    const view = render(<GoogleBasemap {...props} />);
    const oldPin = await screen.findByRole("button", { name: place.name });
    view.rerender(<GoogleBasemap {...props} selectedPlaceId={place.id} />);

    const pin = screen.getByRole("button", { name: place.name });
    expect(pin.firstElementChild?.outerHTML).toBe(
      normalizedMarkerHtml(place.categoryId, "result-active"),
    );
    expect(pin.getAttribute("aria-pressed")).toBe("true");
    expect(pin.style.width).toBe("36px");
    expect(pin.style.zIndex).toBe("800");
    expect(screen.getByRole("tooltip").className).toContain("map-tip--active");
    fireEvent.mouseLeave(pin);
    fireEvent.blur(pin);
    expect(pin.querySelector<HTMLSpanElement>("[role=tooltip]")?.hidden).toBe(false);
    expect(mock.maps[0].panTo).toHaveBeenLastCalledWith({ lat: place.lat, lng: place.lng });
    expect(screen.getByText("Cafés · 10 Main Street")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(props.onOpenDetails).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(props.onSelectPlace).toHaveBeenLastCalledWith(null);
    fireEvent.click(oldPin);
    expect(props.onSelectPlace).toHaveBeenCalledOnce();

    view.rerender(<GoogleBasemap {...props} />);
    expect(screen.queryByRole("button", { name: "Details" })).toBeNull();
    expect(screen.getByRole("button", { name: place.name }).getAttribute("aria-pressed")).toBe("false");
  });

  it("updates categories, coordinates and radius without rebuilding the map", async () => {
    const props = makeProps();
    const view = render(<GoogleBasemap {...props} />);
    await waitFor(() => expect(mock.markers).toHaveLength(placeholders.length));
    const newCenter = { lat: 40.7, lng: -74 };
    const newPlaceholders = buildMapPlaceholders(newCenter, "parks", 10);
    view.rerender(
      <GoogleBasemap {...props} center={newCenter} radiusKm={10} placeholders={newPlaceholders} />,
    );

    expect(mock.maps).toHaveLength(1);
    expect(mock.maps[0].setCenter).toHaveBeenLastCalledWith(newCenter);
    expect(mock.maps[0].fitBounds).toHaveBeenLastCalledWith(
      expect.objectContaining({ south: expect.any(Number), north: expect.any(Number) }),
      40,
    );
    expect(mock.shapes[0].setMap).toHaveBeenLastCalledWith(null);
    expect(mock.shapes.at(-1)?.options.radius).toBe(10000);
    const node = mock.maps[0].panes.markerLayer.children[0] as HTMLElement;
    expect(node.firstElementChild?.outerHTML).toBe(normalizedMarkerHtml("parks"));
    expect(node.style.left).toBe(`${newPlaceholders[0].lng * 10}px`);
    expect(node.style.top).toBe(`${newPlaceholders[0].lat * 10}px`);

    const marker = mock.markers[placeholders.length];
    marker.project.mockReturnValueOnce(null);
    marker.draw();
    expect(node.style.display).toBe("none");
    marker.project.mockReturnValueOnce({ x: 120, y: 240 });
    marker.draw();
    expect(node.style.display).toBe("block");
    expect(node.style.left).toBe("120px");
    expect(node.style.top).toBe("240px");
  });

  it("uses the latest props and callbacks after delayed Maps script loading", async () => {
    delete window.google;
    const props = makeProps();
    const view = render(<GoogleBasemap {...props} />);
    const script = document.querySelector<HTMLScriptElement>("script[data-pd-google-maps]")!;
    expect(script.src).toContain("https://maps.googleapis.com/maps/api/js?");
    expect(mock.maps).toHaveLength(0);
    const latestProps = makeProps({ center: place, radiusKm: 10, places: [place] });
    view.rerender(<GoogleBasemap {...latestProps} />);

    window.google = mock.google;
    await act(async () => {
      script.dispatchEvent(new Event("load"));
    });
    expect(mock.maps).toHaveLength(1);
    expect(mock.markers).toHaveLength(1);
    expect(screen.getByRole("button", { name: place.name })).toBeTruthy();
    expect(mock.maps[0].setCenter).toHaveBeenLastCalledWith(latestProps.center);
    expect(mock.shapes[0].options.radius).toBe(10000);
    const mapClick = mock.google.maps.event.addListener.mock.calls[0][2];
    mapClick({ latLng: { lat: () => 40, lng: () => -70 } });
    expect(latestProps.onCenterChange).toHaveBeenCalledWith({ lat: 40, lng: -70 });
    expect(props.onCenterChange).not.toHaveBeenCalled();
  });

  it("keeps provider names as text and cleans overlays and listeners on unmount", async () => {
    const googlePlace: OsmPlace = {
      ...place,
      id: "google:example",
      source: "google",
      googlePlaceId: "example",
      name: '<img src=x onerror="alert(1)"> Café',
      sources: { google: true },
    };
    const props = makeProps({ places: [googlePlace], selectedPlaceId: googlePlace.id });
    const view = render(<GoogleBasemap {...props} />);
    const pin = await screen.findByRole("button", { name: googlePlace.name });
    expect(screen.getByRole("tooltip").textContent).toBe(googlePlace.name);
    expect(view.container.querySelector("img")).toBeNull();
    const host = screen.getByRole("presentation");
    view.unmount();

    expect(mock.markers[0].setMap).toHaveBeenLastCalledWith(null);
    expect(mock.shapes[0].setMap).toHaveBeenLastCalledWith(null);
    expect(mock.google.maps.event.clearInstanceListeners).toHaveBeenCalledWith(mock.maps[0]);
    expect(host.children).toHaveLength(0);
    fireEvent.click(pin);
    expect(props.onSelectPlace).not.toHaveBeenCalled();
  });

  it("does not create a map when unmounted before the script resolves", async () => {
    delete window.google;
    const view = render(<GoogleBasemap {...makeProps()} />);
    const script = document.querySelector<HTMLScriptElement>("script[data-pd-google-maps]")!;
    view.unmount();
    window.google = mock.google;
    await act(async () => {
      script.dispatchEvent(new Event("load"));
    });
    expect(mock.maps).toHaveLength(0);
    expect(mock.markers).toHaveLength(0);
    expect(mock.shapes).toHaveLength(0);
  });

  it("initializes area overlays and removes them when switching to radius mode", async () => {
    const props = makeProps({
      searchMode: "area",
      boundingBox: [51.4, 51.6, -0.2, 0.1],
      placeholders: [],
    });
    const view = render(<GoogleBasemap {...props} />);
    await waitFor(() => expect(mock.shapes).toHaveLength(1));
    expect(mock.shapes[0].kind).toBe("rectangle");
    expect(mock.shapes[0].options.bounds).toEqual({ south: 51.4, north: 51.6, west: -0.2, east: 0.1 });
    expect(screen.queryByRole("tooltip")).toBeNull();
    view.rerender(<GoogleBasemap {...props} searchMode="radius" />);
    expect(mock.shapes[0].setMap).toHaveBeenLastCalledWith(null);
    expect(mock.shapes.at(-1)?.kind).toBe("circle");
    expect(mock.maps).toHaveLength(1);
  });
});
