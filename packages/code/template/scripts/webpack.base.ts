import path from "path";
import { Configuration } from "webpack";

const config: Configuration = {
  entry: path.resolve(__dirname, "../src/main.tsx"),
  output: {
    path: path.resolve(__dirname, "../dist"),
    filename: "js/[name]-[contenthash].js",
  },
  resolve: {
    extensions: [".js", ".ts", ".tsx"],
    alias: {
      "@": path.resolve(__dirname, "../src"),
    },
  },
  externals: [
    {
      react: "React",
      "react-dom": "ReactDOM",
      moment: "moment",
      antd: "antd",
      "@ant-design/icons": "icons",
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
      {
        test: /.less$/,
        use: [
          "style-loader",
          {
            loader: "css-loader",
            options: {
              modules: {
                localIdentName: "[local]_[hash:base64:5]",
              },
            },
          },
          "less-loader",
        ],
      },
    ],
  },
};

export default config;
