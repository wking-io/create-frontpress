/* eslint strict: 0, */

'use-strict';

const autoprefixer = require('autoprefixer');
const webpack = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const paths = require('./paths');

// Options for PostCSS as we reference these options twice
// Adds vendor prefixing based on your specified browser support in
// package.json
const postCSSLoaderOptions = {
  // Necessary for external CSS imports to work
  ident: 'postcss',
  plugins: () => [
    require('postcss-flexbugs-fixes'),
    autoprefixer({
      flexbox: 'no-2009',
    }),
    require('tailwindcss')(paths.themePath + '/tailwind.js'),
  ],
};

const extractCSS = new ExtractTextPlugin('css/[name].css');

// This is the development configuration.
// It is focused on developer experience and fast rebuilds.
// The production configuration is different and lives in a separate file.
module.exports = {
  // These are the "entry points" to our application.
  // This means they will be the "root" imports that are included in JS bundle.
  // The first two entry points enable "hot" CSS and auto-refreshes for JS.
  entry: Object.assign(
    // We ship a few polyfills by default:
    { polyfill: paths.ownPath + '/config/polyfills' },
    // Object representing all files not in a folder in the theme src
    paths.themeEntry
  ),
  output: {
    path: paths.themeBuild,
    filename: 'js/[name].js',
  },
  module: {
    strictExportPresence: true,
    rules: [
      // Disable require.ensure as it's not a standard language feature.
      { parser: { requireEnsure: false } },

      {
        test: /\.(js|jsx|mjs)$/,
        enforce: 'pre',
        use: [
          {
            options: {
              eslintPath: require.resolve('eslint'),
              // TODO: consider separate config for production,
              // e.g. to enable no-console and no-debugger only in production.
              baseConfig: {
                extends: [require.resolve('eslint-config-softserve')],
              },
              // @remove-on-eject-begin
              ignore: false,
              useEslintrc: false,
              // @remove-on-eject-end
            },
            loader: require.resolve('eslint-loader'),
          },
        ],
        include: paths.themeSrc,
        exclude: [/[/\\\\]node_modules[/\\\\]/],
      },
      {
        // "oneOf" will traverse all following loaders until one will
        // match the requirements. When no loader matches it will fall
        // back to the "file" loader at the end of the loader list.
        oneOf: [
          {
            test: /\.js$/,
            include: paths.themeJs,
            exclude: /node_modules/,
            use: [
              {
                loader: require.resolve('babel-loader'),
                options: {
                  presets: [
                    [
                      '@babel/preset-env',
                      {
                        modules: false,
                        targets: {
                          browsers: ['last 2 versions', 'safari >= 7'],
                        },
                      },
                    ],
                  ],
                },
              },
            ],
          },
          {
            test: /\.scss$/,
            include: paths.themeStyles,
            use: extractCSS.extract([
              {
                loader: require.resolve('css-loader'),
                options: {
                  importLoaders: 2,
                  url: false,
                },
              },
              {
                loader: require.resolve('postcss-loader'),
                options: postCSSLoaderOptions,
              },
              require.resolve('sass-loader'),
            ]),
          },
          {
            test: /\.(jpg|png)$/,
            use: [
              {
                loader: require.resolve('url-loader'),
                options: { name: 'images/[name].[ext]', limit: 10000 },
              },
            ],
          },
          {
            test: /\.(eot|svg|ttf|woff|woff2|otf)$/,
            use: [
              {
                loader: require.resolve('file-loader'),
                options: { name: 'fonts/[name].[ext]' },
              },
            ],
          },
        ],
      },
      // ** STOP ** Are you adding a new loader?
      // Make sure to add the new loader(s) before the "file" loader.
    ],
  },
  plugins: [
    new webpack.NamedModulesPlugin(),
    extractCSS,
    // Moment.js is an extremely popular library that bundles large locale files
    // by default due to how Webpack interprets its code. This is a practical
    // solution that requires the user to opt into importing specific locales.
    // You can remove this if you don't use Moment.js:
    new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/),
  ],
  // Some libraries import Node modules but don't use them in the browser.
  // Tell Webpack to provide empty mocks for them so importing them works.
  node: {
    dgram: 'empty',
    fs: 'empty',
    net: 'empty',
    tls: 'empty',
    child_process: 'empty',
  },
  // Turn off performance hints during development because we don't do any
  // splitting or minification in interest of speed. These warnings become
  // cumbersome.
  performance: {
    hints: false,
  },
};
