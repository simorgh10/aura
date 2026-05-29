# AI Expert Journal & Learning Ledger

This journal serves as an immutable, chronological record of architectural insights, critical engineering trade-offs, and lessons learned during the design and implementation of the **Multi-Layer Architecture Canvas**.

---

### [2026-05-27] Project Inception & Architectural Strategy
- **Action Taken:** Initiated project for the Multi-Layer Architecture Canvas, a high-performance visual topology system in Angular 19+. Inspected master specification `v2026_master_specification.md` and initiated environment setup.
- **Architectural Decision:** Adopted a zoneless Angular architecture leveraging signals for granular UI updates and SVG foreignObject rendering. This guarantees maximum rendering performance under complex hierarchical layouts.
- **Lesson Learned:** Framing high-performance interactive canvases requires an upfront decoupling of the layout graph (computed via D3/signals) and the rendering tree (rendered recursively via SVG/ForeignObject).

### [2026-05-27] Implementation Completion & Signal Compiler Resolution
- **Action Taken:** Completed full implementation of the infinite canvas, NgRx SignalStore layout engine, curved bezier pathing, recursive box cards, and dynamic sliding specs pane.
- **Architectural Decision:** Implemented custom Markdown rendering natively inside the Zoneless component, avoiding hydrate conflicts and achieving standard GitHub styled Alerts with zero external bundle overhead. Used standard Angular `effect()` to watch selections reactively.
- **Lesson Learned:** Backtick syntax literals within decorator templates must be carefully escaped or converted to nested single quotes to maintain compile-time parsers integrity. Standardizing on standard Angular Signals lifecycle effect loops instead of abstract watchers guarantees bulletproof runtime tracking.

### [2026-05-27] Draggable Nodes, Recursive Visibility Propagation, Scoped Profiles, and Sliding Sidebars
- **Action Taken:** Developed click-and-drag interaction model for component boxes, designed recursive visibility propagation inside NgRx SignalStore, resolved container overlapping conflicts using hierarchy depth-sorting, implemented perspective-scoped environment profile manifests, and built an expandable left controls overlay.
- **Architectural Decision:** Utilized parent depth-based sorting (`depth` ascending) on the canvas SVG nodes computed signal, completely decoupling DOM sorting from coordinate computation. Implemented parent-resizing via visual bounding box calculations of child layout offsets in the TS layout tree.
- **Lesson Learned:** Scaling viewport dragging deltas using `delta / zoom` ensures precise, lag-free cursor tracking at any translation level. Inheriting parent visibility states recursively rather than checking layer visibility in isolation is the key to maintaining correct edge re-anchoring (bubble-up) logic under deep domain nesting.

