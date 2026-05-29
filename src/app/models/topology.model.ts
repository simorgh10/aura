export interface ComponentTypeConfig {
  icon: string;
  css?: Record<string, string>;
}

export interface EdgeTypeConfig {
  css?: Record<string, string>;
}

export interface ProfileConfig {
  id: string;
  props: Record<string, string>;
}

export interface HierarchyTreeNode {
  id: string;
  type: string;
  children?: string[];
}

export interface HierarchyConfig {
  id: string;
  name: string;
  default_profile: string;
  layers: string[];
  tree: HierarchyTreeNode[];
  profiles?: ProfileConfig[];
}

export interface ComponentNodeConfig {
  id: string;
  type: string;
  name: string;
  docs?: string;
  links?: Array<{ type: string; url: string }>;
  ports?: string[];
  css?: Record<string, string>;
}

export interface EdgeConfig {
  from: string; // e.g., "order-api:out"
  to: string;   // e.g., "payment-gateway:in"
  type: string;
}

export interface TopologyManifest {
  version: string;
  types: {
    components: Record<string, ComponentTypeConfig>;
    edges: Record<string, EdgeTypeConfig>;
  };
  profiles: ProfileConfig[];
  hierarchies: HierarchyConfig[];
  components: ComponentNodeConfig[];
  edges: EdgeConfig[];
}

// Runtime representation of a UI Component Node
export interface UINode {
  id: string;
  type: string;
  name: string;
  docs?: string;
  links?: Array<{ type: string; url: string }>;
  ports: string[];
  css?: Record<string, string>;
  
  // Hierarchical state
  parentId?: string;
  childrenIds: string[];
  isLeaf: boolean;
  isExpanded: boolean;
  isVisible: boolean; // affected by hiddenLayers and profile
  depth: number;

  // Layout boundaries (dynamic offset and dimension)
  x: number;
  y: number;
  width: number;
  height: number;
}

// Runtime representation of a UI Edge
export interface UIEdge {
  fromNodeId: string;
  fromPort: string;
  toNodeId: string;
  toPort: string;
  type: string;
  css?: Record<string, string>;

  // Computed layout points
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  
  // Re-anchored actual nodes (if bubble up occurred)
  visualFromNodeId: string;
  visualToNodeId: string;
  isReanchored: boolean;
}
