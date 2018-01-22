'use strict';

const path = require('path');
const fs = require('fs');

// Make sure any symlinks in the project folder are resolved:
// https://github.com/facebookincubator/create-react-app/issues/637
const themeDirectory = fs.realpathSync(process.cwd());
const resolveTheme = relativePath => path.resolve(themeDirectory, relativePath);

const resolveOwn = relativePath => path.resolve(__dirname, '..', relativePath);

const resolveThemeJs = path =>
  fs
    .readdirSync(path)
    .filter(file => path.extname(file) === '.js')
    .map(file => path + file);

// config before eject: we're in ./node_modules/react-scripts/config/
module.exports = {
  themePath: resolveTheme('.'),
  themeBuild: resolveTheme('build'),
  themePublic: resolveTheme('public'),
  themeJs: resolveThemeJs(resolveTheme('src/js')),
  themePackageJson: resolveTheme('package.json'),
  themeSrc: resolveTheme('src'),
  yarnLockFile: resolveTheme('yarn.lock'),
  themeNodeModules: resolveTheme('node_modules'),
  // These properties only exist before ejecting:
  ownPath: resolveOwn('.'),
  ownNodeModules: resolveOwn('node_modules'), // This is empty on npm 3
};

const ownPackageJson = require('../package.json');
const softserveScriptsPath = resolveTheme(
  `node_modules/${ownPackageJson.name}`
);
const softserveScriptsLinked =
  fs.existsSync(softserveScriptsPath) &&
  fs.lstatSync(softserveScriptsPath).isSymbolicLink();

// config before publish: we're in ./packages/react-scripts/config/
if (
  !softserveScriptsLinked &&
  __dirname.indexOf(path.join('packages', 'softserve-scripts', 'config')) !== -1
) {
  module.exports = {
    themePath: resolveTheme('.'),
    themeBuild: resolveOwn('../../build'),
    themePublic: resolveOwn('template/public'),
    themeJs: resolveThemeJs(resolveOwn('template/src/js')),
    themePackageJson: resolveOwn('package.json'),
    themeSrc: resolveOwn('template/src'),
    yarnLockFile: resolveOwn('template/yarn.lock'),
    themeNodeModules: resolveOwn('node_modules'),
    // These properties only exist before ejecting:
    ownPath: resolveOwn('.'),
    ownNodeModules: resolveOwn('node_modules'),
  };
}
