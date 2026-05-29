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

        // If the node is not visible, it has no dimensions
        if (!node.isVisible) {
          return { width: 0, height: 0 };
        }

        // If it's a leaf or collapsed, it has a fixed component size
        if (node.isLeaf || !node.isExpanded || node.childrenIds.length === 0) {
          node.width = 240;
          node.height = 115;
          return { width: 240, height: 115 };
        }

        // Otherwise, it is an expanded container. We lay out visible children side-by-side (flex row)
        const visibleChildren = node.childrenIds.map(cid => nodeMap[cid]).filter(c => c && c.isVisible);

        if (visibleChildren.length === 0) {
          node.width = 240;
          node.height = 115;
          return { width: 240, height: 115 };
        }

        const paddingX = 30;
        const paddingTop = 65;
        const paddingBottom = 25;
        const gap = 35;

        // Compute sizes of children recursively
        let cumulativeWidth = 0;

        visibleChildren.forEach((child, index) => {
          const { width } = computeNodeSizeAndLayout(child.id);
          
          // Place child locally inside parent, adding its drag offset
          const offsetKey = `${activeHierarchy.id}:${child.id}`;
          const offset = nodeOffsets[offsetKey] || { x: 0, y: 0 };

          // Add padding and cumulative width on top of any child's internal shifts (child.x starts as -shiftX if shifted)
          child.x += paddingX + cumulativeWidth + offset.x;
          child.y += paddingTop + offset.y;

          cumulativeWidth += width;
          if (index < visibleChildren.length - 1) {
            cumulativeWidth += gap;
          }
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

      // 4. Position top-level root nodes
      let currentX = 0;
      const rootGap = 80;

      roots.forEach(root => {
        const node = nodeMap[root.id];
        if (node && node.isVisible) {
          computeNodeSizeAndLayout(node.id);
          
          const offsetKey = `${activeHierarchy.id}:${node.id}`;
          const offset = nodeOffsets[offsetKey] || { x: 0, y: 0 };

          // Add starting layout coordinates on top of any internal container shifts (node.x starts as -shiftX if shifted)
          node.x += currentX + offset.x;
          node.y += 10 + offset.y;
          currentX += node.width + rootGap;
        }
      });

      // 5. Translate local relative coordinates of nested children to global absolute coordinates, and compute depth recursively
      const applyGlobalTranslations = (nodeId: string, parentGlobalX: number, parentGlobalY: number, parentDepth: number) => {
        const node = nodeMap[nodeId];
        if (!node || !node.isVisible) return;

        // Add parent coordinates to get global absolute coordinate space
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
    async loadTopology() {
      patchState(store, { loading: true });
      try {
        const yamlText = await firstValueFrom(
          http.get('/topology.yaml', { responseType: 'text' })
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
        console.error('Failed to load topology.yaml manifest', err);
        patchState(store, { loading: false });
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

      // Recursive push function
      const pushNode = (targetId: string, deltaX: number, deltaY: number) => {
        if (visited.has(targetId)) return;
        visited.add(targetId);

        const offsetKey = `${hierarchyId}:${targetId}`;
        const existing = nextOffsets[offsetKey] || { x: 0, y: 0 };
        nextOffsets[offsetKey] = { x: existing.x + deltaX, y: existing.y + deltaY };

        const targetNode = nodeMap[targetId];
        if (!targetNode) return;

        // Visual bounding boundaries for collision check (adding delta to target position)
        const targetNewX = targetNode.x + deltaX;
        const targetNewY = targetNode.y + deltaY;

        Object.values(nodeMap).forEach(other => {
          if (other.id === targetId || !other.isVisible || visited.has(other.id)) return;

          // Prevent collision checks between parents and their own children (and vice versa)
          if (isAncestor(targetId, other.id) || isAncestor(other.id, targetId)) {
            return;
          }

          // Check for rectangular intersection
          const overlapX = Math.min(targetNewX + targetNode.width, other.x + other.width) - Math.max(targetNewX, other.x);
          const overlapY = Math.min(targetNewY + targetNode.height, other.y + other.height) - Math.max(targetNewY, other.y);

          if (overlapX > 0 && overlapY > 0) {
            // Push recursive sibling by the exact drag movement deltas
            pushNode(other.id, deltaX, deltaY);
          }
        });
      };

      pushNode(nodeId, dx, dy);
      patchState(store, { nodeOffsets: nextOffsets });
    }
  }))
);
