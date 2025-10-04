const { clickConsentButton } = require('../src/cmpStrategies');
const { initializePlaywright } = require('../src/validator');

describe('clickConsentTcf', () => {
  let browser;
  let page;

  beforeAll(async () => {
    browser = await initializePlaywright();
  }, 30000);

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    const context = await browser.newContext();
    page = await context.newPage();
  });

  afterEach(async () => {
    await page.context().close();
  });

  it('should click element with single selector', async () => {
    let clicked = false;
    await page.setContent('<button id="consent-btn" onclick="window.clicked=true">Accept</button>');
    await page.exposeFunction('setClicked', () => { clicked = true; });

    await clickConsentButton(page, '#consent-btn');

    // Verify the button was clicked
    const wasClicked = await page.evaluate(() => window.clicked);
    expect(wasClicked).toBe(true);
  });

  it('should click element with array of selectors (first match)', async () => {
    let clicked = false;
    await page.setContent('<button class="consent-btn" onclick="window.clicked=true">Accept</button>');
    await page.exposeFunction('setClicked', () => { clicked = true; });

    await clickConsentButton(page, ['#nonexistent', '.consent-btn'], 100);

    // Verify the button was clicked
    const wasClicked = await page.evaluate(() => window.clicked);
    expect(wasClicked).toBe(true);
  });

  it('should throw error when no selectors match', async () => {
    await page.setContent('<div>No buttons here</div>');

    await expect(clickConsentButton(page, '#nonexistent', 100)).rejects.toThrow(
      'No consent button found with selectors: #nonexistent'
    );
  });

  it('should throw error when none of the array selectors match', async () => {
    await page.setContent('<div>No buttons here</div>');

    await expect(clickConsentButton(page, ['#btn1', '#btn2'], 100)).rejects.toThrow(
      'No consent button found with selectors: #btn1 | #btn2'
    );
  });
});