"use strict"
const Papa = require('papaparse')
const fs = require('fs');
const ELK = require('elkjs');
const elksvg = require('elkjs-svg');
const spw = require('string-pixel-width')
const path = require('path')

//Convert Express nodes and edges to ELK input format
const elk_json_base = {
    "id": "G1",
    "layoutOptions": {
        "algorithm": "layered"
    },
    "children": [],
    "edges": []
};

//node definition
var schema_nodes_filename = 'C:/work/wg12-stepmod/data/modules/activity/activity_arm_schema_nodes.csv'

var schema_json_output_filename = './json/layout/js_activity_arm_schema_csv_to_json_test.json'

//utf8 option is required to workaround papaparse bug, otherwise csv is treated as buffer instead of string
var nodes_in = fs.readFileSync(schema_nodes_filename, 'utf8')
var parsed_nodes_in = Papa.parse(nodes_in, {header:true, skipEmptyLines: true})

var elk_json_working = elk_json_base 

parsed_nodes_in.data.forEach(data => {
    elk_json_working.children.push(data);
})

elk_json_working.children.forEach(data => {
    data.class = [data.class];
    data.ports = [];
    if (data.uses_port == "TRUE") {
        var port_to_append = {"id": data.id + ":" + "uses", "class": "uses" };
        data.ports.push(port_to_append);
    }
    delete data.uses_port;
    if (data.used_port == "TRUE") {
        var port_to_append = {"id": data.id + ":" + "used", "class": "used" };
        data.ports.push(port_to_append);
    }
    delete data.used_port;
    data.labels = [{"text": data.labels}];
    data.properties = {};
})

//edge definition
var schema_edges_filename = 'C:/work/wg12-stepmod/data/modules/activity/activity_arm_schema_edges.csv'

var edges_in = fs.readFileSync(schema_edges_filename, 'utf8')
var csv_edges_in = Papa.parse(edges_in, {header:true, skipEmptyLines: true})

csv_edges_in.data.forEach(data => {
    var EDGE_to_append = {"id": data.edge_id, "sources": [data.from], "targets": [data.to]}
    elk_json_working.edges.push(EDGE_to_append)
})

//console.log(elk_json_working)
//ELK JSON pre-layout
fs.writeFileSync(schema_json_output_filename, JSON.stringify(elk_json_working, null, 2))

//convert ELK JSON to ELK Layout and Render to SVG

var input_file = schema_json_output_filename;
var output_layout_filename = './json/layout/' + path.parse(input_file).name + '_csv_layout' + path.parse(input_file).ext;
var output_graphic_filename = './svg/' + 'csv_elkjs_' + path.parse(input_file).name + '.svg';

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

const graph_data = fs.readFileSync(schema_json_output_filename)
const graph_obj = JSON.parse(graph_data)
//console.log(graph_obj)
//Math.ceil(spw('Activity_characterized_arm', {font: 'Times New Roman', size:11}))
//TODO need to update elkjs-svg.js to allow variable font/font size per node 
//DEFAULT LABEL FONT FOR LAYOUT
//"labels": [
//  {
//    "text": "Activity_characterized_arm",
//    "font.name": "Times New Roman",
//    "font.size": 14 
//}]

const default_font = 'Times New Roman'
const default_font_size = 14

function font_point_size_to_pixel_height(point_size) {
  const pixel_height = point_size*1.333
  return(Math.ceil(pixel_height))
}

function string_to_pixel_width(string, font, point_size) {
  const pixel_width = spw(string, {font: font, size:point_size})
  return(Math.ceil(pixel_width))
}
//console.log(font_point_size_to_pixel_height(12))
//console.log(font_point_size_to_pixel_height(7))
//console.log(font_point_size_to_pixel_height(22))


graph_obj.children.forEach(data => {
  //size labels for layout
  var max_label_pixel_height = [0];
  var max_label_pixel_width = [0];

  data.labels.forEach(label_data => {
    var label_info = label_data;

    if (label_data['font.size'] != null) {
      var label_size = label_data['font.size']
    } else {
      var label_size = default_font_size
    }

    if (label_data['font.name'] != null) {
      var label_font = label_data['font.name']
    } else {
      var label_font = default_font
    }

    var label_pixel_width = string_to_pixel_width(label_info.text, label_font, label_size);
    var label_pixel_height = font_point_size_to_pixel_height(label_size);
    label_data.width = label_pixel_width
    label_data.height = label_pixel_height 
    max_label_pixel_height.push(label_pixel_height)
    max_label_pixel_width.push(label_pixel_width)
  })
  max_label_pixel_height = Math.max(...max_label_pixel_height)
  max_label_pixel_width = Math.max(...max_label_pixel_width)
  //default port_sizing
  data.ports.forEach(port_data => {
    if (port_data.class.includes("used")) {
      port_data.width = 8
      port_data.height = 8
    } else if (port_data.class.includes("uses")) {
      port_data.width = 0
      port_data.height = 0
    }
  })
  //console.log(label_info)
  //console.log(label_size)
  //console.log(label_font)


  if (data.class.includes("Schema")) {
    max_label_pixel_height = 2*max_label_pixel_height
    data.properties['nodeLabels.placement'] = "[H_LEFT, V_TOP, INSIDE]"
  } else {
    data.properties['nodeLabels.placement'] = "[H_LEFT, V_CENTER, INSIDE]"
  }
  //console.log(label_pixel_width)
  //minimum box size is determined by label_pixel_width and label_pixel_height, buffer added to each side
  data.width = max_label_pixel_width + 5*2
  //console.log(label_pixel_height)
  data.height = max_label_pixel_height + 5*2
})

//console.log(graph_obj.children)

const elk = new ELK()
const test = elk.layout(graph_obj)
elk.layout(graph_obj).then(data => {
    //console.log(data);
    fs.writeFileSync(output_layout_filename, JSON.stringify(data, null, 2));
    var renderer = new elksvg.Renderer();
    var svg = renderer.toSvg(data);
    //console.log(svg);
    fs.writeFile(output_graphic_filename, svg, (err) => {
        if (err) throw err;
       })
  })

//.then(console.log)
 //  .catch(console.error)