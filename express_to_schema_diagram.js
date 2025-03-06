 "use strict"
import path from 'path';
import ep from './src/express_parsing.js';
import fsh from './src/file_search.js'
import aep from './src/antlr_tree_parsing.js'

const express_folder_to_read = "c:/work/wg12-stepdev/data/modules/"//zonal_breakdown/"

let Files = fsh.FindExpressFiles(express_folder_to_read, ".exp");
//console.log(Files)
Files = Files.filter(
  function(filename) { 
    return  path.parse(filename).base === "arm.exp"||path.parse(filename).base === "mim.exp"
  });

const output_folder_path = "./output/";

//setup output folders
fsh.CreateFolder(output_folder_path);

const const_keys_to_ignore = ["graphic.element"]//[,"expression", "function", "rule", , "#text","description", "comment", "constant", "totalover", "super.expression",  "typename", "label", "selectitems", "where", "select","abstract.supertype", "items", "lower", "upper", "unique.attribute", "optional", "abstract.entity", "genericentity", "fixed", "unique", "extensible", "version"]

const antlr_parse_flag = false
const js_string_parse_flag = true
const express_g_flag = true

Files.forEach(schema_file => {
    let formatted_folder_path = path.dirname(schema_file).split(path.sep).join("/")
    let output_express_folder_path = formatted_folder_path.replace(express_folder_to_read, output_folder_path) + "/"
    fsh.CreateFolder(output_express_folder_path)
    //ANTLR4 PARSING

    //parse lisp to json nested arrays
    if (antlr_parse_flag) {
            var express_working = aep.antlr_string_express_parsing(schema_file)
      if (Array.isArray(express_working)) {
        if (typeof express_working[0] !== "undefined") {
      }
            ep.export_express_json_schema(express_working, output_express_folder_path)
      }
    }

    //STRING PARSING
    if (js_string_parse_flag) {
      var express_working = ep.string_express_parsing(schema_file)
      express_working = ep.removeKeysInPlace(express_working, ep.const_keys_to_ignore);
      //express_working.express[0].type = express_working.express[0].type.sort((a,b) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1:0))
      //}

      express_working = ep.removeBlankKeysInPlace(express_working, ep.blanks_keys_to_ignore)
      express_working = ep.removeKeysInPlaceByValue(express_working, ep.false_keys_to_ignore, "NO")
      ep.export_express_json_schema(express_working.express, output_express_folder_path)
    }

    if (js_string_parse_flag && express_g_flag) {
      ep.create_elk_graphics_from_schemas(express_working.express, output_express_folder_path)
    }
})

