class CMPService {
  constructor(page, cmpId, vendorId) {
    this.page = page;
    this.cmpId = cmpId;
    this.vendorId = vendorId;
    this.defaultTimeout = 30000;
  }
  /**
   * @param {Page} page - Playwright page instance.
   * @param {string} cmpId - CMP ID.
   * @param {number} vendorId - Vendor ID.
   */
  static init = (page, cmpId, vendorId) => {
    return new CMPService(page, cmpId, vendorId);
  }
  
  strategies = {
    6: { selector: '.sp_choice_type_11', frame: '[id^="sp_message_iframe"]' },
    7: { custom: 'checkByDidomiAPI' },
    10: { selector: '.qc-cmp2-summary-buttons button[mode=primary]' },
    28: { selector: '#onetrust-accept-btn-handler' },
    31: { selector: '.cmptxt_btn_yes' },
    68: { selector: '.unic-modal-content button:nth-of-type(2)' },
    247: { custom: 'clickShadowButtonWithCDP', selector: { attribute: 'data-testid', value: 'button-agree'} },
    300: { selector: '.fc-cta-consent' },
    374: { selector: '#cookiescript_accept' },
    401: { selector: '.cky-notice-btn-wrapper .cky-btn-accept' }
  }

  async executeStrategy() {
    const strategy = this.strategies[this.cmpId];
    if (!strategy) throw new Error(`CMP ID ${this.cmpId} not yet added`);

    if (!strategy.custom) {
      if (!strategy.selector) throw new Error(`CMP ID ${this.cmpId} has no selector defined`);

      // default approach
      await this.clickConsentButton(strategy.selector, strategy.frame ?? null);
      return this.checkByTCFAPI();
    }

    return this[strategy.custom](strategy.selector ?? null);
  }

  /**
   * Finds and clicks a consent button in top document context.
   * Handles both single selectors (string) and multiple selectors (array).
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
   * @returns {Promise<boolean>} True if consent status collected for the vendorId.
   */
  async checkByTCFAPI() {
    await this.page.waitForLoadState('domcontentloaded', { timeout: this.defaultTimeout });

    const tcfDataHandle = await this.page.waitForFunction(() => {
      return new Promise((resolve) => {
        window.__tcfapi('addEventListener', 2, (tcData, success) => {
          if (success && tcData.eventStatus === 'useractioncomplete') resolve(tcData);
        });
      });
    }, { timeout: this.defaultTimeout });
    
    // Extract the actual object from JSHandle
    const tcfData = await tcfDataHandle.jsonValue(); 

    if (tcfData?.vendor?.consents) {
      return this.vendorId in tcfData.vendor.consents;
    }
    
    throw new Error('Failed to get vendor consents after consent button click');
  }

  /**
   * @returns {Promise<boolean>} Resolves to true if vendorId is present. Rejects on timeout or if the API call fails.
   */
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

  /**
   * Use Chromium DevTools Protocol to find an element anywhere (piercing closed shadow roots) and click it.
   * @param {{attribute: string, value: string}} selector - Object with attribute name and value to match
   * @returns {Promise<boolean>} resolves to true if clicked and TCF check succeeds
   */
  async clickShadowButtonWithCDP({ attribute, value }) {
    if (!attribute || !value) {
      throw new Error('Invalid parameters for clickShadowButtonWithCDP');
    }

    // create CDP session bound to this page (Chromium only)
    const client = await this.page.context().newCDPSession(this.page);
    await client.send('DOM.enable');
    
    // get flattened document nodes including shadow DOM
    const flat = await client.send('DOM.getFlattenedDocument', { depth: -1, pierce: true });
    // flattened document may expose nodes in different shapes depending on chrome version
    const nodes = flat.nodes ?? (flat.root && flat.root.children ? flat.root.children : []);

    let buttonNodeId;
    for (const n of nodes) {
        const attrs = n.attributes || [];
        for (let i = 0; i < attrs.length; i += 2) {
           if (attrs[i] === attribute && attrs[i + 1] === value) {
            buttonNodeId = n.nodeId ?? n.backendNodeId ?? null;
          }
        }
      }

    if (!buttonNodeId || buttonNodeId === 0) {
      throw new Error(`CDP: selector not found: [${attribute}=${value}]`);
    }

    // resolve node to a remote object so we can call click()
    const { object: { objectId } } = await client.send('DOM.resolveNode', { nodeId: buttonNodeId });

    // call click on the element
    await client.send('Runtime.callFunctionOn', {
      objectId,
      functionDeclaration: 'function(){ this.click(); }',
      returnByValue: true
    });

    // cleanup CDP session
    await client.detach();

    return this.checkByTCFAPI();
  }
}

module.exports = {
  CMPService
}