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

### [2026-05-29] Predictable Dragging & Decoupled Overlap Resolution
- **Action Taken:** Simplified active dragging coordinates mutations to ensure predictable localized card movement and completed decoupled visual overlap checks.
- **Architectural Decision:** Removed recursive push-based sibling collision cascades from `updateNodeOffset()` to completely eliminate sudden or chaotic ("brutal") visual side-effects. Retained the iterative `resolveRootOverlaps()` pass inside `layoutNodes()` calculated signal to automatically resolve overlapping roots ONLY when parent domain layers are redisplayed or rebalanced.
- **Lesson Learned:** Disabling active collision calculations during cursor drags produces a much more natural, lightweight, and predictable interaction flow. Relying on reactive computed layout signals to resolve container overlaps ONLY upon state boundary transitions (such as toggling visibilities or manual rebalancing) achieves perfect structural cleanliness with zero runtime lag.

### [2026-05-29] Gentle Least-Overlap Collision Pushing
- **Action Taken:** Developed a gentle least-overlap collision pushing algorithm inside the active dragging coordinates compiler in the store.
- **Architectural Decision:** Upgraded `updateNodeOffset()` to check for rectangular intersection of visible siblings. If an overlap occurs during cursor drags, the colliding card is pushed along its axis of minimum overlap by exactly `overlap + 15px` gap buffer (the least possible distance). This eliminates brutal jumps and creates a smooth sliding physical contact.
- **Lesson Learned:** Calculating collision vectors dynamically based on minimum overlap sizes instead of flat coordinate offsets guarantees localized predictable drags that naturally slide only when boundaries touch. This fulfills the strict parent auto-resize boundary containment rules with zero visual lag.

### [2026-05-30] Multiple Topologies & Catch-All Routing
- **Action Taken:** Developed a dynamic catch-all deep URL routing (`[[...topologypath]]`) system and introduced the concept of an Enterprise Topology Registry mapping indices to sub-directories and leaves.
- **Architectural Decision:** Configured a wildcard route `**` to load `RootTopologyComponent`. Upgraded `TopologyStore` using sequential `withMethods` blocks to allow dynamic manifest loads via chaining. Traversed the index registry tree dynamically based on URL segments, displaying an elegant, glassmorphic categories landing dashboard (for indexes) or the full interactive canvas (for leaf topologies). Added a premium breadcrumb navigation trail mapping physical route paths to logical node names.
### [2026-06-01] Dynamic Styling Externalization (Phase A)
- **Action Taken:** Extended YAML schemas with color and badge CSS tokens in all manifests and refactored `NodeBoxComponent`, `SidebarComponent`, and `RootTopologyComponent` to dynamically resolve styles.
- **Architectural Decision:** Replaced all hardcoded, TS-based visual maps with signal-computed CSS injections. Type styling and badge tokens are dynamically resolved at runtime directly from active topology manifest attributes, leaving components completely visual-agnostic.
- **Lesson Learned:** Moving visualization tokens to the metadata layer drastically simplifies Angular template logic, accelerates compilation, and empowers non-developers to restyle views purely via YAML adjustments.

### [2026-06-01] Diagram-Level Resource Isolation (Phase B)
- **Action Taken:** Reorganized the file registry structure inside `/public/topologies/` to isolate both YAML schemas and documentation on a per-diagram/leaf folder basis.
- **Architectural Decision:** Created isolated diagram directories (e.g. `/topologies/checkout/`, `/topologies/analytics/`) containing their specific `manifest.yaml` and local `docs/` sub-directories. Re-mapped all component `docs` attributes to point to `/topologies/[leaf]/docs/[filename].md`, and updated `/public/topologies/index.json`. Created five new high-fidelity, PCI-compliant markdown files for components in the Checkout subsystem. Purged all loose top-level YAML manifests and global `public/docs/` folders.
- **Lesson Learned:** Transitioning from a shared global pool to a self-contained diagram-level structure prevents cross-diagram leakage and makes each visual sub-system a fully decoupled package that can be added, updated, or removed in absolute safety.

### [2026-06-01] Premium Dual-Theme (Light/Dark) System Integration
- **Action Taken:** Injected `theme` state and `toggleTheme()` modifier inside `TopologyStore`. Added `sun` and `moon` SVG icon structures. Formulated dual-theme CSS variables in `styles.css`. Integrated theme-swapping effects and floating toggles in `RootTopologyComponent`, `CanvasComponent`, and `NodeBoxComponent`.
- **Architectural Decision:** Adopted a purely CSS variable-bound theme injection system synchronized reactively via a standard Angular Signal `effect` loop. Instead of writing custom TS-based layout or text re-parsers for the markdown drawer, we utilized global `styles.css` article specificity overrides to dynamically adjust rendered HTML headers, warning panels, and code snippet colors at runtime.
- **Lesson Learned:** Coordinating DOM-level class bindings reactively with CSS variable custom properties is immensely cleaner and more performant than dynamically swapping Tailwind classes via JS string interpolation. It preserves clean compilation bundles, avoids Hydration conflicts, and yields microsecond transition smoothness globally.


