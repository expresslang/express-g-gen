"use strict"
import path from 'path';
import ep from './src/express_parsing.js';
import fsh from './src/file_search.js'
import exp_xml from './src/express_xml_parser.js'

const express_folder_to_read = "../../../wg12-stepdev/data/modules/"//zonal_breakdown/"

const ref_output_folder_path = "./ref_output/";
fsh.CreateFolder(ref_output_folder_path);

//REFERENCE EXPRESS XML FILES FOR COMPARISON AGAINST JS PARSING
let xml_Files = fsh.FindExpressFiles(express_folder_to_read, ".xml").filter(
  function(filename) { 
    return  path.parse(filename).base === "arm.xml"||path.parse(filename).base === "mim.xml"
  });

xml_Files.forEach(schema_file => {
  let test_schema = exp_xml.parse_express_xml(schema_file);
  let formatted_folder_path = path.dirname(schema_file).split(path.sep).join("/");
  let output_express_folder_path = formatted_folder_path.replace(express_folder_to_read, ref_output_folder_path) + "/";
  fsh.CreateFolder(output_express_folder_path);
  let express_to_export = ep.modifyArrayKeysInPlace(ep.removeKeysInPlace(test_schema.express[0].schema, ep.const_keys_to_ignore), ["supertypes"]);
  express_to_export = ep.removeBlankKeysInPlace(express_to_export, ep.blanks_keys_to_ignore)
  express_to_export = ep.removeKeysInPlaceByValue(express_to_export, ep.false_keys_to_ignore, "NO")

  if (typeof test_schema.express != "undefined") { 
    ep.export_express_json_schema(express_to_export, output_express_folder_path);
  }
})
