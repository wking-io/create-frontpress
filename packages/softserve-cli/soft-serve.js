'use strict';

const chalk = require('chalk');
const dns = require('dns');
const envinfo = require('envinfo');
const execSync = require('child_process').execSync;
const fs = require('fs-extra');
const Future = require('fluture');
const os = require('os');
const path = require('path');
const program = require('commander');
const { compose, map, chain } = require('ramda');
const semver = require('semver');
const spawn = require('cross-spawn');
const url = require('url');
const validatePackageName = require('validate-npm-package-name');

const packageJson = require('./package.json');

program
  .version(packageJson.version)
  .arguments('<theme-name>')
  .usage(`${chalk.green('<theme-name>')} [options]`)
  .option('--verbose', 'print additional logs')
  .option('--info', 'print environment debug info')
  .option('--use-npm')
  .on('--help', () => {
    console.log(`    Only ${chalk.green('<theme-name>')} is required.`);
    console.log();
    console.log(
      `    If you have any problems, do not hesitate to file an issue:`
    );
    console.log(
      `      ${chalk.cyan('https://github.com/wking-io/softserve-cli')}`
    );
    console.log();
  })
  .parse(process.argv);

const themeName = program.args[0];

if (typeof themeName === 'undefined') {
  if (program.info) {
    envinfo.print({
      packages: ['softserve-scripts'],
      noNativeIDE: true,
      duplicates: true,
    });
    process.exit(0);
  }

  console.error('Please specify the theme directory:');
  console.log(`  ${chalk.cyan(program.name())} ${chalk.green('<theme-name>')}`);
  console.log();
  console.log('For example:');
  console.log(`  ${chalk.cyan(program.name())} ${chalk.green('my-theme')}`);
  console.log();
  console.log(
    `Run ${chalk.cyan(`${program.name()} --help`)} to see all options.`
  );
  process.exit(1);
}

createTheme(program).fork(reason => {
  console.log();
  console.log('Aborting installation.');
  if (reason.command) {
    console.log(`  ${chalk.cyan(reason.command)} has failed.`);
  } else {
    console.log(chalk.red('Unexpected error. Please report it as a bug:'));
    console.log(reason);
  }
  console.log();

  // On 'exit' we will delete these files from target directory.
  const knownGeneratedFiles = [
    'package.json',
    'npm-debug.log',
    'yarn-error.log',
    'yarn-debug.log',
    'node_modules',
  ];
  const currentFiles = fs.readdirSync(path.join(root));
  currentFiles.forEach(file => {
    knownGeneratedFiles.forEach(fileToMatch => {
      // This will catch `(npm-debug|yarn-error|yarn-debug).log*` files
      // and the rest of knownGeneratedFiles.
      if (
        (fileToMatch.match(/.log/g) && file.indexOf(fileToMatch) === 0) ||
        file === fileToMatch
      ) {
        console.log(`Deleting generated file... ${chalk.cyan(file)}`);
        fs.removeSync(path.join(root, file));
      }
    });
  });
  const remainingFiles = fs.readdirSync(path.join(root));
  if (!remainingFiles.length) {
    // Delete target folder if empty
    console.log(
      `Deleting ${chalk.cyan(`${themeName} /`)} from ${chalk.cyan(
        path.resolve(root, '..')
      )}`
    );
    process.chdir(path.resolve(root, '..'));
    fs.removeSync(path.join(root));
  }
  console.log('Done.');
  process.exit(1);
}, console.log);

function createTheme(program) {
  return compose(
    newRun,
    checkNpmWorks,
    moveIntoTheme,
    checkYarn,
    createPackage(os.EOL),
    initPackage,
    announceBuild,
    setupDirectory,
    checkThemeName,
    getConfig
  )(program);
}

function newRun(config) {
  return compose(
    map(runInit),
    chain(newInstall),
    map(buildCmd),
    map(announceAgain),
    newCheckIfOnline,
    announceInstall,
    addPackageToInstall
  )(config);
}

