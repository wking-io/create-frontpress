'use strict';

const pipe = require('crocks/helpers/pipe');
const prop = require('crocks/Maybe/prop');
const maybeToAsync = require('crocks/Async/maybeToAsync');
const propPath = require('crocks/Maybe/propPath');
const bimap = require('crocks/pointfree/bimap');
const map = require('crocks/pointfree/map');
const chain = require('crocks/pointfree/chain');
const sequence = require('crocks/pointfree/sequence');
const Pair = require('crocks/Pair');
const Async = require('crocks/Async');
const { always, identity, dirExists, mkdir } = require('./softserve-utils');

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
const makeInstallDirHelp = pipe(
  map(prop('installPath')),
  map(mkdir),
  sequence(Async),
  bimap(always('makeInstallDir'), identity)
);

// fetchTheme :: Pair Config Config -> Async Error (Pair Config Config)
const fetchTheme = pipe();

// replaceNames :: Pair Config Config -> Async Error (Pair Config Config)
const replaceNames = pipe();

// makePackage :: Pair Config Config -> Async Error (Pair Config Config)
const makePackage = pipe();

const blowItUp = () => {
  console.log('Error!');
};

const announceSuccess = () => {
  console.log('Success!');
};
