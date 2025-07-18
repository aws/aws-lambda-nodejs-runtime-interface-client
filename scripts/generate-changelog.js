#!/usr/bin/env node
/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Simple changelog generator that creates a markdown formatted list of commits
 * between the last tag and HEAD (or between two specified git refs)
 */

// Parse command line arguments
const args = process.argv.slice(2);
let startRef = '';
let endRef = 'HEAD';
let outputFile = '';

// Process arguments
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--start-ref' && i + 1 < args.length) {
    startRef = args[i + 1];
    i++;
  } else if (args[i] === '--end-ref' && i + 1 < args.length) {
    endRef = args[i + 1];
    i++;
  } else if (args[i] === '--output' && i + 1 < args.length) {
    outputFile = args[i + 1];
    i++;
  }
}

// If no start ref is provided, use the last tag
if (!startRef) {
  try {
    startRef = execSync('git describe --tags --abbrev=0').toString().trim();
    console.log(`Using last tag as start ref: ${startRef}`);
  } catch (error) {
    console.error('No tags found. Using first commit as start ref.');
    startRef = execSync('git rev-list --max-parents=0 HEAD').toString().trim();
  }
}

// Get repository info from package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
const repoUrl = packageJson.repository && packageJson.repository.url
  ? packageJson.repository.url.replace(/^git\+|\.git$/g, '')
  : 'https://github.com/aws/aws-lambda-nodejs-runtime-interface-client';

// Get commit range
const commitRange = `${startRef}..${endRef}`;
console.log(`Generating changelog for commit range: ${commitRange}`);

// Get commits
const gitLogFormat = '%h %s';
const gitLog = execSync(`git log ${commitRange} --pretty=format:"${gitLogFormat}"`).toString();

// Filter out version commits and format the changelog
const commits = gitLog.split('\n')
  .filter(line => line.trim())
  .filter(line => {
    // Filter out version commits (just a version number)
    const message = line.substring(line.indexOf(' ') + 1);
    return !/^v?\d+\.\d+\.\d+(-.*)?$/.test(message) && 
           !message.startsWith('working on ') &&
           !message.startsWith('Working on ');
  })
  .map(line => {
    const hash = line.substring(0, line.indexOf(' '));
    const message = line.substring(line.indexOf(' ') + 1);
    
    // Check if message starts with a category (e.g., "feat:", "fix:")
    let formattedMessage = message;
    const categoryMatch = message.match(/^(\w+):\s*(.*)/);
    if (categoryMatch) {
      const [, category, rest] = categoryMatch;
      formattedMessage = `**${category}**: ${rest}`;
    }
    
    return `* [\`${hash}\`](${repoUrl}/commit/${hash}) - ${formattedMessage}`;
  });

// Generate the changelog content
const changelogContent = commits.join('\n');

// Output the changelog
if (outputFile) {
  fs.writeFileSync(outputFile, changelogContent);
  console.log(`Changelog written to ${outputFile}`);
} else {
  console.log('\nChangelog:');
  console.log(changelogContent);
}