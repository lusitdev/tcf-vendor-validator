const { CMPService } = require('../src/CMPService');
const { initializePlaywright } = require('../src/validator');

describe('clickConsentTcf', () => {
  let browser;
  let page;
  let service;

  beforeAll(async () => {
    browser = await initializePlaywright();
  }, 30000);

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    const context = await browser.newContext();
    page = await context.newPage();
    // create a CMPService instance (cmpId and vendorId are unused by clickConsentButton)
    service = CMPService.init(page, 1, 999);
  });

  afterEach(async () => {
    await page.context().close();
  });

  it('should click element with single selector', async () => {
    let clicked = false;
    await page.setContent('<button id="consent-btn" onclick="window.clicked=true">Accept</button>');
    await page.exposeFunction('setClicked', () => { clicked = true; });

  await service.clickConsentButton('#consent-btn');

    // Verify the button was clicked
    const wasClicked = await page.evaluate(() => window.clicked);
    expect(wasClicked).toBe(true);
  });

  it('should click element with array of selectors (first match)', async () => {
    let clicked = false;
    await page.setContent('<button class="consent-btn" onclick="window.clicked=true">Accept</button>');
    await page.exposeFunction('setClicked', () => { clicked = true; });
    service.defaultTimeout = 100;

  await service.clickConsentButton(['#nonexistent', '.consent-btn']);

    // Verify the button was clicked
    const wasClicked = await page.evaluate(() => window.clicked);
    expect(wasClicked).toBe(true);
  });

  it('should throw error when no selectors match', async () => {
    await page.setContent('<div>No buttons here</div>');
    service.defaultTimeout = 100;

    await expect(service.clickConsentButton('#nonexistent')).rejects.toThrow(
      'No consent button found with selectors: #nonexistent'
    );
  });

  it('should throw error when none of the array selectors match', async () => {
    await page.setContent('<div>No buttons here</div>');
    service.defaultTimeout = 100;

    await expect(service.clickConsentButton(['#btn1', '#btn2'])).rejects.toThrow(
      'No consent button found with selectors: #btn1 | #btn2'
    );
  });
});