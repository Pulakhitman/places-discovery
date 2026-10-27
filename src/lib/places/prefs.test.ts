import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SEARCH_PREFS,
  loadSearchPrefs,
  saveSearchPrefs,
} from "./prefs";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

function withWindowStorage(run: () => void): void {
  const previous = (globalThis as { window?: Window }).window;
  const storage = memoryStorage();
  (globalThis as { window: Window }).window = {
    localStorage: storage,
  } as Window;
  try {
    run();
  } finally {
    if (previous === undefined) {
      delete (globalThis as { window?: Window }).window;
    } else {
      (globalThis as { window: Window }).window = previous;
    }
  }
}

describe("search prefs", () => {
  afterEach(() => {
    delete (globalThis as { window?: Window }).window;
  });

  it("returns stable defaults when window is unavailable (SSR)", () => {
    delete (globalThis as { window?: Window }).window;
    expect(loadSearchPrefs()).toEqual(DEFAULT_SEARCH_PREFS);
  });

  it("returns stable defaults when storage is empty", () => {
    withWindowStorage(() => {
      expect(loadSearchPrefs()).toEqual(DEFAULT_SEARCH_PREFS);
    });
  });

  it("round-trips valid prefs through localStorage", () => {
    withWindowStorage(() => {
      saveSearchPrefs({
        category: "cafes",
        radiusKm: 2,
        searchMode: "area",
        sort: "name",
      });
      expect(loadSearchPrefs()).toEqual({
        category: "cafes",
        radiusKm: 2,
        searchMode: "area",
        sort: "name",
      });
    });
  });

  it("falls back to defaults for invalid stored values", () => {
    withWindowStorage(() => {
      window.localStorage.setItem(
        "places-discovery.search-prefs.v1",
        JSON.stringify({ category: "nope", radiusKm: 99, sort: "weird" }),
      );
      expect(loadSearchPrefs()).toEqual(DEFAULT_SEARCH_PREFS);
    });
  });
});
