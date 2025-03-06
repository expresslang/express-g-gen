"use strict"

import fs from 'fs';
import fparse from 'fast-sexpr';
import aep from './src/antlr_express_parsing.js'
import ep from './src/express_parsing.js'

let input = './js_testing/weld_arm.exp'

let parse_tree = aep.ParseExpressFile(input)
fs.writeFileSync('./test_antlr_parsed.sexp', parse_tree)
//fs.writeFileSync('./test_antlr_ruleNames.json', JSON.stringify(tree.parser.ruleNames))

//parse lisp to json nested arrays
let express_array = fparse(parse_tree)[0][1]
//fs.writeFileSync('./test_antlr_parsed.json',JSON.stringify(express_array, null, 2))


const values_to_remove = [';', ':', ',', '(', ')', '=', 'USE','FROM', 'END_FUNCTION', "ENTITY", "SUBTYPE", "OF"]

values_to_remove.forEach(removal_value => {
  aep.removeValueFromArray(express_array, removal_value)
})

const PassThruRefs = ["attributeRef","constantRef","entityRef","enumerationRef","functionRef","parameterRef","procedureRef","ruleLabelRef","ruleRef","schemaRef","subtypeConstraintRef","typeLabelRef","typeRef","variableRef", "enumerationItem", "enumerationReference"]
const PassThruIds = ["attributeId","constantId","entityId","enumerationId","functionId","parameterId","procedureId","ruleLabelId","ruleId","schemaId","subtypeConstraintId","typeLabelId","typeId","variableId", "enumerationId", "enumerationId"]

PassThruRefs.forEach((ref_string, index) => {
  aep.findIdsAndPassThrough(express_array, ref_string, PassThruIds[index])
})

const ids_to_rollup = PassThruIds

ids_to_rollup.forEach(id => {
  aep.findIdsAndConvertToDictionary(express_array, id)
})



let express_dictionary = {
  name: express_array[2][1],
  body: express_array[3]
}


console.log(express_dictionary)
fs.writeFileSync('./test_antlr_parse_clean.json',JSON.stringify(express_dictionary, null, 2))
