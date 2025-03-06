"use strict"
import fs from 'fs';
import spw  from'string-pixel-width';
import ELK from 'elkjs';
import elksvg from './elkjs-svg/elkjs-svg.js';

const default_font = 'Times New Roman';
const default_font_size = 14;

function font_point_size_to_pixel_height(point_size) {
    const pixel_height = point_size*1.333
    return(Math.ceil(pixel_height))
  }
  
function string_to_pixel_width(string, font, point_size) {
    const pixel_width = spw(string, {font: font, size:point_size})
    return(Math.ceil(pixel_width))
 }

function size_labels_for_layout(elk_element) {
    var max_label_pixel_height = [0];
    const label_height_pixel_buffer_per_side = 0;
    const label_width_pixel_buffer_per_side = 2;
    var max_label_pixel_width = [0];
    
    elk_element.labels.forEach(label_data => {
      if (label_data['font.size'] != null) {
        var label_size = label_data['font.size'];
      } else {
        var label_size = default_font_size;
      }

      if (label_data['font.name'] != null) {
        var label_font = label_data['font.name'];
      } else {
        var label_font = default_font;
      }

      var label_pixel_width = string_to_pixel_width(label_data.text, label_font, label_size) + 2*label_width_pixel_buffer_per_side;
      var label_pixel_height = font_point_size_to_pixel_height(label_size)  + 2*label_height_pixel_buffer_per_side;
      label_data.width = label_pixel_width;
      label_data.height = label_pixel_height;
      max_label_pixel_height.push(label_pixel_height);
      max_label_pixel_width.push(label_pixel_width);
    })

    return {
      "max_label_pixel_height": Math.max(...max_label_pixel_height), 
      "max_label_pixel_width": Math.max(...max_label_pixel_width),
      "sum_label_pixel_height": max_label_pixel_height.reduce((a, b) => a + b, 0),
      "sum_label_pixel_width": max_label_pixel_width.reduce((a, b) => a + b, 0)
    }
 }

 function set_ports_layout(express_object_label) {
    express_object_label.ports.forEach(port_data => {
      if (port_data.class.includes("used")) {
        port_data.width = 8
        port_data.height = 8
        
      } else if (port_data.class.includes("uses")) {
        port_data.width = 0
        port_data.height = 0}
        //relative x and y
      if (typeof port_data.layoutOptions != 'undefined') {
        if (port_data.layoutOptions.side.includes("SOUTH") ) {
            port_data.x = Math.ceil(express_object_label.width/2)
            port_data.y = express_object_label.height + port_data.height
        } else if (port_data.layoutOptions.side.includes("WEST") ) {
            port_data.x = - port_data.width
            port_data.y = Math.floor(express_object_label.height/2 - port_data.height/2)
        } else if (port_data.layoutOptions.side.includes("EAST") ) {
            port_data.x = Math.ceil(express_object_label.width)
            port_data.y = Math.floor(express_object_label.height/2 - port_data.height/2)
        } else if (port_data.layoutOptions.side.includes("NORTH") ) {
            port_data.x = Math.ceil(express_object_label.width/2)
            port_data.y = -port_data.height
        }
    }

    })
 }

function set_label_layout(express_object_label, label_height_width) {
    if (express_object_label.class.includes("Schema")) {
      label_height_width.max_label_pixel_height = 2*label_height_width.max_label_pixel_height
      express_object_label.layoutOptions['elk.nodeLabels.placement'] = "[H_LEFT, V_TOP, INSIDE]"
    } else {
      express_object_label.layoutOptions['elk.nodeLabels.placement'] = "[H_LEFT, V_CENTER, INSIDE]"
    }
 }

    //Background on arm/mimexpg[0-9]+.gif
    //most independent object goes at top
    //attributes point up
    //supertype relations - arrows point down
    //express-g labelling
    //1 = schema
    //2 = entity
    //3+ = inter schema references
    //3+ = express-g for modules containing only extensions to extensible select types are not provided

    //611 modules
    //armexpg
    //1:653
    //2:575
    //3:109
    //4:57
    //5+:104
    //Total: 1498

    //mimexpg
    //1:631
    //2:382
    //3:63
    //4:30
    //5+:75
    //Total:1181

