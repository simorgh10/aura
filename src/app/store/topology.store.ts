import { inject, computed } from '@angular/core';
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import * as jsYaml from 'js-yaml';
import { 
  TopologyManifest, 
  ProfileConfig, 
  HierarchyConfig, 
  ComponentNodeConfig, 
  EdgeConfig, 
  UINode, 
  UIEdge 
} from '../models/topology.model';
import { PropertyResolverService } from '../services/property-resolver.service';

export interface TopologyState {
  manifest: TopologyManifest | null;
  activeProfileId: string | null;
  activeHierarchyId: string | null;
  hiddenLayers: string[];
  expandedNodes: string[];
  selectedComponentId: string | null;
  zoom: number;
  panX: number;
  panY: number;
  loading: boolean;
  nodeOffsets: Record<string, { x: number; y: number }>;
  currentViewType: 'index' | 'leaf' | 'loading' | 'error';
  currentIndexNode: any | null;
  currentPathSegments: string[];
  errorMsg: string | null;
  registry: any | null;
}

const initialState: TopologyState = {
  manifest: null,
  activeProfileId: null,
  activeHierarchyId: null,
  hiddenLayers: [],
  expandedNodes: [],
  selectedComponentId: null,
  zoom: 1,
  panX: 100,
  panY: 100,
  loading: false,
  nodeOffsets: {},
  currentViewType: 'loading',
  currentIndexNode: null,
  currentPathSegments: [],
  errorMsg: null,
  registry: null,
};


