# V2026 Master Specification: Multi-Layer Architecture Canvas

## 1. Overview
The **Multi-Layer Architecture Canvas** is a high-performance, interactive visualization platform designed for complex technical and functional ecosystems. It provides a "React-Flow" inspired experience within a modern Angular ecosystem, allowing users to navigate through multiple architectural perspectives (Hierarchies) and environment contexts (Profiles).

## 2. Functional Specification

### 2.1. The Component Box System
Each component is a visual "box" representing a system entity.
- **States:**
  - **Expanded:** Displays its own header, footer, and its direct children nodes.
  - **Collapsed:** Displays header and footer but remains "empty" internally.
  - **Leaf:** A component with no children. It does not show an expand/collapse icon.
- **Header:**
  - Displays an icon and a name.
  - **Templatization:** The name is resolved using properties from the active **Profile**.
- **Footer:**
  - Displays a set of icons representing links (e.g., GitLab, Confluence).
  - **Templatization:** Link URLs and icons can be derived from profile properties.
- **Styling:**
  - Component appearance (borders, colors, spacing) is driven by its **Type** and can be overridden via CSS properties in the YAML definition.

### 2.2. Hierarchy & Layer Management
- **Multi-Hierarchy:** Components can exist in multiple hierarchies (e.g., "Network Topology", "Functional Domains"). Only one hierarchy is visible at a time.
- **Profile Context:** Each hierarchy is bound to a specific Profile (e.g., "Production", "Staging"). Profiles provide the key-value pairs for templatization.
- **Layer Hiding:** Users can toggle the visibility of specific **Component Types** within a hierarchy (e.g., "Hide all 'Subnet' boxes").

### 2.3. The Edge (Connector) System
- **Directed Edges:** Connect connection ports between two component boxes.
- **Port System:** Components define specific named "ports" (e.g., `in`, `out`, `db_read`).
- **Edge Re-anchoring (Bubble-up Logic):**
  - If Component B is a child of Parent P, and Parent P is **collapsed**, any edge targeting B must be visually re-anchored to a corresponding port on Parent P.
  - This ensures that high-level views remain accurate even when granular details are hidden.
- **Edge Types:** Edges have types (e.g., `grpc`, `kafka_stream`) with associated CSS styles (stroke, animation, arrows).

### 2.4. Documentation & Interaction
- **Lateral Slide-over Pane:** Clicking a component box triggers a sliding pane from the right.
- **Content:** Displays high-fidelity Markdown documentation linked to the component.
- **Pan & Zoom:** Standard infinite canvas interactions (drag to pan, scroll to zoom).

## 3. Technical Specification

### 3.1. Tech Stack (2026 Cutting Edge)
- **Framework:** **Angular 19+** (Zoneless, Standalone Components).
- **Reactivity:** **Angular Signals** for the entire reactive graph (Nodes, Edges, Visibility).
- **State Management:** **NgRx SignalStore** using `withEntities` for topology data and `withState` for UI state (Active View, Zoom Level).
- **UI Components:** **Angular CDK** (Overlays, Drag and Drop, Portals).
- **Styling:** **Vanilla CSS** + **Tailwind CSS** for layout.
- **Markdown:** `ngx-markdown` for the documentation pane.
- **Graph Layout:** **D3-Hierarchy** for initial tree positioning and **D3-Force** for edge routing optimization.

### 3.2. Data Schema (YAML)
The system is driven by a YAML-based "Topology Manifest".

```yaml
version: "2026.1"

types:
  components:
    microservice:
      icon: "cpu"
      css: { "border-color": "var(--primary-blue)" }
    bucket:
      icon: "archive"
  edges:
    async:
      css: { "stroke-dasharray": "5,5", "animation": "dash 3s linear infinite" }

profiles:
  - id: "prod"
    props:
      env: "PROD"
      k8s_cluster: "us-east-1"
      gitlab_base: "https://gitlab.com/prod"

hierarchies:
  - id: "functional"
    name: "Functional View"
    default_profile: "prod"
    layers: ["domain", "microservice", "database"]
    tree:
      - id: "ordering-domain"
        type: "domain"
        children: ["order-api", "order-db"]

components:
  - id: "order-api"
    type: "microservice"
    name: "Order API - ${env}"
    docs: "assets/docs/order-api.md"
    links:
      - { type: "gitlab", url: "${gitlab_base}/order-api" }
    ports: ["in", "out"]

edges:
  - from: "order-api:out"
    to: "payment-gateway:in"
    type: "async"
```

### 3.3. Key Algorithms

#### A. Property Resolution (Templatizing)
A recursive resolver that parses `${key}` markers and replaces them using the active profile's `props` map. This is implemented as an Angular `Effect` or a computed `Signal` that refreshes when the profile changes.

#### B. Edge Re-anchoring Algorithm
1. For every Edge `E(source_node, target_node)`:
2. Identify the `active_hierarchy`.
3. If `target_node` is hidden or its ancestor is **collapsed**:
   - Traverse up the hierarchy from `target_node` until a visible, non-collapsed node `P` is found.
   - Update the visual endpoint of `E` to the nearest port on `P`.
4. Recalculate SVG path using the new coordinates.

#### C. SVG Rendering Strategy
Each Component Box is a standalone SVG `<g>` element or a ForeignObject (for rich HTML rendering inside SVG). This allows for seamless scaling and deep nesting while maintaining React-Flow's performance characteristics.

## 4. Implementation Priorities
1. **Core Canvas Engine:** Basic pan/zoom with Angular Signals.
2. **Topology Store:** Implement the YAML loader and NgRx SignalStore.
3. **Hierarchical Rendering:** Recursive component rendering (Expanded/Collapsed logic).
4. **Reactive Edges:** Port mapping and the re-anchoring algorithm.
5. **Profile/Templatizing Service:** Property injection logic.
6. **UI Polish:** Documentation pane and layer control.
