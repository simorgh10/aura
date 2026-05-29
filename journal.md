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

### [2026-05-29] Tri-Layer Rendering Stack, Collision Sliding, and Parent Coordinate Origin Shifting
- **Action Taken:** Architected a Tri-Layer SVG rendering stack (Containers layer, Edges layer, Leaves layer), programmed recursive push-based collision card sliding in the TopologyStore, and refined parent resizing using relative shifting layout mathematics.
- **Architectural Decision:** Split the flat canvas SVG loop into separate container and leaf arrays. Placed the edges render array between them, forcing connectors to overlay container backgrounds while ending behind leaf components. Created recursive coordinate offset adjustments to shift parent origin left/upward when children are dragged beyond boundary caps.
- **Lesson Learned:** Stacking SVG groups sequentially in the HTML template completely replaces complex CSS z-index workarounds, maintaining high frame rates. Applying equal drag deltas recursively to overlapping cards creates a natural sliding collision cascade without circular feedback loops.
- **Action Taken (Follow-up):** Decoupled nested child visibility from the visual visibility of parent containers.
- **Architectural Decision:** Rewrote `resolveVisibility` to trace ancestor `isExpanded` states recursively rather than ancestor `isVisible` states. This enables container nodes (like Domains) to be visually hidden via layer control menu selections, while their child nodes remain perfectly visible and laid out at their absolute graph positions.
- **Lesson Learned:** Decoupling parent layer display properties from the hierarchical state of their descendants is essential to support granular view filtering without causing silent downstream node disappearances.
- **Action Taken (Follow-up 2):** Resolved child superposition (overlap) bug when parent container layers are hidden.
- **Architectural Decision:** Upgraded `computeNodeSizeAndLayout` to layout child relative positions even when the parent node itself is invisible (provided the parent has visible descendants). Modified Step 4 and Step 5 to sequentially position and translate coordinates globally for invisible parent nodes, ensuring visible children inherit correct absolute coordinate origins.
- **Lesson Learned:** Visually hiding a container backdrop card must not interrupt the recursive geometry compiler passes, or relative-to-global translations will fail, resulting in children coordinates collapsing to zero (superposition).
- **Lesson Learned:** Automatically checking and resolving container boundary overlaps reactively inside layout signals guarantees stable visually separate rendering without requiring manual layout resets. Exposing a manual rebalance trigger lets users instantly revert any chaotic coordinates dragging to clean, calculated symmetries.

### [2026-05-29] Dynamic 2D Grid-Wrapping Layout Compiler
- **Action Taken:** Transitioned visual canvas layout from a single-row horizontal tree to a compact, spatially balanced Dynamic 2D Grid-Wrapping Layout for both nested children and top-level root containers.
- **Architectural Decision:** Implemented dynamic row heights and column widths grouping logic using rows of max size 2. Recursively parsed and positioned child cards based on calculated column margins, preserving custom drag offsets. Applied the same 2-column grid wrapping to top-level domains.
- **Lesson Learned:** Balanced 2D distributions are far more space-efficient and visually readable than single-line row trees. Upgrading the geometry compiler to divide cards into dynamic rows and columns before positioning completely resolves empty vertical axis layouts and excessive horizontal stretching.

