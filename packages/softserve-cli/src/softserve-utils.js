'use strict';

const path = require('path');
const fs = require('fs');
const process = require('process');
const chalk = require('chalk');
const Result = require('crocks/Result');
const tryCatch = require('crocks/Result/tryCatch');
const either = require('crocks/pointfree/either');
const Async = require('crocks/Async');

// always :: a -> b -> a
const always = a => () => a;

// identity :: a -> a
const identity = a => a;

// mkdir :: String -> Async Error ()
const mkdir = Async.fromNode(fs.mkdir);

// readdir :: (String, Options) -> Async Error (Array fs.Dirent)
const readdir = Async.fromNode(fs.readdir);

// dirExists :: String -> String -> Async Error Bool
const dirExists = path => name =>
  readdir(path, { withFileTypes: true }).map(nodes =>
    nodes.some(node => node.isDirectory() && node.name === name)
  );

const buildConfigFor = target => (name, options) => ({
  name,
  options,
  target,
});

const getDirState = dirs => {
  return dirs.reduce(
    (acc, dir, index) => {
      if (dir === 'wp-content') {
        return ['wp-content', index];
      } else if (dir === 'mu-plugins') {
        return ['mu-plugins', index];
      } else if (dir === 'plugins') {
        return ['plugins', index];
      } else if (dir === 'themes') {
        return ['themes', index];
      }
      return acc;
    },
    ['root', 0]
  );
};

const readdirSync = tryCatch(fs.readdirSync);

function directoryNameExists(name) {
  return readdirSync('./', { withFileTypes: true }).chain(
    data =>
      data.some(node => node.isDirectory() && node.name === name)
        ? Result.Ok(true)
        : Result.Err(false)
  );
}

function checkIfRootDirectory(config) {
  const notRootError = () => {
    console.log(`${chalk.red.underline(`GENERATOR ERROR:`)}`);
    console.log(``);
    console.log(`You are running the generator in the wrong location.`);
    console.log(``);
    console.log(
      `The directory that you are in does not contain a ${chalk.bold(
        `wp-content`
      )} directory.`
    );
    console.log(``);
    console.log(
      `Just change directories to the root of your Wordpress project (where the wp-content directory and wp-config.php file is located) and run the generator again.`
    );
    console.log(``);
    process.exit(1);
  };

  const newConfig = () =>
    Object.assign(config, {
      installPath: path.resolve(process.cwd(), 'wp-content', config.target),
    });

  return either(notRootError, newConfig)(directoryNameExists('wp-content'));
}

function checkIfTargetDirectory(config) {
  if (path.basename(process.cwd()) === config.target) {
    return Object.assign(config, { installPath: process.cwd() });
  } else {
    console.log(`${chalk.red.underline(`GENERATOR ERROR:`)}`);
    console.log(``);
    console.log(`You are running the generator in the wrong location.`);
    console.log(``);
    console.log(
      `The directory that you need to be in is: ${chalk.cyan(config.target)}`
    );
    console.log(
      `However, the directory you are in is: ${chalk.cyan(
        path.basename(process.cwd)
      )}`
    );
    console.log(``);
    console.log(
      `Just change directories to the correct location and run the generator again.`
    );
    console.log(
      `If you would like to generate the files in a different location add the ${chalk.bold(
        `--here`
      )} flag to ignore this safety check.`
    );
    console.log(``);
    process.exit(1);
  }
}

const findInstallDirectory = config =>
  config.options.root
    ? checkIfRootDirectory(config)
    : checkIfTargetDirectory(config);

const chdir = tryCatch(process.chdir);

const changeToInstallDirectory = config =>
  either(() => {
    console.log(`Failed to change to directory ${config.installPath}.`);
    process.exit(1);
  }, () => config)(chdir(config.installPath));

const getDirectories = path =>
  readdirSync(path, { withFileTypes: true }).map(nodes =>
    nodes.reduce(
      (acc, node) => (node.isDirectory() ? [...acc, node.name] : acc),
      []
    )
  );

const isValidDirectoryName = config =>
  either(() => {
    console.log(
      chalk.red(
        `We cannot create a project called ${chalk.green(
          config.name
        )} because a directory with the same name exists.`
      )
    );
    console.log(``);
    console.log(``);
    either(
      () => '',
      dirs => console.log(chalk.cyan(dirs.map(dir => `  ${dir}`).join('\n')))
    )(getDirectories('./'));
    console.log(``);
    console.log(``);
    console.log(chalk.red('Please choose a different project name.'));
    process.exit(1);
  }, () => config)(directoryNameExists(config.name));

module.exports = {
  chdir,
  buildConfigFor,
  getDirState,
  readdirSync,
  findInstallDirectory,
  changeToInstallDirectory,
  isValidDirectoryName,
  always,
  identity,
  mkdir,
  readdir,
  dirExists,
};
