'use strict';

const path = require('path');
const fs = require('fs');

const themeDirectory = fs.realpathSync(process.cwd());
const resolveTheme = relativePath => path.resolve(themeDirectory, relativePath);

const resolveOwn = relativePath => path.resolve(__dirname, '..', relativePath);
const resolveEntryJs = p =>
  fs
    .readdirSync(p)
    .filter(file => path.extname(file) === '.js')
    .reduce((acc, file) => {
      const entry = { [path.basename(file, '.js')]: `${p}/${file}` };
      return Object.assign(acc, entry);
    }, {});

// config before eject: we're in ./node_modules/react-scripts/config/
module.exports = {
  themePath: resolveTheme('.'),
  themeBuild: resolveTheme('assets'),
  themePublic: resolveTheme('public'),
  themeEntry: resolveEntryJs(resolveTheme('src/js')),
  themeJs: resolveTheme('src/js'),
  themePackageJson: resolveTheme('package.json'),
  themeSrc: resolveTheme('src'),
  themeStyles: resolveTheme('src/scss'),
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

// config before publish: we're in ./packages/softserve-scripts/config/
if (
  !softserveScriptsLinked &&
  __dirname.indexOf(path.join('packages', 'softserve-scripts', 'config')) !== -1
) {
  module.exports = {
    themePath: resolveTheme('.'),
    themeBuild: resolveOwn('../../assets'),
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
