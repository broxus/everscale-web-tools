const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const {CleanWebpackPlugin} = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const WasmPackPlugin = require('@wasm-tool/wasm-pack-plugin');
const {WebpackPluginServe} = require('webpack-plugin-serve');

const outputPath = path.resolve(__dirname, 'dist');

module.exports = {
    entry: [
        'webpack-plugin-serve/client',
        path.resolve(__dirname, "src/index.tsx"),
    ],
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.svg$/,
                use: ['@svgr/webpack'],
            },
            {
                test: /\.s[ac]ss$/i,
                use: ['style-loader', 'css-loader', 'sass-loader'],
            },
            {
                test: /\.(woff(2)?|ttf|eot)(\?v=\d+\.\d+\.\d+)?$/,
                use: [
                    {
                        loader: 'file-loader',
                        options: {
                            name: '[name].[ext]',
                            outputPath: 'fonts/',
                        },
                    },
                ],
            },
            {
                test: /\.(png|jpe?g|gif)$/i,
                use: [
                    {
                        loader: 'file-loader',
                    },
                ],
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    plugins: [
        new CleanWebpackPlugin({cleanStaleWebpackAssets: false}),
        new HtmlWebpackPlugin({template: 'public/index.html'}),
        new WasmPackPlugin({
            extraArgs: '--target web',
            crateDirectory: path.resolve(__dirname, 'core'),
        }),
        new CopyWebpackPlugin({
            patterns: [
                {from: path.resolve(__dirname, "core/pkg/index_bg.wasm")},
            ],
        }),
        new WebpackPluginServe({
            static: outputPath,
            liveReload: true,
            host: 'localhost',
        })
    ],
    output: {
        filename: '[name].js',
        path: outputPath
    },
    experiments: {
        asyncWebAssembly: true,
    }
}
