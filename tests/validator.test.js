const { initializePlaywright } = require('../src/validator');

describe('initializePlaywright', () => {
  it('should launch and return a functional Playwright browser instance', async () => {
    const browser = await initializePlaywright();

    expect(browser).toBeDefined();
    expect(typeof browser.newContext).toBe('function');
    expect(typeof browser.close).toBe('function');

    // Verify browser can create context and page
    const context = await browser.newContext();
    const page = await context.newPage();
    expect(page).toBeDefined();

    await browser.close();
  }, 30000); // Extended timeout for browser operations
});

