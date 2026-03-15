"use client";

import { useRef } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import cytoscape from "cytoscape";
import { GRAPH_COLORS } from "@/lib/theme";
import type { GraphData, GraphNode } from "@/lib/api";

const CY_STYLESHEET: cytoscape.Stylesheet[] = [
  {
    selector: "node[type='Grant']",
    style: {
      "background-color": GRAPH_COLORS.Grant,
      "label": "data(label)",
      "color": "#e8edf5",
      "font-size": 9,
      "text-valign": "bottom",
      "text-margin-y": 4,
      "width": 20,
      "height": 20,
      "border-width": 1,
      "border-color": "rgba(59,130,246,0.5)",
    },
  },
  {
    selector: "node[type='Agency']",
    style: {
      "background-color": GRAPH_COLORS.Agency,
      "label": "data(label)",
      "color": "#e8edf5",
      "font-size": 9,
      "width": 28,
      "height": 28,
      "shape": "diamond",
    },
  },
  {
    selector: "node[type='TechArea']",
    style: {
      "background-color": GRAPH_COLORS.TechArea,
      "label": "data(label)",
      "color": "#e8edf5",
      "font-size": 10,
      "width": 32,
      "height": 32,
      "shape": "hexagon",
    },
  },
  {
    selector: "node[type='Company']",
    style: {
      "background-color": GRAPH_COLORS.Company,
      "label": "data(label)",
      "color": "#e8edf5",
      "font-size": 9,
      "width": 18,
      "height": 18,
    },
  },
  {
    selector: "edge",
    style: {
      "line-color": "rgba(255,255,255,0.1)",
      "target-arrow-color": "rgba(255,255,255,0.15)",
      "target-arrow-shape": "triangle",
      "curve-style": "bezier",
      "width": 1,
      "arrow-scale": 0.7,
    },
  },
  {
    selector: "node:selected",
    style: {
      "border-width": 3,
      "border-color": "#00d4ff",
      "background-color": "#00d4ff",
    },
  },
];

interface Props {
  data: GraphData;
  onNodeClick?: (node: GraphNode["data"]) => void;
}

export default function KnowledgeGraph({ data, onNodeClick }: Props) {
  const cyRef = useRef<cytoscape.Core | null>(null);
  const elements = [...data.nodes, ...data.edges];

  function handleCyInit(cy: cytoscape.Core) {
    cyRef.current = cy;
    cy.on("tap", "node", (e) => {
      const nodeData = e.target.data();
      onNodeClick?.(nodeData);
    });
  }

  return (
    <div
      className="h-full w-full rounded-xl overflow-hidden"
      style={{ background: "#0a0e1a", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <CytoscapeComponent
        elements={elements}
        stylesheet={CY_STYLESHEET}
        layout={{
          name: "cose",
          animate: true,
          animationDuration: 800,
          fit: true,
          padding: 40,
          randomize: true,
        }}
        style={{ width: "100%", height: "100%" }}
        cy={handleCyInit}
      />
    </div>
  );
}
