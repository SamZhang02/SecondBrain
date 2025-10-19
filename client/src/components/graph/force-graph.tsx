import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";

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

interface ForceGraphProps {
  data?: ForceGraphData;
  width?: number;
  height?: number;
  onNodeClick?: (node: GraphNode) => void;
  onLinkClick?: (link: GraphLink) => void;
  colorMap?: Record<string, string>; // group -> color mapping
  forceConfig?: Partial<D3ForceConfig>;
}

interface D3ForceConfig {
  repelForce: number;
  centerForce: number;
  linkDistance: number;
}

const DEFAULT_FORCE_CONFIG: D3ForceConfig = {
  repelForce: 0.8,
  centerForce: 0.3,
  linkDistance: 120,
};

const ROOT_NODE_ID = "__graph_root__";
const ROOT_NODE_LABEL = "Knowledge Hub";

const DOCUMENT_KEYWORDS = ["document", "doc", "file"] as const;

const isDocumentNode = (node: GraphNode) => {
  const lowerValue = (value: unknown) =>
    typeof value === "string" ? value.toLowerCase() : "";

  const group = lowerValue(node.group);
  if (DOCUMENT_KEYWORDS.some((keyword) => group.includes(keyword))) {
    return true;
  }

  const candidateKeys: string[] = [
    "type",
    "kind",
    "category",
    "nodeType",
    "node_type",
  ];

  const extendedNode = node as Record<string, unknown>;

  if (typeof extendedNode.document === "boolean") {
    return extendedNode.document;
  }

  return candidateKeys.some((key) => {
    const value = key in extendedNode ? extendedNode[key] : undefined;
    const lowered = lowerValue(value);
    return DOCUMENT_KEYWORDS.some((keyword) => lowered.includes(keyword));
  });
};

type InternalGraphNode = GraphNode & d3.SimulationNodeDatum;
type InternalGraphLink = GraphLink & d3.SimulationLinkDatum<InternalGraphNode>;

