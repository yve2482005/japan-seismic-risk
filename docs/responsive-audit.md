# Cross-device UI/UX audit — 2026-08-25

The public monitor was reviewed at **375×812** (Android/iPhone-class) and **768×1024** (tablet) viewports across the Dashboard, Alerts, Map, and System Status views.

| Area | Finding | Responsive improvement |
|---|---|---|
| Global navigation | The full navigation is compact at phone width, which makes labels and hit areas too small for comfortable touch use. | Add a horizontally scrollable compact navigation rail with 44 px minimum touch targets, while retaining the full row for tablet and desktop. |
| Safe areas | Public pages do not consistently reserve display-inset space on phone devices. | Add `env(safe-area-inset-*)` padding to the shared page chrome. |
| Dashboard density | The dashboard is readable on phones but needs a clearer single-column rhythm and larger action targets. | Use mobile-first spacing and action sizing; restore multi-column density from tablet upward. |
| Form controls | Alerts filters/settings flow well at tablet width but should keep full-width controls and comfortable spacing on phone width. | Normalize mobile field and action minimum height and maintain tablet two-column layouts. |
| Map controls | The map remains legible at tablet dimensions; compact controls need an intentional phone layout. | Preserve full-width filters on phones, then switch to compact grid layouts at tablet/desktop breakpoints. |

## Post-change verification

The updated **375×812** mobile layout keeps the dashboard brand and navigation visible without compressing buttons. The primary navigation now forms a touch-sized horizontal rail, while Alerts, Map, and System Status retain comfortable full-width fields, cards, and readable text. A transient status-page loading state was rechecked and the loaded mobile view displayed correctly.

At **768×1024**, the dashboard restores a dense but readable multi-column layout, with the Alerts settings retaining clear two-column grouping and the Map filters using a compact grid. At **1440×1000**, the dashboard, map, and status screens preserve their full data density without overflow; the primary navigation remains a single compact row.
