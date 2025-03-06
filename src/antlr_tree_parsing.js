"use strict"
import aep from './antlr_express_parsing.js'
import fparse from 'fast-sexpr';
import ep from './express_parsing.js';

const stringId_regex = new RegExp('([aA-zZ0-9])+(\\_*[aA-zZ0-9]*)*', 'g')

function DeepFilterArray(main_arr, filter_arr, maxLevel = 10) {
  if (Array.isArray(main_arr)) {
    var filtered_array = main_arr.filter(item => !filter_arr.includes(item));

    for (var key in filtered_array) { 
      if (Array.isArray(filtered_array[key]) && maxLevel >= 0) {
        filtered_array[key] = DeepFilterArray(filtered_array[key], filter_arr, maxLevel -1)
      }
    }
  } else {var filtered_array = []}
  return filtered_array
}

function DeepArrayToObject(arr) {
  let obj = {};

  for (let i = 1; i < arr.length; i++) {
    var key = arr[i-1];
    var value = arr[i];
    
    if (Array.isArray(value) && !Array.isArray(key)) {
      obj[key] = DeepArrayToObject(value);
    } else if (arr.length == 2) {
      obj[key] = value
    }
  }
  return obj;
};


function antlr_string_express_parsing(schema_file) {
    let antlr_parse_sexp = aep.ParseExpressFile(schema_file)
    let antlr_parse_tree = fparse(antlr_parse_sexp)[0][1]
    antlr_parse_tree = DeepFilterArray(antlr_parse_tree, ep.express_keywords)
    antlr_parse_tree = DeepFilterArray(antlr_parse_tree, ";")
    antlr_parse_tree = DeepFilterArray(antlr_parse_tree, ",")
   // antlr_parse_tree = DeepArrayToObject(antlr_parse_tree)
    antlr_parse_tree = antlrParseSchemaDeclaration(antlr_parse_tree)
    //let schema_file_contents = fs.readFileSync(schema_file, 'utf-8')
    //antlr_parse_tree = replaceIdsWithName(antlr_parse_tree)
   // schema_file_contents = parse_string_express_statements(schema_file_contents);
    //let express_json_working = {
     // "file_path": schema_file,
     // "express": []
    //};
    //FIND THE SCHEMAS
    //express_json_working.express = ParseSchemaDeclaration(schema_file_contents);
    return antlr_parse_tree
  }

  function antlrParseSchemaDeclaration(input) {
    let express_working = antlrParseSchemaBody(input)
    //FIND THE SCHEMA INTERFACES
    antlrParseInterfaceDefintions(express_working);
  
    //FIND THE ENTITY, TYPE AND OTHER DECLARATIONS
    //ParseTypeDeclarations(express_working);
    //ParseEntityDeclarations(express_working);
    //ParseConstantDeclarations(express_working);
  
    //ParseFunctionDeclarations(express_working);
    //ParseCaseDeclarations(express_working);
    //ParseIfDeclarations(express_working);
  
    //ParseLocalDeclarations(express_working);
    //ParseProcedureDeclarations(express_working);
    //ParseRepeatDeclarations(express_working);
    //ParseRuleDeclarations(express_working);
    //ParseSubTypeConstraintDeclarations(express_working);
  
    return express_working
  }

function antlrParseInterfaceDefintions(express) {

    express.forEach(schema => { 
        let interface_array = [];
        schema.interface.forEach(interface_definition => {
          if (interface_definition[0] == "useClause") {
            let object_definition = {kind: "use", schema: interface_definition[1][1][1]}
            if (interface_definition.length > 2) {
             // console.log(interface_definition[2])
              let interfaced_items = [];
              interface_definition[2].forEach(interfaced_object => {
                interfaced_items.push({name: interfaced_object[1][1][1][1]})
              })
              object_definition['interfaced.item'] = interfaced_items
            }

            interface_array.push(object_definition)
            //delete schema.contents[i]
            }
           })
           schema.interface = interface_array
        })


        return express
}



  function getAllIndexesRegex(array, regex) {
    let indexes = [], i;
    for (i = 0; i < array.length; i++)
      if (regex.test(array[i]))
        indexes.push(i);
    return indexes;
  }
  
  function antlrParseSchemaBody(express) {
    let index_array = []
    if (express[0] == "schemaDecl") {
      var object_definition = {}
      let interfaces = [];
      let contents = [];
      let entities = [];
      let types = [];
      object_definition.name = express[1][1]
      for (let i = 1; i < express[2].length; i++) {
        //console.log(i ,express)
        if (express[2][i][0] == "interfaceSpecification") {    
          interfaces.push(express[2][i][1])
        } else if (express[2][i][0] == "schemaBodyDeclaration") {
          if (express[2][i][1][0] == "declaration" && express[2][i][1][1][0] == 'entityDecl') {
            entities.push(express[2][i][1][1])
          } else if (express[2][i][1][0] == "declaration" && express[2][i][1][1][0] == 'typeDecl') {
            types.push(express[2][i][1][1])
          } else {
            
            console.log("SCHEMA BODY", express[2][i][1][0], express[2][i][1][1][0])
            contents.push(express[2][i][1])

          }
        }
      }
      object_definition.interface = interfaces;
      object_definition.contents = contents;
      object_definition.entity = entities;
      object_definition.type = types;
      index_array.push(object_definition);
    }
    //console.log(index_array)
    return(index_array)
  }

  function antlrMultiLineDefinition(input, clause, clean_definition = true) {
    let index_array = []
    if (Array.isArray(input)) {
    let input_statements = input.filter(str => str != ';')

  
    let start_regex = new RegExp(`^${clause}`);
    let end_regex = new RegExp(`^END_${clause}$`);
    let start_indexes = getAllIndexesRegex(input_statements, start_regex);
    let end_indexes = getAllIndexesRegex(input_statements, end_regex);
    //grab objects going forward
    for (let i = 0; i < start_indexes.length; i++) {
      let object_definition = {}
      if (end_indexes[i] - start_indexes[i] >= 1) {
        object_definition.contents = input_statements.slice(start_indexes[i], end_indexes[i]);
      }
      object_definition.name = object_definition.contents[1][1]
      object_definition.contents = object_definition.contents[2]
      
      index_array.push(object_definition);
    }
    //remove objects in reverse
    if (clean_definition) {
      for (let i = start_indexes.length - 1; i >= 0; i--) {
        input.contents = input_statements.splice(start_indexes[i], end_indexes[i] - start_indexes[i] + 1);
      }
    }
    }
    return index_array
  }
  

function replaceIdsWithName(object, maxLevel = 10) {
    let id_fields = ['schemaId', 'typeId', 'entityId', 'attributeId']
    for (var key in object) { 
        if (Array.isArray(object[key]) && object[key].length == 2) {
            if (id_fields.some(value => object[key][0].includes(value))) {
                object[key] = {name: object[key][1]}
            } else if (typeof object[key] === "object" && maxLevel>0) {
                replaceIdsWithName(object[key], maxLevel-1)}
        } else if (typeof object[key] === "object" && maxLevel>0) {
            replaceIdsWithName(object[key], maxLevel-1)
        }
    }

    return object
}



export default {antlr_string_express_parsing, DeepFilterArray};