declare module "react-cytoscapejs" {
  import { Component } from "react";
  import cytoscape from "cytoscape";

  interface CytoscapeComponentProps {
    id?: string;
    className?: string;
    style?: React.CSSProperties | string;
    elements: cytoscape.ElementDefinition[];
    stylesheet?: (cytoscape.StylesheetStyle | cytoscape.StylesheetCSS)[];
    layout?: cytoscape.LayoutOptions & Record<string, unknown>;
    pan?: cytoscape.Position;
    zoom?: number;
    panningEnabled?: boolean;
    userPanningEnabled?: boolean;
    minZoom?: number;
    maxZoom?: number;
    zoomingEnabled?: boolean;
    userZoomingEnabled?: boolean;
    boxSelectionEnabled?: boolean;
    autoungrabify?: boolean;
    autolock?: boolean;
    autounselectify?: boolean;
    cy?: (cy: cytoscape.Core) => void;
    headless?: boolean;
    [key: string]: unknown;
  }

  class CytoscapeComponent extends Component<CytoscapeComponentProps> {
    static normalizeElements(
      elements: cytoscape.ElementDefinition[] | { nodes: cytoscape.ElementDefinition[]; edges: cytoscape.ElementDefinition[] }
    ): cytoscape.ElementDefinition[];
  }

  export default CytoscapeComponent;
}