const elk_json_base = {
      "id": "G1",
      "layoutOptions": {
        "algorithm": "layered",
        "edgeLabels.sideSelection": "ALWAYS_UP",
        "edgeRouting": "ORTHOGONAL",
        "nodePlacement.strategy": "NETWORK_SIMPLEX",
        "org.eclipse.elk.partitioning.activate": true,
        "elk.direction": "DOWN",
        "elk.edge.thickness": 1,
        "elk.hierarchyHandling": "INCLUDE_CHILDREN",
        "elk.layered.considerModelOrder.longEdgeStrategy": "DUMMY_NODE_UNDER",
        "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
        "elk.layered.crossingMinimization.forceNodeModelOrder": true
      },
      "children": [],
      "edges": []
};

function prelayout_schema_express_g_from_string_without_grouper(express_string_schema) {
  var elk_json_working = JSON.parse(JSON.stringify(elk_json_base));
  //SCHEMA LAYOUT
  //P1 = arm.exp SCHEMA

  var base_schema = JSON.parse(JSON.stringify(base_schema_json));
  //console.log(base_schema.labels[0].text, express_string_schema.name)
  base_schema.labels = [{text : express_string_schema.name}];
                         
  elk_json_working.children.push(base_schema);
  elk_json_working = set_size_for_node_labels(elk_json_working)
  
  var schema_column_grouper = JSON.parse(JSON.stringify(reference_schema_base))
  schema_column_grouper.id = "COLUMN_GROUPER_1"
  schema_column_grouper.layoutOptions["elk.direction"] = "RIGHT"

    //P2+ = USE FROM/REFERENCE FROM SCHEMAs
    if (express_string_schema.interface) {
      if (express_string_schema.interface.length > 0) {
        if (express_string_schema.interface.length === 1) {
          var schema_grouper_count = 1;
        } else {
          var schema_grouper_count = 2;
          var schema_grouper_split = Math.ceil(express_string_schema.interface.length/schema_grouper_count);
        }
      }

      let group_number = 1
      for (var i = 0; i < express_string_schema.interface.length; i++) {
        if (i === 0) {
          var schema_grouper = JSON.parse(JSON.stringify(reference_schema_base));
          schema_grouper.id = "R" + group_number
        }
        if (i > 0 & i % schema_grouper_split === 0) {
          var schema_grouper = JSON.parse(JSON.stringify(reference_schema_base));
          group_number = group_number + 1
          schema_grouper.id = "R" + group_number

        }

        let schema_id = "P" + (i+1)
        var reference_schema = JSON.parse(JSON.stringify(base_schema_json))
        reference_schema.id = schema_id
        reference_schema.labels = [{"text": express_string_schema.interface[i].schema}]
        reference_schema.ports = [
                                  {
                                    "id": schema_id + ":used",
                                    "class": "used"
                                  }
                                ]
        reference_schema.properties = {}
        delete reference_schema.children

        schema_grouper.children.push(reference_schema)
        var schema_edge_id = "E" + (i+1)
        //console.log(express_string_schema.interface[i]['interfaced.item'])

        if (typeof express_string_schema.interface[i]['interfaced.item'] == 'undefined') {
          var edge_labels = undefined
        } else {
          let edge_labels_in_work = express_string_schema.interface[i]['interfaced.item']
         // console.log(edge_labels_in_work)
          var edge_labels = []
           edge_labels_in_work.forEach(label => {
            edge_labels.push({text: label.name})
          })

        }

        //console.log(edge_labels)

        var reference_schema_edge = {
                                  "id": schema_edge_id,
                                  "class": [express_string_schema.interface[i].kind],
                                  "labels": edge_labels,
                                  "sources": [
                                    "P0:uses"
                                  ],
                                  "targets": [
                                    reference_schema.ports[0].id
                                  ],
                                  "properties": {}
                                }
        if (reference_schema_edge.labels === undefined || reference_schema_edge.labels.length === 0) {
          reference_schema_edge.labels = [{"text": ""}]
        }


        elk_json_working.edges.push(reference_schema_edge)

        if (i % schema_grouper_split === schema_grouper_split -1 || i === express_string_schema.interface.length - 1) {
          schema_grouper = set_size_for_node_labels(schema_grouper)
          schema_column_grouper.children.push(schema_grouper)}
      }
      elk_json_working.children.push(schema_column_grouper)

      //COLUMN GROUPER TO BASE SCHEMA NODE EDGE FOR LAYOUT
     var column_grouper_edge = {
      "id": "COLUMN_GROUPER_EDGE",
      "class": [
        "drawing_aid"
      ],
      "labels": [
        {
          "text": ""
        }
      ],
      "sources":["P0"],
      "targets":["COLUMN_GROUPER_1"],
      "properties": {}
    }
    elk_json_working.edges.push(column_grouper_edge)
    elk_json_working = set_size_for_edge_labels(elk_json_working)


    }
      return elk_json_working
}
  


