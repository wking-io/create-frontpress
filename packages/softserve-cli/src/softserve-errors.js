'use strict';

const chalk = require('chalk');

const root = () => {
  console.log(chalk.red('You are not root.'));
};

module.exports = {
  root,
};
