"use strict";

const {Xml, Text, Cdata} = require("./helpers/xml.js");

function Renderer() {
  // configuration
  this._style = `
    rect {
      opacity: 0.8;
      fill: #ffffff;
      stroke-width: 1;
      stroke: #222222;
    }
    rect.port {
      opacity: 1;
      fill: #ffffff;
    }
    text {
      font-size: 14px;
      font-family: "Times New Roman";
      /* in elk's coordinates "hanging" would be the correct value" */
      /* dominant-baseline: hanging; replaced with y = y + height/2 for compatibility */
      text-align: left;
    }
    g.port > text {
      font-size: 14px;
    }
    polyline {
      fill: none;
      stroke: black;
      stroke-width: 1;
    }
    path {
      fill: none;
      stroke: black;
      stroke-width: 4;
    }
  `;
  //arrowhead for definitions
  this._defs = new Xml(
    "marker",
    {
      "id": "arrowhead",
      "markerWidth": "10",
      "markerHeight": "6",
      "refX": "0",
      "refY": "3",
      "orient": "auto"
      },
      [
        new Xml("polygon", {"points": "0 0, 10 3, 0 6",  "fill": "black"})
      ]
  );
  //background color
  //<rect width="100%" height="100%" fill="white"/>
  this._background = new Xml(
    "rect", 
    {
      "width":"100%",
      "height":"100%",
      "fill":"white"
    }
  );

  this.reset();
}

