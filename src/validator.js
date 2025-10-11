const { chromium } = require('playwright');
const { parseSiteList } = require('./utils');
const { CMPService } = require('./CMPService');

/**
 * Uses headless Chromium with sandbox disabled for server environments.
 * @param {Object} [options] - Options to configure browser launch.
 * @returns {Promise<browser>} Playwright browser instance.
 */
async function initializePlaywright(options = {}) {
  // Default to headless
  const headless = options.headless !== false;
  
  const browser = await chromium.launch({
    headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage'
    ]
  });
  
  return browser;
}

/**
 * @param {number} vendorId - The TCF vendor ID to check for consent.
 * @param {string} siteListPath - Path to the sitelist file containing target websites.
 * @returns {Promise<Object[]>} Array of validation results for each site.
 */
async function validateVendorConsent(vendorId, siteListPath, options = {}) {
  const browser = await initializePlaywright(options);
  const context = await browser.newContext();

  const sites = parseSiteList(siteListPath);
  const results = [];

  try {
    for (const site of sites) {
      console.log(`Validating ${site} for TCF Vendor ID ${vendorId} consent...`);

      const result = await VendorPresent.check(context, site, vendorId);
      results.push(result);
    }
  } catch (error) {
    console.error('Error during validation process:', error);
  } finally {
    await context.close();
    await browser.close();
  }

  return results;
}

class VendorPresent {
  constructor(site, vendorId) {
    this.site = site;
    this.vendorId = vendorId;
    this.hasTCF = null;
    this.cmpId = null;
    this.vendorPresent = null;
    this.timestamp = null;
    this.error = null;
  }
  /**
   * Checks a website whether CMP collects consent for the vendor ID.
   * @param {Context} context - Playwright's browser context
   * @param {string} site - Website URL to check.
   * @param {number} vendorId - TCF vendor ID to validate.
   * @returns {Promise<Object>} Validation result for the site.
   */
  static async check(context, site, vendorId) {
    const result = new VendorPresent(site, vendorId);
    // Cookies cleaning can be removed (or not) after implementing domain deduplication 
    const cookies = await context.cookies();
    if (cookies.length) await context.clearCookies();
    const page = await context.newPage();

    try {
      await page.goto(site, { waitUntil: 'domcontentloaded', timeout: 90000 });

      // Check if TCF API is present
      result.hasTCF = await hasTCFAPI(page);
      if (!result.hasTCF) return result;

      result.cmpId = await getCMPId(page);

      result.vendorPresent = await CMPService.init(page, result.cmpId, vendorId).run();
    } catch (error) {
      result.error = error.message;
    } finally {
      await page.close();

      result.timestamp = new Date().toISOString();

      return result;
    }
  }
}

/**
 * @param {Page} page - Playwright page instance.
 * @returns {Promise<boolean>} True if TCF API is detected.
 */
async function hasTCFAPI(page) {
  try {
    const hasAPIHandle = await page.waitForFunction(() => {
      return typeof window.__tcfapi === 'function';
    });
    const hasAPI = await hasAPIHandle.jsonValue();
    return Boolean(hasAPI);
  } catch {
    return false;
  }
}

/**
 * @param {Page} page - Playwright page instance.
 * @returns {Promise<string>} CMP ID.
 */
async function getCMPId(page) {
  const tcfPing = async page => {
    const cmpData = await page.evaluate(() => {
      return new Promise(r => {
        window.__tcfapi('ping', 2, r);
      });
    });

    return (cmpData?.cmpId) ? cmpData.cmpId : null;
  };

  // Retries are necessary on some websites.
  try {
    const start = Date.now();
    const timeout = 90000;
    const pingPace = 1000;

    while (Date.now() < start + timeout) {
      const cmpId = await tcfPing(page);
      if (cmpId) return cmpId;
      await new Promise(r => setTimeout(r, pingPace));
    }

    throw new Error('Timeout');
  } catch (e) {
    console.error('Error in getCMPId:', e);
    throw new Error(`TCF API ping failed: ${e.message}`);
  }
}

module.exports = {
  initializePlaywright,
  validateVendorConsent
};