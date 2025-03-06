"use strict"

import fs from 'fs';
import egl from './express_g_layout.js';
import { flatten, inflate } from 'flattenjs'

function ContainsAny(input_array, comparison_array) {
  return input_array.some(array_value => comparison_array.includes(array_value))
}

function StringContainsAnySubstring(input_string, comparison_array) {
  comparison_array.forEach(included_string => {
    if (input_string.includes(included_string)) {
      return true
    } else {return false}
  })
}

function ContainsAll(input_array, comparison_array) {
  return comparison_array.every(array_value => input_array.includes(array_value))
}

function getAllIndexesRegex(array, regex) {
  let indexes = [], i;
  for (i = 0; i < array.length; i++) {
    if (regex.test(array[i])) {indexes.push(i)};
  }
  return indexes;
}


//MULTILINE DECLARATIONS/STATMENTS
//"END_ALIAS", "END_CASE", "END_CONSTANT", "END_ENTITY", "END_FUNCTION", "END_IF", "END_LOCAL", "END_PROCEDURE","END_REPEAT", "END_RULE", "END_SCHEMA", "END_SUBTYPE_CONSTRAINT"

function ParseAliasDeclarations(input) {
  input.forEach(express_schema => {
    if (express_schema.contents) {
      express_schema.declarations.push(...MultiLineDefinition(express_schema.contents, "ALIAS", true));
    }
  })
}

function ParseCaseDeclarations(input) {
  input.forEach(express_schema => {
    if (express_schema.contents) {
      let declaration_breakdown_array = MultiLineDefinition(express_schema.contents, "CASE", true);
      if (declaration_breakdown_array.length > 0) {
        express_schema.algorithm = declaration_breakdown_array;
      }
    }
  })
}

function ParseConstantDeclarations(input) {
  input.forEach(express_schema => {
    if (express_schema.contents) {
      express_schema.constant = MultiLineDefinition(express_schema.contents, "CONSTANT", true);
    }
  })
}

function ParseTypeDeclarations(input) {
  //327 type_decl = TYPE type_id ’=’ underlying_type ’;’ [ where_clause ] END_TYPE ’;’ .
  //332 underlying_type = concrete_types | constructed_types .
  input.forEach(express_schema => {
    if (express_schema.contents) {
      let declaration_breakdown_array = MultiLineDefinition(express_schema.contents, "TYPE", false);
      
      if (declaration_breakdown_array.length > 0) {

        var declaration_definition_array = [];
        declaration_breakdown_array.forEach(declaration => {

          let object_declaration = {};
          let where_statements = [];

          if (declaration.contents) {
            declaration.contents.forEach((statement, index) => {

              if (index === 0) {  
              
            
                statement = GetSubstringAfterSeparator(statement, '=')
               

                //.map(str => str.trim())
                object_declaration = ParseUnderlyingType(statement);
              } else {
                where_statements.push(statement);
              }
            })
          }

          if (where_statements.length > 0) {
            object_declaration.where = ParseWhereStatement(where_statements, 0);
          }
          object_declaration.name = declaration.name;

          
          declaration_definition_array.push(object_declaration);
        })

        if (declaration_definition_array.length > 0) {
          express_schema['type'] = declaration_definition_array;
        }
      }
    }
  })
}

function ParseParanthesesBlock(input_statement) {
  let left_parentheses_position = input_statement.indexOf("(");
  let right_parantheses_position = input_statement.indexOf(")");
  let parantheses_items = [];
  if (left_parentheses_position > -1 && right_parantheses_position > -1) {
     parantheses_items = return_all_regex_matches(input_statement.slice(left_parentheses_position + 1, right_parantheses_position), stringId_regex);
  }
  return parantheses_items
}

function ParseEnumerationType(input_statement) {
  let tokenized_input_statement = return_all_regex_matches(input_statement, stringId_regex);
  let enumeration_type = {};
  //213 enumeration_type = [ EXTENSIBLE ] ENUMERATION [ ( OF enumeration_items ) | enumeration_extension ] .
  //209 enumeration_extension = BASED_ON type_ref [ WITH enumeration_items ] .
  //210 enumeration_id = simple_id .
  //211 enumeration_items = '(' enumeration_id { ',' enumeration_id } ')' .
  if (input_statement.includes("ENUMERATION")) {
    if (input_statement.includes("EXTENSIBLE")) { enumeration_type.extensible = "YES" }
    let based_on_index = tokenized_input_statement.indexOf("BASED_ON")
    if (based_on_index > -1) {
      enumeration_type.basedon = tokenized_input_statement[based_on_index + 1]
    }
    let parantheses_items = ParseParanthesesBlock(input_statement);
    if (typeof parantheses_items !== "undefined" && parantheses_items.length > 0) {
      enumeration_type.items = parantheses_items.join(' ')
    } else { enumeration_type.items = "" }
  }
  return enumeration_type
}

function ParseSelectType(input_statement) {
  let tokenized_input_statement = return_all_regex_matches(input_statement, stringId_regex);
  let select_type = {};
  //302 select_type = [ EXTENSIBLE [ GENERIC_ENTITY ] ] SELECT [ select_list | select_extension ] .
  //300 select_extension = BASED_ON type_ref [ WITH select_list ] .
  //301 select_list = '(' named_types { ',' named_types } ')' .
  if (input_statement.includes("SELECT")) {
    if (input_statement.includes("EXTENSIBLE")) { select_type.extensible = "YES" }
    if (input_statement.includes("GENERIC_ENTITY")) { select_type.genericentity = "YES" }
    let based_on_index = tokenized_input_statement.indexOf("BASED_ON")
    if (based_on_index > -1) {
      select_type.basedon = tokenized_input_statement[based_on_index + 1]

    }
    let parantheses_items = ParseParanthesesBlock(input_statement);
    if (typeof parantheses_items !== "undefined" && parantheses_items.length > 0) {
      select_type.selectitems = parantheses_items.join(' ')
    } else { select_type.selectitems = "" }

  }
  return select_type
}

function CountObjectKeys(input) {
  return Object.keys(input).length
}

function ParseSimpleTypes(input_statement) {
  let simple_type = {};
  let tokenized_input_statement = return_all_regex_matches(input_statement, stringId_regex);
  
  if (tokenized_input_statement.length === 1) {
    //console.log(tokenized_input_statement);
    let typename_name = tokenized_input_statement[0];
    //console.log(typename_name)

    simple_type = Object.assign(simple_type, DetermineIfBuiltInType(typename_name))

  } else {simple_type = undefined}
  return simple_type
}