const reference_schema_base = {"id": "R1",
"class": ["GROUPER"],
"labels": [
          {
            "text": "",
            "x": 0,
            "y": 0,
            "height": 0,
            "width": 0
          }],
"ports": [],
"properties": {},
"layoutOptions": {
  "edgeLabels.sideSelection": "ALWAYS_UP",
  "elk.layered.crossingMinimization.forceNodeModelOrder": true,
  "elk.layered.nodePlacement.networkSimplex.nodeFlexibility": "NODE_SIZE",
  "elk.layered.priority.straightness": 100,
  "elk.layered.spacing.baseValue": 25,
  "elk.direction": "DOWN"
},
"children": [],
"height": 0,
"width": 0,
"x": 0,
"y": 0
}

//base_schema_json text relative x,y offset of 5,5

const base_schema_json = {"id": "P0", 
"class":["Schema"],
"labels": [
            {
              "text": "PUT SCHEMA NAME HERE",
              "height": 0,
              "width": 0,
              "x": 5,
              "y": 5
            }],
"ports": [
  {
    "id": "P0" + ":uses",
    "class": "uses"
  ,"layoutOptions": {"side": "SOUTH"},
  "height": 0,
  "width": 0,
  "x": 0,
  "y": 0
  }
],
"properties": {
  "portConstraints": "FIXED_SIDE"                      
},
"layoutOptions": {
  "elk.nodeLabels.placement": "[H_CENTER, V_TOP, INSIDE]"
},
"children": [],
"height": 0,
"width": 0,
"x": 0,
"y": 0
};



