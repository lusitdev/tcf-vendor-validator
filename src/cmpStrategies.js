const processCmpId = [];
processCmpId[6] = { start: clickConsentTcf, selector: '.sp_choice_type_11' };
processCmpId[7] = { start: checkByDidomiApi };
processCmpId[10] = { start: clickConsentTcf, selector: '.qc-cmp2-summary-buttons button[mode=primary]'};
processCmpId[28] = { start: clickConsentTcf, selector: '#onetrust-accept-btn-handler' };
processCmpId[31] = { start: clickConsentTcf, selector: '.cmptxt_btn_yes' };
processCmpId[68] = { start: clickConsentTcf, selector: '.unic-modal-content button:nth-of-type(2)' };
processCmpId[300] = { start: clickConsentTcf, selector: '.fc-cta-consent' };
processCmpId[374] = { start: clickConsentTcf, selector: '#cookiescript_accept' };
processCmpId[401] = { start: clickConsentTcf, selector: '.cky-notice-btn-wrapper .cky-btn-accept' };
// Add more mappings as needed

async function clickConsentTcf(page, vendorId, cmpId) {
  await clickConsentBtn(page, processCmpId[cmpId].selector, 60000);
  return checkByTcfApi(page, vendorId);
};

/**
 * Finds and clicks a consent button using flexible selector matching.
 * Handles both single selectors (string) and multiple selectors (array).
 * @param {Page} page - Playwright page instance.
 * @param {number} timeout - Timeout in milliseconds (default: 5000).
 * @returns {Promise<void>} Resolves when button is successfully clicked.
 * @throws {Error} If no selector matches any clickable element within timeout.
 */
async function clickConsentBtn(page, selectors, timeout = 5000) {
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

  // None of the selectors worked
  console.error('Selectors failed!');
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
async function checkByTcfApi(page, vendorId) {
  await page.waitForLoadState('domcontentloaded', { timeout: 10000 });

  const tcfDataHandle = await page.waitForFunction(() => {
    return new Promise((resolve) => {
      window.__tcfapi('addEventListener', 2, (tcData, success) => {
        if (success && tcData.eventStatus === 'useractioncomplete') resolve(tcData);
      });
    });
  }, { timeout: 10000 });

  const tcfData = await tcfDataHandle.jsonValue(); // Extract the actual object from JSHandle
  console.log(tcfData);

  if (tcfData?.vendor?.consents) {
    return String(vendorId in tcfData.vendor.consents);
  }

  throw new Error('Failed to get vendor consents after consent button click');
}

async function checkByDidomiApi(page, vendorId) {
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
  processCmpId,
  clickConsentBtn
}