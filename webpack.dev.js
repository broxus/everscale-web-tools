const { WebpackPluginServe } = require('webpack-plugin-serve');

const { merge } = require('webpack-merge');
const common = require('./webpack.common');

module.exports = merge(common, {
  entry: ['webpack-plugin-serve/client'],
  mode: 'development',
  devtool: 'inline-source-map',
  plugins: [
    new WebpackPluginServe({
      static: common.output.path,
      liveReload: true,
      host: 'localhost'
    })
  ]
});