function prelayout_schema_express_g_from_string(express_string_schema) {
  var elk_json_working = JSON.parse(JSON.stringify(elk_json_base));
  //SCHEMA LAYOUT
  //P1 = arm.exp SCHEMA

  var base_schema = JSON.parse(JSON.stringify(base_schema_json));
  //console.log(base_schema.labels[0].text, express_string_schema.name)
  base_schema.labels = [{text : express_string_schema.name,
    "height": 0,
    "width": 0,
    "x": 0,
    "y": 0}];
                         
  elk_json_working.children.push(base_schema);
  elk_json_working = set_size_for_node_labels(elk_json_working)
  
  var schema_column_grouper = JSON.parse(JSON.stringify(reference_schema_base))
  schema_column_grouper.id = "COLUMN_GROUPER_1"
  schema_column_grouper.layoutOptions["elk.direction"] = "RIGHT"

    //P2+ = USE FROM/REFERENCE FROM SCHEMAs
    if (express_string_schema.interface) {
      if (express_string_schema.interface.length > 0) {
        if (express_string_schema.interface.length === 1) {
          var schema_grouper_count = 1;
        } else {
          var schema_grouper_count = 2;
          var schema_grouper_split = Math.ceil(express_string_schema.interface.length/schema_grouper_count);
        }
      }

      let group_number = 1
      for (var i = 0; i < express_string_schema.interface.length; i++) {
        if (i === 0) {
          var schema_grouper = JSON.parse(JSON.stringify(reference_schema_base));
          schema_grouper.id = "R" + group_number
        }
        if (i > 0 & i % schema_grouper_split === 0) {
          var schema_grouper = JSON.parse(JSON.stringify(reference_schema_base));
          group_number = group_number + 1
          schema_grouper.id = "R" + group_number

        }

        let schema_id = "P" + (i+1)
        var reference_schema = JSON.parse(JSON.stringify(base_schema_json))
        reference_schema.id = schema_id
        reference_schema.labels = [{"text": express_string_schema.interface[i].schema,
        "height": 0,
        "width": 0,
        "x": 0,
        "y": 0}]
        reference_schema.ports = [
                                  {
                                    "id": schema_id + ":used",
                                    "class": "used"
                                  }
                                ]
        reference_schema.properties = {}
        delete reference_schema.children

        schema_grouper.children.push(reference_schema)
        var schema_edge_id = "E" + (i+1)
        //console.log(express_string_schema.interface[i]['interfaced.item'])

        if (typeof express_string_schema.interface[i]['interfaced.item'] == 'undefined') {
          var edge_labels = undefined
        } else {
          let edge_labels_in_work = express_string_schema.interface[i]['interfaced.item']
         // console.log(edge_labels_in_work)
          var edge_labels = []
           edge_labels_in_work.forEach(label => {
            edge_labels.push({text: label.name, width: 0, height: 0, x: 0, y: 0})
          })

        }

        //console.log(edge_labels)

        var reference_schema_edge = {
                                  "id": schema_edge_id,
                                  "class": [express_string_schema.interface[i].kind],
                                  "labels": edge_labels,
                                  "sources": [
                                    "P0:uses"
                                  ],
                                  "targets": [
                                    reference_schema.ports[0].id
                                  ],
                                  "properties": {}
                                }
        if (reference_schema_edge.labels === undefined || reference_schema_edge.labels.length === 0) {
          reference_schema_edge.labels = [{"text": ""}]
        }


        elk_json_working.edges.push(reference_schema_edge)

        if (i % schema_grouper_split === schema_grouper_split -1 || i === express_string_schema.interface.length - 1) {
          schema_grouper = set_size_for_node_labels(schema_grouper)
          schema_column_grouper.children.push(schema_grouper)}
      }
      elk_json_working.children.push(schema_column_grouper)

      //COLUMN GROUPER TO BASE SCHEMA NODE EDGE FOR LAYOUT
     var column_grouper_edge = {
      "id": "COLUMN_GROUPER_EDGE",
      "class": [
        "drawing_aid"
      ],
      "labels": [
        {
          "text": ""
        }
      ],
      "sources":["P0"],
      "targets":["COLUMN_GROUPER_1"],
      "properties": {}
    }
    //elk_json_working.edges.push(column_grouper_edge)
    elk_json_working = set_size_for_edge_labels(elk_json_working)


    }
      return elk_json_working
}

const default_port_layout =  {
  "id": "SCHEMA_ID" + ":used",
  "class": "used", 
  "height": 0,
  "width": 0,
  "x": 0,
  "y": 0
}

