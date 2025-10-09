class CMPService {
  constructor(page, cmpId, vendorId) {
    this.page = page;
    this.cmpId = cmpId;
    this.vendorId = vendorId;
    this.defaultTimeout = 30000;
  }

  static init = (page, cmpId, vendorId) => {
    return new CMPService(page, cmpId, vendorId);
  }
  
  strategies = {
    6: { selector: '.sp_choice_type_11', frame: '[id^="sp_message_iframe"]' },
    7: { custom: () => this.checkByDidomiAPI() },
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

    if (!strategy.custom) {
      if (!strategy.selector) throw new Error(`CMP ID ${this.cmpId} has no selector defined`);
      await this.clickConsentButton(strategy.selector, strategy.frame ?? null);
      return this.checkByTCFAPI();
    }

    return strategy.custom();
  }

  /**
   * Finds and clicks a consent button using flexible selector matching.
   * Handles both single selectors (string) and multiple selectors (array).
   * @param {number} timeout - Timeout in milliseconds (default: 5000).
   * @returns {Promise<void>} Resolves when button is successfully clicked.
   * @throws {Error} If no selector matches any clickable element within timeout.
   */
  async clickConsentButton(selectors, frame) {
    const selectorArray = Array.isArray(selectors) ? selectors : [selectors];
    const context = frame ? this.page.frameLocator(frame) : this.page;

    for (const selector of selectorArray) {
      try {
        const locator = context.locator(selector);
        await locator.waitFor({ state: 'visible' , timeout: this.defaultTimeout });
        console.log(`Found: ${selector}`);
        await locator.click({ timeout: this.defaultTimeout });
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
   * @returns {Promise<boolean>} True if consent collected for vendor.
   */
  async checkByTCFAPI() {
    await this.page.waitForLoadState('domcontentloaded', { timeout: 10000 });

    const tcfDataHandle = await this.page.waitForFunction(() => {
      return new Promise((resolve) => {
        window.__tcfapi('addEventListener', 2, (tcData, success) => {
          if (success && tcData.eventStatus === 'useractioncomplete') resolve(tcData);
        });
      });
    }, { timeout: 10000 });

    const tcfData = await tcfDataHandle.jsonValue(); // Extract the actual object from JSHandle

    if (tcfData?.vendor?.consents) {
      return this.vendorId in tcfData.vendor.consents;
    }
    
    throw new Error('Failed to get vendor consents after consent button click');
  }

  async checkByDidomiAPI() {
    try {
      await this.page.waitForFunction(() => typeof window.Didomi !== 'undefined', { timeout: 60000 });
    } catch {
      throw new Error('Didomi API: time out waiting for API');
    }
    try {
      const requiredVendors = await this.page.evaluate(() => Didomi.getRequiredVendors());
      return this.vendorId in requiredVendors;
    } catch (err) {
      throw new Error('Didomi API: getRequiredVendors failed: ' + err);
    }
  }
}

module.exports = {
  CMPService
}