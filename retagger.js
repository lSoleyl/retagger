#!/usr/bin/env node
const mp3tag = require('mp3tag');
const async = require('async');
const glob = require('glob');
const path = require('path');
const _ = require('lodash');
const fs = require('fs');

var args = require('minimist')(process.argv.slice(2));

if (args['help']) {
  console.log("retagger.js - Retagging tool for .mp3 files");
  console.log("Title and artist are derived from the file's name and the album is derived from the folder's name");
  console.log("Usage: node retagger.js [--test]");
  console.log("  test - only print changes, don't apply them");
  return;
}

const testMode = args['test'];
var filesChanged = 0;

glob("**/*.mp3", (err, files) => {
  async.eachSeries(files, updateFile, (err) => {
    if (err) {
      console.error("An error occurred: ", err)
      return;
    }

    console.log(filesChanged + "/" + files.length + " files changed");
  });
});


/** Retrieves the frame with the given id from the tag and decodes it as string if it exists
 */
function getString(tag, id) {
  var frame = tag.getFrameBuffer(id);
  if (frame)
    return mp3tag.decodeString(frame);

  return '-';
}

function setString(tag, id, string) {
  tag.setFrameBuffer(id, mp3tag.encodeString(string));
}

// List of properties to check
const properties = [
  {
    description:'Title',
    id: 'TIT2',
    expected: function(filename) {
      return matchFile(filename).title;
    }
  },
 
  {
    description:'Artist',
    id: 'TPE1',
    expected: function(filename) {
      return matchFile(filename).artists;
    }
  },
 
  {
    description:'Album',
    id: 'TALB',
    expected: function(filename) { 
    var absolutePath = path.resolve(filename);
      return path.basename(path.dirname(absolutePath));
    }
  }
];


/** Opens one file, and applies all necessary changes to it. The callback is called, once this
 *  has been done.
 */
function updateFile(filepath, cb) {
  mp3tag.readHeader(filepath, (err, tag) => {
    if (err) {
      err.message += " in file: " + filepath;
      return cb(err);
    }


    var changes = [];

    // First simply collect all changes
    _.each(properties, (prop) => {
      var current = getString(tag, prop.id);
      var expected = prop.expected(filepath);

      if (current !== expected) {
        changes.push(_.defaults({new:expected, current:current}, prop));
      }
    });

    // Now print changes and apply them if we aren't in test mode
    if (changes.length > 0) {
      console.log("File: " + filepath + ":");  
      _.each(changes, (change) => {
        console.log("  " + change.description + ": " + change.current + " --> " + change.new);
        if (!testMode) {
          setString(tag, change.id, change.new);
        }
      });

      if (!testMode) {
        ++filesChanged;
        tag.save(_.noop);
      }

      console.log("\n\n");
    }

    process.nextTick(() => { cb(null); });
  });
}


const PATTERNS = [ 
  { //matcher for multiple artists (a ft. b - bla , a&b - kkk)
     regex: /(.*?)\s*(([fF]([eE][aA])?[tT]\.)|([,&]))\s*(.*?) - (.*)/,
     artists: [1,6],
     title: 7
  },
  { //Modified second matcher, now the most accurate matcher
    regex: /(.*?) - (.*)/, 
    artists: [1],
    title: 2
  },
  { //Simplest matcher. Matches everything as title with no interpret
    regex: /(.*)/,
    artists: [],
    title: 1
  }
];

/** Matches the pattern and returns an object, which contains the calculated result structure or null if no match was possible.
 */
function applyPattern(pattern, filename) {
  var match = pattern.regex.exec(filename);
  if (!match)
    return null;

  return {
    title: match[pattern.title],
    artists: _.map(pattern.artists, (index) => { return match[index]; }).join('/')
  };
}

function matchFile(filename) {
  var name = path.basename(filename, '.mp3');

  for(var i = 0; i < PATTERNS.length; ++i) {
    var result = applyPattern(PATTERNS[i], name);

    if (result) {
      return result;
    }
  }
}
