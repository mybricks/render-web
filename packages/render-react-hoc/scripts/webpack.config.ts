import path from "path";
import { Configuration } from "webpack";

const config: Configuration = {
  mode: "production",
  entry: path.resolve(__dirname, "../src/index.tsx"),
  output: {
    path: path.resolve(__dirname, "../dist"),
    filename: "index.js",
    libraryTarget: "module"
  },
  experiments: {
    outputModule: true,
  },
  resolve: {
    extensions: [".ts", ".tsx"],
  },
  externals: [
    {
      'react': 'react',
      'react-dom': 'react-dom',
    },
  ],
  module: {
    rules: [
      {
        test: /.(ts|tsx)$/,
        use: {
          loader: "babel-loader",
          options: {
            presets: [
              "@babel/preset-env",
              "@babel/preset-react",
              "@babel/preset-typescript",
            ],
          },
        },
      },
    ]
  }
}

export default config;
