"use strict"
import fs from 'fs';
import path from 'path';

function ReadFilesWithExtension(Directory, file_extension = ".exp") {
  var Files = [];
    fs.readdirSync(Directory).forEach(File => {
        const Absolute = path.join(Directory, File);
        if (fs.lstatSync(Absolute).isDirectory()) {
            Files = Files.concat(ReadFilesWithExtension(Absolute, file_extension));
        } else if (path.extname(Absolute) === file_extension){         
            var file_path_return = {
              "file_path": Absolute, 
              "file_contents": fs.readFileSync(Absolute, 'utf-8')
            };
            Files.push(file_path_return);}
    })
  return Files
}

function FindExpressFiles(Directory, file_extension = ".exp", current_recursion_level = 0,max_recursion_level = 1) {
  var Files = [];
  if (current_recursion_level > max_recursion_level) {
  } else {
  fs.readdirSync(Directory).forEach(File => {
      const Absolute = path.join(Directory, File);
      if (fs.lstatSync(Absolute).isDirectory()) {
        Files = Files.concat(FindExpressFiles(Absolute, file_extension, current_recursion_level +1, max_recursion_level));
      } else if (path.extname(Absolute) === file_extension) { //& ep.ContainsAny([path.basename(Absolute)], file_names)){         
          Files.push(Absolute);
        }
  })
  }
  return Files

}

function CreateFolder(folder_path) {
  if (!fs.existsSync(folder_path)){
      fs.mkdirSync(folder_path, { recursive: true });
  }
}

function FindFilesWithExtension(Directory, file_extension = ".exp") {
  var Files = [];
    fs.readdirSync(Directory).forEach(File => {
        const Absolute = path.join(Directory, File);
        if (fs.lstatSync(Absolute).isDirectory()) {
            Files = Files.concat(FindFilesWithExtension(Absolute, file_extension));
        } else if (path.extname(Absolute) === file_extension){         
            var file_path_return = {
              "file_path": Absolute, 
              "exp_folder": path.dirname(Absolute)};
            Files.push(file_path_return);}
    })
  return Files
}  


function ReadJSONinFolder(Directory, file_extension = ".json") {
  var Files = [];
  fs.readdirSync(Directory).forEach(File => {
      const Absolute = path.join(Directory, File);
      if (fs.lstatSync(Absolute).isDirectory()) {
      } else if (path.extname(Absolute) === file_extension){         
          var file_path_return = {
            "file_path": Absolute, 
            "file_contents": fs.readFileSync(Absolute, 'utf-8')};
          Files.push(file_path_return);
        }
  })
  return Files
}

export default {ReadFilesWithExtension, FindExpressFiles, CreateFolder, FindFilesWithExtension, ReadJSONinFolder};