function layout_schema_two_column_express_g_from_string(express_string_schema, length_before_split=3) {
  var elk_json_working = JSON.parse(JSON.stringify(elk_json_base));
  elk_json_working.layoutOptions = {
                                    "algorithm": "fixed"
                                  }
                                  //SCHEMA LAYOUT
  //P1 = arm.exp SCHEMA

  var base_schema = JSON.parse(JSON.stringify(base_schema_json));
  //console.log(base_schema.labels[0].text, express_string_schema.name)
  base_schema.labels = [{text : express_string_schema.name,
    "height": 0,
    "width": 0,
    "x": 5,
    "y": 5}];
                         
  elk_json_working.children.push(base_schema);
  elk_json_working = set_size_for_node_labels(elk_json_working)
  //console.log(elk_json_working)
  //console.log(express_string_schema)

    //P2+ = USE FROM/REFERENCE FROM SCHEMAs
    if (express_string_schema.interface && express_string_schema.interface.length > 0) {
       if (express_string_schema.interface.length < length_before_split) {
          var schema_grouper_count = 1;
          var group_size = express_string_schema.interface.length
       //   console.log("ONE COLUMN LAYOUT", group_size)
        } else {
          var schema_grouper_count = 2;
          var group_size = Math.ceil(express_string_schema.interface.length/2);
         // console.log("TWO COLUMN LAYOUT", group_size)
        }
      
      for (var i = 0; i < express_string_schema.interface.length; i++) {

        let schema_id = "P" + (i+1)
        var reference_schema = JSON.parse(JSON.stringify(base_schema_json))
        reference_schema.id = schema_id
        reference_schema.labels = [{"text": express_string_schema.interface[i].schema,
        "height": 0,
        "width": 0,
        "x": 5,
        "y": 5}]
        reference_schema.ports = []
      
       let port_layout = JSON.parse(JSON.stringify(default_port_layout))
        port_layout.id = schema_id + ":used";

        if (i >= group_size || schema_grouper_count == 1) {
          port_layout.layoutOptions = {"side": "WEST" }
        } else {
          port_layout.layoutOptions = {"side": "EAST" } 
        }
        reference_schema.ports.push(port_layout)

        //reference_schema.properties = {}
        delete reference_schema.children

        elk_json_working.children.push(reference_schema)

        var schema_edge_id = "E" + (i+1)
        //console.log(express_string_schema.interface[i]['interfaced.item'])

        if (typeof express_string_schema.interface[i]['interfaced.item'] == 'undefined') {
          var edge_labels = undefined
        } else {
          let edge_labels_in_work = express_string_schema.interface[i]['interfaced.item']
         // console.log(edge_labels_in_work)
          var edge_labels = []
           edge_labels_in_work.forEach(label => {
            edge_labels.push({text: label.name, width: 0, height: 0, x: 0, y: 0})
          })

        }

        //console.log(edge_labels)

        var reference_schema_edge = {
                                  "id": schema_edge_id,
                                  "class": [express_string_schema.interface[i].kind],
                                  "labels": edge_labels,
                                  "sources": [
                                    "P0:uses"
                                  ],
                                  "targets": [
                                    reference_schema.ports[0].id
                                  ],
                                  "properties": {}
                                }
        if (reference_schema_edge.labels === undefined || reference_schema_edge.labels.length === 0) {
          reference_schema_edge.labels = [{"text": "", 
                                            "height": 0,
                                            "width": 0, 
                                            "x": 0,
                                            "y": 0}]
        }


        elk_json_working.edges.push(reference_schema_edge)

      }
    
    elk_json_working = set_size_for_node_labels(elk_json_working)
    
    //find the widest node label
    let column_width = [0];
    let row_height = 19;

    let left_hand_node_column_width = [0];
    let right_hand_node_column_width = [0];
    
    elk_json_working.children.forEach( (schema_node,index) => {
      column_width.push(size_labels_for_layout(schema_node).max_label_pixel_width)
      if (schema_grouper_count == 2) {
        if (index <= group_size) {
          left_hand_node_column_width.push(size_labels_for_layout(schema_node).max_label_pixel_width);
        } else {
          right_hand_node_column_width.push(size_labels_for_layout(schema_node).max_label_pixel_width);
        }
      } else {
        right_hand_node_column_width.push(size_labels_for_layout(schema_node).max_label_pixel_width); 
      }
    })

    let center_line_column_offset = Math.floor(column_width[1])

    let right_hand_column_offset = [0]

    let max_column_width = Math.max(...column_width)
    let max_left_hand_column_width = Math.max(...left_hand_node_column_width)
    let max_right_hand_column_width =Math.max(...right_hand_node_column_width)
    //console.log(column_width, max_column_width, max_left_hand_column_width, max_right_hand_column_width)
    let left_hand_column_offset = left_hand_node_column_width.map(element =>  element - max_left_hand_column_width)
    //console.log("LEFT HAND COLUMN WIDTHS",left_hand_node_column_width,"MAX COL WIDTH" ,max_left_hand_column_width, "COLUMN OFFSET", left_hand_column_offset)
    //TODO:
    //need to determine for LH column (column 1), handedness of offsets  opposite in RH column (column 2)
    //1. max width of schema blocks (right hand side of all schema blocks on same line )
    //2. max width of edge labels (left hand side of all edge labels on same line, with gap between schema nodes and edge labels, plus rh gap between edge labels and center vertical line)
    //3. center line from node 0
    //4. edge labels start at y center of schema block with positive y vertical offset. 
    //5. Each subsequent schema block needs to be drawn with offset from previous block based on edge levels. Even top row of each column may need additional offset


    //position schema blocks
    let actual_node_port_positions_x = []
    let actual_node_port_positions_y = []

    elk_json_working.children.forEach( (schema_node,index)  => {
      //same vertical spacing between schema_nodes
      schema_node.y = row_height;
      let schema_graphic_centerline = Math.floor(center_line_column_offset/2) + Math.max(...left_hand_column_offset) + max_left_hand_column_width
      //19 is pixel height of characters in labels (assuming default font), other value *2 provides additional whitespace between adjacent nodes 
      if (index === 0) {
        schema_node.x = schema_graphic_centerline
      }
      //console.log(schema_grouper_count)
      if (index > 0) {
        if (schema_grouper_count == 1) {
            schema_node.x = max_left_hand_column_width + max_column_width + center_line_column_offset;
        } else if (schema_grouper_count == 2) {
            if (index <= group_size) {
              //LH COLUMN SCHEMA SHAPES ARE RH JUSTIFIED
              schema_node.x = schema_graphic_centerline - left_hand_column_offset[index+1]  - max_left_hand_column_width
             // console.log( "LH_COLUMN", "SCHEMA X", schema_node.x, "LEFT_OFFSET", left_hand_column_offset[index+1])
            } else {
              //RH COLUMN SCHEMA SHAPES ARE LH JUSTIFIED
              schema_node.x = schema_graphic_centerline + max_left_hand_column_width -  max_right_hand_column_width/2
              //console.log("SCHEMA X", schema_node.x, "MAX LEFT",max_left_hand_column_width ,"MAX COL WIDTH" , max_column_width, "COLUMN OFFSET", center_line_column_offset)
            }
        }
      }
      //console.log("INDEX", index,"SCHEMA X", schema_node.x,"SCHEMA Y",schema_node.y, "SCHEMA_GROUPER_COUNT", schema_grouper_count)

      if (index == group_size) {row_height = 19 + 19*2 + 10*2} else { row_height = row_height + 19*2 + 10*2}
    })

    //PULL PORT POSITIONS FROM NODES 
    elk_json_working.children.forEach(express_object_label => 
      {
        express_object_label.ports.forEach(port => {
          actual_node_port_positions_x.push(port.x + express_object_label.x)
          actual_node_port_positions_y.push(port.y + express_object_label.y)
          //console.log("PORT POSITIONS", port.x, port.y, express_object_label.x, express_object_label.y)
        })
      } )


    //DRAW ARROW FROM NODE 0 SCHEMA  TO USE FROM/REFERENCE FROM SCHEMAS
    elk_json_working.edges.forEach( (express_object_label, index) => {

        let bend_shape = [{
          "id": express_object_label.id + "_s0",
          "startPoint": {
            "x": actual_node_port_positions_x[0],
            "y": actual_node_port_positions_y[0]
          },
          "endPoint": {
            "x": actual_node_port_positions_x[index+1],
            "y": actual_node_port_positions_y[index+1]+4
          },
          "bendPoints": [
            {
              "x": actual_node_port_positions_x[0],
              "y": actual_node_port_positions_y[index+1]+4
            }
          ],
          "incomingShape": "P0:uses",
          "outgoingShape": "P" + (index+1) + ":used"
        }] 
        express_object_label.sections = bend_shape
        //console.log(bend_shape)

    })

    elk_json_working = set_size_for_edge_labels(elk_json_working)

    elk_json_working.x = 0
    elk_json_working.y = 0
    elk_json_working.width = 0
    elk_json_working.height = 0

    }
      return elk_json_working
}

