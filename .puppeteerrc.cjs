const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Forces Puppeteer to install Chrome inside the project folder
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
