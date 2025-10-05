const { chromium } = require('playwright');
const { parseSiteList } = require('./utils');
const { processCMPId } = require('./cmpStrategies');

/**
 * Initializes Playwright browser instance for CMP testing.
 * Uses headless Chromium with sandbox disabled for server environments.
 * @returns {Promise<Browser>} Playwright browser instance.
 */
async function initializePlaywright(options = {}) {
  // Default to headless, can be overridden
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
 * Validates TCF vendor consent collection across websites using CMP detection.
 * Implements the core utility functionality described in AGENTS.md.
 * @param {number} vendorId - The TCF vendor ID to check for consent.
 * @param {string} siteListPath - Path to the sitelist file containing target websites.
 * @returns {Promise<Object[]>} Array of validation results for each site.
 */
async function validateVendorConsent(vendorId, siteListPath, options = {}) {
  const browser = await initializePlaywright(options);
  const context = await browser.newContext();
  const page = await context.newPage();

  const sites = parseSiteList(siteListPath);
  const results = [];

  try {
    for (const site of sites) {
      console.log(`Validating ${site} for TCF Vendor ID ${vendorId} consent...`);

      const result = await checkSiteForVendor(page, site, vendorId);
      results.push(result);
    }
  } catch (error) {
    console.error('Error during validation process:', error);
  } finally {
    await browser.close();
  }

  return results;
}

/**
 * Checks a single website whether CMP is configured for consent collection for vendor ID.
 * @param {Page} page - Playwright page instance.
 * @param {string} site - Website URL to check.
 * @param {number} vendorId - TCF vendor ID to validate.
 * @returns {Promise<Object>} Validation result for the site.
 */
async function checkSiteForVendor(page, site, vendorId) {
  let cmpInfo = null;
  let hasTCF;
  try {
    await page.goto(site, { waitUntil: 'domcontentloaded', timeout: 90000 });
    
    // wait for TCF API or CMP elements to ensure readiness
    await page.waitForFunction(() => {
      return typeof window.__tcfapi === 'function';
    }, { timeout: 10000 });

    // TODO: ensure recording cmpId when error occurres after this point
    // Check if TCF API is present
    hasTCF = await hasTCFAPI(page);
    if (!hasTCF) {
      return {
        site,
        vendorId,
        hasTCF: false,
        cmpId: null,
        vendorPresent: false,
        timestamp: new Date().toISOString(),
        error: null
      };
    }

    cmpId = await getCMPId(page);

    const vendorPresent = await processCMPId[cmpId].start(page, vendorId, cmpId);

    return {
      site,
      vendorId,
      hasTCF: true,
      cmpId,
      vendorPresent,
      timestamp: new Date().toISOString(),
      error: null
    };
  } catch (error) {
    return {
      site,
      vendorId,
      hasTCF: hasTCF,
      cmpId: cmpInfo?.cmpId ?? null,
      vendorPresent: 'n/a',
      timestamp: new Date().toISOString(),
      error: error.message
    };
  }
}

/**
 * Checks if the TCF API is present on the page.
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
 * @returns {Promise<number>} CMP ID.
 */
async function getCMPId(page) {
  const tcfPing = async page => {
    const cmpData = await page.evaluate(() => {
      return new Promise((res) => {
        window.__tcfapi('ping', 2, pingData => res(pingData));
      });
    });

    return (cmpData?.cmpId) ? Number(cmpData.cmpId) : null;
  };

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