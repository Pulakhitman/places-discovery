# Reviews plan (official Places API only)

**Status:** Refined by [Plan reviews official API](bc-11e2346e-d1c3-5a9f-804f-8b1526844410); light UX on `cursor/coverage-reviews-plan-e515`
**Policy:** No scraping. Official Places API (New) only.

## Phases
1. Full review fields + attribution + matched Google name; reviews only on Details mask
2. Official `reviewSummary` on same Details call (verbatim); never app-written summary
3. Session placeId reuse; slim Text Search match mask; do not cache review JSON
4. Match confidence (name/distance); confirm weak matches before Details
5. Local skim/filter of the same five reviews

## Refuse
Scraping; fake pagination; reviews on search masks; prefetch-all; persisting review text; paraphrase

## Next
Implement Phase 1 when requested.

## Gaps (from planner)
- Author uri/avatar; per-review Maps + flagContentUri; originalText; visitDate
- reviewSummary not requested; match first-hit without name/distance check
- Text Search match bills Enterprise rating fields redundantly

## Cost shape
Keep reviews off Nearby/Text. One Atmosphere Details call beats splitting hours vs reviews. Phase 3 slim match to id/name/location.
