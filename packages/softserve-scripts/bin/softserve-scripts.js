#!/usr/bin/env node

'use strict';

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on('unhandledRejection', err => {
  throw err;
});

const chalk = require('chalk');
const spawn = require('cross-spawn');
const args = process.argv.slice(2);
const paths = require('../config/paths');

const exec = (command, args) =>
  spawn.sync(command, args, {
    stdio: 'inherit',
  });

const scriptIndex = args.findIndex(x => x === 'build' || x === 'start');

const script = scriptIndex === -1 ? args[0] : args[scriptIndex];

switch (script) {
  case 'build':
    console.log('');
    console.log(chalk.cyan('Bundling files for production!'));
    console.log('');
    exec('webpack', [
      '--mode',
      'production',
      '--config',
      paths.ownPath + '/config/webpack.config.prod',
    ]);
    break;
  case 'start':
    console.log('');
    console.log(chalk.cyan('Bundling files! Also, watching for changes.'));
    console.log('');
    exec('webpack', [
      '--mode',
      'development',
      '--watch',
      '--config',
      paths.ownPath + '/config/webpack.config.dev',
    ]);
    break;
  default:
    console.log('');
    console.log('Unknown script "' + script + '".');
    console.log('Perhaps you need to update softserve-scripts?');
    console.log('See: https://github.com/wking-io/softserve-cli');
    break;
}
