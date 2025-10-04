const { chromium } = require('playwright');
const { parseSiteList } = require('./utils');
const { processCmpId: process } = require('./cmpStrategies');
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
 * Checks a single website for TCF vendor consent collection by CMP.
 * @param {Page} page - Playwright page instance.
 * @param {string} site - Website URL to check.
 * @param {number} vendorId - TCF vendor ID to validate.
 * @returns {Promise<Object>} Validation result for the site.
 */
async function checkSiteForVendor(page, site, vendorId) {
  let cmpInfo = null;
  let hasTCF;
  try {
    await page.goto(site, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // wait for TCF API or CMP elements to ensure readiness
    await page.waitForFunction(() => {
      return typeof window.__tcfapi === 'function';
    }, { timeout: 10000 });

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
    const vendorPresent = await process[cmpId].start(page, vendorId, page, vendorId, cmpId);

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
async function getCMPId(page) {
  try {
    const cmpInfo = await page.evaluate(() => {
      return new Promise((resolve) => {
        window.__tcfapi('ping', 2, (pingReturn, success) => {
          resolve(success ? pingReturn : null);
        });
      });
    });
    if (!cmpInfo?.cmpId) {
      throw new Error('TCF API present, ping failed to get CMP info');
    }
    return Number(cmpInfo.cmpId);
  } catch (err) {
    throw new Error(`TCF API ping failed: ${err}`);
  }
}

module.exports = {
  initializePlaywright,
  validateVendorConsent
};