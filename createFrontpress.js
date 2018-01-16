#!/usr/bin/env node

'use strict';

const program = require('commander');
const chalk = require('chalk');

// Theme Name: This is using let so that we can reassign in program
let themeName;

program
  .arguments('<theme-name>')
  .usage(`${chalk.green('<theme-name>')} [options]`)
  .action(name => (themeName = name))
  .on('--help', () => {
    console.log(`    Only ${chalk.green('<theme-directory>')} is required.`);
    console.log();
    console.log(`    If you have any problems, do not hesitate to file an issue:`);
    console.log(`      ${chalk.cyan('https://github.com/wking-io/create-frontpress')}`);
    console.log();
  })
  .parse(process.argv);

if (typeof themeName === 'undefined') {
  console.error('Please specify the project directory:');
  console.log(`  ${chalk.cyan(program.name())} ${chalk.green('<project-directory>')}`);
  console.log();
  console.log('For example:');
  console.log(`  ${chalk.cyan(program.name())} ${chalk.green('my-theme')}`);
  console.log();
  console.log(`Run ${chalk.cyan(`${program.name()} --help`)} to see all options.`);
  process.exit(1);
}

console.log(`You would like to create a theme with the name ${chalk.cyan(themeName)}`);
