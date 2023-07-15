const webpack = require("webpack");
const path = require("path");
const BundleAnalyzerPlugin =
  require("webpack-bundle-analyzer").BundleAnalyzerPlugin;
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const StyleLintPlugin = require("stylelint-webpack-plugin");
const SpriteLoaderPlugin = require("svg-sprite-loader/plugin");
const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");

const production = process.env.NODE_ENV === "production";
const isApp = process.env.BUILD_MODE === "app";
const BUILD_MODE = isApp ? process.env.BUILD_MODE : "lib";
const appEntryFile =
  isApp && process.env.APP_ENTRY ? process.env.APP_ENTRY : "index";

const output = {
  path: path.resolve(__dirname, "dist"),
  publicPath: "",
  filename: "smartcharts.js",
  chunkFilename: "[name]-[chunkhash:6].smartcharts.js",
  libraryExport: "default",
  library: "smartcharts",
  libraryTarget: "umd",
  hashDigestLength: 6,
};

const config = {
  devtool: "source-map",
  entry: path.resolve(__dirname, "./src/index.ts"),
  output,
  resolve: {
    alias: {
      "@binary-com/smartcharts": path.resolve(__dirname, "src/"),
      chartiq: path.resolve(
        __dirname,
        `chartiq/${production ? "production" : "development"}/index.js`
      ),
      src: path.resolve(__dirname, "src"),
    },
    extensions: [".ts", ".tsx", ".js"],
  },
  devServer: {
    static: {
      directory: path.join(__dirname, "."),
      serveIndex: true,
      staticOptions: {
        redirect: true,
      },
    },
    devMiddleware: {
      writeToDisk: true,
    },
  },
  module: {
    rules: [
      {
        test: /\.svg$/,
        use: [
          {
            loader: "svg-sprite-loader",
            options: {
              extract: true,
              spriteFilename: "sprite-[hash:6].smartcharts.svg",
              esModule: false,
            },
          },
          {
            loader: "svgo-loader",
            options: {
              plugins: [
                {
                  name: "removeUselessStrokeAndFill",
                  removeUselessStrokeAndFill: false,
                },
                {
                  name: "removeUnknownsAndDefaults",
                  removeUnknownsAndDefaults: false,
                },
              ],
            },
          },
        ],
      },
      {
        test: /\.(s*)css$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
            options: {
              esModule: false,
            },
          },
          {
            loader: "css-loader",
            options: {
              sourceMap: true,
              esModule: true,
              modules: {
                mode: "icss",
              },
            },
          },
          {
            loader: "postcss-loader",
            options: {
              postcssOptions: {
                plugins: [
                  "postcss-import",
                  "postcss-preset-env",
                  "postcss-inline-svg",
                  "postcss-svgo",
                ],
              },
            },
          },
          {
            loader: "sass-loader",
            options: {
              sourceMap: true,
              additionalData: (content, loaderContext) => {
                const { resourcePath } = loaderContext;
                const variablesImport = `@import "sass/_variables.scss";`;
                const themesImport = `@import "sass/_themes.scss";`;

                if (resourcePath.endsWith("_themes.scss")) {
                  // Exclude _themes.scss from importing _themes.scss again
                  if (content.includes(variablesImport)) {
                    content = content.replace(themesImport, "");
                  }
                  return `${variablesImport} ${content}`;
                } else {
                  return `${variablesImport} ${themesImport} ${content}`;
                }
              },
              sassOptions: {
                filePaths: [path.resolve(__dirname, "./src")],
              },
            },
          },
        ],
      },
      /**
       * this is a temporary fix for chartiq's AMD module
       */
      // { parser: {  amd: false  } },
      {
        test: /\.(js|jsx)$/,
        exclude: [/node_modules/, /\\chartiq/, /\\scripts/],
        loader: "eslint-loader",
        enforce: "pre",
        options: { fix: true },
      },
      {
        test: /\.(js|jsx|ts|tsx)$/,
        // exclude: /node_modules/,
        loader: "babel-loader",
      },
      {
        test: /\.po$/,
        use: [
          path.resolve("./loaders/translation-loader.js"),
          "json-loader",
          "po-loader",
        ],
      },
      {
        test: /\.pot$/,
        use: [
          path.resolve("./loaders/pot-loader.js"),
          "json-loader",
          "po-loader",
        ],
      },
      {
        include: path.resolve(__dirname, "src/utils/ga.js"),
        use: [
          {
            loader: path.resolve("./loaders/exclude-block-loader.js"),
            options: {
              start: `@START-EXCLUDE: '${BUILD_MODE}'`,
              end: "@END-EXCLUDE",
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new webpack.ProvidePlugin({
      t: [path.resolve(__dirname, "./src/Translation.ts"), "t"],
    }),
    new MiniCssExtractPlugin({ filename: "smartcharts.css" }),
    new StyleLintPlugin(),
    new SpriteLoaderPlugin(),
    new ForkTsCheckerWebpackPlugin(),
  ],
  externals: {
    react: {
      root: "React",
      commonjs: "react",
      commonjs2: "react",
    },
    "react-dom": {
      commonjs: "react-dom",
      commonjs2: "react-dom",
      root: "ReactDOM",
    },
    "babel-polyfill": "babel-polyfill",
    "react-transition-group": {
      commonjs: "react-transition-group",
      commonjs2: "react-transition-group",
      root: "ReactTransitionGroup",
    },
    moment: {
      root: "moment",
      commonjs: "moment",
      commonjs2: "moment",
    },
  },
};

if (production) {
  config.plugins.push(
    new webpack.DefinePlugin({
      "process.env": {
        NODE_ENV: JSON.stringify("production"),
      },
    })
  );
}

if (process.env.ANALYZE_BUNDLE) {
  config.plugins.push(new BundleAnalyzerPlugin());
}

if (isApp) {
  config.entry = path.resolve(__dirname, `./app/${appEntryFile}.tsx`);
  config.plugins.push(
    new CopyWebpackPlugin({
      patterns: [
        { from: "./sass/favicons/*.png" },
        {
          from: "./node_modules/@babel/polyfill/dist/polyfill.min.js",
          to: "babel-polyfill.min.js",
        },
        { from: "./app/assets/*.svg" },
        { from: "./nojs-smartcharts.css" },
        {
          from: production
            ? "./node_modules/react/umd/react.production.min.js"
            : "./node_modules/react/umd/react.development.js",
          to: "react.js",
        },
        {
          from: production
            ? "./node_modules/react-dom/umd/react-dom.production.min.js"
            : "./node_modules/react-dom/umd/react-dom.development.js",
          to: "react-dom.js",
        },
        {
          from: production
            ? "./node_modules/mobx/dist/mobx.umd.production.min.js"
            : "./node_modules/mobx/dist/mobx.umd.development.js",
          to: "mobx.js",
        },
        {
          from: production
            ? "./node_modules/mobx-react-lite/dist/mobxreactlite.umd.production.min.js"
            : "./node_modules/mobx-react-lite/dist/mobxreactlite.umd.development.js",
          to: "mobx-react-lite.js",
        },
        {
          from: production
            ? "./node_modules/moment/min/moment-with-locales.min.js"
            : "./node_modules/moment/min/moment-with-locales.js",
          to: "moment.js",
        },
        {
          from: "./node_modules/react-transition-group/dist/react-transition-group.js",
          to: "react-transition-group.js",
        },
      ],
    })
  );
}

module.exports = config;