Renderer.prototype = {
  constructor: Renderer,

  reset() {
    // internal housekeeping
    this._edgeRoutingStyle = {
      __global: "POLYLINE"
    };
    this._parentIds = {};
    this._edgeParents = {};
  },

  init(root) {
    // reset
    this.reset();
    this.registerParentIds(root);
    this.registerEdges(root);
  },

  /* Utility methods. */

  // edges can be specified anywhere, there coordinates however are relative
  //  a) to the source node's parent
  //  b) the source node, if the target is a descendant of the source node
  isDescendant(parent, node) {
    var current = node.id;
    while (this._parentIds[current]) {
      current = this._parentIds[current];
      if (current == parent.id) {
          return true;
      }
    }
    return false;
  },

  getOption(e, id) {
    if (!e) {
      return undefined;
    }
    if (e.id) {
      return e.id;
    }
    var suffix = id.substr(id.lastIndexOf('.') + 1);
    if (e[suffix]) {
      return e[suffix];
    }
    return undefined;
  },

  registerParentIds(p) {
    this._edgeParents[p.id] = [];
    if (p.properties) {
      var er = this.getOption(p.properties,p.id);
      if (er) {
        this._edgeRoutingStyle[p.id] = er;
      }
    }
    (p.children || []).forEach((c) => {
      this._parentIds[c.id] = p.id;
      this.registerParentIds(c);
    });
  },

  registerEdges(p) {
    (p.edges || []).forEach((e) => {
      e.sources.forEach(source_id => {
        e.targets.forEach(target_id => {
          if (source_id.includes(":")) {
            source_id = source_id.slice(0, source_id.indexOf(":"));
          }
          if (!this.isDescendant(source_id, target_id)) {
            source_id = this._parentIds[source_id];
          }
          this._edgeParents[source_id].push(e);
        });
      });
    });
    (p.children || []).forEach(c => this.registerEdges(c));
  },

  /*
   * Rendering methods.
   */

  renderRoot(root, styles="DEFAULT", defs="DEFAULT", background="DEFAULT") {
    var children = [];

    var defsChildren = [];
    var renderDefs = (styles != null || defs != null);
    
    if (renderDefs) {
      if (styles != null) {
        defsChildren.push(this.svgCss(styles == "DEFAULT"? this._style: styles));
      }
      if (defs != null) {
        defsChildren.push(defs == "DEFAULT"? this._defs: new Text(defs));
      }

      children.push(new Xml("defs", {}, defsChildren));

      // Only add background when we're also adding defs
      if (background != null) {
        children.push(background == "DEFAULT" ? this._background : background);
      }
    }

    children.push(this.renderGraph(root));

    return new Xml(
      "svg",
      {
          "version": "1.1",
          "xmlns": "http://www.w3.org/2000/svg",
          "width": root.width || 100,
          "height": root.height || 100
      },
      children
    );
  },

  renderGraph(graph) {
    var children = [];

    // paint edges first so that ports are drawn on top of them
    for (const edge of this._edgeParents[graph.id]) {
      children.push(this.renderEdge(edge, graph));
      if (edge.labels) {
        //overall definition arrow location
        var edge_min_x = [];
        var edge_min_y = [];
        for (const l of edge.labels) {
          children.push(this.renderLabel(l));
          edge_min_x.push(l.x);
          edge_min_y.push(l.y);
        }
        //console.log(edge_min_x)
        //console.log(edge_min_y)
        if (edge.class && (edge.class.includes("USE FROM") || edge.class.includes("REFERENCE FROM") || edge.class.includes("use") || edge.class.includes("reference"))) {
          edge.x = Math.min(...edge_min_x);
          edge.y = Math.min(...edge_min_y);
          children.push(this.renderEdgeDefinitionArrow(edge))
          //console.log(edge)
        }
      }
    }
    // render nodes with absolute coordinates
    for (const child of graph.children) {
      if (Array.isArray(child.class)) {
        if (child.class.includes("ellipse")) {
          children.push(this.renderEllipse(child));
        } else if (child.class.includes("circle")) {
          children.push(this.renderCircle(child));
        } else if (child.class.includes("Schema")) {
          children.push(this.renderSchemaBlock(child));
        } else if (child.class.includes("Entity")) {
          children.push(this.renderEntityBlock(child));
        } else if (child.class.includes("SubTypeConstraint")) {
          children.push(this.renderSubTypeConstraintBlock(child));
        } else if (child.class.includes("Referenced")) {
          children.push(this.renderReferencedBlock(child));
        } else if (child.class.includes("UsedFrom")) {
          children.push(this.renderUsedFromBlock(child));
        } else if (child.class.includes("SimpleDataType")) {
          children.push(this.renderSimpleDataTypeBlock(child));
        } else if (child.class.includes("GenericEntityBlock")) {
          children.push(this.renderGenericEntityBlock(child));
        } else if (child.class.includes("ConstructedDataTypeBlock")) {
          children.push(this.renderConstructedDataTypeBlock(child));
        } else if (child.class.includes("GROUPER")) {
          //do nothing
        } else {
          children.push(this.renderRectangle(child));
        }
      } else {
        children.push(this.renderRectangle(child));
      }
      //render ports and labels with relative coordinates to parent shape, i.e. rectangle 
      if (child.ports || child.labels) {
        children.push(this.renderPortsAndLabels(child))
      }

      if (child.children != null && child.children.length > 0) {
        children.push(this.renderGraph(child));
      }
    }

    // Only add transform group if there's actual translation needed
    const x = graph.x || 0;
    const y = graph.y || 0;
    if (x !== 0 || y !== 0) {
      return new Xml("g", {"transform": `translate(${x},${y})`}, children);
    } else {
      // For root level or zero-offset graphs, return children directly wrapped in a simple group
      return new Xml("g", {}, children);
    }
  },

  renderPortsAndLabels(node) {
    var children = [];
    if (node.ports) {
      for (const p of node.ports) {
        if (Array.isArray(p.class)) {
          if (p.class.includes("ellipse")) {
            children.push(this.renderEllipse(p));
          } else if (p.class.includes("circle")) {
            children.push(this.renderCircle(p));
          } else { 
            children.push(this.renderRectangle(p));  
          }
        } else {
          // Changed: render rectangle instead of circle port to match original behavior
          children.push(this.renderRectangle(p));
        }

        if (p.labels) {
          children.push(this.renderPort(p));
        }
      }
    }
    if (node.labels) {
      for (const l of node.labels) {
        children.push(this.renderLabel(l));
      }
    }

    return new Xml("g", {"transform": `translate(${node.x || 0},${node.y || 0})`}, children);
  },

  renderRectangle(node) {
    return new Xml("rect", {
      ...this.idClass(node, "node"),
      ...this.posSizeRectangle(node),
      ...this.style(node),
      ...this.attributes(node)
    })
  },

  renderEdgeDefinitionArrow(e) {
    return new Xml("line", {
      ...this.idClass(e, "edge_arrow"),
      ...this.posSizeDefinitionLine(e),
      ...this.attributes(e)
    })
  },

  renderTopRectangle(node) {
    return new Xml("rect", {
      ...this.idClass(node, "node"),
      ...this.posSizeTopRectangle(node),
      ...this.attributes(node)
    })
  },

  renderBottomRectangle(node) {
    return new Xml("rect", {
      ...this.idClass(node, "node"),
      ...this.posSizeBottomRectangle(node),
      ...this.attributes(node)
    })
  },

  renderLeftRectangle(node) {
    return new Xml("rect", {
      ...this.idClass(node, "node"),
      ...this.posSizeLeftRectangle(node),
      ...this.attributes(node)
    })
  },

  renderRightRectangle(node) {
    return new Xml("rect", {
      ...this.idClass(node, "node"),
      ...this.posSizeRightRectangle(node),
      ...this.attributes(node)
    })
  },

  renderCircle(node) {
    return new Xml("circle", {
      ...this.idClass(node, "circle"),
      ...this.posSizeCircle(node),
      ...this.attributes(node)
    })
  },

  renderCirclePort(node) {
    return new Xml("circle", {
      ...this.idClass(node, "circle"),
      ...this.posSizeCirclePort(node),
      ...this.attributes(node)
    })
  },

  renderEllipse(node) {
    return new Xml("ellipse", {
      ...this.idClass(node, "ellipse"),
      ...this.posSizeEllipse(node),
      ...this.attributes(node)
    })
  },

  renderSchemaBlock(e) {
      return(new Xml("g", {
        "transform": `translate(${0},${0})`, "class": "SCHEMA"}, 
        [this.renderTopRectangle(e), 
          this.renderBottomRectangle(e)]));
  },
  
  renderEntityBlock(e) {
    return(new Xml("g", {
      "transform": `translate(${0},${0})`, "class": "ENTITY"}, 
      [this.renderRectangle(e)]));
  },

  renderSubTypeConstraintBlock(e) {
    return(new Xml("g", {
      "transform": `translate(${0},${0})`, "class": "SUBTYPE_CONSTRAINT"}, 
      [this.renderEllipse(e)]));
  },

  renderReferencedBlock(e) {
    //requires dashed rectangle
    return(new Xml("g", {
      "transform": `translate(${0},${0})`, "class": "REFERENCED_FROM"}, 
      [this.renderRectangle(e)]));
  },

  renderUsedFromBlock(e) {
    return(new Xml("g", {
      "transform": `translate(${0},${0})`, "class": "USED_FROM"}, 
      [this.renderRectangle(e)]));
  },

  renderSimpleDataTypeBlock(e) {
    return(new Xml("g", {
      "transform": `translate(${0},${0})`, "class": "SIMPLE_DATA_TYPE"}, 
      [this.renderRectangle(e), 
        this.renderLeftRectangle(e)]));
  },

  renderGenericEntityBlock(e) {
    return(this.renderSimpleDataTypeBlock(e))
  },

  renderConstructedDataTypeSelectBlock(e) {
    //ADD DASHED LINE
    return(new Xml("g", {
      "transform": `translate(${0},${0})`, "class": "SELECT"}, 
      [this.renderRectangle(e), 
        this.renderEllipse(e)]));
  },

  renderConstructedDataTypeEnumerationBlock(e) {
    //ADD DASHED LINE
    return(new Xml("g", {
      "transform": `translate(${0},${0})`, "class": "ENUMERATION"}, 
      [this.renderRectangle(e), 
        this.renderEllipse(e)]));
  },


  renderPort(port) {
    return new Xml(
      "g",
      {
          ...this.idClass(port, "port"),
          "transform": `translate(${port.x || 0},${port.y || 0})`
      },
      this.renderLabels(port.labels)
    )
  },

  renderEdge(edge, node) {
    var bends = this.getBends(edge.sections);

    if (this._edgeRoutingStyle[node.id] == "SPLINES" || this._edgeRoutingStyle.__global == "SPLINES") {
      return this.renderPath(edge, bends);
    } else if (this._edgeRoutingStyle[node.id] == "DASHED_POLY" || this._edgeRoutingStyle.__global == "DASHED_POLY") {
      return this.renderDashedPolyline(edge, bends);
    } else if (edge.class && (edge.class.includes("USE FROM") || edge.class.includes("use"))) {
      return this.renderPolyline(edge, bends);
    } else if (edge.class && (edge.class.includes("REFERENCE FROM") || edge.class.includes("reference"))) {
      return this.renderDashedPolyline(edge, bends);
    } else {
      return this.renderPolyline(edge, bends);
    }
  },

  renderPath(edge, bends) {
    return new Xml("path", {
      "d": this.bendsToSpline(bends),
      ...this.idClass(edge, "edge"),
      ...this.style(edge),
      ...this.attributes(edge),
    });
  },

  renderPolyline(edge, bends) {
    return new Xml("polyline", {
      "points": this.bendsToPolyline(bends),
      ...this.idClass(edge, "edge"),
      ...this.style(edge),
      ...this.attributes(edge),
    });
  },

  renderDashedPolyline(edge, bends) {
    return new Xml("polyline", {
      "points": this.bendsToPolyline(bends),
      ...this.idClass(edge, "edge"),
      ...this.style(edge),
      ...this.attributes(edge),
      "stroke-dasharray": "4,4"
    });
  },

  getBends(sections) {
    var bends = [];
    if (sections && sections.length > 0) {
      sections.forEach(section => {
        if (section.startPoint) {
          bends.push(section.startPoint);
        }
        if (section.bendPoints) {
          bends = bends.concat(section.bendPoints);
        }
        if (section.endPoint) {
          bends.push(section.endPoint);
        }
      });
    }
    return bends;
  },

  renderLabels(labels) {
    return (labels || []).map(l => this.renderLabel(l))
  },

  renderLabel(label) {
    return new Xml("text", {
      ...this.idClass(label, "label"),
      ...this.posSizeLabelRectangle(label),
      ...this.style(label),
      ...this.attributes(label),
    }, [
      new Text(label.text)
    ]);
  },

  bendsToPolyline(bends) {
    return bends.map(bend => `${bend.x},${bend.y}`).join(" ")
  },

  bendsToSpline(bends) {
    if (!bends.length) {
      return ""
    }

    let {x, y} = bends[0];
    points = [`M${x} ${y}`]

    for (let i = 1; i < bends.length; i = i+3) {
      var left = bends.length - i;
      if (left == 1) {
        points.push(`L${bends[i].x + " " + bends[i].y}`);
      } else if (left == 2) {
        points.push(`Q${bends[i].x + " " + bends[i].y}`);
        points.push(bends[i+1].x + " " + bends[i+1].y);
      } else {
        points.push(`C${bends[i].x + " " + bends[i].y}`);
        points.push(bends[i+1].x + " " + bends[i+1].y);
        points.push(bends[i+2].x + " " + bends[i+2].y);
      }
    }
    return points.join(" ");
  },

  svgCss(css) {
    if (css == "") {
      return "";
    }
    return new Xml("style", {"type": "text/css"}, [
      new Cdata(
        new Text(css)
      )
    ]);
  },

  posSizeRectangle(e) {
    return {
      "x": e.x || 0,
      "y": e.y || 0,
      "width": e.width || 0,
      "height": e.height || 0,
    };
  },

  posSizeLabelRectangle(e) {
    return {
      "x": e.x || 0,
      "y": e.y + e.height/2 || 0,
      "width": e.width || 0,
      "height": e.height || 0,
    };
  },

  posSizeDefinitionLine(e) {
    return {
      "x1": e.x - 2|| 0,
      "y1": e.y || 0,
      "x2": e.x - 2|| 0,
      "y2": e.y + e.height -6 || 0,
      "stroke": "black",
      "stroke-width": 1,
      "marker-end":  "url(#arrowhead)"
    }
  },

  posSizeTopRectangle(e) {
    return {
      "x": e.x || 0,
      "y": e.y || 0,
      "width": e.width || 0,
      "height": e.height/2 || 0,
    };
  },

  posSizeBottomRectangle(e) {
    return {
      "x": e.x || 0,
      "y": e.y + e.height/2 || 0,
      "width": e.width || 0,
      "height": e.height/2 || 0,
    };
  },

  posSizeLeftRectangle(e) {
    return {
      "x": e.x || 0,
      "y": e.y || 0,
      "width": e.width - 10 || 0,
      "height": e.height || 0,
    };
  },

  posSizeRightRectangle(e) {
    return {
      "x": e.x + 10 || 0,
      "y": e.y + e.height/2 || 0,
      "width": e.width -10 || 0,
      "height": e.height || 0,
    };
  },
  
  posSizeEllipse(e) {
    return {
      "cx": e.x || 0,
      "cy": e.y || 0,
      "rx": e.width/2,
      "ry": e.height/2,
    };
  },

  posSizeCircle(e) {
    return {
      "cx": e.x || 0,
      "cy": e.y || 0,
      "r": e.width/2,
      "stroke" : "black",
      //hollow circle properties
      "stroke-width" : 2,
      "fill": "none"
    };
  },
  posSizeCirclePort(e) {
    return {
      "cx": e.x + e.width/2|| 0,
      "cy": e.y + e.width/2|| 0,
      "r": e.width/2,
      "stroke" : "black",
      //hollow circle properties
      "stroke-width" : 1,
      "fill": "none"
    };
  },
  posSizeSchemaBlock(e) {
    this.posSizeRectangle(e)
  },
  
  posSizeEntityBlock(e) {
    this.posSizeRectangle(e)
  },

  posSizeSubTypeConstraintBlock(e) {
    this.posSizeEllipse(e)
  },

  posSizeReferencedBlock(e) {
    this.posSizeRectangle(e)
  },

  posSizeUsedFromBlock(e) {
    this.posSizeRectangle(e)
  },

  posSizeSimpleDataTypeBlock(e) {
    this.posSizeRectangle(e)
  },

  posSizeGenericEntityBlock(e) {
    this.posSizeRectangle(e)
  },

  posSizeConstructedDataTypeBlock(e) {
    this.posSizeRectangle(e)
  },

  idClass(e, className) {
    var elemClasses = Array.isArray(e.class)? e.class.join(" "): e.class;
    var classes = [elemClasses, className].filter(c => c).join(" ")

    var properties = {}
    if (e.id) {
      properties["id"] = e.id;
    }
    if (classes) {
      properties["class"] = classes;
    }
    return properties;
  },

  style(e) {
    if (!e.style) {
      return {}
    }
    return {
      "style": e.style
    }
  },

  attributes(e) {
    return e.attributes;
  },


  /*
   * Public API
   */

  toSvg(json, styles="DEFAULT", defs="DEFAULT", background="DEFAULT") {
   this.init(json);
   // When styles and defs are null but background should still be rendered by default
   var tree = this.renderRoot(json, styles, defs, background);
   return tree.render();
  }
};


exports = module.exports = {
  Renderer
};
