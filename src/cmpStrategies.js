const processCMPId = [];
processCMPId[6] = { start: iframeClickThenTCF, selector: '.sp_choice_type_11' };
processCMPId[7] = { start: checkByDidomiAPI };
processCMPId[10] = { start: clickThenTCF, selector: '.qc-cmp2-summary-buttons button[mode=primary]'};
processCMPId[28] = { start: clickThenTCF, selector: '#onetrust-accept-btn-handler' };
processCMPId[31] = { start: clickThenTCF, selector: '.cmptxt_btn_yes' };
processCMPId[68] = { start: clickThenTCF, selector: '.unic-modal-content button:nth-of-type(2)' };
processCMPId[300] = { start: clickThenTCF, selector: '.fc-cta-consent' };
processCMPId[374] = { start: clickThenTCF, selector: '#cookiescript_accept' };
processCMPId[401] = { start: clickThenTCF, selector: '.cky-notice-btn-wrapper .cky-btn-accept' };
// Add more mappings as needed

async function clickThenTCF(page, vendorId, cmpId) {
  await clickConsentButton(page, processCMPId[cmpId].selector, 60000);
  return checkByTCFAPI(page, vendorId);
};

async function iframeClickThenTCF(page, vendorId, cmpId) {
  await clickConsentButtonIframe(page, processCMPId[cmpId].selector, 60000);
  return checkByTCFAPI(page, vendorId);
};

/**
 * Finds and clicks a consent button using flexible selector matching.
 * Handles both single selectors (string) and multiple selectors (array).
 * @param {Page} page - Playwright page instance.
 * @param {number} timeout - Timeout in milliseconds (default: 5000).
 * @returns {Promise<void>} Resolves when button is successfully clicked.
 * @throws {Error} If no selector matches any clickable element within timeout.
 */
async function clickConsentButton(page, selectors, timeout = 5000) {
const selectorArray = Array.isArray(selectors) ? selectors : [selectors];

  for (const selector of selectorArray) {
    try {
      const locator = page.locator(selector);
      await locator.waitFor({ state: 'visible' , timeout: timeout });
      console.log(`Found: ${selector}`);
      await locator.click({ timeout: timeout });
      console.log(`Clicked button: ${selector}`);
      return; // clicked
    } catch (error) {
      // Continue to next selector if this one fails
      continue;
    }
  }

  const selectorsString = Array.isArray(selectors) ? selectors.join(' | ') : selectors;
  throw new Error(`No consent button found with selectors: ${selectorsString}`);
}

/**
 * Finds and clicks a consent button. Searches main frame first then all iframes.
 * Handles both single selector (string) and multiple selectors (array).
 * @param {Page} page - Playwright page instance.
 * @param {string|array} selectors - Selector or array of selectors.
 * @param {number} timeout - Timeout in milliseconds (default: 5000).
 */
async function clickConsentButtonIframe(page, selectors, timeout = 5000) {
  const selectorArray = Array.isArray(selectors) ? selectors : [selectors];
  const start = Date.now();
  const end = start + timeout;
  const pollInterval = 200;

  // Try main frame quickly for each selector
  for (const selector of selectorArray) {
    try {
      const locator = page.locator(selector);
      await locator.waitFor({ state: 'visible', timeout: Math.min(1000, timeout) });
      await locator.click({ timeout: Math.min(1000, timeout) });
      return;
    } catch (e) {
      // continue to next selector
    }
  }

  // Poll frames until timeout
  while (Date.now() < end) {
    const frames = page.frames();
    for (const f of frames) {
      for (const selector of selectorArray) {
        try {
          // Use frame.locator (works with Playwright) and attempt to click if visible
          const locator = f.locator(selector);
          // short wait to check visibility
          await locator.waitFor({ state: 'visible', timeout: 500 }).catch(() => null);
          // try click (may fail if not actually visible/clickable)
          await locator.click({ timeout: 1000 }).then(() => { throw 'clicked'; }).catch(() => { /* no-op */ });
        } catch (marker) {
          if (marker === 'clicked') return;
          // otherwise fallthrough to next selector/frame
        }
      }
    }
    await new Promise((r) => setTimeout(r, pollInterval));
  }

  const selectorsString = Array.isArray(selectors) ? selectors.join(' | ') : selectors;
  throw new Error(`No consent button found with selectors: ${selectorsString}`);
}

/**
 * Checks if vendor ID is present in the TCF vendor consents object.
 * Assumes TCF API is present (checked by hasTCFAPI).
 * @param {Page} page - Playwright page instance.
 * @param {number} vendorId - TCF vendor ID.
 * @returns {Promise<boolean>} True if consent collected for vendor.
 */
async function checkByTCFAPI(page, vendorId) {
  await page.waitForLoadState('domcontentloaded', { timeout: 10000 });

  const tcfDataHandle = await page.waitForFunction(() => {
    return new Promise((resolve) => {
      window.__tcfapi('addEventListener', 2, (tcData, success) => {
        if (success && tcData.eventStatus === 'useractioncomplete') resolve(tcData);
      });
    });
  }, { timeout: 10000 });

  const tcfData = await tcfDataHandle.jsonValue(); // Extract the actual object from JSHandle

  if (tcfData?.vendor?.consents) {
    return String(vendorId in tcfData.vendor.consents);
  }

  throw new Error('Failed to get vendor consents after consent button click');
}

async function checkByDidomiAPI(page, vendorId) {
  try {
    await page.waitForFunction(() => typeof window.Didomi !== 'undefined', { timeout: 60000 });
  } catch {
    throw new Error('Didomi API: time out waiting for API');
  }
  try {
    const requiredVendors = await page.evaluate(() => Didomi.getRequiredVendors());
    return String(vendorId in requiredVendors);
  } catch (err) {
    throw new Error('Didomi API: getRequiredVendors failed: ' + err);
  }
}

module.exports = {
  processCMPId,
  clickConsentButton
}