function layout_entity_express_g_from_string(express_string_schema) {
  var elk_json_working = JSON.parse(JSON.stringify(elk_json_base));
  //ENTITY LAYOUT
 // console.log(express_string_schema)
    if (express_string_schema.entity) {
      for (var i = 0; i < express_string_schema.entity.length; i++) {
        var schema_id = "P" + (i+1)
        var reference_entity = {"id": schema_id, 
                              "class":["ENTITY"],
                              "labels": [
                                          {
                                            "text": express_string_schema.entity[i].name
                                          }],
                              "ports": [
                                {
                                  "id": schema_id + ":uses",
                                  "class": "uses"
                                ,"layoutOptions": {"side": "SOUTH"}                  
                                },
                                {
                                  "id": schema_id + ":used",
                                  "class": "used"
                                }
                              ],
                              "properties": {
                                "partitioning.partition": 2
                              },
                              "layoutOptions": {
                                "elk.nodeLabels.placement": "[H_CENTER, V_TOP, INSIDE]"
                              }
                              }
        elk_json_working.children.push(reference_entity)
        var schema_edge_id = "E" + (i+1)

        var reference_entity_edge = {
                                  "id": schema_edge_id,
                                  "class": [express_string_schema.entity[i].express_object_type],
                                  "labels": [],
                                  "sources": [
                                    "P1:uses"
                                  ],
                                  "targets": [
                                    reference_entity.ports[0].id
                                  ],
                                  "properties": {}
                                }
        if (reference_entity_edge.labels.length === 0) {
          reference_entity_edge.labels = [{"text": ""}]
        }
        elk_json_working.edges.push(reference_entity_edge)
      }
    }
      return elk_json_working
}


