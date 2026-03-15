"use client";

import { useRef, useCallback } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import cytoscape from "cytoscape";
import { GRAPH_COLORS } from "@/lib/theme";
import type { GraphData, GraphNode } from "@/lib/api";

const CY_STYLESHEET: cytoscape.StylesheetStyle[] = [
  // ── Grant ──────────────────────────────────────────────
  {
    selector: "node[type='Grant']",
    style: {
      "background-color": GRAPH_COLORS.Grant,
      "label": "data(label)",
      "color": "#8ba8c8" as unknown as string,
      "font-size": 7,
      "text-valign": "bottom",
      "text-margin-y": 4,
      "text-outline-color": "#040810" as unknown as string,
      "text-outline-width": 2.5,
      "width": "data(size)" as unknown as number,
      "height": "data(size)" as unknown as number,
      "border-width": 1,
      "border-color": "rgba(59,130,246,0.3)" as unknown as string,
      "text-max-width": "80px" as unknown as string,
      "text-wrap": "ellipsis",
    },
  },
  // ── Agency ─────────────────────────────────────────────
  {
    selector: "node[type='Agency']",
    style: {
      "background-color": GRAPH_COLORS.Agency,
      "label": "data(label)",
      "color": "#ffd580" as unknown as string,
      "font-size": 9,
      "font-weight": "bold",
      "text-outline-color": "#040810" as unknown as string,
      "text-outline-width": 2.5,
      "text-valign": "bottom",
      "text-margin-y": 7,
      "width": "data(size)" as unknown as number,
      "height": "data(size)" as unknown as number,
      "shape": "diamond",
      "border-width": 1.5,
      "border-color": "rgba(251,191,36,0.45)" as unknown as string,
      "text-max-width": "100px" as unknown as string,
      "text-wrap": "ellipsis",
    },
  },
  // ── TechArea ───────────────────────────────────────────
  {
    selector: "node[type='TechArea']",
    style: {
      "background-color": GRAPH_COLORS.TechArea,
      "label": "data(label)",
      "color": "#d8b4fe" as unknown as string,
      "font-size": 13,
      "font-weight": "bold",
      "text-outline-color": "#040810" as unknown as string,
      "text-outline-width": 3,
      "text-valign": "bottom",
      "text-margin-y": 10,
      "width": "data(size)" as unknown as number,
      "height": "data(size)" as unknown as number,
      "shape": "hexagon",
      "border-width": 2.5,
      "border-color": "rgba(167,139,250,0.55)" as unknown as string,
      "text-max-width": "130px" as unknown as string,
      "text-wrap": "ellipsis",
    },
  },
  // ── Hub node (drilldown center) ────────────────────────
  {
    selector: "node[?is_hub]",
    style: {
      "border-width": 3,
      "border-color": "#2D72D2" as unknown as string,
      "font-size": 13,
      "font-weight": "bold",
      "color": "#ffffff" as unknown as string,
      "text-margin-y": 12,
      "text-outline-width": 3,
      "overlay-color": "#2D72D2" as unknown as string,
      "overlay-opacity": 0.07,
      "overlay-padding": 10,
    },
  },
  // ── Edges ──────────────────────────────────────────────
  {
    selector: "edge",
    style: {
      "line-color": "rgba(255,255,255,0.06)" as unknown as string,
      "target-arrow-color": "rgba(255,255,255,0.08)" as unknown as string,
      "target-arrow-shape": "triangle",
      "curve-style": "bezier",
      "width": 1,
      "arrow-scale": 0.5,
    },
  },
  // ── Selected ───────────────────────────────────────────
  {
    selector: "node:selected",
    style: {
      "border-width": 3,
      "border-color": "#2D72D2" as unknown as string,
      "overlay-color": "#2D72D2" as unknown as string,
      "overlay-opacity": 0.18,
      "overlay-padding": 8,
    },
  },
  // ── Highlight / Fade ───────────────────────────────────
  {
    selector: "node.highlighted",
    style: {
      "border-width": 2.5,
      "border-color": "#2D72D2" as unknown as string,
      "opacity": 1,
    },
  },
  {
    selector: "edge.highlighted",
    style: {
      "line-color": "rgba(0,212,255,0.4)" as unknown as string,
      "opacity": 0.85,
    },
  },
  {
    selector: "node.faded",
    style: { "opacity": 0.1 },
  },
  {
    selector: "edge.faded",
    style: { "opacity": 0.04 },
  },
];

interface Props {
  data: GraphData;
  mode?: "overview" | "drilldown";
  onNodeClick?: (node: GraphNode["data"] | null) => void;
  cyRef?: React.MutableRefObject<cytoscape.Core | null>;
}

export default function KnowledgeGraph({ data, mode, onNodeClick, cyRef: externalCyRef }: Props) {
  const internalRef = useRef<cytoscape.Core | null>(null);
  const cyRefToUse = externalCyRef ?? internalRef;

  const elements = [...data.nodes, ...data.edges];
  const nodeCount = data.nodes.length;

  const handleCyInit = useCallback((cy: cytoscape.Core) => {
    cyRefToUse.current = cy;

    cy.on("tap", "node", (e) => {
      const node = e.target;
      onNodeClick?.(node.data());
      cy.elements().addClass("faded");
      const neighborhood = node.neighborhood().add(node);
      neighborhood.removeClass("faded").addClass("highlighted");
    });

    cy.on("tap", (e) => {
      if (e.target === cy) {
        cy.elements().removeClass("faded highlighted");
        onNodeClick?.(null);
      }
    });
  }, [onNodeClick, cyRefToUse]);

  // Layout strategy:
  // overview  → cose spread (up to 273 nodes)
  // drilldown ≤ 80  → concentric (hub at center, grants in outer ring)
  // drilldown > 80  → cose compact
  let layout: cytoscape.LayoutOptions;

  if (mode === "overview") {
    layout = {
      name: "cose",
      animate: true,
      animationDuration: 900,
      fit: true,
      padding: 60,
      randomize: false,
      nodeRepulsion: () => 18000,
      idealEdgeLength: () => 160,
      edgeElasticity: () => 50,
      gravity: 0.08,
      numIter: 1000,
    } as cytoscape.LayoutOptions;
  } else if (nodeCount <= 80) {
    layout = {
      name: "concentric",
      animate: true,
      animationDuration: 700,
      fit: true,
      padding: 80,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      concentric: (node: any) => (node.data("is_hub") ? 10 : 1),
      levelWidth: () => 1,
      minNodeSpacing: 28,
    } as cytoscape.LayoutOptions;
  } else {
    layout = {
      name: "cose",
      animate: false,
      fit: true,
      padding: 80,
      randomize: false,
      nodeRepulsion: () => 5000,
      idealEdgeLength: () => 75,
      gravity: 0.4,
      numIter: 500,
    } as cytoscape.LayoutOptions;
  }

  return (
    <CytoscapeComponent
      elements={elements}
      stylesheet={CY_STYLESHEET}
      layout={layout}
      style={{ width: "100%", height: "100%" }}
      cy={handleCyInit}
    />
  );
}
