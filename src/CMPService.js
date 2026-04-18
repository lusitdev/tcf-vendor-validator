const { pollTCFAPI } = require('./utils');

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
    5: { selector: { attribute: 'data-testid', value: 'uc-accept-all-button' } },
    6: { selector: '.sp_choice_type_11', frame: '[id^="sp_message_iframe"]' },
    7: { custom: 'checkByDidomiAPI' },
    10: { selector: '.qc-cmp2-summary-buttons button[mode=primary]' },
    28: { selector: '#onetrust-accept-btn-handler' },
    31: { selector: '.cmptxt_btn_yes' },
    68: { selector: '.unic-modal-content button:nth-of-type(2)' },
    72: { selector: '.ulv5cww .z1lwc6s .us9u54n'},
    112: { selector: '.sp_choice_type_11', frame: '[id^="sp_message_iframe"]' },
    134: { selector: '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll'},
    247: { custom: 'clickShadowButtonWithCDP', selector: { attribute: 'data-testid', value: 'button-agree'} },
    280: { selector: '.cmp-intro_acceptAll' },
    300: { selector: '.fc-cta-consent' },
    309: { selector: '#gdpr-banner-accept' },
    345: { selector: '.sp_choice_type_11', frame: '[id^="sp_message_iframe"]' },
    355: { selector: '#btn-eiS3ai-consent-all' },
    374: { selector: '#cookiescript_accept' },
    397: { selector: '._consent-accept_1lphq_114' },
    401: { selector: '.cky-notice-btn-wrapper .cky-btn-accept' },
    411: { selector: '#pg-accept-btn'}
  }

  async executeStrategy() {
    const strategy = this.strategies[this.cmpId];
    if (!strategy) throw new Error(`CMP ID ${this.cmpId} not yet added`);

    if (!strategy.custom) {
      if (!strategy.selector) throw new Error(`CMP ID ${this.cmpId} has no selector defined`);

      // default approach
      await this.clickConsentButton(strategy.selector, strategy.frame ?? null);
      // when pages reloads after click
      await this.page.waitForFunction(() => typeof window.__tcfapi === 'function', { timeout: 10000 }); 
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
        await locator.click({ timeout: this.defaultTimeout, noWaitAfter: true });
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
    try {
      const tcfData = await pollTCFAPI(this.page, 'addEventListener', 9999, 'vendor');
      return this.validateVendor(tcfData); 
    } catch(e) {
      throw new Error(`checkByTCFAPI: ${e.message}`);
    }
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

  validateVendor(tcObject) {
    try {
      // tcf v 2.3
      if (tcObject.tcfPolicyVersion >= 4 && tcObject.vendor.disclosedVendors) {
        return tcObject.vendor.disclosedVendors[this.vendorId] ?? false;
      }
      // old tcf
      return tcObject.vendor.consents[this.vendorId] ?? false;
    } catch (e) {
      throw new Error(`tcObject invalid: ${e}`)
    }
  }
}

module.exports = {
  CMPService
}