function runInit(config) {
  checkNodeVersion(config.packageToInstall);
  checkForScriptDep(config.packageToInstall);

  const scriptsPath = path.resolve(
    process.cwd(),
    'node_modules',
    config.packageToInstall,
    'scripts',
    'init.js'
  );

  const init = require(scriptsPath);
  return init(
    config.root,
    config.themeName,
    config.verbose,
    config.originalDirectory
  );
}

function newInstall(config) {
  return Future((rej, res) => {
    spawn(config.command.name, config.command.args, {
      stdio: 'inherit',
    }).on('close', code => {
      if (code !== 0) {
        rej({
          command: `${config.name} ${config.args.join(' ')}`,
        });
      } else {
        res(config);
      }
    });
  });
}

function buildCmd(config) {
  const name = config.useYarn ? 'yarn' : 'npm';
  const args = config.useYarn
    ? ['add', config.packageToInstall, '--exact', '--cwd', config.root]
    : ['i', config.packageToInstall, '--save-exact', '--loglevel', 'error'];

  if (!config.isOnline && config.useYarn) {
    args.push('--offline');

    console.log(chalk.yellow('You appear to be offline.'));
    console.log(chalk.yellow('Falling back to the local Yarn cache.'));
    console.log();
  }

  return Object.assign(config, { command: { name, args } });
}

function announceAgain(config) {
  console.log(`Installing ${chalk.cyan(config.packageToInstall)}...`);
  console.log();
  return config;
}

function newCheckIfOnline(config) {
  if (!config.useYarn) {
    // Don't ping the Yarn registry.
    // We'll just assume the best case.

    return Future.of(Object.assign(config, { isOnline: true }));
  }

  return Future((rej, res) => {
    dns.lookup('registry.yarnpkg.com', err => {
      let proxy;
      if (err != null && (proxy = getProxy())) {
        // If a proxy is defined, we likely can't resolve external hostnames.
        // Try to resolve the proxy name as an indication of a connection.
        dns.lookup(url.parse(proxy).hostname, proxyErr => {
          res(Object.assign(config, { isOnline: proxyErr == null }));
        });
      } else {
        res(Object.assign(config, { isOnline: err == null }));
      }
    });
  });
}

function announceInstall(config) {
  console.log('Installing packages. This might take a couple of minutes.');
  return config;
}
function addPackageToInstall(config) {
  return Object.assign(config, {
    packageToInstall: getInstallPackage(
      config.version,
      config.originalDirectory
    ),
  });
}

function checkNpmWorks(config) {
  if (!config.useYarn && !checkThatNpmCanReadCwd()) {
    process.exit(1);
  }

  if (!config.useYarn) {
    const npmInfo = checkNpmVersion();
    if (!npmInfo.hasMinNpm) {
      if (npmInfo.npmVersion) {
        console.log(
          chalk.yellow(
            `You are using npm ${npmInfo.npmVersion}.\n\n` +
              `Please update to npm 3 or higher for a better, fully supported experience.\n`
          )
        );
      }
    }
  }

  return config;
}

function moveIntoTheme(config) {
  process.chdir(config.root);
  return config;
}

function checkYarn(config) {
  let useYarn = config.useYarn;
  useYarn &&
    commandWorks('yarnpkg --version').fork(
      () => (useYarn = false),
      () => (useYarn = true)
    );

  return Object.assign(config, { useYarn });
}

function createPackage(eol) {
  return function(config) {
    fs.writeFileSync(
      path.join(config.root, 'package.json'),
      JSON.stringify(config.package, null, 2) + eol
    );
    return config;
  };
}

function initPackage(config) {
  return Object.assign(config, {
    package: {
      name: config.themeName,
      version: '0.1.0',
      private: true,
    },
  });
}

function announceBuild(config) {
  console.log(`Creating a new Wordpress Theme in ${chalk.green(config.root)}.`);
  console.log();
  return config;
}

function setupDirectory(config) {
  fs.ensureDirSync(config.themeName);
  if (!isSafeToCreateThemeIn(config.root, config.themeName)) {
    process.exit(1);
  }
  return config;
}

