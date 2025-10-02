# Overview

This project is an EXPRESS language parser and schema diagram generator. EXPRESS is a data modeling language defined in ISO 10303-11 (STEP - Standard for the Exchange of Product Model Data). The tool parses EXPRESS files (.exp) and generates SVG schema diagrams visualizing the entity relationships and structure.

The system processes EXPRESS files (particularly arm.exp and mim.exp files from STEP modules), parses them using either ANTLR4 grammar or custom JavaScript parsing, and creates visual diagrams using the ELK (Eclipse Layout Kernel) graph layout library.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Parsing Architecture

The system implements multiple parsing strategies for EXPRESS language files:

**ANTLR4-based Parsing**: Uses auto-generated lexer/parser from EXPRESS grammar files. The grammar supports the full EXPRESS language specification including entities, types, functions, schemas, and complex declarations. ANTLR4 generates parse trees that are converted to S-expressions and then transformed into JSON structures.

**Custom JavaScript String Parsing**: Alternative parsing approach using regex patterns and string manipulation. This method processes EXPRESS statements directly without grammar compilation, offering faster execution for simple cases.

**XML Reference Parsing**: Supports conversion of EXPRESS XML output (from Express Engine) to JSON format for comparison and validation against the JavaScript parsing results.

## Graph Layout and Visualization

**ELK Graph Layout**: Uses elkjs library to compute hierarchical graph layouts. The system converts EXPRESS entity relationships into ELK-compatible graph structures with nodes (entities) and edges (relationships).

**SVG Generation**: Custom elkjs-svg renderer (modified from original) generates SVG diagrams from layouted graphs. Handles label sizing, text measurement, and visual styling. The renderer calculates pixel dimensions for text labels using the string-pixel-width library.

**Layout Configuration**: Supports customizable layout algorithms (layered, force-directed), node placement strategies, and visual styling through CSS and SVG definitions.

## Data Processing Pipeline

EXPRESS files are discovered recursively in specified directories, filtered (arm.exp/mim.exp preference), then processed through:

1. File reading and initial parsing
2. Syntax tree generation (ANTLR or string-based)
3. AST transformation and cleanup (keyword removal, structure flattening)
4. Entity/relationship extraction
5. Graph structure creation
6. Layout computation via ELK
7. SVG rendering and file output

The pipeline supports batch processing of multiple schemas and maintains directory structure in output folders.

## Module Structure

**Core Parsing Modules**:
- `antlr_express_parsing.js` - ANTLR4 integration and parse tree processing
- `express_parsing.js` - Core parsing utilities and multiline declaration handling
- `antlr_tree_parsing.js` - Parse tree to object conversion
- `express_xml_parser.js` - XML format parsing using fast-xml-parser

**Visualization Modules**:
- `express_g_layout.js` - ELK graph layout preparation and label sizing
- `elkjs-svg/` - Modified SVG rendering library with custom XML generation

**Utility Modules**:
- `file_search.js` - Recursive file discovery and folder creation
- ANTLR grammar outputs in `src/antlr/express_antlr_js/`

# External Dependencies

**ANTLR4 Runtime** (antlr4 v4.11.0): Lexer/parser runtime for processing EXPRESS grammar. Used for generating and traversing parse trees. The project includes the full ANTLR4 JavaScript runtime in `src/antlr/antlr4/`.

**ELK Graph Layout** (elkjs v0.8.2): Eclipse Layout Kernel for hierarchical graph layout computation. Provides multiple layout algorithms (layered, force-directed) and constraint-based positioning.

**XML/JSON Processing**:
- fast-xml-parser (v4.0.12): Parses EXPRESS XML format with custom array handling
- fast-sexpr (v1.0.0): Converts ANTLR S-expression output to nested arrays

**Text Measurement**:
- string-pixel-width (v1.10.0): Calculates pixel width of text strings for label sizing in SVG output
- flattenjs (v2.1.3): Object flattening/inflating utilities for data transformation

**Modified Third-Party**:
- elkjs-svg: Custom-modified SVG renderer (original from EmilStenstrom/elkjs-svg) with enhanced XML generation and styling capabilities. Located in `src/elkjs-svg/` with its own package.json.

**File System**: Node.js fs module for file I/O operations including recursive directory scanning and output generation.