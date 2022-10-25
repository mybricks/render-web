/**
 * XGraph opensource
 * CheMingjun @2019
 * Mail:chemingjun@126.com Wechat:ALJZJZ
 */
const path = require('path');
const webpack = require('webpack')

const {merge} = require("webpack-merge")
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin

const TerserPlugin = require("terser-webpack-plugin");

module.exports = {
  mode: 'production',
  entry: './src/index.tsx',
  output: {
    globalObject: 'this',
    filename: 'index.min.js',
    path: path.resolve(__dirname, '../'),
    libraryTarget: 'umd'
  },
  //devtool: 'cheap-module-source-map',
  //devtool: 'cheap-module-eval-source-map',
  externals: [{
    'react': 'react',
    'react-dom': 'react-dom'
  }],
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              silent: true,
              transpileOnly: true,
              compilerOptions: {
                module: 'es6',
                target: 'es6'
              }
            }
          }
        ]
      },
      {
        test: /\.css$/,
        // exclude: /node_modules/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /^[^\.]+\.less$/i,
        use: [
          {loader: 'style-loader'},
          {
            loader: 'css-loader',
            options: {
              modules: {
                localIdentName: '[local]-[hash:5]'
              }
            }
          },
          {loader: 'less-loader'}
        ]
      }
    ]
  },
  optimization: {
    concatenateModules: false,//name_name
    minimize: true,
    minimizer: [
      new TerserPlugin({
        extractComments: false,
      }),
    ]
  },

  plugins: [
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify('production')
      }
    }),
    new webpack.ProvidePlugin({
      'React': 'react'
    }),
    //new BundleAnalyzerPlugin()
  ]
}
