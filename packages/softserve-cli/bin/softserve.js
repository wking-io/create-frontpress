#!/usr/bin/env node

'use strict';

const chalk = require('chalk');

const currentNodeVersion = process.versions.node;
const major = currentNodeVersion.split('.')[0];

if (major < 6) {
  console.error(
    chalk.red(
      'You are running Node ' +
        currentNodeVersion +
        '.\n' +
        'Softserve requires Node 6 or higher. \n' +
        'Please update your version of Node.'
    )
  );
  process.exit(1);
}

const program = require('commander');
const packageJson = require('../package.json');

program
  .version(packageJson.version)
  .description('Generator for modern Wordpress Development')
  .command('theme <name>', 'Generate theme using passed in name.')
  .alias('t')
  .option(
    '-h',
    '--here',
    'Force install the theme in the current directory. Defaults to: false',
    false
  )
  .action(require('../src/softserve-theme'));
