const { chromium, devices, errors } = require('playwright');
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
      '--disable-dev-shm-usage',
      // features to avoid bot filters
      // '--disable-features=IsolateOrigins,site-per-process',
    ]
  });
  
  return browser;
}

/**
 * @param {number} vendorId - The TCF vendor ID to check for consent.
 * @param {string} siteListPath - Path to the sitelist file containing target websites.
 * @returns {Promise<Object[]>} Array of validation results for each site.
 */
async function validateSitesForVendor(vendorId, siteListPath, options = {}) {
  const browser = await initializePlaywright(options);
  const context = await browser.newContext({
    ...devices['Desktop Chrome'],
    // some CMPs doesn't load without viewport definition
    viewport: { width: 1536, height: 695 },
  });

  const sites = parseSiteList(siteListPath);
  const results = [];

  try {
    for (const site of sites) {
      console.log(`Validating ${site} for TCF Vendor ID ${vendorId} consent...`);

      const result = await SiteChecker
        .run(context, site, vendorId, { hasTCFAPI, getCMPId });
        
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

class SiteChecker {
  constructor(site, vendorId) {
    this.site = site;
    this.vendorId = vendorId;
    this.hasTCF = null;
    this.cmpId = null;
    this.vendorIsPresent = null;
    this.timestamp = null;
    this.error = null;
  }
  /**
   * Checks a website whether CMP collects consent for the vendor ID.
   * @param {Context} context - Playwright's browser context
   * @param {string} site - Website URL to check.
   * @param {number} vendorId - TCF vendor ID to validate.
   * @param {Object} checks - Object containing check functions.
   * @param {function} checks.hasTCFAPI - Function to check if TCF API is present.
   * @param {function} checks.getCMPId - Function to retrieve the CMP ID.
   * @returns {Promise<Object>} Validation result for the site.
   */

  static async run(context, site, vendorId, { hasTCFAPI, getCMPId }) {
    const result = new SiteChecker(site, vendorId);

    // Cookies cleaning can be removed (or not) after implementing domain deduplication 
    const cookies = await context.cookies();
    if (cookies.length) await context.clearCookies();
    const page = await context.newPage();

    try {
      await page.goto(site, { waitUntil: 'domcontentloaded', timeout: 90000 });
      // sometimes redirects occurs to sites dedicated to consent window
      // some pages are never networkidle hence timeout with silent catch
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      result.hasTCF = await hasTCFAPI(page);
      if (!result.hasTCF) return;
      result.cmpId = await getCMPId(page);

      result.vendorIsPresent = await CMPService
        .init(page, result.cmpId, vendorId)
        .executeStrategy();
    } catch (e) {
      result.error = e.message;
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
  const check = async context => {
    try {
      return await context.evaluate(
        () => typeof window.__tcfapi === 'function'
      );
    } catch (e) {
      throw new Error(`hasTCFAPI failed: ${e.message}`);
    }
  }
  
  // Check main page
  if (await check(page)) return true;

  // Check all frames
  for (const frame of page.frames()) {
      if (await check(frame)) return true;
  }

  // add shadow dom logic?

  return false;
}

/**
 * @param {Page} page - Playwright page instance.
 * @returns {Promise<string>} CMP ID.
 */
async function getCMPId(page) {
  const start = Date.now();
  const step = 500;
  const timeout = 1e4;

  async function pollForCMPId() {
    if (Date.now() - start > timeout) throw new Error('pollForCMPId timeout');
    /* const result = await page.evaluate(
      async () => await new Promise(r => window.__tcfapi('ping', 2, r))
    ); */
    const result = await page.evaluate(() => {
      let pData;
      window.__tcfapi('ping', 2, d => pData = d);
      return pData;
    });
    if (result.cmpId) return result.cmpId;
    console.log("pData: " + JSON.stringify(result));
    await new Promise(r => setTimeout(r, step));
    return pollForCMPId();
  }

  try {
    return await pollForCMPId();
  } catch(e) {
    console.error('Error in getCMPId:', e);
    throw new Error(`TCF API ping failed: ${e.message}`);
  }
}

module.exports = {
  initializePlaywright,
  validateSitesForVendor,
  SiteChecker
};