function getConfig(program) {
  const name = program.args[0];
  const root = path.resolve(name);
  return {
    root,
    themeName: path.basename(root),
    originalDirectory: process.cwd(),
    useYarn: !program.useNpm,
    verbose: program.verbose,
    version: program.version,
  };
}

/**
 * Runs the theme name through the following checks. If any of the checks 
 * fail the script exits and returns a message explaining the failure
 * 
 * 1. Checks it is valid NPM package name
 * 2. Check that it does not match any project dependencies
 * 3. Check that the directory
 */
function checkThemeName(config) {
  return compose(checkValidDirectory, checkNotDependency, checkValidNpm)(
    config
  );
}

/**
 * Print results of NPM validation.
 */
function printValidationResults(results, color) {
  if (typeof results !== 'undefined') {
    results.forEach(error => {
      console.error(chalk[color](`  *  ${error}`));
    });
  }
}

/**
 * Check that passed in themeName is a valid NPM package name.
 */
function checkValidNpm(config) {
  const validationResult = validatePackageName(config.themeName);
  if (!validationResult.validForNewPackages) {
    console.error(
      `Could not create a project called ${chalk.red(
        `"${config.themeName}"`
      )} because of npm naming restrictions:`
    );
    printValidationResults(validationResult.errors, 'red');
    printValidationResults(validationResult.warnings, 'yellow');
    process.exit(1);
  }
  return config;
}

function checkNotDependency(config) {
  const dependencies = ['softserve-scripts'].sort();
  if (dependencies.indexOf(config.themeName) >= 0) {
    console.error(
      chalk.red(
        `We cannot create a project called ${chalk.green(
          config.themeName
        )} because a dependency with the same name exists.\n` +
          `Due to the way npm works, the following names are not allowed:\n\n`
      ) +
        chalk.cyan(dependencies.map(depName => `  ${depName}`).join('\n')) +
        chalk.red('\n\nPlease choose a different project name.')
    );
    process.exit(1);
  }
  return config;
}

/**
 * Returns if the passed in 
 */
function isDirectory(source) {
  return fs.lstatSync(source).isDirectory();
}

function getDirectories(source) {
  return fs.readdirSync(source).filter(isDirectory);
}

function checkValidDirectory(config) {
  const directories = getDirectories(config.originalDirectory);
  if (directories.indexOf(config.themeName) >= 0) {
    console.error(
      chalk.red(
        `We cannot create a project called ${chalk.green(
          config.themeName
        )} because a directory with the same name exists.\n\n`
      ) +
        chalk.cyan(directories.map(dirName => `  ${dirName}`).join('\n')) +
        chalk.red('\n\nPlease choose a different project name.')
    );
    process.exit(1);
  }
  return config;
}

// Check files in newly created directory to make sure we are safe to make theme
function isSafeToCreateThemeIn(root, name) {
  const validFiles = [
    '.DS_Store',
    'Thumbs.db',
    '.git',
    '.gitignore',
    '.idea',
    'README.md',
    'LICENSE',
    'web.iml',
    '.hg',
    '.hgignore',
    '.hgcheck',
    '.npmignore',
    'mkdocs.yml',
    'docs',
    '.travis.yml',
    '.gitlab-ci.yml',
    '.gitattributes',
  ];
  console.log();

  const conflicts = fs
    .readdirSync(root)
    .filter(file => !validFiles.includes(file));
  if (conflicts.length < 1) {
    return true;
  }

  console.log(
    `The directory ${chalk.green(name)} contains files that could conflict:`
  );
  console.log();
  for (const file of conflicts) {
    console.log(`  ${file}`);
  }
  console.log();
  console.log(
    'Either try using a new directory name, or remove the files listed above.'
  );

  return false;
}

function commandWorks(cmd) {
  return Future.try(() => execSync(cmd, { stdio: 'ignore' }));
}

