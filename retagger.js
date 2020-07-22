#!/usr/bin/env node
const mp3tag = require('mp3tag');
const glob = require('glob');
const path = require('path');
const _ = require('lodash');

var args = require('minimist')(process.argv.slice(2));

if (args['help']) {
  console.log("retagger.js - Retagging tool for .mp3 files");
  console.log("Title and artist are derived from the file's name and the album is derived from the folder's name.");
  console.log("The tool will recursively scan all subdirectories starting from the current directory.")
  console.log("Usage: node retagger.js [--test]");
  console.log("  test - only print changes, don't apply them");
  return;
}

const testMode = args['test'];
var filesChanged = 0;

glob("**/*.mp3", async (err, files) => {
  if (err) {
    console.error("Error while scanning for mp3 files: ", err);
    process.exitCode = 1;
    return;
  }

  for (const filePath of files) {
    try {
      await updateFile(filePath);
    } catch(err) {
      // Add information to help locate problem
      err.message += ` in file: ${filePath}`;
      throw err;
    }    
  }

  console.log(`${filesChanged}/${files.length} files changed`);
});


/** Retrieves the frame with the given id from the tag and decodes it as string if it exists
 */
function getString(tag, id) {
  var frame = tag.getFrameBuffer(id);
  if (frame)
    return tag.decoder.decodeString(frame);

  return '-';
}

function setString(tag, id, string) {
  tag.setFrameBuffer(id, tag.decoder.encodeString(string));
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
      const absolutePath = path.resolve(filename);
      return path.basename(path.dirname(absolutePath));
    }
  },

  {
    description:'Track',
    id: 'TRCK',
    expected: function(filename) {
      return matchFile(filename).track;
    }
  }
];


/** Opens one file, and applies all necessary changes to it. The callback is called, once this
 *  has been done.
 */
async function updateFile(filePath) {


  const tagData = await mp3tag.readHeader(filePath);

  const changes = [];

  // First simply collect all changes
  _.each(properties, (prop) => {
    const current = getString(tagData, prop.id);
    const expected = prop.expected(filePath);

    if (current !== expected) {
      changes.push(_.defaults({new:expected, current:current}, prop));
    }
  });

  // Now print changes and apply them if we aren't in test mode
  if (changes.length > 0) {
    console.log(`File: ${filePath} :`);  
    _.each(changes, (change) => {
      console.log(`  ${change.description}: ${change.current} --> ${change.new}`);
      if (!testMode) {
        setString(tagData, change.id, change.new);
      }
    });

    if (!testMode) {
      ++filesChanged;
      tagData.save(_.noop);
    }

    console.log("\n\n");
  }
}


const PATTERNS = [
  { //matcher for track number + multiple artists (a ft. b - bla , a&b - kkk)
    regex: /^([0-9]+) (.*?)\s*(([fF]([eE][aA])?[tT]\.)|([,&]))\s*(.*?) - (.*)$/,
    track: 1,
    artists: [2,7],
    title: 8
  },
  { // matcher for providing a track number (002 interpret - title)
    regex: /^([0-9]+) (.*?) - (.*)$/,
    track: 1,
    artists: [2],
    title: 3
  },
  { // matcher for tracknumber + title (002 title)
    regex: /^([0-9]+) (.*)$/,
    track: 1,
    artists: [],
    title: 2
  },
  { //matcher for multiple artists (a ft. b - bla , a&b - kkk)
     regex: /^(.*?)\s*(([fF]([eE][aA])?[tT]\.)|([,&]))\s*(.*?) - (.*)$/,
     artists: [1,6],
     title: 7
  },
  { //Modified second matcher, now the most accurate matcher
    regex: /^(.*?) - (.*)$/, 
    artists: [1],
    title: 2
  },
  { //Simplest matcher. Matches everything as title with no interpret
    regex: /^(.*)$/,
    artists: [],
    title: 1
  }
];

/** Matches the pattern and returns an object, which contains the calculated result structure or null if no match was possible.
 */
function applyPattern(pattern, filename) {
  const match = pattern.regex.exec(filename);
  if (!match) {
    return null;
  }

  return {
    title: match[pattern.title],
    artists: _.map(pattern.artists, (index) => { return match[index]; }).join('/'),
    track: pattern.track ? (parseInt(match[pattern.track])+'') : ''
  };
}

function matchFile(filename) {
  const name = path.basename(filename, '.mp3');

  for(let i = 0; i < PATTERNS.length; ++i) {
    const result = applyPattern(PATTERNS[i], name);

    if (result) {
      return result;
    }
  }
}
