# Reviews plan (official Places API only)

**Status:** Phase 1 on `main`; Phase 2+ on `cursor/reviews-phase-2-e515`
**Policy:** No scraping. Official Places API (New) only.

## Phases
1. Full review fields + attribution + matched Google name; reviews only on Details mask — **done**
2. Official `reviewSummary` on same Details call (verbatim); never app-written summary — **done (this PR)**
3. Session placeId reuse; slim Text Search match mask; do not cache review JSON — **done (this PR)**
4. Match confidence (name/distance); confirm weak matches before Details — **done (Phase 1)**
5. Local skim/filter of the same five reviews — **done (this PR)**

## Refuse
Scraping; fake pagination; reviews on search masks; prefetch-all; persisting review text; paraphrase

## Next
Polish / monitoring only unless Google adds new official review fields.

## Cost shape
Keep reviews off Nearby/Text. One Atmosphere Details call for hours + reviews + `reviewSummary`. Session `placeId` skips repeat Text Search. In-memory Details cache stores metadata only (empty `reviews`, no `reviewSummary`).

## Phase 1 (merged via #3)
- Full review fields (author/avatar/links/report/visitDate/originalText)
- Match confidence + weak-match confirm before photos/reviews
- Slim Text Search match mask; Google Maps attribution

## Phase 2+ (this branch)
- `reviewSummary` on Details field mask; UI shows Google text + disclosure verbatim
- `sessionStorage` placeId + match metadata reuse (never review bodies)
- Details cache strips review JSON / summary on write
- Local skim: min stars + sort among the same ≤5 reviews
