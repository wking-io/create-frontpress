/* eslint strict: 0, */

'use-strict';

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on('unhandledRejection', err => {
  throw err;
});

const chalk = require('chalk');
const execSync = require('child_process').execSync;
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const spawn = require('cross-spawn');

const { defaultBrowsers } = require('./utils/browsersHelper');

module.exports = function(themePath, themeName, verbose, originalDirectory) {
  const ownPackageName = require(path.join(__dirname, '..', 'package.json'))
    .name;
  const ownPath = path.join(themePath, 'node_modules', ownPackageName);
  const themePackage = require(path.join(themePath, 'package.json'));
  const useYarn = fs.existsSync(path.join(themePath, 'yarn.lock'));

  // Copy over some of the devDependencies
  themePackage.dependencies = themePackage.dependencies || {};

  // Setup the script rules
  themePackage.scripts = {
    start: 'react-scripts start',
    build: 'react-scripts build',
  };

  themePackage.browsersList = defaultBrowsers;

  fs.writeFileSync(
    path.join(themePath, 'package.json'),
    JSON.stringify(themePackage, null, 2) + os.EOL
  );

  const readmeExists = fs.existsSync(path.join(themePath, 'README.md'));
  if (readmeExists) {
    fs.renameSync(
      path.join(themePath, 'README.md'),
      path.join(themePath, 'README.old.md')
    );
  }

  // Copy the files for the user
  const templatePath = path.join(ownPath, 'template');
  if (fs.existsSync(templatePath)) {
    fs.copySync(templatePath, themePath);
  } else {
    console.error(
      `Could not locate supplied template: ${chalk.green(templatePath)}`
    );
    return;
  }

  // Rename gitignore after the fact to prevent npm from renaming it to .npmignore
  // See: https://github.com/npm/npm/issues/1862
  fs.move(
    path.join(themePath, 'gitignore'),
    path.join(themePath, '.gitignore'),
    [],
    err => {
      if (err) {
        // Append if there's already a `.gitignore` file there
        if (err.code === 'EEXIST') {
          const data = fs.readFileSync(path.join(themePath, 'gitignore'));
          fs.appendFileSync(path.join(themePath, '.gitignore'), data);
          fs.unlinkSync(path.join(themePath, 'gitignore'));
        } else {
          throw err;
        }
      }
    }
  );

  let command;
  let args;

  if (useYarn) {
    command = 'yarnpkg';
    args = ['add'];
  } else {
    command = 'npm';
    args = ['install', '--save', verbose && '--verbose'].filter(e => e);
  }
  args.push('react', 'react-dom');

  if (gitInit()) {
    console.log();
    console.log('Initialized git repository');
  }

  // Display the most elegant way to cd.
  // This needs to handle an undefined originalDirectory for
  // backward compatibility with old global-cli's.
  let cdpath;
  if (
    originalDirectory &&
    path.join(originalDirectory, themeName) === themePath
  ) {
    cdpath = themeName;
  } else {
    cdpath = themePath;
  }

  // Change displayed command to yarn instead of yarnpkg
  const displayedCommand = useYarn ? 'yarn' : 'npm';

  console.log();
  console.log(`Success! Created ${themeName} at ${themePath}`);
  console.log('Inside that directory, you can run several commands:');
  console.log();
  console.log(chalk.cyan(`  ${displayedCommand} start`));
  console.log('    Starts the development server.');
  console.log();
  console.log(
    chalk.cyan(`  ${displayedCommand} ${useYarn ? '' : 'run '}build`)
  );
  console.log('    Bundles the app into static files for production.');
  console.log();
  console.log('We suggest that you begin by typing:');
  console.log();
  console.log(chalk.cyan('  cd'), cdpath);
  console.log(`  ${chalk.cyan(`${displayedCommand} start`)}`);
  if (readmeExists) {
    console.log();
    console.log(
      chalk.yellow(
        'You had a `README.md` file, we renamed it to `README.old.md`'
      )
    );
  }
  console.log();
  return 'Happy Hacking!';
};

function gitInit() {
  try {
    execSync('git --version', { stdio: 'ignore' });

    if (insideGitRepository() || insideMercurialRepository()) {
      return false;
    }

    execSync('git init', { stdio: 'ignore' });
    execSync('git add -A', { stdio: 'ignore' });
    execSync('git commit -m "Initial commit from softserve-cli"', {
      stdio: 'ignore',
    });

    return true;
  } catch (e) {
    return false;
  }
}

function insideGitRepository() {
  try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

function insideMercurialRepository() {
  try {
    execSync('hg --cwd . root', { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}
