/**
 * Mybricks opensource
 * CheMingjun @2019
 * Mail:chemingjun@126.com Wechat:ALJZJZ
 */
const webpack = require('webpack')
const { merge } = require('webpack-merge')
const common = require('./webpack.common')

module.exports = merge(common, {
  mode: 'production',
  plugins: [
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify('production')
      }
    }),
  ]
})
