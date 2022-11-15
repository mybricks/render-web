/**
 * Mybricks opensource
 * CheMingjun @2019
 * Mail:chemingjun@126.com Wechat:ALJZJZ
 */
const path = require('path');
const webpack = require('webpack')
const TerserPlugin = require("terser-webpack-plugin");

const outputPath = path.resolve(__dirname, `../dist`)

module.exports = {
  mode: 'development',
  entry: './src/index.tsx',
  output: {
    path: outputPath,
    globalObject: 'this',
    filename: 'index.min.js',
    libraryTarget: 'umd',
    library: '_mybricks_render_web'
  },
  //devtool: 'cheap-module-source-map',
  devtool: 'eval',
  externals: [{
    'react': {commonjs: "react", commonjs2: "react", amd: "react", root: "React"},
    'react-dom': {commonjs: "react-dom", commonjs2: "react-dom", amd: "react-dom", root: "ReactDOM"},
  }],
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
    alias: {
      '@mybricks/comlib-core':
        path.resolve(__dirname, '../../_comlibs/comlib-core/src/runtime.ts'),
    }
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
  //devtool: 'cheap-source-map',//devtool: 'cheap-source-map',
  // resolve: {
  //     alias: {
  //         '@es/spa-designer': require('path').resolve(__dirname, '../'),
  //     }
  // },
  devServer: {
    static: {
      directory: outputPath,
    },
    port: 8001,
    host: '0.0.0.0',
    // compress: true,
    // hot: true,
    client: {
      logging: 'warn',
      // overlay: true,
      // progress: true,
    },
    // open:true,
    proxy: []
  }
}
