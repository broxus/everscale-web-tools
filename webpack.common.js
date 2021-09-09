const path = require('path');
const { IgnorePlugin } = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const WasmPackPlugin = require('@wasm-tool/wasm-pack-plugin');

const outputPath = path.resolve(__dirname, 'dist');

module.exports = {
  entry: [path.resolve(__dirname, 'src/index.tsx')],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.svg$/,
        use: ['@svgr/webpack']
      },
      {
        test: /\.s[ac]ss$/i,
        use: ['style-loader', 'css-loader', 'sass-loader']
      },
      {
        test: /\.css$/i,
        use: ['css-loader']
      },
      {
        test: /\.(woff(2)?|ttf|eot)(\?v=\d+\.\d+\.\d+)?$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[name].[ext]',
              outputPath: 'fonts/'
            }
          }
        ]
      },
      {
        test: /\.(png|jpe?g|gif|webmanifest)$/i,
        use: [
          {
            loader: 'file-loader'
          }
        ]
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  },
  plugins: [
    new IgnorePlugin({
      resourceRegExp: /^wbg$/
    }),
    new CleanWebpackPlugin({ cleanStaleWebpackAssets: false }),
    new HtmlWebpackPlugin({
      template: 'public/index.html',
      inject: 'head'
    }),
    new WasmPackPlugin({
      extraArgs: '--target web',
      crateDirectory: path.resolve(__dirname, 'core')
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: path.resolve(__dirname, 'core/pkg/index_bg.wasm') },
        { from: path.resolve(__dirname, 'public/manifest'), to: outputPath }
      ]
    })
  ],
  output: {
    filename: '[name].[hash].js',
    path: outputPath
  },
  experiments: {
    asyncWebAssembly: true
  }
};