function ParseUnderlyingType(input_statement) {
  //332 underlying_type = concrete_types | constructed_types
  //193 concrete_types = aggregation_types | simple_types | type_ref .
  //327 type_decl = TYPE type_id '=' underlying_type ';' [ where_clause ] END_TYPE ';' .
  //307 simple_types = binary_type | boolean_type | integer_type | logical_type | number_type | real_type | string_type .

  let object_declaration = {};

  let aggregation_type = ParseAggregateClause(input_statement);
  let aggregation_type_base = {}

  if (typeof aggregation_type != "undefined") {
    aggregation_type_base.aggregate = aggregation_type.aggregate;
    //aggregation_type_base.typename = aggregation_type.typename;

    aggregation_type_base = Object.assign(aggregation_type_base, DetermineIfBuiltInType(aggregation_type.typename))
  }

  //198 constructed_types = enumeration_type | select_type .

  let simple_type = ParseSimpleTypes(input_statement);
  let select_type = ParseSelectType(input_statement);
  let enumeration_type = ParseEnumerationType(input_statement);

  if (CountObjectKeys(aggregation_type_base) > 0) { 
    object_declaration = aggregation_type_base
  } else if (CountObjectKeys(select_type) > 0) {
    object_declaration.select = select_type;
  } else if (CountObjectKeys(enumeration_type) > 0) {
    object_declaration.enumeration = enumeration_type
  } else if (typeof simple_type != "undefined") {
    object_declaration = simple_type
  };


  //console.log("PARSED UNDERLYING TYPE",underlying_types)
  return object_declaration
}

function nested_statement_end(start_array, statement_length) {
  let actual_starts = start_array.filter( x => x > -1);
  if (actual_starts.length > 0) {
    var statement_end = Math.min(...actual_starts)
  } else {
    var statement_end = statement_length} 

  if (statement_end === 0) {
    statement_end = statement_length
  }
  ;
  //console.log(statement_end);
  return statement_end
}

