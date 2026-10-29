// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type { ComponentProps } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchControls } from "./SearchControls";

type Props = ComponentProps<typeof SearchControls>;

function renderControls(overrides: Partial<Props> = {}) {
  const props: Props = {
    category: "cafes",
    searchMode: "radius",
    radiusKm: 5,
    customKeyword: "",
    areaLabel: null,
    hasAreaBBox: false,
    areaTooLarge: false,
    loading: false,
    source: "osm",
    googleAvailable: true,
    onSourceChange: vi.fn(),
    onCategoryChange: vi.fn(),
    onSearchModeChange: vi.fn(),
    onRadiusChange: vi.fn(),
    onCustomKeywordChange: vi.fn(),
    onSearch: vi.fn(),
    disabled: false,
    ...overrides,
  };
  render(<SearchControls {...props} />);
  return props;
}

function searchButton() {
  return screen.getByRole("button", { name: /^search/i });
}

afterEach(cleanup);

describe("SearchControls — results source", () => {
  it("offers OpenStreetMap, Google, and Both as one labelled radio group", () => {
    renderControls();
    const group = screen.getByRole("group", { name: "Results from" });
    const radios = within(group).getAllByRole("radio");

    expect(radios).toHaveLength(3);
    expect(
      within(group).getByRole("radio", { name: "OpenStreetMap" }),
    ).toBeChecked();
    expect(within(group).getByRole("radio", { name: "Google" })).toBeEnabled();
    expect(within(group).getByRole("radio", { name: "Both" })).toBeEnabled();
    expect(
      within(group).getByRole("radio", { name: "OpenStreetMap" }),
    ).toHaveAccessibleDescription(/exportable/i);
  });

  it("separates the results source from the map background", () => {
    renderControls();
    expect(screen.getByText(/not the map background/i)).toBeInTheDocument();
  });

  it("reports source changes", () => {
    const props = renderControls();
    fireEvent.click(screen.getByRole("radio", { name: "Both" }));
    expect(props.onSourceChange).toHaveBeenCalledWith("both");
  });

  it("locks the Google lanes and says why when Google is unavailable", () => {
    renderControls({ googleAvailable: false });

    expect(screen.getByRole("radio", { name: "OpenStreetMap" })).toBeEnabled();
    for (const name of ["Google", "Both"]) {
      const radio = screen.getByRole("radio", { name });
      expect(radio).toBeDisabled();
      expect(radio).toHaveAccessibleDescription(/GOOGLE_MAPS_API_KEY/);
    }
    expect(screen.getAllByText("Needs key")).toHaveLength(2);
    expect(searchButton()).toBeEnabled();
  });

  it("blocks a Google search that cannot run and points back to OpenStreetMap", () => {
    renderControls({ source: "google", googleAvailable: false });

    expect(searchButton()).toBeDisabled();
    expect(searchButton()).toHaveAccessibleDescription(/choose OpenStreetMap/i);
  });

  it("warns that Google covers an area with a circle", () => {
    renderControls({
      source: "google",
      searchMode: "area",
      hasAreaBBox: true,
      areaLabel: "Dhaka",
    });
    expect(screen.getByText(/covers the area with a circle/i)).toBeVisible();
  });
});

describe("SearchControls — where to search", () => {
  it("switches between the pin radius and the selected area", () => {
    const props = renderControls();
    const group = screen.getByRole("group", { name: "Where to search" });

    expect(
      within(group).getByRole("radio", { name: "Around the pin" }),
    ).toBeChecked();
    fireEvent.click(within(group).getByRole("radio", { name: "Selected area" }));
    expect(props.onSearchModeChange).toHaveBeenCalledWith("area");
  });

  it("picks a radius and names it on the search button", () => {
    const props = renderControls({ radiusKm: 5 });
    const group = screen.getByRole("group", { name: /radius/i });

    expect(within(group).getByRole("radio", { name: "5 km" })).toBeChecked();
    fireEvent.click(within(group).getByRole("radio", { name: "10 km" }));
    expect(props.onRadiusChange).toHaveBeenCalledWith(10);
    expect(searchButton()).toHaveTextContent("Search within 5 km");
  });

  it("asks for a pin before a radius search", () => {
    renderControls({ disabled: true });
    expect(searchButton()).toBeDisabled();
    expect(searchButton()).toHaveAccessibleDescription(/place the pin/i);
  });

  it("asks for an area before an area search", () => {
    renderControls({ searchMode: "area", hasAreaBBox: false });

    expect(screen.queryByRole("group", { name: /radius/i })).toBeNull();
    expect(screen.getByText(/no area yet/i)).toBeInTheDocument();
    expect(searchButton()).toBeDisabled();
    expect(searchButton()).toHaveAccessibleDescription(/pick an area above/i);
  });

  it("flags an area that is too large", () => {
    renderControls({
      searchMode: "area",
      hasAreaBBox: true,
      areaTooLarge: true,
    });
    expect(screen.getByText(/too large to search/i)).toBeInTheDocument();
    expect(searchButton()).toBeDisabled();
  });

  it("searches a ready area", () => {
    const props = renderControls({
      searchMode: "area",
      hasAreaBBox: true,
      areaLabel: "Dhaka, Bangladesh",
    });

    expect(screen.getByText("Dhaka, Bangladesh")).toBeInTheDocument();
    fireEvent.click(searchButton());
    expect(searchButton()).toHaveTextContent("Search selected area");
    expect(props.onSearch).toHaveBeenCalledTimes(1);
  });
});

describe("SearchControls — category and submit", () => {
  it("requires a custom keyword, then searches on Enter", () => {
    const blocked = renderControls({ category: "custom", customKeyword: "" });
    const keyword = screen.getByRole("textbox", { name: "Keyword" });

    expect(searchButton()).toBeDisabled();
    fireEvent.keyDown(keyword, { key: "Enter" });
    expect(blocked.onSearch).not.toHaveBeenCalled();

    cleanup();
    const ready = renderControls({
      category: "custom",
      customKeyword: "bakery",
    });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Keyword" }), {
      key: "Enter",
    });
    expect(ready.onSearch).toHaveBeenCalledTimes(1);
  });

  it("disables the button while a search is running", () => {
    renderControls({ loading: true });
    expect(searchButton()).toBeDisabled();
    expect(searchButton()).toHaveTextContent("Searching…");
  });
});
