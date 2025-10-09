class CMPService {
  constructor(page, cmpId, vendorId) {
    this.page = page;
    this.cmpId = cmpId;
    this.vendorId = vendorId;
  }

  static init = (page, cmpId, vendorId) => {
    return new CMPService(page, cmpId, vendorId);
  }
  
  strategies = {
    6: { selector: '.sp_choice_type_11', frame: '[id^="sp_message_iframe"]' },
    7: { custom: this.checkByDidomiAPI },
    10: { selector: '.qc-cmp2-summary-buttons button[mode=primary]' },
    28: { selector: '#onetrust-accept-btn-handler' },
    31: { selector: '.cmptxt_btn_yes' },
    68: { selector: '.unic-modal-content button:nth-of-type(2)' },
    300: { selector: '.fc-cta-consent' },
    374: { selector: '#cookiescript_accept' },
    401: { selector: '.cky-notice-btn-wrapper .cky-btn-accept' }
  }

  async run() {
    const strategy = this.strategies[this.cmpId];
    if (!strategy) throw new Error(`CMP ID ${this.cmpId} not yet added`);
    if (!strategy.selector) throw new Error(`CMP ID ${this.cmpId} has no selector defined`);

    if (!strategy.custom) {
      await this.clickConsentButton(this.page, strategy.selector, 30000, strategy.frame ?? null);
      return this.checkByTCFAPI(this.page, this.vendorId);
    }

    return strategy.custom();
  }

  /**
   * Finds and clicks a consent button using flexible selector matching.
   * Handles both single selectors (string) and multiple selectors (array).
   * @param {Page} page - Playwright page instance.
   * @param {number} timeout - Timeout in milliseconds (default: 5000).
   * @returns {Promise<void>} Resolves when button is successfully clicked.
   * @throws {Error} If no selector matches any clickable element within timeout.
   */
  clickConsentButton = async (page, selectors, timeout = 5000, frame) => {
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
  checkByTCFAPI = async (page, vendorId) => {
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

  checkByDidomiAPI = async (page, vendorId) => {
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
}

module.exports = {
  CMPService
}