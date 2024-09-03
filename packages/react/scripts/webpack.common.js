/**
 * Mybricks opensource
 * CheMingjun @2019
 * Mail:chemingjun@126.com Wechat:ALJZJZ
 */
const path = require('path');
const webpack = require('webpack')
const TerserPlugin = require("terser-webpack-plugin");

module.exports = {
  // mode: 'production',
  target: ['web', 'es5'],
  entry: './src/build.ts',
  output: {
    globalObject: 'this',
    filename: 'index.min.js',
    path: path.resolve(__dirname, '../'),
    libraryTarget: 'umd',
    library: '_mybricks_render_web'
  },
  //devtool: 'cheap-module-source-map',
  //devtool: 'cheap-module-eval-source-map',
  externals: [{
    'react': {commonjs: "react", commonjs2: "react", amd: "react", root: "React"},
    'react-dom': {commonjs: "react-dom", commonjs2: "react-dom", amd: "react-dom", root: "ReactDOM"},
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
                target: 'es5'
              }
            }
          }
        ]
      },
      // {
      //   test: /\.css$/,
      //   // exclude: /node_modules/,
      //   use: ['style-loader', 'css-loader']
      // },
      // {
      //   test: /^[^\.]+\.less$/i,
      //   use: [
      //     {loader: 'style-loader'},
      //     {
      //       loader: 'css-loader',
      //       options: {
      //         modules: {
      //           localIdentName: '[local]-[hash:5]'
      //         }
      //       }
      //     },
      //     {loader: 'less-loader'}
      //   ]
      // }
      {
        test: /\.lazy.less$/i,
        use: [
          {
            loader: 'style-loader',
            options: {
              injectType: "lazyStyleTag",
              insert: function insertIntoTarget(element, options) {
                (options.target || document.head).appendChild(element)
              },
            },
          },
          {
            loader: 'css-loader',
            options: {
              modules: {
                localIdentName: '[local]-[hash:5]'
              }
            }
          },
          {
            loader: 'less-loader',
            options: {
              lessOptions: {
                javascriptEnabled: true,
              }
            }
          }
        ]
      },
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
    // new webpack.DefinePlugin({
    //   'process.env': {
    //     NODE_ENV: JSON.stringify('production')
    //   }
    // }),
    new webpack.ProvidePlugin({
      'React': 'react'
    }),
    //new BundleAnalyzerPlugin()
  ]
}
