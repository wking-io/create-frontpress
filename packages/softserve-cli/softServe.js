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
const { compose } = require('ramda');
const semver = require('semver');
const spawn = require('cross-spawn');
const url = require('url');
const validatePackageName = require('validate-npm-package-name');

const packageJson = require('./package.json');
// Theme Name: This is using let so that we can reassign in program
let themeName;

program
  .version(packageJson.version)
  .arguments('<theme-name>')
  .usage(`${chalk.green('<theme-name>')} [options]`)
  .action(name => {
    themeName = name;
  })
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

createTheme(themeName, program.verbose, program.scriptsVersion, program.useNpm);

function createTheme(name, verbose, version, useNpm) {
  const root = path.resolve(name);
  const themeName = path.basename(root);
  const originalDirectory = process.cwd();

  checkThemeName(themeName, originalDirectory);
  fs.ensureDirSync(themeName);
  if (!isSafeToCreateThemeIn(root, themeName)) {
    process.exit(1);
  }

  console.log(`Creating a new Wordpress Theme in ${chalk.green(root)}.`);
  console.log();

  const packageJson = {
    name: themeName,
    version: '0.1.0',
    private: true,
  };

  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify(packageJson, null, 2) + os.EOL
  );

  let useYarn = !useNpm;
  useYarn &&
    commandWorks('yarnpkg --version').fork(
      () => (useYarn = false),
      () => (useYarn = true)
    );

  process.chdir(root);
  if (!useYarn && !checkThatNpmCanReadCwd()) {
    process.exit(1);
  }

  if (!useYarn) {
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
  run(root, themeName, version, verbose, originalDirectory, useYarn);
}

function run(root, themeName, version, verbose, originalDirectory, useYarn) {
  const packageToInstall = getInstallPackage(version, originalDirectory);

  console.log('Installing packages. This might take a couple of minutes.');
  checkIfOnline(useYarn)
    .chain(isOnline => {
      console.log(`Installing ${chalk.cyan(packageToInstall)}...`);
      console.log();

      return install(root, useYarn, packageToInstall, verbose, isOnline).map(
        () => packageToInstall
      );
    })
    .map(packageName => {
      checkNodeVersion(packageName);
      checkForScriptDep(packageName);

      const scriptsPath = path.resolve(
        process.cwd(),
        'node_modules',
        packageName,
        'scripts',
        'init.js'
      );

      const init = require(scriptsPath);
      return init(root, themeName, verbose, originalDirectory);
    })
    .fork(reason => {
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
}

function install(root, useYarn, dependencies, verbose, isOnline) {
  return Future((rej, res) => {
    let command;
    let args;
    if (useYarn) {
      command = 'yarnpkg';
      args = ['add', '--exact'];
      if (!isOnline) {
        args.push('--offline');
      }
      args.push(dependencies);

      // Explicitly set cwd() to work around issues with default install locations
      args.push('--cwd');
      args.push(root);

      if (!isOnline) {
        console.log(chalk.yellow('You appear to be offline.'));
        console.log(chalk.yellow('Falling back to the local Yarn cache.'));
        console.log();
      }
    } else {
      command = 'npm';
      args = [
        'install',
        '--save',
        '--save-exact',
        '--loglevel',
        'error',
      ].concat(dependencies);
    }

    if (verbose) {
      args.push('--verbose');
    }

    spawn(command, args, { stdio: 'inherit' }).on('close', code => {
      if (code !== 0) {
        rej({
          command: `${command} ${args.join(' ')}`,
        });
        return;
      }
      res();
    });
  });
}

function checkThemeName(themeName, originalPath) {
  return compose(
    checkValidDirectory(originalPath),
    checkNotDependency,
    checkValidNpm
  )(themeName);
}

function checkValidNpm(themeName) {
  const validationResult = validatePackageName(themeName);
  if (!validationResult.validForNewPackages) {
    console.error(
      `Could not create a project called ${chalk.red(
        `"${themeName}"`
      )} because of npm naming restrictions:`
    );
    printValidationResults(validationResult.errors);
    printValidationResults(validationResult.warnings);
    process.exit(1);
  }
  return themeName;
}

function checkNotDependency(themeName) {
  const dependencies = ['softserve-scripts'].sort();
  if (dependencies.indexOf(themeName) >= 0) {
    console.error(
      chalk.red(
        `We cannot create a project called ${chalk.green(
          themeName
        )} because a dependency with the same name exists.\n` +
          `Due to the way npm works, the following names are not allowed:\n\n`
      ) +
        chalk.cyan(dependencies.map(depName => `  ${depName}`).join('\n')) +
        chalk.red('\n\nPlease choose a different project name.')
    );
    process.exit(1);
  }
  return themeName;
}

function checkValidDirectory(source) {
  return function(themeName) {
    const directories = getDirectories(source);
    if (directories.indexOf(themeName) >= 0) {
      console.error(
        chalk.red(
          `We cannot create a project called ${chalk.green(
            themeName
          )} because a directory with the same name exists.\n\n`
        ) +
          chalk.cyan(directories.map(dirName => `  ${dirName}`).join('\n')) +
          chalk.red('\n\nPlease choose a different project name.')
      );
      process.exit(1);
    }
    return themeName;
  };
}

function printValidationResults(results) {
  if (typeof results !== 'undefined') {
    results.forEach(error => {
      console.error(chalk.red(`  *  ${error}`));
    });
  }
}

function getDirectories(source) {
  return fs.readdirSync(source).filter(isDirectory);
}

function isDirectory(source) {
  return fs.lstatSync(source).isDirectory();
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
