# Cross-device UI/UX audit

## Scope

Reviewed the public dashboard, Alerts, Events map, and System Status views at a 390×844 mobile viewport and a 1440×1000 desktop viewport. The audit preserves live-data provenance, explicit unavailable states, permission boundaries, and the existing Burmese-first public-monitoring tone.

## Findings

The mobile dashboard hierarchy is strong: the navy seismic hero establishes context, summary cards are readable, and the shortcut cards offer direct paths to Map, Alerts, and Safety. The header navigation is touch-friendly after the prior responsive pass, but the horizontal rail should make its scroll affordance and current page context more obvious on narrow screens.

The Alerts page is information-rich and usable on mobile, but its long settings flow benefits from stronger section landmarks, a more prominent device-subscription status treatment, and a consistent action-state pattern for loading, success, and failure. The Android subscription panel now surfaces its state visibly; the next UI refinement should keep that message near the action and avoid implying that a real push has been delivered.

The Events map is clear on desktop with a two-column map/detail composition, but on mobile its loading state occupies most of the viewport while data is requested. A compact skeleton or progress state would communicate continuity better. The System Status page has the same transient-loading opportunity and should keep the live-source timestamp and model-unavailable explanation close to the first viewport.

Desktop layouts use the available width well and preserve readable data density. Across all sizes, bilingual labels sometimes compete with the primary metric. A consistent eyebrow/title/metadata hierarchy, visible focus states, and a compact automatic-status summary should reduce scanning cost without adding artificial data.

## Safe implementation priorities

1. Add reusable responsive page-shell primitives for consistent horizontal padding, top spacing, safe-area behavior, and focus-visible treatment.
2. Improve mobile navigation context without introducing a second navigation system.
3. Add compact skeleton/loading states to Events and System Status while retaining truthful loading copy.
4. Strengthen responsive typography and action stacking for Alerts without changing alert semantics.
5. Preserve the source, model-gating, privacy, and background-notification disclaimers exactly in meaning.

## Post-implementation verification

The new loading states render as compact centered cards on mobile and desktop, with a visible source label, animated progress cue, skeleton lines, and an explicit accessible status region. Events and Forecasts no longer present a mostly blank viewport while snapshot data is pending. System Status now retains its loaded data hierarchy and its source/model boundaries.

The responsive dashboard and Alerts layout remain readable at 390×844 and 1440×1000. The existing touch-friendly navigation and iOS safe-area support remain intact. The implementation introduces no new data, does not alter alert thresholds, and keeps unavailable/error states distinct from healthy live-source states.
