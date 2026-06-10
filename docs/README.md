# Docs

Project-level documentation for the infinite-canvas framework.

## Precedence

When documents disagree, the order of truth is:

1. **Code and tests** (`packages/infinite-canvas/`)
2. **Implementation-era planning docs** carried with the code
   (`reference/infinite-canvas/README.md`, `FEATURE_TRACKER.md`,
   `RASTERIZATION_PLAN.md`, `SELECTION_AND_KEYBOARD_PLAN.md`) — these were
   maintained through the latest implementation work
3. **This directory** — requirements, policies, and forward-looking research

## Documents

- [ROADMAP.md](ROADMAP.md) — the large work programs (P1–P8) with scope,
  exit criteria, dependencies, and the recommended spine
- [ARCHITECTURE_PLAN.md](ARCHITECTURE_PLAN.md) — the porting/bring-up plan
  that stood this repo up (2026-06-10; largely executed)
- [SHAPING_PLAN.md](SHAPING_PLAN.md) — the html-in-canvas posture +
  headless extraction plan (2026-06-10; executed)
- [REQUIREMENTS.md](REQUIREMENTS.md) — what the framework must do, with
  per-requirement status
- [zoom-policy.md](zoom-policy.md) — the zoom model; mostly implemented,
  open items marked

### research/

Forward-looking specs and reference material, curated 2026-06-10 from the
pre-implementation research corpus in kek-monorepo (authored 2026-04-22..24,
the same days the official implementation began; runtime-descriptive docs
from that corpus were dropped as stale — they described a predecessor
architecture deleted on 2026-04-23). Each file carries its own provenance
note and current status.

- [grouping-and-docking.md](research/grouping-and-docking.md) — the next
  major tranche: group shells, n-ary container trees, split/tabs/accordion,
  sequencing
- [snapping.md](research/snapping.md) — hardening spec for the existing snap
  subsystem: **hysteresis** (a tracked risk), docking-intent, spatial
  indexing, organization commands
- [state-focus-and-recipes.md](research/state-focus-and-recipes.md) — state
  tier boundaries (implemented; protect), group-aware focus model, layout
  recipes
- [acceptance-scenarios.md](research/acceptance-scenarios.md) — 30+
  architecture-level acceptance tests with coverage status
- [body-content-contract.md](research/body-content-contract.md) — the unbuilt
  window-body contract (portal roots, positioning, input ownership, a11y) and
  low-zoom chrome findings
- [risk-register.md](research/risk-register.md) — architectural risks with
  mitigation status, including repo-era additions (headless regression,
  dependency drift, interactive performance)
- [api-friction-backlog.md](research/api-friction-backlog.md) — defects and
  ergonomic gaps surfaced by the 2026-06-10 showcase-rebuild exercise, with
  fixed/open status
- [tooling-candidates.md](research/tooling-candidates.md) — ecosystem
  packages with adoption triggers, corrected for decisions already made
- [feature-landscape-2026.md](research/feature-landscape-2026.md) — near-
  verbatim product survey of the infinite-canvas landscape (early 2026), for
  roadmap positioning

## Not carried over

From the kek-monorepo doc corpus, the following were deliberately left behind
as historical: `current-runtime-audit.md`, `implementation-roadmap.md`,
`agent-handoff-report.md`, the old directory `README.md` (all describe the
pre-framework `desktop-*` architecture or the crisis that ended it),
`core-architecture.md` (absorbed into the implementation; its scene-owned
chrome tenet was reversed), `state-management-evaluation.md` (Legend State
decision absorbed), `handle-source-review.md` (lessons absorbed into
`interaction.ts`), and corpus files 01/02/06/10 (settled rationale). They
remain in kek-monorepo at `apps/web/reference/infinite-canvas/` if needed.
