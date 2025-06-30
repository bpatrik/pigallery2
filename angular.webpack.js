/**
 * Custom angular webpack configuration
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires,no-undef
module.exports = (config, options) => {
  // Use webpack from Angular's bundled version
  // eslint-disable-next-line @typescript-eslint/no-var-requires,no-undef
  const webpack = require('@angular-devkit/build-angular/node_modules/webpack');
  
  config.plugins = [
    ...config.plugins,
    new webpack.IgnorePlugin({
      resourceRegExp: /config\/private\/Config/,
    })
  ];

  return config;
}