export const TopologyStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  
  withComputed((state, resolver = inject(PropertyResolverService)) => {
    // Retrieves active hierarchy config
    const activeHierarchy = computed((): HierarchyConfig | null => {
      const manifest = state.manifest();
      const hierarchyId = state.activeHierarchyId();
      if (!manifest || !hierarchyId) return null;
      return manifest.hierarchies.find(h => h.id === hierarchyId) || null;
    });

    // Retrives active profile config (hierarchy scope first, then fallback to global)
    const activeProfile = computed((): ProfileConfig | null => {
      const hierarchy = activeHierarchy();
      const profileId = state.activeProfileId();
      if (!profileId) return null;
      
      if (hierarchy && hierarchy.profiles) {
        const found = hierarchy.profiles.find(p => p.id === profileId);
        if (found) return found;
      }
      
      const manifest = state.manifest();
      if (manifest && manifest.profiles) {
        return manifest.profiles.find(p => p.id === profileId) || null;
      }
      
      return null;
    });

    // Resolves component list properties dynamically under active profile
    const resolvedComponents = computed((): ComponentNodeConfig[] => {
      const manifest = state.manifest();
      if (!manifest) return [];
      const profile = activeProfile();
      const props = profile?.props || {};
      return manifest.components.map(comp => resolver.resolveNode(comp, props));
    });

    return {
      activeHierarchy,
      activeProfile,
      resolvedComponents
    };
  }),

  withComputed((state) => ({
    // Computes layout representation of components inside the active hierarchy
    layoutNodes: (): Record<string, UINode> => {
      const manifest = state.manifest();
      const activeHierarchy = state.activeHierarchy();
      const resolvedComps = state.resolvedComponents();
      const hiddenLayers = state.hiddenLayers();
      const expandedNodes = state.expandedNodes();
      const nodeOffsets = state.nodeOffsets();

      if (!manifest || !activeHierarchy) return {};

      // 1. Map components to parent/child and visibility trees
      const nodeMap: Record<string, UINode> = {};
      const layerSet = new Set(activeHierarchy.layers);
      
      // Initialize basic lookup map of components
      resolvedComps.forEach(comp => {
        nodeMap[comp.id] = {
          id: comp.id,
          type: comp.type,
          name: comp.name,
          description: comp.description,
          docs: comp.docs,
          links: comp.links,
          ports: comp.ports || ['in', 'out'],
          css: comp.css,
          childrenIds: [],
          isLeaf: true,
          isExpanded: expandedNodes.includes(comp.id),
          isVisible: false, // will resolve recursively
          depth: 0,
          x: 0, y: 0, width: 240, height: 110 // default leaf size
        };
      });

      // Populate children based on active hierarchy tree
      activeHierarchy.tree.forEach(treeNode => {
        const parentNode = nodeMap[treeNode.id];
        if (parentNode) {
          parentNode.isLeaf = false;
          parentNode.childrenIds = treeNode.children || [];
          treeNode.children?.forEach(childId => {
            const childNode = nodeMap[childId];
            if (childNode) {
              childNode.parentId = treeNode.id;
            }
          });
        }
      });

      // Find top-level root nodes
      const roots = activeHierarchy.tree.filter(t => {
        const comp = nodeMap[t.id];
        return comp && !comp.parentId;
      });

      // 2. Recursive visibility propagation
      // 2. Recursive visibility propagation
      const resolveVisibility = (nodeId: string, isParentExpanded: boolean) => {
        const node = nodeMap[nodeId];
        if (!node) return;

        const isLayerVisible = layerSet.has(node.type) && !hiddenLayers.includes(node.type);
        // A node is visible if its layer is visible AND all parent ancestors are expanded
        node.isVisible = isLayerVisible && isParentExpanded;

        node.childrenIds.forEach(cid => {
          resolveVisibility(cid, isParentExpanded && node.isExpanded);
        });
      };

      // Propagate visibility across roots
      roots.forEach(root => {
        resolveVisibility(root.id, true);
      });

      // 3. Recursive layout algorithm: calculates size and local coordinate layout of children
      const computeNodeSizeAndLayout = (nodeId: string): { width: number; height: number } => {
        const node = nodeMap[nodeId];
        if (!node) return { width: 0, height: 0 };

        // Identify visible children inside the container
        const visibleChildren = (!node.isLeaf && node.isExpanded && node.childrenIds.length > 0)
          ? node.childrenIds.map(cid => nodeMap[cid]).filter(c => c && c.isVisible)
          : [];

        // If the node itself is not visible, and it has no visible children, it has no dimensions in the layout
        if (!node.isVisible && visibleChildren.length === 0) {
          node.width = 0;
          node.height = 0;
          return { width: 0, height: 0 };
        }

        // If it's a leaf, collapsed, or has no visible children, it gets fixed size (provided it is visible)
        if (node.isLeaf || !node.isExpanded || visibleChildren.length === 0) {
          node.width = 240;
          node.height = 115;
          return { width: 240, height: 115 };
        }

        const paddingX = 30;
        const paddingTop = 65;
        const paddingBottom = 25;
        const gapX = 35;
        const gapY = 35;

        // Group children into 2-column grid rows
        const maxCols = 2;
        const rows: UINode[][] = [];
        for (let i = 0; i < visibleChildren.length; i += maxCols) {
          rows.push(visibleChildren.slice(i, i + maxCols));
        }

        // Compute sizes of all children recursively first
        visibleChildren.forEach(child => {
          computeNodeSizeAndLayout(child.id);
        });

        // Calculate column widths and row heights
        const maxColWidths: number[] = [];
        const rowHeights: number[] = [];

        rows.forEach((row, rowIndex) => {
          let maxH = 0;
          row.forEach((child, colIndex) => {
            maxH = Math.max(maxH, child.height);
            maxColWidths[colIndex] = Math.max(maxColWidths[colIndex] || 0, child.width);
          });
          rowHeights[rowIndex] = maxH;
        });

        // Position children using the calculated column widths and row heights
        rows.forEach((row, rowIndex) => {
          // Sum row heights for k < rowIndex
          let cumulativeY = 0;
          for (let k = 0; k < rowIndex; k++) {
            cumulativeY += rowHeights[k] + gapY;
          }

          row.forEach((child, colIndex) => {
            // Sum column widths for k < colIndex
            let cumulativeX = 0;
            for (let k = 0; k < colIndex; k++) {
              cumulativeX += maxColWidths[k] + gapX;
            }

            const offsetKey = `${activeHierarchy.id}:${child.id}`;
            const offset = nodeOffsets[offsetKey] || { x: 0, y: 0 };

            // Apply initial coordinate additions relative to parent
            child.x += paddingX + cumulativeX + offset.x;
            child.y += paddingTop + cumulativeY + offset.y;
          });
        });

        // Resolve top-left overflow shifts (left/up dragging)
        const currentMinX = visibleChildren.length > 0 ? Math.min(...visibleChildren.map(c => c.x)) : paddingX;
        const currentMinY = visibleChildren.length > 0 ? Math.min(...visibleChildren.map(c => c.y)) : paddingTop;

        const shiftX = currentMinX < paddingX ? paddingX - currentMinX : 0;
        const shiftY = currentMinY < paddingTop ? paddingTop - currentMinY : 0;

        if (shiftX > 0 || shiftY > 0) {
          visibleChildren.forEach(child => {
            child.x += shiftX;
            child.y += shiftY;
          });
          // Shift parent node relative coordinates so children don't jump in global absolute space
          node.x -= shiftX;
          node.y -= shiftY;
        }

        // Calculate parent dimensions based on actual visual bounding box of visible children
        const rightBounds = visibleChildren.map(c => c.x + c.width);
        const bottomBounds = visibleChildren.map(c => c.y + c.height);

        const maxX = rightBounds.length > 0 ? Math.max(...rightBounds) : 0;
        const maxY = bottomBounds.length > 0 ? Math.max(...bottomBounds) : 0;

        node.width = Math.max(240, maxX + paddingX);
        node.height = Math.max(115, maxY + paddingBottom);

        return { width: node.width, height: node.height };
      };

      // 4. Position top-level root nodes in a 2-column grid
      const rootMaxCols = 2;
      const visibleRoots = roots.map(r => nodeMap[r.id]).filter(n => {
        if (!n) return false;
        const hasVisibleDescendants = !n.isLeaf && n.isExpanded && n.childrenIds.some(cid => nodeMap[cid]?.isVisible);
        return n.isVisible || hasVisibleDescendants;
      });

      // Position all roots locally to determine their expanded dimensions
      visibleRoots.forEach(root => {
        computeNodeSizeAndLayout(root.id);
      });

      // Group roots into rows of size rootMaxCols
      const rootRows: UINode[][] = [];
      for (let i = 0; i < visibleRoots.length; i += rootMaxCols) {
        rootRows.push(visibleRoots.slice(i, i + rootMaxCols));
      }

      // Calculate root column widths and row heights
      const maxRootColWidths: number[] = [];
      const rootRowHeights: number[] = [];

      rootRows.forEach((row, rowIndex) => {
        let maxH = 0;
        row.forEach((root, colIndex) => {
          maxH = Math.max(maxH, root.height);
          maxRootColWidths[colIndex] = Math.max(maxRootColWidths[colIndex] || 0, root.width);
        });
        rootRowHeights[rowIndex] = maxH;
      });

      const rootGapX = 80;
      const rootGapY = 80;

      rootRows.forEach((row, rowIndex) => {
        // Sum row heights for k < rowIndex
        let cumulativeY = 0;
        for (let k = 0; k < rowIndex; k++) {
          cumulativeY += rootRowHeights[k] + rootGapY;
        }

        row.forEach((root, colIndex) => {
          // Sum column widths for k < colIndex
          let cumulativeX = 0;
          for (let k = 0; k < colIndex; k++) {
            cumulativeX += maxRootColWidths[k] + rootGapX;
          }

          const offsetKey = `${activeHierarchy.id}:${root.id}`;
          const offset = nodeOffsets[offsetKey] || { x: 0, y: 0 };

          root.x += cumulativeX + offset.x;
          root.y += 10 + cumulativeY + offset.y;
        });
      });

      // 4b. Resolve overlaps between top-level roots (Constraint Check & Fix)
      const resolveRootOverlaps = () => {
        const visibleRoots = roots.map(r => nodeMap[r.id]).filter(n => n && n.isVisible);
        let hasOverlap = true;
        let safetyCounter = 0;

        while (hasOverlap && safetyCounter < 50) {
          hasOverlap = false;
          safetyCounter++;

          for (let i = 0; i < visibleRoots.length; i++) {
            const A = visibleRoots[i];
            for (let j = i + 1; j < visibleRoots.length; j++) {
              const B = visibleRoots[j];
              
              const overlapX = Math.min(A.x + A.width, B.x + B.width) - Math.max(A.x, B.x);
              const overlapY = Math.min(A.y + A.height, B.y + B.height) - Math.max(A.y, B.y);

              if (overlapX > 0 && overlapY > 0) {
                hasOverlap = true;
                // Push overlapping container B to the right with a 20px gap buffer
                B.x += overlapX + 20;
              }
            }
          }
        }
      };

      resolveRootOverlaps();

      // 5. Translate local relative coordinates of nested children to global absolute coordinates, and compute depth recursively
      const applyGlobalTranslations = (nodeId: string, parentGlobalX: number, parentGlobalY: number, parentDepth: number) => {
        const node = nodeMap[nodeId];
        if (!node) return;

        // Add parent coordinates to get global absolute coordinate space, regardless of node's own visibility
        node.x += parentGlobalX;
        node.y += parentGlobalY;
        node.depth = parentDepth + 1;

        node.childrenIds.forEach(cid => {
          applyGlobalTranslations(cid, node.x, node.y, node.depth);
        });
      };

      // Apply coordinates across roots
      roots.forEach(root => {
        applyGlobalTranslations(root.id, 0, 0, -1);
      });

      return nodeMap;
    }
  })),

  withComputed((state) => ({
    // Computes visual edges using port positions and bubble-up (re-anchoring) logic
    layoutEdges: (): UIEdge[] => {
      const manifest = state.manifest();
      const nodeMap = state.layoutNodes();
      
      if (!manifest || Object.keys(nodeMap).length === 0) return [];

      // Helper function to find the highest visible ancestor if a target is collapsed/hidden
      const getHighestVisibleAncestor = (nodeId: string): UINode | null => {
        let current = nodeMap[nodeId];
        if (!current) return null;

        let highestCollapsed: UINode | null = null;
        let walker: UINode | undefined = current;

        while (walker) {
          if (!walker.isVisible) {
            // If the node itself is hidden by layer controls, we bubble up to parent
            highestCollapsed = walker;
          } else if (!walker.isExpanded && !walker.isLeaf) {
            // If walker is a collapsed container, this is the visual anchor!
            highestCollapsed = walker;
          }
          walker = walker.parentId ? nodeMap[walker.parentId] : undefined;
        }

        if (highestCollapsed) {
          return highestCollapsed.isVisible ? highestCollapsed : null;
        }

        return current.isVisible ? current : null;
      };

      const uiEdges: UIEdge[] = [];

      manifest.edges.forEach(edge => {
        const [fromId, fromPortName] = edge.from.split(':');
        const [toId, toPortName] = edge.to.split(':');

        const fromNode = getHighestVisibleAncestor(fromId);
        const toNode = getHighestVisibleAncestor(toId);

        // If either source or destination is completely hidden, skip edge rendering
        if (!fromNode || !toNode || fromNode.id === toNode.id) return;

        const isReanchored = fromNode.id !== fromId || toNode.id !== toId;

        // Calculate port positions
        const getPortCoords = (node: UINode, portName: string, isSource: boolean) => {
          let relX = 0;
          let relY = node.height / 2;

          if (portName === 'in') {
            relX = 0;
            relY = node.height / 2;
          } else if (portName === 'out') {
            relX = node.width;
            relY = node.height / 2;
          } else if (portName === 'db' || portName === 'db_write') {
            relX = node.width / 2;
            relY = node.height;
          } else if (portName === 'db_read') {
            relX = node.width / 2;
            relY = 0;
          } else {
            // General mapping if port is re-anchored
            relX = isSource ? node.width : 0;
            relY = node.height / 2;
          }

          return {
            x: node.x + relX,
            y: node.y + relY
          };
        };

        const fromCoords = getPortCoords(fromNode, isReanchored ? 'out' : fromPortName, true);
        const toCoords = getPortCoords(toNode, isReanchored ? 'in' : toPortName, false);

        // Resolve edge visual style configuration
        const edgeTypeStyle = manifest.types.edges[edge.type]?.css || {};

        uiEdges.push({
          fromNodeId: fromId,
          fromPort: fromPortName,
          toNodeId: toId,
          toPort: toPortName,
          type: edge.type,
          css: edgeTypeStyle,
          fromX: fromCoords.x,
          fromY: fromCoords.y,
          toX: toCoords.x,
          toY: toCoords.y,
          visualFromNodeId: fromNode.id,
          visualToNodeId: toNode.id,
          isReanchored
        });
      });

      return uiEdges;
    }
  })),

  withMethods((store, http = inject(HttpClient)) => ({
    // Loads the YAML Topology manifest and sets initial UI state
    async loadTopology(manifestUrl: string = '/topology.yaml') {
      patchState(store, { loading: true });
      try {
        const yamlText = await firstValueFrom(
          http.get(manifestUrl, { responseType: 'text' })
        );
        const doc = jsYaml.load(yamlText) as TopologyManifest;
        
        // Use default profile and hierarchy
        const firstHierarchy = doc.hierarchies[0];
        const defaultProfile = firstHierarchy ? (firstHierarchy.default_profile || firstHierarchy.profiles?.[0]?.id) : doc.profiles?.[0]?.id;

        patchState(store, {
          manifest: doc,
          activeHierarchyId: firstHierarchy?.id || null,
          activeProfileId: defaultProfile || null,
          expandedNodes: doc.components.filter(c => c.type === 'domain').map(c => c.id), // default domains expanded
          loading: false
        });
      } catch (err) {
        console.error('Failed to load topology manifest from ' + manifestUrl, err);
        patchState(store, { loading: false, currentViewType: 'error', errorMsg: 'Failed to load topology map configuration.' });
      }
    }
  })),

  withMethods((store, http = inject(HttpClient)) => ({
    // Resolves deep navigation paths based on the topologies registry
    async navigateToPath(segments: string[]) {
      patchState(store, { currentViewType: 'loading', errorMsg: null });
      try {
        let currentNode = store.registry();
        if (!currentNode) {
          const indexData = await firstValueFrom(
            http.get('/topologies/index.json')
          );
          patchState(store, { registry: indexData });
          currentNode = indexData;
        }

        let found = true;
        for (const seg of segments) {
          if (currentNode.type === 'index' && currentNode.children) {
            const child = currentNode.children.find((c: any) => c.id === seg);
            if (child) {
              currentNode = child;
            } else {
              found = false;
              break;
            }
          } else {
            found = false;
            break;
          }
        }

        if (!found) {
          patchState(store, { 
            currentViewType: 'error', 
            errorMsg: `Topological view not found: /${segments.join('/')}`,
            currentPathSegments: segments
          });
          return;
        }

        if (currentNode.type === 'leaf') {
          patchState(store, { 
            currentViewType: 'leaf',
            currentIndexNode: null,
            currentPathSegments: segments
          });
          await store.loadTopology(currentNode.manifest);
        } else {
          patchState(store, { 
            currentViewType: 'index',
            currentIndexNode: currentNode,
            currentPathSegments: segments,
            manifest: null,
            activeHierarchyId: null,
            activeProfileId: null
          });
        }
      } catch (err) {
        console.error('Failed to resolve dynamic topology path', err);
        patchState(store, { currentViewType: 'error', errorMsg: 'Failed to load topologies index.' });
      }
    },

    // UI State mutation methods
    setActiveProfile(profileId: string) {
      patchState(store, { activeProfileId: profileId });
    },

    setActiveHierarchy(hierarchyId: string) {
      const manifest = store.manifest();
      if (!manifest) return;
      
      const hierarchy = manifest.hierarchies.find(h => h.id === hierarchyId);
      const defaultProfile = hierarchy ? (hierarchy.default_profile || hierarchy.profiles?.[0]?.id) : store.activeProfileId();

      patchState(store, { 
        activeHierarchyId: hierarchyId,
        activeProfileId: defaultProfile || null
      });
    },

    toggleNodeExpanded(nodeId: string) {
      const current = store.expandedNodes();
      const next = current.includes(nodeId)
        ? current.filter(id => id !== nodeId)
        : [...current, nodeId];
      patchState(store, { expandedNodes: next });
    },

    toggleLayerVisibility(layerType: string) {
      const current = store.hiddenLayers();
      const next = current.includes(layerType)
        ? current.filter(t => t !== layerType)
        : [...current, layerType];
      patchState(store, { hiddenLayers: next });
    },

    setSelectedComponent(componentId: string | null) {
      patchState(store, { selectedComponentId: componentId });
    },

    updateViewport(panX: number, panY: number, zoom: number) {
      patchState(store, { panX, panY, zoom });
    },

    resetViewport() {
      patchState(store, { panX: 100, panY: 100, zoom: 1 });
    },

    rebalanceLayout() {
      patchState(store, { 
        nodeOffsets: {}, 
        panX: 100, 
        panY: 100, 
        zoom: 1 
      });
    },

    updateNodeOffset(hierarchyId: string, nodeId: string, dx: number, dy: number) {
      const nodeMap = store.layoutNodes();
      const currentOffsets = store.nodeOffsets();
      const nextOffsets = { ...currentOffsets };
      const visited = new Set<string>();

      // Ancestor/Descendant checker to avoid relative collision lock
      const isAncestor = (ancestorId: string, descendantId: string): boolean => {
        let current = nodeMap[descendantId];
        while (current && current.parentId) {
          if (current.parentId === ancestorId) return true;
          current = nodeMap[current.parentId];
        }
        return false;
      };

      // Gentle Least-Overlap Collision Push
      const pushNode = (targetId: string, shiftX: number, shiftY: number) => {
        if (visited.has(targetId)) return;
        visited.add(targetId);

        const offsetKey = `${hierarchyId}:${targetId}`;
        const existing = nextOffsets[offsetKey] || { x: 0, y: 0 };
        nextOffsets[offsetKey] = { x: existing.x + shiftX, y: existing.y + shiftY };

        const targetNode = nodeMap[targetId];
        if (!targetNode) return;

        // Apply shift to targetNode bounds for downstream sibling checks
        const targetNewX = targetNode.x + shiftX;
        const targetNewY = targetNode.y + shiftY;

        Object.values(nodeMap).forEach(other => {
          if (other.id === targetId || !other.isVisible || visited.has(other.id)) return;

          // Prevent collision checks between parents and their own children
          if (isAncestor(targetId, other.id) || isAncestor(other.id, targetId)) {
            return;
          }

          // Check for rectangular intersection using target's shifted coordinates
          const overlapX = Math.min(targetNewX + targetNode.width, other.x + other.width) - Math.max(targetNewX, other.x);
          const overlapY = Math.min(targetNewY + targetNode.height, other.y + other.height) - Math.max(targetNewY, other.y);

          if (overlapX > 0 && overlapY > 0) {
            // Push along the axis of minimum overlap (least possible movement)
            let siblingShiftX = 0;
            let siblingShiftY = 0;

            if (overlapX < overlapY) {
              // Push horizontally
              siblingShiftX = targetNewX < other.x ? overlapX + 15 : -(overlapX + 15);
            } else {
              // Push vertically
              siblingShiftY = targetNewY < other.y ? overlapY + 15 : -(overlapY + 15);
            }

            pushNode(other.id, siblingShiftX, siblingShiftY);
          }
        });
      };

      // The dragged node moves by the raw drag deltas (dx, dy)
      pushNode(nodeId, dx, dy);
      patchState(store, { nodeOffsets: nextOffsets });
    }
  }))
);