export default function ForceGraph({
  data = { nodes: [], links: [] },
  width,
  height,
  onNodeClick,
  onLinkClick,
  colorMap,
  forceConfig,
}: ForceGraphProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({
    width: width ?? 800,
    height: height ?? 600,
  });
  const resolvedForceConfig = useMemo(
    () => ({ ...DEFAULT_FORCE_CONFIG, ...forceConfig }),
    [forceConfig],
  );

  useEffect(() => {
    if (typeof width === "number" && typeof height === "number") {
      setCanvasSize((current) => {
        if (current.width === width && current.height === height)
          return current;
        return { width, height };
      });
      return;
    }

    const svgEl = svgRef.current;
    if (!svgEl || typeof ResizeObserver === "undefined") {
      return;
    }

    const updateFromRect = (rect: DOMRectReadOnly) => {
      const nextWidth = Math.max(1, rect.width);
      const nextHeight = Math.max(1, rect.height);
      setCanvasSize((current) => {
        if (current.width === nextWidth && current.height === nextHeight) {
          return current;
        }
        return { width: nextWidth, height: nextHeight };
      });
    };

    updateFromRect(svgEl.getBoundingClientRect());

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      updateFromRect(entry.contentRect);
    });

    observer.observe(svgEl);

    return () => observer.disconnect();
  }, [width, height]);

  useEffect(() => {
    if (!data || !data.nodes?.length) return;

    const computedWidth = canvasSize.width;
    const computedHeight = canvasSize.height;
    if (!computedWidth || !computedHeight) return;

    const svg = d3
      .select(svgRef.current)
      .attr("viewBox", [0, 0, computedWidth, computedHeight])
      .style("background", "hsl(var(--background))")
      .style("border-radius", "1rem")
      .style("border", "1px solid hsl(var(--border))");

    svg.selectAll("*").remove();

    const userNodes = data.nodes ?? [];
    const userLinks = data.links ?? [];

    const nodes = userNodes.map((node) => ({
      ...node,
    })) as InternalGraphNode[];

    const links = userLinks.map((link) => ({
      ...link,
    })) as InternalGraphLink[];

    if (!nodes.some((node) => node.id === ROOT_NODE_ID)) {
      nodes.push({
        id: ROOT_NODE_ID,
        label: ROOT_NODE_LABEL,
        group: "root",
      } as InternalGraphNode);
    }

    const documentNodes = userNodes.filter((node) => isDocumentNode(node));
    const documentNodeIds = new Set(documentNodes.map((node) => node.id));

    const toNodeId = (ref: GraphNodeId | InternalGraphNode): GraphNodeId => {
      if (typeof ref === "object" && ref !== null) {
        return (ref as InternalGraphNode).id;
      }
      return ref;
    };

    const existingRootLinks = new Set(
      links
        .filter((link) => toNodeId(link.source) === ROOT_NODE_ID)
        .map((link) => toNodeId(link.target))
        .filter((targetId) => documentNodeIds.has(targetId)),
    );

    documentNodes.forEach((node) => {
      if (node.id === ROOT_NODE_ID) return;
      if (existingRootLinks.has(node.id)) return;
      links.push({
        source: ROOT_NODE_ID,
        target: node.id,
        value: 1,
      } as InternalGraphLink);
    });

    const nodeById = new Map<GraphNodeId, InternalGraphNode>();
    nodes.forEach((node) => nodeById.set(node.id, node));
    const fillColors = colorMap ?? {};
    const radius = 5;
    const getNodeRadius = (node: InternalGraphNode) =>
      node.id === ROOT_NODE_ID ? radius * 2 : radius;

    const simulation = d3
      .forceSimulation<InternalGraphNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<InternalGraphNode, InternalGraphLink>(links)
          .id((node) => node.id)
          .distance(resolvedForceConfig.linkDistance),
      )
      .force(
        "charge",
        d3
          .forceManyBody()
          .strength(-600 * resolvedForceConfig.repelForce)
          .distanceMin(20)
          .distanceMax(500),
      )
      .force("center", d3.forceCenter(computedWidth / 2, computedHeight / 2))
      .force(
        "x",
        d3.forceX(computedWidth / 2).strength(resolvedForceConfig.centerForce),
      )
      .force(
        "y",
        d3.forceY(computedHeight / 2).strength(resolvedForceConfig.centerForce),
      )
      .force(
        "collision",
        d3.forceCollide<InternalGraphNode>().radius((d) => {
          if (d.id === ROOT_NODE_ID) {
            return getNodeRadius(d) * 1.6;
          }
          const textWidth = d.label?.length ?? 1;
          return Math.max(getNodeRadius(d), textWidth * 0.6);
        }),
      );

    const rootNode = nodeById.get(ROOT_NODE_ID);
    if (rootNode) {
      rootNode.fx = computedWidth / 2;
      rootNode.fy = computedHeight / 2;
    }

    const clamp = (value: number, min: number, max: number) =>
      Math.max(min, Math.min(max, value));
    const resolveLinkNode = (
      ref: InternalGraphNode | GraphNodeId,
    ): InternalGraphNode | undefined => {
      if (typeof ref === "object" && ref !== null) {
        return ref as InternalGraphNode;
      }
      return nodeById.get(ref);
    };

    const link = svg
      .append("g")
      .attr("stroke", "var(--foreground)")
      .attr("stroke-opacity", 0.7)
      .selectAll<SVGLineElement, InternalGraphLink>("line")
      .data(links)
      .join("line")
      .attr("stroke-width", (d) => (d.value ? Math.sqrt(d.value) : 2))
      .on("click", (_, d) => onLinkClick?.(d));

    const node = svg
      .append("g")
      .selectAll<SVGCircleElement, InternalGraphNode>("circle")
      .data(nodes)
      .join("circle")
      .attr("r", (d) => getNodeRadius(d))
      .attr("fill", (d) => {
        if (d.id === ROOT_NODE_ID) return "#f97316";
        if (d.group && fillColors[d.group]) return fillColors[d.group];
        if (d.group) return d3.schemeTableau10[d.group.charCodeAt(0) % 10];
        return "#60a5fa";
      })
      .on("click", (_, d) => onNodeClick?.(d))
      .call(
        d3
          .drag<SVGCircleElement, InternalGraphNode>()
          .on("start", (event, d) => {
            if (d.id === ROOT_NODE_ID) return;
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            if (d.id === ROOT_NODE_ID) return;
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (d.id === ROOT_NODE_ID) return;
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      );

    const label = svg
      .append("g")
      .attr("text-anchor", "middle")
      .attr("font-family", "sans-serif")
      .attr("fill", "hsl(var(--foreground))")
      .selectAll<SVGTextElement, InternalGraphNode>("text")
      .data(nodes)
      .join("text")
      .text((d) => d.label ?? String(d.id))
      .attr("font-size", (d) => (d.id === ROOT_NODE_ID ? 10 : 8))
      .attr("font-weight", (d) => (d.id === ROOT_NODE_ID ? "600" : null));

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => resolveLinkNode(d.source)?.x ?? computedWidth / 2)
        .attr("y1", (d) => resolveLinkNode(d.source)?.y ?? computedHeight / 2)
        .attr("x2", (d) => resolveLinkNode(d.target)?.x ?? computedWidth / 2)
        .attr("y2", (d) => resolveLinkNode(d.target)?.y ?? computedHeight / 2);

      node
        .attr("cx", (d) => {
          const currentRadius = getNodeRadius(d);
          d.x = clamp(
            d.x ?? computedWidth / 2,
            currentRadius,
            computedWidth - currentRadius,
          );
          return d.x;
        })
        .attr("cy", (d) => {
          const currentRadius = getNodeRadius(d);
          d.y = clamp(
            d.y ?? computedHeight / 2,
            currentRadius,
            computedHeight - currentRadius,
          );
          return d.y;
        });

      label
        .attr("x", (d) => d.x ?? computedWidth / 2)
        .attr("y", (d) => (d.y ?? computedHeight / 2) - (getNodeRadius(d) + 5));
    });

    return () => {
      simulation.stop();
      svg.selectAll("*").remove();
    };
  }, [
    data,
    canvasSize,
    colorMap,
    onNodeClick,
    onLinkClick,
    resolvedForceConfig,
  ]);

  return <svg ref={svgRef} className="w-full h-full"></svg>;
}
//

