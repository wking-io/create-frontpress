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
const { compose } = require('ramda');
const { defaultBrowsers } = require('./utils/browsersHelper');

module.exports = compose(
  announceComplete,
  getAnnouncementVars,
  gitInit,
  changeFilename('eslintrc', '.eslintrc'),
  changeFilename('gitignore', '.gitignore'),
  copyTemplate,
  renameReadme,
  checkForReadme,
  updatePackage,
  getProjectDeps
);

function announceComplete(config) {
  console.log();
  console.log(`Success! Created ${config.themeName} at ${config.root}`);
  console.log('Inside that directory, you can run several commands:');
  console.log();
  console.log(chalk.cyan(`  ${config.displayedCommand} start`));
  console.log('    Starts the development server.');
  console.log();
  console.log(
    chalk.cyan(
      `  ${config.displayedCommand} ${config.useYarn ? '' : 'run '}build`
    )
  );
  console.log('    Bundles the app into static files for production.');
  console.log();
  console.log('We suggest that you begin by typing:');
  console.log();
  console.log(chalk.cyan('  cd'), config.cdpath);
  console.log(`  ${chalk.cyan(`${config.displayedCommand} start`)}`);
  if (config.readmeExists) {
    console.log();
    console.log(
      chalk.yellow(
        'You had a `README.md` file, we renamed it to `README.old.md`'
      )
    );
  }
  console.log();
  return 'Happy Hacking!';
}

function getAnnouncementVars(config) {
  const cdpath =
    config.originalDirectory &&
    path.join(config.originalDirectory, config.themeName) === config.root
      ? config.themeName
      : config.root;

  // Change displayed command to yarn instead of yarnpkg
  const displayedCommand = config.useYarn ? 'yarn' : 'npm';

  return Object.assign(config, { cdpath, displayedCommand });
}

function gitInit(config) {
  if (config.createRepository) {
    try {
      execSync('git --version', { stdio: 'ignore' });

      if (!insideGitRepository() || !insideMercurialRepository()) {
        execSync('git init', { stdio: 'ignore' });
        execSync('git add -A', { stdio: 'ignore' });
        execSync('git commit -m "Initial commit from softserve-cli"', {
          stdio: 'ignore',
        });
      }

      console.log();
      console.log('Initialized git repository');
    } catch (e) {
      return config;
    }
  }

  return config;
}

function changeFilename(before, after) {
  return function(config) {
    // Rename gitignore after the fact to prevent npm from renaming it to .npmignore
    // See: https://github.com/npm/npm/issues/1862
    fs.move(
      path.join(config.root, before),
      path.join(config.root, after),
      [],
      err => {
        if (err) {
          // Append if there's already a `.gitignore` file there
          if (err.code === 'EEXIST') {
            fs.appendFileSync(
              path.join(config.root, after),
              fs.readFileSync(path.join(config.root, before))
            );
            fs.unlinkSync(path.join(config.root, before));
          } else {
            throw err;
          }
        }
      }
    );
    return config;
  };
}

function copyTemplate(config) {
  const templatePath = path.join(config.ownPath, 'template');
  if (fs.existsSync(templatePath)) {
    console.log('');
    console.log('Copying the theme template...');
    fs.copySync(templatePath, config.root);
  } else {
    console.error(
      `Could not locate supplied template: ${chalk.green(templatePath)}`
    );
  }

  return config;
}

function renameReadme(config) {
  if (config.readmeExists) {
    fs.renameSync(
      path.join(config.root, 'README.md'),
      path.join(config.root, 'README.old.md')
    );
  }
  return config;
}

function checkForReadme(config) {
  return Object.assign(config, {
    readmeExists: fs.existsSync(path.join(config.root, 'README.md')),
  });
}

function updatePackage(config) {
  // Copy over some of the devDependencies
  config.themePackage.dependencies = config.themePackage.dependencies || {};

  // Setup the script rules
  config.themePackage.scripts = {
    start: 'softserve-scripts start',
    build: 'softserve-scripts build',
  };

  config.themePackage.browsersList = defaultBrowsers;

  fs.writeFileSync(
    path.join(config.root, 'package.json'),
    JSON.stringify(config.themePackage, null, 2) + os.EOL
  );
}

function getProjectDeps(config) {
  const ownPath = path.join(config.root, 'node_modules', config.themeName);
  const themePackage = require(path.join(config.root, 'package.json'));

  return Object.assign(config, { ownPath, themePackage });
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