//Math.ceil(spw('Activity_characterized_arm', {font: 'Times New Roman', size:11}))
    //TODO need to update elkjs-svg.js to allow variable font/font size per node 
    //DEFAULT LABEL FONT FOR LAYOUT
    //"labels": [
    //  {
    //    "text": "Activity_characterized_arm",
    //    "font.name": "Times New Roman",
    //    "font.size": 14 
    //}]

    //console.log(font_point_size_to_pixel_height(12))
    //console.log(font_point_size_to_pixel_height(7))
    //console.log(font_point_size_to_pixel_height(22))


function set_size_for_node_labels(elk_layout_json) {
    //SIZING NODE LABELS
    elk_layout_json.children.forEach(express_object_label => {
      
      let label_height_width = size_labels_for_layout(express_object_label);

      set_label_layout(express_object_label, label_height_width)


      //minimum box size is determined by label_pixel_width and label_pixel_height, buffer added to each side
      express_object_label.height = label_height_width.max_label_pixel_height + 5*2;
      express_object_label.width = label_height_width.max_label_pixel_width + 5*2;

      
      //default port_sizing
      set_ports_layout(express_object_label)
    })


    return elk_layout_json
}

function set_size_for_edge_labels(elk_layout_json) {
    //SIZING LABELS FOR EDGES
    //console.log(graph_obj.children)
    if (elk_layout_json.edges) {
      //let max_edge_label_width = [];

      elk_layout_json.edges.forEach(edge_label => {
        var label_height_width = size_labels_for_layout(edge_label);

        edge_label.width = label_height_width.max_label_pixel_width;
        edge_label.height = label_height_width.sum_label_pixel_height;
        //set all edge label widths to largest edge label width
        //max_edge_label_width.push(label_height_width.max_label_pixel_width)
      })
      //max_edge_label_width = Math.max(...max_edge_label_width);
      //elk_layout_json.edges.forEach(edge_label => {
        //edge_label.width = max_edge_label_width;
        //edge_label.labels.forEach(label_data => {
         // label_data.width = edge_label.width;
        //})
      //}
    }
    return elk_layout_json
}

function create_elk_graphics(pre_layout_elk, output_folder_path, schema_name, layout_type) {
    //let output_layout_filename = './output/layout/' + path.parse(schema_prelayout_filename).name + '_json_layout' + path.parse(schema_prelayout_filename).ext;
    //let output_graphic_filename = './svg/express_g/' + path.parse(schema_prelayout_filename).name + '_json_elkjs' + '.svg';
    let layout_filename = output_folder_path + schema_name + '_' + layout_type + '_layout' + '.json';
    let graphic_filename = output_folder_path + schema_name + '_' + layout_type + '.svg';
    let graphic_filename_gif = output_folder_path + schema_name + '_' + layout_type + '.gif';

        //convert ELK JSON to ELK Layout and Render to SVG
    let elk = new ELK()
    elk.layout(pre_layout_elk).then(data => {
      //console.log(data);
      fs.writeFile(layout_filename, JSON.stringify(data, null, 2), (err) => {if (err) throw err});
      //console.log(data)
      let renderer = new elksvg.Renderer();
      let svg = renderer.toSvg(data);
      fs.writeFile(graphic_filename, svg, (err) => {if (err) throw err});
      //console.log(svg);
      //render gif from svg

      })
}


 export default {string_to_pixel_width, font_point_size_to_pixel_height, prelayout_schema_express_g_from_string, prelayout_schema_express_g_from_string_without_grouper, layout_entity_express_g_from_string, create_elk_graphics, layout_schema_two_column_express_g_from_string,  default_font, default_font_size};