function ParseWhereStatement(input_statements, start, end) {
  //var where_statement_end = contents_length - 1;
  let where_statements = [];
  let declared_where_statements = [];

  if (start > -1) {
    declared_where_statements = input_statements.slice(start);
    declared_where_statements.forEach((statement, index) => {
      if (index === 0) {
        statement = statement.replace("WHERE", "").trim();
      }
      let label = GetSubstringBeforeSeparator(statement, ":");
      let expression = GetSubstringAfterSeparator(statement, ":").replace(/\s+/g, " ").replace(/\(\s+/g,"\(").replace(/\s+\)/g, "\)").replace(/\s+\(/g, "\(").replace(/,/g, ", ").replace("\\ ", "\\").replace(/\s*\{\s*/g, "\{").replace(/\s*\}\s*/g, "\}").replace(/\s*\|\s+/g, " \| ").replace(/NOT\s*\(/g,"NOT \(").replace(/\|\s*/g, "\| ").replace(/\s*OR\s*\(/g, " OR \(").replace(/AND\s*\(/g, "AND \(").replace(/\s+/g, " ").replace(/\,\s{2,}/g, "\,").replace("' + '", "");
      //.replace(/QUERY\s+\(/g,"QUERY\(").replace(/TYPEOF\s+\(/g, "TYPEOF\(").replace(/\s+/g, " ").replace(/SIZEOF\s+\(/g,"SIZEOF\(").replace(/EXISTS\s+/g, "EXISTS")
      where_statements.push({ label: label, expression: expression 
        })
    })
    // console.log("ENTITY HAS A WHERE CLAUSE", entity_where_statements)
  }
  return where_statements
}

function ParseDeriveStatement(input_statements, start, end) {
  //200 derived_attr = attribute_decl ’:’ parameter_type ’:=’ expression ’;’ .
//177 attribute_decl = attribute_id | redeclared_attribute .
//266 parameter_type = generalized_types | named_types | simple_types .
  let derive_statements = [];
  let entity_derive_statements = [];

  if (start > -1) {
    entity_derive_statements = input_statements.slice(start, end);
    entity_derive_statements.forEach((statement, index) => {
      if (index === 0) {
        statement = statement.replace("DERIVE", "").trim();
      }

      let has_attribute = ParseDeriveAttribute(statement);
      derive_statements.push(has_attribute);
    })
//      console.log("ENTITY HAS A DERIVE CLAUSE", entity_derive_statements)
  }
  return derive_statements
}

function ParseDeriveAttribute(input_statement) {
    //200 derived_attr = attribute_decl ’:’ parameter_type ’:=’ expression ’;’ .
//177 attribute_decl = attribute_id | redeclared_attribute .
//266 parameter_type = generalized_types | named_types | simple_types .
  let attribute_declaration = ParseAttributeDeclaration(GetSubstringBeforeSeparator(input_statement, ":"));
  
  let typename_name = GetSubstringAfterSeparator(input_statement, ":").trim();
  let attribute_base_aggregate = ParseAggregateClause(GetSubstringBeforeSeparator(GetSubstringAfterSeparator(input_statement, ":"), ":=").trim());

  if (typeof attribute_base_aggregate != "undefined") {
    attribute_declaration.aggregate = attribute_base_aggregate.aggregate;
    typename_name = attribute_base_aggregate.typename
  }

  var typename_expression_boolean = typename_name.includes(":=");
  if (typename_expression_boolean) {
      typename_expression_boolean = true;
      var typename_expression = GetSubstringAfterSeparator(typename_name, ":=").trim().replace(/\,\s*/g, "\,");
      typename_name = GetSubstringBeforeSeparator(typename_name, ":=").trim()
  }

  if (typename_expression_boolean) {
    //attribute_base.expression = typename_expression;
  }

  attribute_declaration = Object.assign(attribute_declaration, DetermineIfBuiltInType(typename_name));

  return attribute_declaration
}

function ParseInverseAttribute(input_statement) {
    //248 inverse_attr = attribute_decl ':' [ ( SET | BAG ) [ bound_spec ] OF ] entity_ref FOR [ entity_ref '.' ] attribute_ref ';' .
  let attribute_declaration = ParseAttributeDeclaration(GetSubstringBeforeSeparator(input_statement, ":"));
  let attribute_base_aggregate = ParseAggregateClause(GetSubstringAfterSeparator(input_statement, ":").trim());
  let express_ids = return_all_regex_matches(GetSubstringAfterSeparator(input_statement, ":").trim(), stringId_regex)

  //console.log(attribute_base_aggregate)
  if (express_ids.length === 3) {
    //entity_ref FOR attribute ref ';'
    attribute_declaration.attribute = express_ids[2];
    attribute_declaration.entity = express_ids[0];
  } else if (typeof attribute_base_aggregate != "undefined") {
    attribute_declaration['inverse.aggregate']= attribute_base_aggregate.aggregate
    express_ids = return_all_regex_matches(attribute_base_aggregate.typename, stringId_regex);
    if (express_ids.length === 3) {
      attribute_declaration.attribute = express_ids[2];
      attribute_declaration.entity = express_ids[0];
    }
  }

  return attribute_declaration
}

function ParseInverseStatement(input_statements, start, end) { 
  let inverse_statements = [];
  let entity_inverse_statements = [];


  //249 inverse_clause = INVERSE inverse_attr { inverse_attr } .

  if (start > -1) {
    entity_inverse_statements = input_statements.slice(start, end);
    entity_inverse_statements.forEach((statement, index) => {
      if (index === 0) {
        statement = statement.replace("INVERSE", "").trim();
      }

      let inverse_has_attribute = ParseInverseAttribute(statement);

      inverse_statements.push(inverse_has_attribute);
    })
  //    console.log("ENTITY HAS A INVERSE CLAUSE",  entity_inverse_statements)
  }
  return inverse_statements
}

function ParseUniqueStatement(input_statements, start, end) {
  let unique_statements = [];
  let entity_unique_statements = [];

  if (start > -1) {
    //333 unique_clause = UNIQUE unique_rule ’;’ { unique_rule ’;’ } .
    //334 unique_rule = [ rule_label_id ’:’ ] referenced_attribute { ’,’referenced_attribute } .
    //280 referenced_attribute = attribute_ref | qualified_attribute .
    entity_unique_statements = input_statements.slice(start, end);
    entity_unique_statements.forEach((statement, index) => {
      if (index === 0) {
        statement = statement.replace("UNIQUE", "").trim();
      }
      let label = GetSubstringBeforeSeparator(statement, ":");
      let expression = GetSubstringAfterSeparator(statement, ":");
      let tokenized_input_statement = expression.split(",");

      for (let j = 0; j < tokenized_input_statement.length; j++) {
        if (tokenized_input_statement[j].trim().startsWith("SELF")) {
            tokenized_input_statement[j] = {
              'attribute': GetSubstringAfterSeparator(tokenized_input_statement[j], ".").trim(),
              'entity-ref': GetSubstringBeforeSeparator(tokenized_input_statement[j],".").trim().replace("SELF\\","")
            }
        }
        else {
        tokenized_input_statement[j] = {
          "attribute": tokenized_input_statement[j].trim()
          }
        }
      }

      unique_statements.push({'unique.attribute': tokenized_input_statement, label: label})
    })
      //console.log("ENTITY HAS A UNIQUE CLAUSE", entity_unique_statements)
  }
  return unique_statements
}

function ParseEntityDeclarations(input) {
  input.forEach(express_schema => {
    if (express_schema.contents) {
      let declaration_breakdown_array = MultiLineDefinition(express_schema.contents, "ENTITY", true);
      if (declaration_breakdown_array.length > 0) {
        //FIND THE ENTITY ATTRIBUTES
        let declaration_definition_array = []
        declaration_breakdown_array.forEach(declaration => {
          //206 entity_decl = entity_head entity_body END_ENTITY .
          //207 entity_head = ENTITY entity_id subsuper .
          //204 entity_body = { explicit_attr } [ derive_clause ] [ inverse_clause ] [ unique_clause ] [ where_clause ]
           
          let explicit_attributes = [];
          let has_supertype = [];
          if (declaration.contents) {
            //console.log(declaration)
            let contents_length = declaration.contents.length;
            let explicit_attribute_statements_start = 0;
            let derive_statement_start = declaration.contents.findIndex((statement) => statement.includes("DERIVE"));
            let inverse_statement_start = declaration.contents.findIndex((statement) => statement.includes("INVERSE"));
            let unique_statement_start  = declaration.contents.findIndex((statement) => statement.startsWith("UNIQUE"));
            let where_statement_start = declaration.contents.findIndex((statement) => statement.includes("WHERE"));
            
            let explicit_attribute_statements_end = nested_statement_end([derive_statement_start, inverse_statement_start , unique_statement_start , where_statement_start], contents_length);
            let derive_statement_end = nested_statement_end([inverse_statement_start , unique_statement_start , where_statement_start], contents_length);           
            let inverse_statement_end = nested_statement_end([unique_statement_start , where_statement_start], contents_length);
            let unique_statement_end = nested_statement_end([where_statement_start], contents_length);

            let entity_statements = declaration.contents.slice(0, explicit_attribute_statements_end);

            entity_statements.forEach((statement, index) => {
              //PARSE keywords
          
              if (index === 0) {
                has_supertype = ParseEntitySubtype(statement);
              } else {
                let has_attribute = ParseExplicitAttribute(statement);
                explicit_attributes.push(has_attribute);
              }
            })
        
            var derive_statements = ParseDeriveStatement(declaration.contents, derive_statement_start, derive_statement_end);
            var inverse_statements = ParseInverseStatement(declaration.contents, inverse_statement_start, inverse_statement_end);
            var unique_statements = ParseUniqueStatement(declaration.contents, unique_statement_start, unique_statement_end);
            var where_statements = ParseWhereStatement(declaration.contents, where_statement_start);

            delete declaration.contents
          }

          let object_declaration = {};
          if (explicit_attributes.length > 0) {
            object_declaration.explicit = explicit_attributes;
            //console.log(entity_declaration)
          }

          if (unique_statements.length > 0) {object_declaration.unique = unique_statements};
          if (inverse_statements.length > 0) {object_declaration.inverse = inverse_statements};
          if (derive_statements.length > 0) {object_declaration.derived = derive_statements};
          if (where_statements.length > 0) {object_declaration.where = where_statements};

          object_declaration.name = declaration.name;
          if (has_supertype.length > 0) {
            //console.log(has_supertype)
            object_declaration["abstract.supertype"] = has_supertype[0]['abstract.supertype'];
            if (typeof has_supertype[0]['super.expression'] != "undefined") {
              object_declaration["super.expression"] = has_supertype[0]['super.expression']
            }
            if (typeof has_supertype[0]['abstract.entity'] != "undefined") {
              object_declaration["abstract.entity"] = has_supertype[0]['abstract.entity']
            }
            object_declaration.supertypes = has_supertype[0].supertypes;
          }
          declaration_definition_array.push(object_declaration)
        })
        //console.log(declaration_definition_array, declaration_definition_array.length)

        if (declaration_definition_array.length > 0) {
          express_schema['entity'] = declaration_definition_array;
        }
      }

    }
  })


}


function ParseFunctionDeclarations(input) {
  input.forEach(express_schema => {
    if (express_schema.contents) {
      let declaration_breakdown_array = MultiLineDefinition(express_schema.contents, "FUNCTION", true);
      if (declaration_breakdown_array.length > 0) {
        express_schema.function = declaration_breakdown_array;
      }
    }
  })
}

function ParseIfDeclarations(input) {
  input.forEach(express_schema => {
    if (express_schema.contents) {
      let declaration_breakdown_array = MultiLineDefinition(express_schema.contents, "IF", true);
      if (declaration_breakdown_array.length > 0) {
        express_schema.algorithm = declaration_breakdown_array;
      }
    }
  })
}

function ParseLocalDeclarations(input) {
  input.forEach(express_schema => {
    if (express_schema.contents) {
      let declaration_breakdown_array = MultiLineDefinition(express_schema.contents, "LOCAL", true);
      if (declaration_breakdown_array.length > 0) {
        express_schema.algorithm = declaration_breakdown_array;
      }
    }
  })
}

function ParseProcedureDeclarations(input) {
  input.forEach(express_schema => {
    if (express_schema.contents) {
      let declaration_breakdown_array = MultiLineDefinition(express_schema.contents, "PROCEDURE", true);
      if (declaration_breakdown_array.length > 0) {
        express_schema.algorithm = declaration_breakdown_array;
      }
    }
  })
}

function ParseRepeatDeclarations(input) {
  input.forEach(express_schema => {
    if (express_schema.contents) {
      let declaration_breakdown_array = MultiLineDefinition(express_schema.contents, "REPEAT", true);
      if (declaration_breakdown_array.length > 0) {
        express_schema.algorithm = declaration_breakdown_array;
      }
    }
  })
}


function ParseRuleDeclarations(input) {
  input.forEach(express_schema => {
    if (express_schema.contents) {
      let declaration_breakdown_array = MultiLineDefinition(express_schema.contents, "RULE", true);
      if (declaration_breakdown_array.length > 0) {
        express_schema['rule'] = declaration_breakdown_array;
      }
    }
  })
}


function ParseSchemaDeclaration(input) {
  let express_working = MultiLineDefinition(input, "SCHEMA", true);

  //FIND THE SCHEMA INTERFACES
  ParseInterfaceDefinitions(express_working);

  //FIND THE ENTITY, TYPE AND OTHER DECLARATIONS
  ParseTypeDeclarations(express_working);
  ParseEntityDeclarations(express_working);
  //ParseConstantDeclarations(express_working);

  //ParseFunctionDeclarations(express_working);
  //ParseCaseDeclarations(express_working);
  //ParseIfDeclarations(express_working);

  //ParseLocalDeclarations(express_working);
  //ParseProcedureDeclarations(express_working);
  //ParseRepeatDeclarations(express_working);
  //ParseRuleDeclarations(express_working);
  ParseSubTypeConstraintDeclarations(express_working);


  express_working.forEach(namespace => {
    if (namespace.contents) {
      delete namespace.contents;
    }
    let namespace_name = namespace.name;
    delete namespace.name;
    namespace.name = namespace_name;
  })

  return express_working
}

function ParseSubTypeConstraintDeclarations(input) {
  input.forEach(express_schema => {
    if (express_schema.contents) {
      let declaration_breakdown_array = MultiLineDefinition(express_schema.contents, "SUBTYPE_CONSTRAINT", false);
      if (declaration_breakdown_array.length > 0) {

        let declaration_definition_array = []
        declaration_breakdown_array.forEach(declaration => {
          let object_declaration = {};
          object_declaration.name = declaration.name;
          object_declaration['abstract.supertype'] = "NO";
          declaration.contents.forEach((statement, index) => {
            //console.log(statement);
            if (statement.includes("ABSTRACT SUPERTYPE")) {
              object_declaration['abstract.supertype'] = "YES"};
            if (index === 0) {
              //subtype_constraint_head
              let entity_ref = GetSubstringAfterSeparator(statement, "FOR").trim();
              object_declaration.entity = entity_ref;

              //subtype_constraint_body
              //abstract_supertype
              if (statement.includes("ABSTRACT SUPERTYPE")) {
                let super_expression = GetSubstringAfterSeparator(statement, "ABSTRACT SUPERTYPE");
                if (typeof super_expression != "undefined") { 
                  object_declaration["super.expression"] = super_expression.replace(/\s/g, ""); 
                }
              }

            } else {
              if (statement.includes("ONEOF")) {
                object_declaration["super.expression"] = statement.replace(/\s/g, "");;
              }
            }
          })
          delete declaration.contents

          declaration_definition_array.push(object_declaration)
        })

        if (declaration_definition_array.length > 0) {
          express_schema['subtype.constraint'] = declaration_definition_array;
        }
      }


    }
  })
}




function MultiLineDefinition(input, clause, clean_definition = true) {
  let input_statements = input.filter(str => str != ';')
  let index_array = []

  let start_regex = new RegExp(`^${clause}`);
  let end_regex = new RegExp(`^END_${clause}$`);
  //console.log(clause, start_regex, end_regex);
  let start_indexes = getAllIndexesRegex(input_statements, start_regex);
  let end_indexes = getAllIndexesRegex(input_statements, end_regex);
  // console.log(clause,start_indexes, end_indexes)
  //grab objects going forward
  for (let i = 0; i < start_indexes.length; i++) {
    let object_definition = {}
    if (end_indexes[i] - start_indexes[i] >= 1) {
      object_definition.contents = input_statements.slice(start_indexes[i], end_indexes[i]);
    }
    object_definition.name = input_statements[start_indexes[i]].replace(start_regex, "").match(stringId_regex)[0]
    index_array.push(object_definition);
  }
  //remove objects in reverse
  if (clean_definition) {
    for (let i = start_indexes.length - 1; i >= 0; i--) {
      input.contents = input_statements.splice(start_indexes[i], end_indexes[i] - start_indexes[i] + 1);
    }
  }
  //console.log(clause," INDEX_ARRAY ",index_array)
  return index_array
}


const declaration_TYPES = ["ENTITY", "TYPE", "FUNCTION", "RULE", "CONSTANT"];
const express_BuiltInTypes = ["NUMBER", "REAL", "INTEGER", "STRING", "BOOLEAN", "LOGICAL", "BINARY"]

const express_keywords = ["ABSTRACT", "AGGREGATE", "ALIAS", "ARRAY", "AS", "BAG", "BASED", "ON", "BEGIN", "BINARY", "BOOLEAN", "BY", "CASE", "CONSTANT", "DERIVE", "ELSE", "END", "END_ALIAS", "END_CASE", "END_CONSTANT", "END_ENTITY", "END_FUNCTION", "END_IF", "END_LOCAL", "END_PROCEDURE", "END_REPEAT", "END_RULE", "END_SCHEMA", "END_SUBTYPE_CONSTRAINT", "END", "TYPE", "ENTITY", "ENUMERATION", "ESCAPE", "EXTENSIBLE", "FIXED", "FOR", "FROM", "FUNCTION", "GENERIC", "ENTITY", "IF", "INTEGER", "INVERSE", "LIST", "LOCAL", "LOGICAL", "NUMBER", "OF", "ONEOF", "OPTIONAL", "OTHERWISE", "PROCEDURE", "QUERY", "REAL", "RENAMED", "REFERENCE", "REPEAT", "RETURN", "RULE", "SCHEMA", "SELECT", "SET", "SKIP", "STRING", "SUBTYPE", "SUBTYPE_CONSTRAINT", "SUPERTYPE", "THEN", "TO", "TOTAL", "OVER", "TYPE", "UNIQUE", "UNTIL", "USE", "let", "WHERE", "WHILE", " WITH"]
const express_operators = ["AND", "ANDOR", "DIV", "IN", "LIKE", "MOD", "NOT", "OR", "XOR"]
const express_constants = ["?", "SELF", "CONST", "E", "PI", "FALSE", "TRUE", "UNKNOWN"]
const express_functions = ["ABS", "ACOS", "ASIN", "ATAN", "BLENGTH", "COS", "EXISTS", "EXP", "FORMAT", "HIBOUND", "HIINDEX", "LENGTH", "LOBOUND", "LOG", "LOG2", "LOG10", "LOINDEX", "NVL", "ODD", "ROLESOF", "SIN", "SIZEOF", "SQRT", "TAN", "TYPEOF", "USEDIN", "VALUE", "VALUE_IN", "VALUE", "UNIQUE"]
const express_procedures = ["INSERT", "REMOVE"]
const express_symbols = [".", ",", ";", ":", "*", "+", "-", "=", "%", "’", "\\", "/", "<", ">", "[", "]", "{", "}", "|", "e", "(", ")", "<=", "<>", ">=", "<*", ":=", "||", "**", "--", "(*", "*)", ":=:", ":<>:"]


const stringId_regex = new RegExp('([aA-zZ0-9])+(\\_*[aA-zZ0-9]*)*', 'g')

function GetSubstringBetween(input_string, first_delimiter, last_delimiter) {
  return input_string.substring(input_string.indexOf(first_delimiter) + 1, input_string.indexOf(last_delimiter))
}

function ParseInterfaceDefinitions(input) {
  //267 reference_clause = REFERENCE FROM schema_ref [ '(' resource_or_rename { ',' resource_or_rename } ')' ] ';' .
  //313 use_clause = USE FROM schema_ref [ '(' named_type_or_rename { ',' named_type_or_rename } ')' ] ';' .
  //246 named_type_or_rename = named_types [ AS ( entity_id | type_id ) ] .
  //274 resource_or_rename = resource_ref [ AS rename_id ] .
  //275 resource_ref = constant_ref | entity_ref | function_ref | procedure_ref | type_ref .
  input.forEach(namespace => {
    if (namespace.contents) {
      let use_from_interfaces = ParseUseFromInterface(namespace.contents);
      let reference_from_interfaces = ParseReferenceFromInterface(namespace.contents);

      let index_array = [].concat(use_from_interfaces, reference_from_interfaces)
      if (index_array.length > 0) {namespace.interface = index_array}
      }
  })

}

function ParseUseFromInterface(input) {
  let start_regex = new RegExp('^(USE FROM)\\s+');
  let start_indexes = getAllIndexesRegex(input, start_regex);
  let interface_array = [];
  for (let i = 0; i < start_indexes.length; i++) {
    let referenced_declarations = ParseParanthesesBlock(input[start_indexes[i]])
    let object_definition = {};
    if (referenced_declarations.length > 0) {
      for (let j = 0; j < referenced_declarations.length; j++) {
        referenced_declarations[j] = {
          "name": referenced_declarations[j]
        };
      }
      object_definition['interfaced.item'] = referenced_declarations
    }
    object_definition.kind = "use",
    object_definition.schema = input[start_indexes[i]].replace(start_regex, "").match(stringId_regex)[0]//, 

    interface_array.push(object_definition)

  }
  return interface_array
}

function ParseReferenceFromInterface(input) {
  let start_regex = new RegExp('^(REFERENCE FROM)\\s+');
  let start_indexes = getAllIndexesRegex(input, start_regex);
  let interface_array = [];
  for (let i = 0; i < start_indexes.length; i++) {
    let referenced_declarations = ParseParanthesesBlock(input[start_indexes[i]])
    let object_definition = {};
    if (referenced_declarations.length > 0) {
      for (let j = 0; j < referenced_declarations.length; j++) {
        referenced_declarations[j] = {
          "name": referenced_declarations[j]
        };
      }
      object_definition['interfaced.item'] = referenced_declarations
    }
    object_definition.kind = "reference",
    object_definition.schema = input[start_indexes[i]].replace(start_regex, "").match(stringId_regex)[0]//, 

    interface_array.push(object_definition)
 
  }
  return interface_array
}

function return_all_regex_matches(input_string, regex) {
  return Array.from(input_string.matchAll(regex), (x) => x[0])
}

function ParseMaterializedInterfaceDefinitions(input) {
  //from longform
  //example: "(* \"activity_method\" USE from SCHEMA activity_method_arm *)"
  let index_array = [];
  const materialized_interface_TYPES = ['USE from', 'IMPLICIT from']
  materialized_interface_TYPES.forEach(clause => {
    let start_regex = new RegExp(clause);
    let start_indexes = getAllIndexesRegex(input, start_regex)
    for (let i = 0; i < start_indexes.length; i++) {
      let object_definition = {
        "kind": clause,
        "interface_id": input[start_indexes[i]].split(start_regex)[0].match(stringId_regex)[0],
        "interface_schema_id": input[start_indexes[i]].split(start_regex)[1].replace("SCHEMA", "").match(stringId_regex)[0]
      }
      index_array.push(object_definition)
    }
    for (let i = start_indexes.length - 1; i >= 0; i--) {
      input.contents = input.splice(start_indexes[i], 1);
    }
  })

  return index_array
}

function GetSubstringBeforeSeparator(input, separator) {
  let separator_index = input.indexOf(separator);
  return separator_index == -1 ? input : input.substring(0, separator_index).trim()
}

function GetSubstringBeforeRegexSeparator(input, regex_separator) {
  let separator_index = RegexIndexOf(input, regex_separator)
  return separator_index == -1 ? input : input.substring(0,separator_index).trim()
}

const inline_comment_regex = new RegExp('/(\-){2,}/')

function GetSubstringAfterSeparator(input, separator, case_transform=undefined) {
  if (typeof case_transform != 'undefined' && case_transform == 'upper') {
    var test_string = input.toUpperCase();
  } else if (typeof case_transform != 'undefined' && case_transform == 'lower'){
    var test_string = input.toLowerCase();
  }
  else if (typeof case_transform == 'undefined') {
    var test_string = input;
  }
  let separator_index = test_string.indexOf(separator);
  let separator_width = separator.length
  if (separator_index > -1) {
    return input.substring(separator_index + separator_width).trim()
  } else {
    let lower_separator = separator.toLowerCase();
    separator_index = input.indexOf(lower_separator);
    return separator_index == -1 ? input : input.substring(separator_index + separator_width).trim()
  }
}

function ParseWhereClause(input) {
  //where_clause = WHERE domain_rule ’;’ { domain_rule ’;’ } .
  //domain_rule = [ rule_label_id ’:’ ] expression .
}

function findIndexOfCommentBlockClose(str, pos) {
  // FIND (*, *) pair indexes, returns indexOf first character
  if (str[pos] != '(') {
    throw new Error("No '(' at index " + pos);
  }
  if (str[pos+1] != '*') {
    throw new Error("No '*' RH adjacent at index " + pos);
  }
  let depth = 1;
  for (let i = pos + 1; i < str.length; i++) {
    switch (str[i]) {
    case '(':
      depth++;
      break;
    case ')':
      if (--depth == 0) {
        if (str[i-1] == "*") {
          return i-1}
      }
      break;
    }
  }
  return -1;    // No matching closing parenthesis
}

////console.log(findClosingBracketMatchIndex('a (bc)', 2)); // 5
//console.log(findClosingBracketMatchIndex('a (b ())', 2)); // 7
//console.log(findClosingBracketMatchIndex('a (b ())', 5)); // 6
//console.log(findClosingBracketMatchIndex('(a (b ()))', 0)); //9


function GetAllIndexOf(input_string, search_string) {
  let startingIndices = [];
  let indexOccurence = input_string.indexOf(search_string, 0);
  while (indexOccurence >= 0) {
    startingIndices.push(indexOccurence);
    indexOccurence = input_string.indexOf(search_string, indexOccurence + 1);
  }
  return startingIndices
}

function GetAllRegexIndexOf(input_string, search_regex) {
  let startingIndices = [];
  let indexOccurence = RegexIndexOf(input_string, search_regex, 0);
  while (indexOccurence >= 0) {
    startingIndices.push(indexOccurence);
    indexOccurence = RegexIndexOf(input_string, search_regex, indexOccurence + 1);
  }
  return startingIndices

}

function RegexIndexOf(string, regex, start) {
  let indexOf = string.substring(start || 0).search(regex);
  return (indexOf >= 0) ? (indexOf + (start || 0)) : indexOf
}

function RegexLastIndexOf(string, regex, start) {
  regex = (regex.global) ? regex : new RegExp(regex.source, "g" + (regex.ignoreCase ? "i" : "") + (regex.multiLine ? "m" : ""));
  if(typeof (start) == "undefined") {
      start = string.length;
  } else if(start < 0) {
      start = 0;
  }
  let stringToWorkWith = string.substring(0, start + 1);
  let lastIndexOf = -1;
  let nextStop = 0;
  while((result = regex.exec(stringToWorkWith)) != null) {
      lastIndexOf = result.index;
      regex.lastIndex = ++nextStop;
  }
  return lastIndexOf;
}

function ParseBoundSpec(input_statement) {
  if (input_statement.includes("[") & input_statement.includes["]"]) {
    let lower_upper = GetSubstringBetween(aggregate_string, "[", "]");
    let lower = GetSubstringBeforeSeparator(lower_upper, ":");
    let upper = GetSubstringAfterSeparator(lower_upper, ":");
    return {lower: lower, upper: upper}
  } else {return undefined}
}


function ParseAggregateClause(input_statement) {
  let attribute_base_aggregate = {};

  if (input_statement.includes("UNIQUE")) {
    var attribute_base_aggregate_unique = "YES";
    input_statement = input_statement.replace("UNIQUE","").trim();
  }

  if (input_statement.includes("OPTIONAL")) {
    var attribute_base_aggregate_optional = "YES";
    input_statement = input_statement.replace("OPTIONAL","").trim();
  }

  

  const aggregate_types = ["SET", "LIST", "BAG", "ARRAY"];
  const aggregate_types_regex = new RegExp(/\b(SET|LIST|BAG|ARRAY)\b/g)

  let aggregates = [];
  let secondary_aggregates = [];
  
  let regex_matches = GetAllRegexIndexOf(input_statement, aggregate_types_regex);

  if (regex_matches.length > 0) {
    var typename_statement = GetSubstringAfterSeparator(input_statement, "OF", 'upper').trim();
    //console.log("MATCHES AND INPUT",regex_matches,input_statement);
    for (let i =0; i < regex_matches.length; i++) {
      if (input_statement[regex_matches[i]] === "L") {
        var aggregate_type = "LIST";
      } else if (input_statement[regex_matches[i]] === "S") {
        var aggregate_type = "SET";
      } else if (input_statement[regex_matches[i]] === "A") {
        var aggregate_type = "ARRAY";
      } else if (input_statement[regex_matches[i]] === "B") {
        var aggregate_type = "BAG";
      }

      if (i > 0) {
        typename_statement = GetSubstringAfterSeparator(typename_statement, "OF", 'upper').trim();
      }

      if (i === regex_matches.length -1) {
          var aggregate_string = input_statement.substring(regex_matches[i]);
          //console.log(aggregate_string,typename_statement)
      } else {
          var aggregate_string = input_statement.substring(regex_matches[i], regex_matches[i+1]);
          //console.log(aggregate_string)
      }
      let lower_upper = GetSubstringBetween(aggregate_string, "[", "]");
      let lower = GetSubstringBeforeSeparator(lower_upper, ":");
      let upper = GetSubstringAfterSeparator(lower_upper, ":");
  
      let aggregate = {type: aggregate_type};
      if (lower.length > 0) {aggregate.lower = lower};
      if (upper.length > 0) {aggregate.upper = upper};
      if (attribute_base_aggregate_unique === "YES") {aggregate.unique = "YES"}
      if (attribute_base_aggregate_optional === "YES") {aggregate.optional = "YES"}
      secondary_aggregates.push(aggregate);
    }
    //console.log("MATCHES AND INPUT",regex_matches,input_statement, secondary_aggregates);

  }


  aggregate_types.forEach(aggregate_type => {
    let start_indexes_string = GetAllRegexIndexOf(input_statement, aggregate_type);
    let of_indexes_string = GetAllIndexOf(input_statement.toUpperCase(), "OF");
    if (start_indexes_string.length > 0 & of_indexes_string.length > 0) {
        //console.log(typename_name, start_indexes_string)
        for (let i = 0; i < start_indexes_string.length; i++) {
          if (i === start_indexes_string.length -1) {
            var aggregate_string = input_statement.substring(start_indexes_string[i]);
            //typename_statement = GetSubstringAfterSeparator(aggregate_string.toUpperCase(), "OF").trim();
          } else {
            var aggregate_string = input_statement.substring(start_indexes_string[i], start_indexes_string[i+1]);
          }
          
          let lower_upper = GetSubstringBetween(aggregate_string, "[", "]");
          let lower = GetSubstringBeforeSeparator(lower_upper, ":");
          let upper = GetSubstringAfterSeparator(lower_upper, ":");
      
          let aggregate = {type: aggregate_type};
          if (lower.length > 0) {aggregate.lower = lower};
          if (upper.length > 0) {aggregate.upper = upper};
          if (attribute_base_aggregate_unique === "YES") {aggregate.unique = "YES"}
          if (attribute_base_aggregate_optional === "YES") {aggregate.optional = "YES"}
          //console.log(aggregate);
          aggregates.push(aggregate);
        }
      }
  })

  if (aggregates.length === 0) {
    return undefined
  } else {
    attribute_base_aggregate.aggregate = aggregates;
    attribute_base_aggregate.typename = typename_statement;
    if (regex_matches.length > 0) {
      attribute_base_aggregate.aggregate = secondary_aggregates 
    }
    //if (attribute_base_aggregate_unique === "YES") {attribute_base_aggregate.unique = "YES"}
   // if (attribute_base_aggregate_optional === "YES") {attribute_base_aggregate.optional = "YES"}
    //    aggregation_type_base = Object.assign(aggregation_type_base, DetermineIfBuiltInType(aggregation_type.typename))
    return attribute_base_aggregate
  }
}

function tryParsingFunctions(functions_and_arguments) {
  // find the first function that doesn't return undefined
  for (let i = 0; i < functions_and_arguments.length; i++) {
    const [fn, function_arguments] = functions_and_arguments[i];
    const result = fn(...function_arguments);
    
    if (result !== undefined) {
      return result;
    }
  }
}

function ParseAttributeDeclaration(input_statement) {
  let attribute_base = {}
  let attributes_declared = input_statement.split(",");
  //console.log(attributes_declared.length, input_statement);
  attributes_declared.forEach(attribute_declaration => {
    attribute_base.name = attribute_declaration;
    let express_ids = return_all_regex_matches(attribute_declaration, stringId_regex);
    let redeclaration_flag = attribute_declaration.search(/^SELF\\/i);
   // console.log(attribute_declaration, "is redeclared", redeclaration_flag)
    if (redeclaration_flag > -1){
      let redeclared_entity = express_ids[0].replace(/^SELF\\/i, "");
      attribute_base.redeclaration = { "entity-ref": redeclared_entity}
      let renamed_flag = express_ids.indexOf("RENAMED");
      if (renamed_flag > -1) {
        let old_name = express_ids[1];
        attribute_base.redeclaration.old_name = old_name;
        attribute_base.name = express_ids[renamed_flag + 1];
      } else {
        attribute_base.name = express_ids[1];
      }

    }
   
  })

  //console.log(attribute_base, input_statement)

  return attribute_base
}

function ParseExplicitAttribute(input_statement) {
  //215 explicit_attr = attribute_decl { ',' attribute_decl } ':' [ OPTIONAL ] parameter_type ';' .
  
  //177 attribute_decl = attribute_id | redeclared_attribute .

  //279 redeclared_attribute = qualified_attribute [ RENAMED attribute_id ] .
  //178 attribute_id = simple_id .
  //275 qualified_attribute = SELF group_qualifier attribute_qualifier .
  //232 group_qualifier = '\' entity_ref .
  //179 attribute_qualifier = '.' attribute_ref .
  let attribute_declaration = ParseAttributeDeclaration(GetSubstringBeforeSeparator(input_statement, ":"));

  //266 parameter_type = generalized_types | named_types | simple_types .

  if (input_statement.includes("OPTIONAL") && !input_statement.includes("ARRAY")) {
      attribute_declaration.optional = "YES"
      input_statement = input_statement.replace("OPTIONAL", "")
   }
  
  let typename_name = GetSubstringAfterSeparator(input_statement, ":").trim();
  let attribute_base_aggregate = ParseAggregateClause(GetSubstringAfterSeparator(input_statement, ":").trim());

  if (typeof attribute_base_aggregate != "undefined") {
    attribute_declaration.aggregate = attribute_base_aggregate.aggregate;
    typename_name = attribute_base_aggregate.typename
  }

  attribute_declaration = Object.assign(attribute_declaration, DetermineIfBuiltInType(typename_name));

  return attribute_declaration
}

function DetermineIfBuiltInType(typename) {
  if (express_BuiltInTypes.includes(typename.toUpperCase())) {
    return {builtintype: {type: typename}}
  } else {
    return {typename: {name: typename}}
  }
}

function ParseInverseRelation(input_statement) {
//248 inverse_attr = attribute_decl ’:’ [ ( SET | BAG ) [ bound_spec ] OF ] entity_ref
//FOR [ entity_ref ’.’ ] attribute_ref ’;’ .
//249 inverse_clause = INVERSE inverse_attr { inverse_attr } .  
  let express_ids = return_all_regex_matches(input_statement, stringId_regex);
  let inverse_base = {};
  let attribute_name = express_ids[0];
  let entity = express_ids[1];
  let attribute = express_ids[3];
  inverse_base.name = attribute_name;
  inverse_base.entity = entity;
  inverse_base.attribute = attribute;

  return inverse_base
}

function array_flattener(data) {
  return data.reduce((r, e) => Array.isArray(e) ? r = r.concat(flat(e)) : r.push(e) && r, [])
}

function ParseEntitySubtype(input_statement) {
  var supertypes = [{}]
  if (input_statement.toUpperCase().includes("SUBTYPE OF")) {

    let sub_supertype_statement = GetSubstringAfterSeparator(input_statement, "SUBTYPE OF", "upper");

    supertypes[0].supertypes = array_flattener(ParseParanthesesBlock(sub_supertype_statement)).sort();

  } 

  if (input_statement.includes("ABSTRACT SUPERTYPE")) {
    supertypes[0]["abstract.supertype"] = "YES";
    var supertype_statement = GetSubstringAfterSeparator(input_statement, "ABSTRACT SUPERTYPE OF");
    supertype_statement = GetSubstringBeforeSeparator(supertype_statement, "SUBTYPE OF").replace(/\s+\)\s+/g,"\)").replace(/\s+\(\s+/g,"\(").replace(/^\(/g,"").replace(/\)$/g, "").replace(/ONEOF\s+/g, "ONEOF").trim();
    if (supertype_statement.endsWith("ABSTRACT SUPERTYPE")) {
      supertype_statement = undefined;
    }
  } else if (input_statement.includes("ABSTRACT")) {
    supertypes[0]['abstract.entity'] = "YES"
  }
  
  if (typeof supertype_statement == "undefined" & input_statement.includes("SUPERTYPE OF")) {
    var supertype_statement = GetSubstringAfterSeparator(input_statement, "SUPERTYPE OF")
    supertype_statement = GetSubstringBeforeSeparator(supertype_statement, "SUBTYPE OF").replace(/\s+\)\s+/g,"\)").replace(/\s+\(\s+/g,"\(").replace(/^\(/g,"").replace(/\)$/g, "").replace(/ONEOF\s+/g, "ONEOF").trim();
  } 
  
  supertypes[0]['super.expression'] = supertype_statement;

  return supertypes
}

function parse_comment_block(express_string) {
  let comment_block_starts = GetAllIndexOf(express_string, "(*")
  let comment_block_ends = GetAllIndexOf(express_string, "*)")

  if (comment_block_starts.length === comment_block_ends.length) {
    let express_string_in_work = express_string
    //strings are immutable, so convert to array
    //console.log("START COMMENT BLOCKS",comment_block_starts, comment_block_ends)
    for (let i = 0; i <comment_block_starts.length; i++) {
      let comment_block_start = express_string_in_work.indexOf("(*");

      if (comment_block_start > -1) {
        let comment_block_end = findIndexOfCommentBlockClose(express_string_in_work, comment_block_start)
        //let string_array = Array.from(express_string_in_work)
        //string_array.splice(comment_block_start, (comment_block_end +2)- comment_block_end,)
        //express_string_in_work = string_array.join('')
        if (comment_block_end > -1) {
          if (comment_block_start === 0) {
            express_string_in_work = express_string_in_work.slice(comment_block_end)
          } else {
            express_string_in_work = express_string_in_work.slice(0, comment_block_start) + "" + express_string_in_work.slice(comment_block_end+2)
          }
        }
      }

    }
   // console.log("COMMENT BLOCK DETAIL", express_string_in_work)
  return express_string_in_work
  } else {return express_string}
   
}

  

const comment_block_regex = new RegExp(/\(\*[^)]*\*\)/g)

function parse_string_express_statements(express_string) {
  express_string = parse_comment_block(express_string)

  let express_statements = express_string.replace(comment_block_regex,"").split(/\r?\n/);

  //strip tail remark
  express_statements = express_statements.map(str => str.trim()).map(str => GetSubstringBeforeSeparator(str, '--')).map(str => str.replace(/\s+/g," "));
  

  //split statements and keep split identifying characters
  const statement_split_regex = new RegExp(/(\(\*|\*\)|;)/g);

  express_statements = express_statements.join(" ").split(statement_split_regex).map(str => str.trim()).filter(str => str != '');
  //console.log(express_statements)
  return (express_statements)
}

function string_express_parsing(schema_file) {
  let schema_file_contents = fs.readFileSync(schema_file, 'utf-8')

  schema_file_contents = parse_string_express_statements(schema_file_contents);
  let express_json_working = {
    "file_path": schema_file,
    "express": []
  };
  //FIND THE SCHEMAS
  express_json_working.express = ParseSchemaDeclaration(schema_file_contents);

  return express_json_working
}

function create_elk_graphics_from_schemas(input_array, output_express_folder_path) {
  input_array.forEach(
    express_schema => {
      //let schema_nodes_filename = json_express_file.file_path;
      //let schema_prelayout_filename = './output/layout/' + path.parse(schema_nodes_filename).name + '_json' + path.parse(schema_nodes_filename).ext;

      //SCHEMA LAYOUT
      let schema_prelayout_filename = output_express_folder_path + express_schema.name + '_schema_pre_layout' + '.json';
      let schema_fixed_layout_filename = output_express_folder_path + express_schema.name + '_fixed_schema_pre_layout' + '.json';
      let elk_schema_working_fixed = egl.layout_schema_two_column_express_g_from_string(express_schema);

      let elk_schema_working = egl.prelayout_schema_express_g_from_string(express_schema);

      fs.writeFileSync(schema_prelayout_filename, JSON.stringify(elk_schema_working, null, 2), (err) => { if (err) throw err });
      fs.writeFileSync(schema_fixed_layout_filename, JSON.stringify(elk_schema_working_fixed, null, 2), (err) => { if (err) throw err });
      //console.log(elk_schema_working.children[1])
      //elk_schema_working = egl.set_size_node_and_edge_labels(elk_schema_working);
      egl.create_elk_graphics(elk_schema_working, output_express_folder_path, express_schema.name, "schema")
      egl.create_elk_graphics(elk_schema_working_fixed, output_express_folder_path, express_schema.name, "schema_fixed")
      //ENTITY LAYOUT
      let entity_prelayout_filename = output_express_folder_path + express_schema.name + '_entity_pre_layout' + '.json';

      //let elk_entity_working = egl.layout_entity_express_g_from_string(express_schema);
      //PRE-LAYOUT
      //fs.writeFileSync(entity_prelayout_filename, JSON.stringify(elk_entity_working, null, 2), (err) => { if (err) throw err });

      //elk_entity_working = egl.set_size_node_and_edge_labels(elk_entity_working);

      //egl.create_elk_graphics(elk_entity_working, output_express_folder_path, express_schema.name, "entity")
    }
  )
}

function sort_by_key(left,right,key) {
  let leftHas = left.hasOwnProperty(key);
  let rightHas = right.hasOwnProperty(key);
  if (leftHas && rightHas) {
    return left[key].localeCompare(right[key])
  }
  return leftHas ? -1 : rightHas ? 1 : 0
}

function sorted(o) {
  const isObj = x => typeof(x) === 'object'
  const isArr = Array.isArray

  // Beware: null is type object, but is not sortable.
  const isSortable = x => (x !== null) && (isObj(x) || isArr(x))

  if (!isSortable(o))
    return o

  if (isArr(o))
    return o.sort((a,b) => sort_by_key(a, b, "schema")).sort((a,b) => sort_by_key(a, b, "name")).map(sorted)

  if (isObj(o))
    return Object.keys(o).sort().reduce(
      (m, x) => (m[x] = isSortable(o[x]) ? sorted(o[x]) : o[x], m), 
      {}
    )
}

function export_express_json_schema(input_array, output_express_folder_path) {

    input_array.forEach(express_schema => {
      let json_string = JSON.stringify(flatten(sorted(express_schema)), null, 2)
      fs.writeFile(output_express_folder_path + express_schema.name + '.json', json_string, (err) => { if (err) throw err })
    })
}

function removeKeyByParsing(object, keyToRemove) {
  return JSON.parse(JSON.stringify(object, (key, value) => key === keyToRemove ? undefined : value).replace(/\\n*\s+/g, " "))
}

function removeKeysByParsing(object, keysToRemove) {
  for (var remove_key in keysToRemove) {
    object = JSON.parse(JSON.stringify(object, (key, value) => key === keysToRemove[remove_key] ? undefined : value).replace(/\\n*\s+/g, " "))
  }
  return object
}

function removeKeysInPlace(object, keysToRemoveArray, maxLevel = 10) {
  for (var key in object) {
    if (keysToRemoveArray.indexOf(key) >= 0) {
      delete object[key]
    } else if (typeof object[key] === "object" && maxLevel>0) {
      removeKeysInPlace(object[key], keysToRemoveArray, maxLevel-1)
    }
  }
  return object
}

function removeKeysInPlaceByValue(object, keysToRemoveArray, value, maxLevel = 10) {
  for (var key in object) {
    if (keysToRemoveArray.indexOf(key) >= 0 && object[key] == value) {
      delete object[key]
    } else if (typeof object[key] === "object" && maxLevel>0) {
      removeKeysInPlaceByValue(object[key], keysToRemoveArray, value, maxLevel-1)
    }
  }
  return object
}

function removeBlankKeysInPlace(object, keysToRemoveArray, maxLevel = 10) {
  for (var key in object) {
    if (keysToRemoveArray.indexOf(key) >= 0 && object[key] === "") {
      delete object[key]
    } else if (typeof object[key] === "object" && maxLevel>0) {
      removeBlankKeysInPlace(object[key], keysToRemoveArray, maxLevel-1)
    }
  }
  return object
}

function modifyArrayKeysInPlace(object, keysToModifyArray, maxLevel = 10) {
  //console.log(keysToModifyArray, maxLevel)
  for (var key in object) {
    if (keysToModifyArray.indexOf(key) >= 0) {
      //console.log("CONDITION 2", object[key], key, object[key][0].split(" "))
      object[key] = object[key][0].split(" ").sort();
    } else if (typeof object[key] === "object" && maxLevel>0) {
    //  console.log("CONDITION 3", object[key], key)
      modifyArrayKeysInPlace(object[key], keysToModifyArray, maxLevel-1)
    }
  }
  return object
}

const const_keys_to_ignore = ["graphic.element"]//,"description", "function", "rule", "super.expression","expression"]//, "interfaced.item", "#text", "comment", "constant", "totalover",  "typename", "label", "selectitems", "where", "select", "items", "lower", "upper", "unique.attribute", "genericentity", "fixed", "unique", "extensible", "version"]

const blanks_keys_to_ignore = ["selectitems", "items"]
const false_keys_to_ignore = ["abstract.supertype", "abstract.entity", "optional"]

export default { ContainsAll, ContainsAny, GetSubstringBeforeSeparator, string_express_parsing, create_elk_graphics_from_schemas, export_express_json_schema, declaration_TYPES, GetAttributeNameAndValue: ParseExplicitAttribute, parse_string_express_statements, removeKeyByParsing, removeKeysInPlace, removeBlankKeysInPlace, removeKeysInPlaceByValue,removeKeysByParsing, modifyArrayKeysInPlace, const_keys_to_ignore, blanks_keys_to_ignore, false_keys_to_ignore, express_keywords};