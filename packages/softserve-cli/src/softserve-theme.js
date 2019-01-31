'use strict';

const pipe = require('crocks/helpers/pipe');
const prop = require('crocks/Maybe/prop');
const maybeToAsync = require('crocks/Async/maybeToAsync');
const propPath = require('crocks/Maybe/propPath');
const bimap = require('crocks/pointfree/bimap');
const map = require('crocks/pointfree/map');
const chain = require('crocks/pointfree/chain');
const extend = require('crocks/pointfree/extend');
const sequence = require('crocks/pointfree/sequence');
const Pair = require('crocks/Pair');
const Async = require('crocks/Async');
const svn = require('node-svn-ultimate');
const {
  always,
  identity,
  dirExists,
  mkdir,
  asyncWith,
  replaceIn,
  TEMPLATE_REPO_URL,
} = require('./softserve-utils');

module.exports = generateTheme;

const generate = pipe(
  Pair.branch,
  isReady,
  buildConfig,
  makeInstallDir,
  fetchTheme,
  replaceNames,
  makePackage
);
const generateTheme = (name, options) =>
  generate({ target: 'themes', name, options }).fork(blowItUp, announceSuccess);

// isReady :: Pair Config Config -> Async Error (Pair Config Bool)
const isReady = pipe(
  map(isHere),
  maybeToAsync('root'),
  chain(isRoot),
  sequence(Async),
  bimap(always('root'), identity)
);

const isHere = propPath(['options', 'here']);
const isRoot = () => dirExists(process.cwd(), 'wp-content');

// buildConfig :: Async Error (Pair Config Config) -> Async Error (Pair Config Config)
const buildConfig = pipe(chain(setInstallPath), map(setNames));

// setInstallPath :: Pair Config Config -> Async Error (Pair Config Config)
const setInstallPath = pipe(
  map(createPath),
  Pair.merge(maybeMerge),
  maybeToAsync('installPath'),
  map(Pair.branch)
);

// createPath :: Config -> Maybe { name: String }
const createPath = pipe(
  prop('name'),
  map(name => ({
    installPath: `${process.cwd()}/wp-content/themes/${name}`,
  }))
);

// maybeMerge :: Config -> Maybe Object -> Maybe Config
const maybeMerge = config => map(name => Object.assign(config, name));

// setNames :: Pair Config Config -> Pair Config Config
const setNames = pipe(
  map(generateNames),
  Pair.merge(maybeMerge),
  maybeToAsync('names'),
  map(Pair.branch)
);

// generateNames :: Config -> { dash, underscore, underscoreUpper, space, spaceUpper }
const generateNames = pipe(
  prop('name'),
  map(name => ({
    dash: name,
    underscore: name.replace('-', '_'),
    underscoreUpper: name
      .split('-')
      .map(capitalize)
      .join('_'),
    space: name
      .split('-')
      .map(capitalize)
      .join(' '),
    spaceUpper: name.replace('-', '_').toUpperCase(),
  }))
);

// capitalize :: String -> String
const capitalize = ([first, ...rest]) =>
  `${first.toUpperCase()}${rest.join('')}`;

// makeInstallDir :: Async Error (Pair Config Config) -> Async Error (Pair Config Config)
const makeInstallDir = chain(makeInstallDirHelp);

// makeInstallDirHelp :: Pair Config Config -> Async Error (Pair Config Config)
const makeInstallDirHelp = pipe(
  asyncWith('installPath', mkdir),
  bimap(always('makeInstallDir'), extend(identity))
);

// fetchTheme :: Async Error (Pair Config Config) -> Async Error (Pair Config Config)
const fetchTheme = chain(getTemplate('theme'));

// getTemplate :: String -> Pair Config Config -> Pair Config Config
const getTemplate = type =>
  pipe(
    asyncWith('installPath', getRepoFolderWith(`${TEMPLATE_REPO_URL}${type}`)),
    bimap(always('getTemplate'), extend(identity))
  );

// getRepoFolder :: (String, String, Options) -> Async Error String
const getRepoFolder = Async.fromNode(svn.commands.export);

// getRepoFolderWith :: String -> String -> Async Error String
const getRepoFolderWith = from => to => getRepoFolder(from, to);

// replaceNames :: Async Error (Pair Config Config) -> Async Error (Pair Config Config)
const replaceNames = chain(map(replaceNamesHelp));

// replaceNamesHelp :: Pair Config Names -> Async Error (Pair Config Config)
const replaceNamesHelp = config => {
  const replaceInTheme = replaceIn(config.installPath);
};

// makePackage :: Pair Config Config -> Async Error (Pair Config Config)
const makePackage = pipe();

const blowItUp = () => {
  console.log('Error!');
};

const announceSuccess = () => {
  console.log('Success!');
};
