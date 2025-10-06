const processCMPId = [];
processCMPId[6] = { start: clickThenTCF, selector: '.sp_choice_type_11', frame: '[id^="sp_message_iframe"]' };
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
  const routing = processCMPId[cmpId];
  if (!routing) throw new Error(`CMP ID ${cmpId} not yet added`);
  if (!routing.selector) throw new Error(`CMP ID ${cmpId} has no selector defined`);

  await clickConsentButton(page, routing.selector, 30000, routing.frame ?? null);
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
async function clickConsentButton(page, selectors, timeout = 5000, frame) {
const selectorArray = Array.isArray(selectors) ? selectors : [selectors];
const context = frame ? page.frameLocator(frame) : page;

  for (const selector of selectorArray) {
    try {
      const locator = context.locator(selector);
      await locator.waitFor({ state: 'visible' , timeout: timeout });
      console.log(`Found: ${selector}`);
      await locator.click({ timeout: timeout });
      console.log(`Clicked button: ${selector}`);
      return;
    } catch {
      // Try next selector
      continue;
    }
  }

  const failedSelectors = Array.isArray(selectors) ? selectors.join(' | ') : selectors;
  throw new Error(`No consent button found with selectors: ${failedSelectors}`);
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