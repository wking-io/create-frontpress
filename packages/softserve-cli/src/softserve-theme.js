'use strict';

const pipe = require('crocks/helpers/pipe');
const ifElse = require('crocks/logic/ifElse');
const propOr = require('crocks/helpers/propOr');
const propPathOr = require('crocks/helpers/propPathOr');
const bimap = require('crocks/pointfree/bimap');
const map = require('crocks/pointfree/map');
const sequence = require('crocks/pointfree/sequence');
const Pair = require('crocks/Pair');
const Async = require('crocks/Async');
const { always, identity, dirExists } = require('./softserve-utils');

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
  map(ifElse(isHere, always(Async.Resolved(true)), isRoot)),
  sequence(Async),
  bimap(always('root'), identity)
);

const isHere = propPathOr(false, ['options', 'here']);
const isRoot = () => dirExists(process.cwd(), 'wp-content');

// buildConfig :: Pair Config Config -> Pair Config Config
const buildConfig = pipe(setInstallPath, setNames);

// setInstallPath :: Pair Config Config -> Pair Config Config
const setInstallPath = pipe(
  map(createPath),
  Pair.merge(Object.assign),
  Pair.branch
);

// createPath :: Config -> { name: String }
const createPath = pipe(propOr('fallback', 'name'), name => ({
  name: `${process.cwd()}/wp-content/themes/${name}`,
}));

// setNames :: Pair Config Config -> Pair Config Config
const setNames = pipe(
  map(generateNames),
  Pair.merge(Object.assign),
  Pair.branch
);

// generateNames :: String -> { dash, underscore, underscoreUpper, space, spaceUpper }
const generateNames = name => ({
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
});

// capitalize :: String -> String
const capitalize = ([first, ...rest]) =>
  `${first.toUpperCase()}${rest.join('')}`;

// makeInstallDir :: Pair Config Config -> Async Error (Pair Config Config)
const makeInstallDir = pipe();

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
