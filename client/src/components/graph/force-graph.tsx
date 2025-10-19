import React, { useEffect, useRef, useState } from "react";
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
}

type InternalGraphNode = GraphNode & d3.SimulationNodeDatum;
type InternalGraphLink = GraphLink & d3.SimulationLinkDatum<InternalGraphNode>;

export default function ForceGraph({
  data = { nodes: [], links: [] },
  width,
  height,
  onNodeClick,
  onLinkClick,
  colorMap,
}: ForceGraphProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({
    width: width ?? 800,
    height: height ?? 600,
  });

  useEffect(() => {
    if (typeof width === "number" && typeof height === "number") {
      setCanvasSize((current) => {
        if (current.width === width && current.height === height) return current;
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
      .style("background", "#0b1120")
      .style("border-radius", "1rem");

    svg.selectAll("*").remove();

    const nodes = data.nodes.map((node) => ({ ...node })) as InternalGraphNode[];
    const links = data.links.map((link) => ({ ...link })) as InternalGraphLink[];
    const nodeById = new Map<GraphNodeId, InternalGraphNode>();
    nodes.forEach((node) => nodeById.set(node.id, node));
    const fillColors = colorMap ?? {};

    const simulation = d3
      .forceSimulation<InternalGraphNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<InternalGraphNode, InternalGraphLink>(links)
          .id((node) => node.id)
          .distance(120),
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(computedWidth / 2, computedHeight / 2))
      .force("x", d3.forceX(computedWidth / 2).strength(0.3))
      .force("y", d3.forceY(computedHeight / 2).strength(0.3));

    const clamp = (value: number, min: number, max: number) =>
      Math.max(min, Math.min(max, value));
    const radius = 10;
    const resolveLinkNode = (
      ref: InternalGraphNode | GraphNodeId,
    ): InternalGraphNode | undefined => {
      if (typeof ref === "object") {
        return ref as InternalGraphNode;
      }
      return nodeById.get(ref);
    };

    const link = svg
      .append("g")
      .attr("stroke", "#aaa")
      .attr("stroke-opacity", 0.7)
      .selectAll<SVGLineElement, InternalGraphLink>("line")
      .data(links)
      .join("line")
      .attr("stroke-width", (d) => (d.value ? Math.sqrt(d.value) : 2))
      .on("click", (_, d) => onLinkClick?.(d));

    const node = svg
      .append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .selectAll<SVGCircleElement, InternalGraphNode>("circle")
      .data(nodes)
      .join("circle")
      .attr("r", radius)
      .attr("fill", (d) => {
        if (d.group && fillColors[d.group]) return fillColors[d.group];
        if (d.group) return d3.schemeTableau10[d.group.charCodeAt(0) % 10];
        return "#60a5fa";
      })
      .on("click", (_, d) => onNodeClick?.(d))
      .call(
        d3
          .drag<SVGCircleElement, InternalGraphNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      );

    const label = svg
      .append("g")
      .attr("text-anchor", "middle")
      .attr("font-family", "sans-serif")
      .attr("fill", "#e0f2fe")
      .selectAll<SVGTextElement, InternalGraphNode>("text")
      .data(nodes)
      .join("text")
      .text((d) => d.label ?? String(d.id))
      .attr("font-size", 14);

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => resolveLinkNode(d.source)?.x ?? computedWidth / 2)
        .attr("y1", (d) => resolveLinkNode(d.source)?.y ?? computedHeight / 2)
        .attr("x2", (d) => resolveLinkNode(d.target)?.x ?? computedWidth / 2)
        .attr("y2", (d) => resolveLinkNode(d.target)?.y ?? computedHeight / 2);

      node
        .attr("cx", (d) => {
          d.x = clamp(d.x ?? computedWidth / 2, radius, computedWidth - radius);
          return d.x;
        })
        .attr("cy", (d) => {
          d.y = clamp(
            d.y ?? computedHeight / 2,
            radius,
            computedHeight - radius,
          );
          return d.y;
        });

      label
        .attr("x", (d) => d.x ?? computedWidth / 2)
        .attr("y", (d) => (d.y ?? computedHeight / 2) - (radius + 5));
    });

    return () => {
      simulation.stop();
      svg.selectAll("*").remove();
    };
  }, [data, canvasSize, colorMap, onNodeClick, onLinkClick]);

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
