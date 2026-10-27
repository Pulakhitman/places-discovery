declare module "@nickgraffis/us-counties" {
  export type UsCounty = {
    FIPS: string;
    stateName: string;
    stateAbbr: string;
    state: string;
    name: string;
    contiguous: boolean;
  };

  export function getCountyByState(state: string): UsCounty[];
  export function normalizeState(state: string): string;
}
