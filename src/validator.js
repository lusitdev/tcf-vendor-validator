const { chromium } = require('playwright');
const { parseSiteList } = require('./utils');
const cmpSelectors = require('./cmpSelectors');

/**
 * Initializes Playwright browser instance for CMP testing.
 * Uses headless Chromium with sandbox disabled for server environments.
 * @returns {Promise<Browser>} Playwright browser instance.
 */
async function initializePlaywright() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
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
async function validateVendorConsent(vendorId, siteListPath) {
  const browser = await initializePlaywright();
  const context = await browser.newContext();
  const page = await context.newPage();

  const sites = parseSiteList(siteListPath);
  const results = [];

  try {
    for (const site of sites) {
      console.log(`Validating ${site} for TCF Vendor ID ${vendorId} consent...`);

      const result = await checkSiteForVendorConsent(page, site, vendorId);
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
 * Checks a single website for TCF vendor consent collection by CMP.
 * @param {Page} page - Playwright page instance.
 * @param {string} site - Website URL to check.
 * @param {number} vendorId - TCF vendor ID to validate.
 * @returns {Promise<Object>} Validation result for the site.
 */
async function checkSiteForVendorConsent(page, site, vendorId) {
  try {
    // Navigate to site with timeout for network stability
    await page.goto(site, { waitUntil: 'networkidle', timeout: 30000 });

    // First check if TCF API is implemented
    const hasTCF = await hasTCFAPI(page);
    if (!hasTCF) {
      return {
        site,
        vendorId,
        hasTCF: false,
        cmpId: null,
        consentCollected: false,
        timestamp: new Date().toISOString(),
        error: null
      };
    }

    // TCF API is present, get CMP info and check for vendor consent
    const cmpInfo = await getCMPInfo(page);
    await clickConsentButton(page, cmpSelectors[cmpInfo.cmpId], 2000);
    const consentCollected = await checkVendorConsent(page, vendorId);

    return {
      site,
      vendorId,
      hasTCF: true,
      cmpId: cmpInfo ? cmpInfo.cmpId : null,
      consentCollected,
      timestamp: new Date().toISOString(),
      error: null
    };
  } catch (error) {
    return {
      site,
      vendorId,
      hasTCF: false,
      cmpId: null,
      consentCollected: false,
      timestamp: new Date().toISOString(),
      error: error.message
    };
  }
}

/**
 * Checks if the TCF API (__tcfapi) is present on the page.
 * @param {Page} page - Playwright page instance.
 * @returns {Promise<boolean>} True if TCF API is detected.
 */
async function hasTCFAPI(page) {
  try {
    const hasAPI = await page.evaluate(() => {
      return typeof window.__tcfapi === 'function';
    });
    return hasAPI;
  } catch {
    return false;
  }
}

/**
 * Gets CMP information using TCF API ping command.
 * @param {Page} page - Playwright page instance.
 * @returns {Promise<Object|null>} CMP information or null if not available.
 */
async function getCMPInfo(page) {
  try {
    const cmpInfo = await page.evaluate(() => {
      return new Promise((resolve) => {
        window.__tcfapi('ping', 2, (pingReturn, success) => {
          resolve(success ? pingReturn : null);
        });
      });
    });
    return cmpInfo;
  } catch {
    return null;
  }
}

/**
 * Checks if consent has been collected for specific TCF vendor.
 * Assumes TCF API is present (checked by hasTCFAPI).
 * @param {Page} page - Playwright page instance.
 * @param {number} vendorId - TCF vendor ID.
 * @returns {Promise<boolean>} True if consent collected for vendor.
 */
async function checkVendorConsent(page, vendorId) {
  try {
    const tcfData = await page.evaluate(() => {
      return new Promise((resolve) => {
        window.__tcfapi('getTCData', 2, (tcData, success) => {
          resolve(success ? tcData : null);
        });
      });
    });

    if (tcfData && tcfData.vendor && tcfData.vendor.consents) {
      return tcfData.vendor.consents[vendorId] === true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Finds and clicks a consent button using flexible selector matching.
 * Handles both single selectors (string) and multiple selectors (array).
 * @param {Page} page - Playwright page instance.
 * @param {string|string[]} selectors - Single selector string or array of selector strings.
 * @param {number} timeout - Timeout in milliseconds (default: 5000).
 * @returns {Promise<void>} Resolves when button is successfully clicked.
 * @throws {Error} If no selector matches any clickable element within timeout.
 */
async function clickConsentButton(page, selectors, timeout = 5000) {
  const selectorArray = Array.isArray(selectors) ? selectors : [selectors];

  for (const selector of selectorArray) {
    try {
      const locator = page.locator(selector);
      await locator.click({ timeout: timeout });
      return; // Successfully clicked
    } catch (error) {
      // Continue to next selector if this one fails
      continue;
    }
  }

  // If we get here, none of the selectors worked
  const selectorString = Array.isArray(selectors) ? selectors.join(' | ') : selectors;
  throw new Error(`No consent button found with selectors: ${selectorString}`);
}

module.exports = {
  initializePlaywright,
  validateVendorConsent,
  clickConsentButton
};