"use strict"
import fxp from 'fast-xml-parser';
import fs from 'fs';

const express_xml_alwaysArray = [
    "express",
    "express.schema",
    "express.schema.interface",
    "express.schema.interface.interfaced.item",
    "express.schema.type",
    "express.schema.type.where",
    "express.schema.type.aggregate",
    "express.schema.constant",
    "express.schema.function",
    "express.schema.rule",
    "express.schema.entity",
    "express.schema.entity.explicit",
    "express.schema.entity.explicit.aggregate",
    "express.schema.entity.derived",
    "express.schema.entity.derived.aggregate",
    "express.schema.entity.inverse",
    "express.schema.entity.inverse.inverse.aggregate",
    "express.schema.entity.where",
    "express.schema.entity.graphic.element",
    "express.schema.entity.supertypes",
    "express.schema.entity.unique",
    "express.schema.entity.unique.unique.attribute",
    "express.schema.subtype.constraint"
];

const express_xml_read_options = {
        ignoreAttributes : false,
        attributeNamePrefix : "",
        attributesGroupName : "",
        allowBooleanAttributes: true,
        isArray: (name, jpath, isLeafNode, isAttribute) => { 
            if( express_xml_alwaysArray.indexOf(jpath) !== -1) return true;
        }
    };


function parse_express_xml(input_path) {
    const parser = new fxp.XMLParser(express_xml_read_options);
    return parser.parse(fs.readFileSync(input_path,'utf8', (err) => { if (err) throw err })) 
}

export default {parse_express_xml};