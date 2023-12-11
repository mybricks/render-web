import { defineConfig } from "cypress";

import webpackConfig from "./scripts/webpack.common";

export default defineConfig({
  component: {
    devServer: {
      framework: "react",
      bundler: "webpack",
      webpackConfig
    },
  },
});
