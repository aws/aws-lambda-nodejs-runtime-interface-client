/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Script to generate and update changelog entries in RELEASE.CHANGELOG.md
 * It automatically adds new entries when cutting a new tag
 */

// Parse command line arguments
const args = process.argv.slice(2);
const updateFile = args.includes('--update');
const outputFile = args.find((arg, i) => arg === '--output' && i + 1 < args.length) 
  ? args[args.indexOf('--output') + 1] 
  : null;

// Get the last tag
let lastTag;
try {
  lastTag = execSync('git describe --tags --abbrev=0').toString().trim();
  console.log(`Last tag: ${lastTag}`);
} catch (error) {
  console.error('No tags found.');
  process.exit(1);
}

// Get current version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
const version = packageJson.version;
console.log(`Current version: ${version}`);

// Get commits since last tag
const gitLogFormat = '%h %s';
const gitLog = execSync(`git log ${lastTag}..HEAD --pretty=format:"${gitLogFormat}"`).toString();

// Filter and format commits
const commits = gitLog.split('\n')
  .filter(line => line.trim())
  .filter(line => {
    // Filter out version commits
    const message = line.substring(line.indexOf(' ') + 1);
    return !/^v?\d+\.\d+\.\d+(-.*)?$/.test(message) && 
           !message.startsWith('working on ') &&
           !message.startsWith('Working on ');
  })
  .map(line => {
    const hash = line.substring(0, line.indexOf(' '));
    const message = line.substring(line.indexOf(' ') + 1);
    
    // Check for PR number in message
    const prMatch = message.match(/\(#(\d+)\)|\(https:\/\/github\.com\/[^\/]+\/[^\/]+\/pull\/(\d+)\)/);
    const prNumber = prMatch ? prMatch[1] || prMatch[2] : null;
    
    if (prNumber) {
      return `- ${message} ([#${prNumber}](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/${prNumber}))`;
    } else {
      return `- ${message}`;
    }
  });

// Generate changelog entry
const today = new Date();
const formattedDate = `${today.toLocaleString('en-US', { month: 'short' })} ${today.getDate()}, ${today.getFullYear()}`;

const changelogEntry = `### ${formattedDate}
\`${version}\`
${commits.join('\n')}

`;

// Output the changelog entry
if (outputFile) {
  fs.writeFileSync(outputFile, changelogEntry);
  console.log(`Changelog entry written to ${outputFile}`);
} else {
  console.log('\nChangelog entry:');
  console.log(changelogEntry);
}

// Update RELEASE.CHANGELOG.md if requested
if (updateFile) {
  const changelogPath = path.join(process.cwd(), 'RELEASE.CHANGELOG.md');
  if (fs.existsSync(changelogPath)) {
    const existingChangelog = fs.readFileSync(changelogPath, 'utf8');
    fs.writeFileSync(changelogPath, changelogEntry + existingChangelog);
    console.log(`Updated ${changelogPath} with new entry`);
  } else {
    fs.writeFileSync(changelogPath, changelogEntry);
    console.log(`Created ${changelogPath} with new entry`);
  }
}