"use strict"
import path from 'path';
import ep from './src/express_parsing.js';
import fsh from './src/file_search.js'

const express_folder_to_read = process.argv[2] || ".";

console.log(`Processing EXPRESS files from: ${express_folder_to_read}`);

let Files = fsh.FindExpressFiles(express_folder_to_read, ".exp");
console.log(`Found ${Files.length} total .exp files:`);
Files.forEach(file => console.log(`  - ${file}`));

// Filter for arm.exp or mim.exp files
let armMimFiles = Files.filter(
  function(filename) { 
    return  path.parse(filename).base === "arm.exp"||path.parse(filename).base === "mim.exp"
  });

// If no arm.exp/mim.exp files, ask user if they want to process all .exp files
if (armMimFiles.length === 0) {
  console.log("\nNo arm.exp or mim.exp files found.");
  console.log("Available .exp files found:");
  Files.forEach(file => console.log(`  - ${file}`));
  console.log("\nTo process all .exp files, modify the filter in the script.");
  console.log("For now, processing will continue with all .exp files...");
  armMimFiles = Files; // Process all .exp files instead
}

if (armMimFiles.length === 0) {
  console.log("No .exp files found to process.");
  process.exit(0);
}

console.log(`\nProcessing ${armMimFiles.length} EXPRESS files:`);
armMimFiles.forEach(file => console.log(`  - ${file}`));

const output_folder_path = "./output/";

//setup output folders
console.log(`Creating output directory: ${output_folder_path}`);
fsh.CreateFolder(output_folder_path);

const const_keys_to_ignore = ["graphic.element"]

const antlr_parse_flag = false
const js_string_parse_flag = true
const express_g_flag = true

armMimFiles.forEach(schema_file => {
    console.log(`\n=== Processing: ${schema_file} ===`);
    let formatted_folder_path = path.dirname(schema_file).split(path.sep).join("/")
    
    // Fix the output path calculation
    let relative_path = path.relative(express_folder_to_read, formatted_folder_path);
    let output_express_folder_path = path.join(output_folder_path, relative_path).split(path.sep).join("/") + "/";
    
    // If it's the current directory, put files directly in output
    if (relative_path === "" || relative_path === ".") {
        output_express_folder_path = output_folder_path;
    }
    
    console.log(`  - Input folder: ${formatted_folder_path}`);
    console.log(`  - Relative path: ${relative_path}`);
    console.log(`  - Output folder: ${output_express_folder_path}`);
    
    fsh.CreateFolder(output_express_folder_path)
    
    //STRING PARSING
    if (js_string_parse_flag) {
      try {
        console.log("  - Parsing EXPRESS schema...");
        var express_working = ep.string_express_parsing(schema_file)
        
        console.log(`  - Parsed result type: ${typeof express_working}`);
        console.log(`  - Express working keys: ${Object.keys(express_working)}`);
        
        if (express_working && express_working.express) {
          console.log(`  - Found ${express_working.express.length} schemas`);
          
          // Log the schema names
          express_working.express.forEach((schema, index) => {
            console.log(`    Schema ${index + 1}: ${schema.name || 'unnamed'}`);
          });
          
        } else {
          console.log("  - No express schemas found in parsed result");
          return;
        }
        
        console.log("  - Removing keys...");
        express_working = ep.removeKeysInPlace(express_working, ep.const_keys_to_ignore);
        express_working = ep.removeBlankKeysInPlace(express_working, ep.blanks_keys_to_ignore)
        express_working = ep.removeKeysInPlaceByValue(express_working, ep.false_keys_to_ignore, "NO")
        
        console.log(`  - Exporting JSON schema to: ${output_express_folder_path}`);
        ep.export_express_json_schema(express_working.express, output_express_folder_path)
        
        if (express_g_flag) {
          console.log("  - Generating SVG diagrams...");
          ep.create_elk_graphics_from_schemas(express_working.express, output_express_folder_path)
        }
        
        console.log("  ✓ Complete");
        
      } catch (error) {
        console.error(`  ✗ Error processing ${schema_file}:`);
        console.error(`     ${error.message}`);
        console.error(`     Stack: ${error.stack}`);
      }
    }
})

console.log(`\nProcessing complete. Check the ${output_folder_path} directory for results.`);

// Better file listing
import('fs').then(fs => {
  function listFilesRecursive(dir, filesList = []) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        listFilesRecursive(filePath, filesList);
      } else {
        filesList.push(path.relative(output_folder_path, filePath));
      }
    });
    
    return filesList;
  }

  if (fs.existsSync(output_folder_path)) {
    const files = listFilesRecursive(output_folder_path);
    console.log(`\nFiles created in output directory:`);
    if (files.length === 0) {
      console.log("  (no files created)");
    } else {
      files.forEach(file => console.log(`  - ${file}`));
    }
  } else {
    console.log("\nOutput directory does not exist");
  }
});

