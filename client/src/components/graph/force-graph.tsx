import React, { useEffect, useRef } from "react";
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

export default function ForceGraph({
  data = { nodes: [], links: [] },
  width = 800,
  height = 600,
  onNodeClick,
  onLinkClick,
  colorMap = {},
}: ForceGraphProps) {
  const ref = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!data || !data.nodes?.length) return;

    const svg = d3
      .select(ref.current)
      .attr("viewBox", [0, 0, width, height])
      .style("background", "#0b1120")
      .style("border-radius", "1rem");

    const simulation = d3
      .forceSimulation(data.nodes)
      .force(
        "link",
        d3
          .forceLink(data.links)
          .id((d: any) => d.id)
          .distance(120),
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2));

    const link = svg
      .append("g")
      .attr("stroke", "#aaa")
      .attr("stroke-opacity", 0.7)
      .selectAll("line")
      .data(data.links)
      .join("line")
      .attr("stroke-width", (d) => (d.value ? Math.sqrt(d.value) : 2))
      .on("click", (_, d) => onLinkClick?.(d));

    const node = svg
      .append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .selectAll("circle")
      .data(data.nodes)
      .join("circle")
      .attr("r", 10)
      .attr("fill", (d) => {
        if (d.group && colorMap[d.group]) return colorMap[d.group];
        if (d.group) return d3.schemeTableau10[d.group.charCodeAt(0) % 10];
        return "#60a5fa";
      })
      .on("click", (_, d) => onNodeClick?.(d))
      .call(
        d3
          .drag<SVGCircleElement, GraphNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            (d as any).fx = d.x;
            (d as any).fy = d.y;
          })
          .on("drag", (event, d) => {
            (d as any).fx = event.x;
            (d as any).fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            (d as any).fx = null;
            (d as any).fy = null;
          }),
      );

    const label = svg
      .append("g")
      .attr("text-anchor", "middle")
      .attr("font-family", "sans-serif")
      .attr("fill", "#e0f2fe")
      .selectAll("text")
      .data(data.nodes)
      .join("text")
      .text((d) => d.label ?? String(d.id))
      .attr("font-size", 14);

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("cx", (d: any) => d.x).attr("cy", (d: any) => d.y);
      label.attr("x", (d: any) => d.x).attr("y", (d: any) => d.y - 15);
    });

    return () => svg.selectAll("*").remove();
  }, [data, width, height, colorMap, onNodeClick, onLinkClick]);

  return <svg ref={ref} className="w-full h-full"></svg>;
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