function checkThatNpmCanReadCwd() {
  const cwd = process.cwd();
  let childOutput;

  Future.try(() => spawn.sync('npm', ['config', 'list']).output.join('')).fork(
    () => (childOutput = true),
    result => (childOutput = result)
  );

  if (typeof childOutput !== 'string') {
    return true;
  }

  const lines = childOutput.split('\n');
  const prefix = '; cwd = ';
  const line = lines.find(line => line.indexOf(prefix) === 0);
  if (typeof line !== 'string') {
    // Fail gracefully. They could remove it.
    return true;
  }
  const npmCWD = line.substring(prefix.length);
  if (npmCWD === cwd) {
    return true;
  }
  console.error(
    chalk.red(
      `Could not start an npm process in the right directory.\n\n` +
        `The current directory is: ${chalk.bold(cwd)}\n` +
        `However, a newly started npm process runs in: ${chalk.bold(
          npmCWD
        )}\n\n` +
        `This is probably caused by a misconfigured system terminal shell.`
    )
  );
  if (process.platform === 'win32') {
    console.error(
      chalk.red(`On Windows, this can usually be fixed by running:\n\n`) +
        `  ${chalk.cyan(
          'reg'
        )} delete "HKCU\\Software\\Microsoft\\Command Processor" /v AutoRun /f\n` +
        `  ${chalk.cyan(
          'reg'
        )} delete "HKLM\\Software\\Microsoft\\Command Processor" /v AutoRun /f\n\n` +
        chalk.red(`Try to run the above two lines in the terminal.\n`) +
        chalk.red(
          `To learn more about this problem, read: https://blogs.msdn.microsoft.com/oldnewthing/20071121-00/?p=24433/`
        )
    );
  }
  return false;
}

function checkNpmVersion() {
  let hasMinNpm = false;
  let npmVersion = null;

  commandWorks('npm --version')
    .map(result => result.toString().trim())
    .fork(console.error, version => (npmVersion = version));

  hasMinNpm = semver.gte(npmVersion, '3.0.0');
  return {
    hasMinNpm: hasMinNpm,
    npmVersion: npmVersion,
  };
}

function getInstallPackage(version) {
  let packageToInstall = 'softserve-scripts';
  const validSemver = semver.valid(version);
  if (validSemver) {
    packageToInstall += `@${validSemver}`;
  }
  return packageToInstall;
}

function checkIfOnline(useYarn) {
  if (!useYarn) {
    // Don't ping the Yarn registry.
    // We'll just assume the best case.
    return Future.of(true);
  }

  return Future((rej, res) => {
    dns.lookup('registry.yarnpkg.com', err => {
      let proxy;
      if (err != null && (proxy = getProxy())) {
        // If a proxy is defined, we likely can't resolve external hostnames.
        // Try to resolve the proxy name as an indication of a connection.
        dns.lookup(url.parse(proxy).hostname, proxyErr => {
          res(proxyErr == null);
        });
      } else {
        res(err == null);
      }
    });
  });
}

function getProxy() {
  if (process.env.https_proxy) {
    return process.env.https_proxy;
  } else {
    try {
      // Trying to read https-proxy from .npmrc
      let httpsProxy = execSync('npm config get https-proxy')
        .toString()
        .trim();
      return httpsProxy !== 'null' ? httpsProxy : undefined;
    } catch (e) {
      return;
    }
  }
}

function checkNodeVersion(packageName) {
  const packageJsonPath = path.resolve(
    process.cwd(),
    'node_modules',
    packageName,
    'package.json'
  );

  const packageJson = require(packageJsonPath);

  if (!packageJson.engines || !packageJson.engines.node) {
    return;
  }

  if (!semver.satisfies(process.version, packageJson.engines.node)) {
    console.error(
      chalk.red(
        'You are running Node %s.\n' +
          'Softserve requires Node %s or higher. \n' +
          'Please update your version of Node.'
      ),
      process.version,
      packageJson.engines.node
    );
    process.exit(1);
  }
}

function checkForScriptDep(packageName) {
  const packagePath = path.join(process.cwd(), 'package.json');
  const packageJson = require(packagePath);

  if (typeof packageJson.dependencies === 'undefined') {
    console.error(chalk.red('Missing dependencies in package.json'));
    process.exit(1);
  }

  const packageVersion = packageJson.dependencies[packageName];
  if (typeof packageVersion === 'undefined') {
    console.error(chalk.red(`Unable to find ${packageName} in package.json`));
    process.exit(1);
  }
}
