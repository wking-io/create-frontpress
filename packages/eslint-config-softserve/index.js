'use strict';

module.exports = {
  root: true,

  parser: 'babel-eslint',

  plugins: ['import'],

  env: {
    browser: true,
    es6: true,
  },

  parserOptions: {
    ecmaVersion: 6,
    sourceType: 'module',
    ecmaFeatures: {
      experimentalObjectRestSpread: true,
    },
  },

  extends: ['eslint:recommended', 'prettier', 'plugin:import/errors'],
  rules: {
    'no-console': 1,
    'no-unused-vars': 1,
    'no-param-reassign': ['error', { props: false }],
    'no-underscore-dangle': 0,
  },
};
