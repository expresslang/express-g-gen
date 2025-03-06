"use strict"
import fs, { stat } from 'fs';
import antlr4 from 'antlr4';
import ExpressLexer from './antlr/express_antlr_js/complex_express/ExpressLexer.js';
import ExpressParser from './antlr/express_antlr_js/complex_express/ExpressParser.js';


//ANTLR4 RELATED FUNCTIONS
// java -Xmx500M -cp "./antlr-4.11.1-complete.jar" org.antlr.v4.Tool -Dlanguage=JavaScript ./express-grammar/Express_simple.g4 -visitor -listener
class Visitor {
    visitChildren(ctx) {
      if (!ctx) {
        return;
      }
  
      if (ctx.children) {
        return ctx.children.map(child => {
          if (child.children && child.children.length != 0) {
            return child.accept(this);
          } else {
            return child.getText();
          }
        });
      }
    }
  }
  
  function ParseExpressFile(input_path) {
    let express_input = fs.readFileSync(input_path, 'utf-8')
    let tree = StartupANTLRSyntaxParser(express_input)
    let lisp_string = toStringTree(tree, tree.parser.ruleNames, null, true, 2)
    return lisp_string
  }
  
  function ParseExpressString(express_string_array) {
    let express_input = express_string_array.join("\n")
    let tree = StartupANTLRSchemaParser(express_input)
    let lisp_string = toStringTree(tree, tree.parser.ruleNames, null, true, 2)
    return lisp_string
  }
  
  function StartupANTLRSyntaxParser(express_input) {
    let chars = new antlr4.InputStream(express_input);
    let lexer = new ExpressLexer(chars);
    let tokens = new antlr4.CommonTokenStream(lexer);
    let parser = new ExpressParser(tokens);
    parser.buildParseTrees = true;
    //set start rule parser.start_rule()
    let tree = parser.syntax();
    //tree.accept(new Visitor());
    return tree
  }
  
  function StartupANTLRSchemaParser(express_input) {
    let chars = new antlr4.InputStream(express_input);
    let lexer = new ExpressLexer(chars);
    let tokens = new antlr4.CommonTokenStream(lexer);
    let parser = new ExpressParser(tokens);
    parser.buildParseTrees = true;
    //set start rule parser.start_rule()
    let tree = parser.schemaDecl();
    //tree.accept(new Visitor());
    return tree
  }
  
  function toStringTree(tree, ruleNames, recog, prettyPrint, indentLvl) {
    ruleNames = ruleNames || null;
    recog = recog || null;
    prettyPrint = prettyPrint || false;
    indentLvl = indentLvl || 0;
  
    if (recog !== null) {
      ruleNames = recog.ruleNames;
    }
  
    let s = antlr4.tree.Trees.getNodeText(tree, ruleNames);
    //s = escapeWhitespace(s, false);
    const c = tree.getChildCount();
  
    if (c === 0) {
      if (prettyPrint) {
        return `\n${" ".repeat(indentLvl)}${s}`;
      }
      return s;
    }
  
    let res = "(" + s + " ";
    if (prettyPrint) {
      res = `\n${" ".repeat(indentLvl)}${res}`;
    }
  
    if (c > 0) {
      s = toStringTree(
        tree.getChild(0), ruleNames, recog, prettyPrint, indentLvl + 1
      );
      res = res.concat(s);
    }
    for (let i = 1; i < c; i++) {
      s = toStringTree(
        tree.getChild(i), ruleNames, recog, prettyPrint, indentLvl + 1
      );
      if (prettyPrint) {
        res = `${res}${" ".repeat(indentLvl)}${s}`;
      } else {
        res = res.concat(' ' + s);
      }
    }
  
    if (prettyPrint) {
      res = `${res}\n${" ".repeat(indentLvl)}`;
    }
    res = res.concat(")");
    return res;
  }

  

function removeValueFromArray(array, value) {
    for (let i = 0; i < array.length; i++) {
      if (array[i] === value) {
        array.splice(i, 1);
      }
    }
    for (let i = 0; i < array.length; i++) {
      if (Array.isArray(array[i])) {
        removeValueFromArray(array[i], value)
      }
    }
  }
  
  function findIdsAndConvertToDictionary(array, value) {
    //const convert_id_to = "name"
    for (let i = 0; i < array.length; i++) {
      if (Array.isArray(array[i]) && array[i].length === 2 && array[i][0] === value) {
        let dict = {};
        dict[value] = array[i][1];
        array[i] = dict;
      } else if (Array.isArray(array[i])) {
        findIdsAndConvertToDictionary(array[i], value);
      }
    }
  
  }
  
  //use for references to id pairs (e.g. entityRef, entityId)
  function findIdsAndPassThrough(array, value_to_replace, value_to_passthru) {
    for (let i = 0; i < array.length; i++) {
      if (Array.isArray(array[i]) && array[i][0] === value_to_replace && Array.isArray(array[i][1]) && array[i][1][0] === value_to_passthru) {
        //let dict = {};
        //dict[value_to_passthru] = array[i][1][1];
        //console.log(i, array[i][0], array[i][1])
        //array[i] = dict;
        array[i] = array[i][1];
      } else if (Array.isArray(array[i])) {
        findIdsAndPassThrough(array[i], value_to_replace, value_to_passthru)
      }
    }
  }

  export default {  ParseExpressFile, ParseExpressString, removeValueFromArray, findIdsAndPassThrough, findIdsAndConvertToDictionary};