// Usage
// const mockData: ForceGraphData = {
//   nodes: [
//     { id: 1, label: "Sam", group: "Engineering", role: "Developer" },
//     { id: 2, label: "Alice", group: "Design", role: "Designer" },
//     { id: 3, label: "Bob", group: "Product", role: "PM" },
//     { id: 4, label: "Eve", group: "Security", role: "Analyst" },
//     { id: 5, label: "Charlie", group: "Engineering", role: "DevOps" },
//   ],
//   links: [
//     { source: 1, target: 2, value: 1 },
//     { source: 1, target: 3, value: 2 },
//     { source: 2, target: 4, value: 1 },
//     { source: 3, target: 4, value: 1 },
//     { source: 1, target: 5, value: 3 },
//   ],
// };
//
// export default function ForceGraphDemo() {
//   const colorMap = {
//     Engineering: "#4ade80",
//     Design: "#60a5fa",
//     Product: "#facc15",
//     Security: "#f87171",
//   };
//
//   const handleNodeClick = (node: GraphNode) => {
//     console.log("Node clicked:", node);
//   };
//
//   const handleLinkClick = (link: GraphLink) => {
//     console.log("Link clicked:", link);
//   };
//
//   return (
//     <div className="flex justify-center items-center h-screen bg-slate-900">
//       <ForceGraph
//         data={mockData}
//         width={900}
//         height={600}
//         onNodeClick={handleNodeClick}
//         onLinkClick={handleLinkClick}
//         colorMap={colorMap}
//       />
//     </div>
//   );
// }
