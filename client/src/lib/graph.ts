export type GraphNodeId = string | number;

export interface GraphNode {
  id: GraphNodeId;
  label?: string;
  group?: string;
  [key: string]: unknown;
}

export interface GraphLink {
  source: GraphNodeId;
  target: GraphNodeId;
  value?: number;
  [key: string]: unknown;
}

export interface ForceGraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}
