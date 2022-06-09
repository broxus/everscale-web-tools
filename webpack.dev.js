const { DefinePlugin } = require('webpack');
const { WebpackPluginServe } = require('webpack-plugin-serve');

const { merge } = require('webpack-merge');
const common = require('./webpack.common');

module.exports = merge(common, {
  entry: ['webpack-plugin-serve/client'],
  mode: 'development',
  devtool: 'inline-source-map',
  plugins: [
    new DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify('development')
      }
    }),
    new WebpackPluginServe({
      static: common.output.path,
      liveReload: true,
      host: 'localhost',
      historyFallback: true
    })
  ]
});
