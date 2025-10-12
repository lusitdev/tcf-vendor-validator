/**
 * Creates a fake Playwright page object for unit testing.
 * Mocks essential methods to avoid launching a real browser.
 */
function makeFakePage() {
  const fakeWindow = {};

  const createLocator = (selector) => ({
    waitFor: jest.fn(async (options) => {
      if (selector === '#nonexistent' || selector === '#btn1' || selector === '#btn2') {
        throw new Error('Selector not found');
      }
      // Otherwise, succeed
    }),
    click: jest.fn(async (options) => {
      if (selector === '#consent-btn' || selector === '.consent-btn') {
        fakeWindow.clicked = true;
      }
    })
  });

  return {
    goto: jest.fn(async () => {}),
    close: jest.fn(async () => {}),
    setContent: jest.fn(async (html) => {
      // Simulate setting content
      if (html.includes('onclick="window.clicked=true"')) {
        fakeWindow.clicked = false; // initial
      }
    }),
    exposeFunction: jest.fn(async (name, fn) => {
      fakeWindow[name] = fn;
    }),
    evaluate: jest.fn(async (fn) => {
      // Temporarily set global window for the function execution
      const originalWindow = global.window;
      global.window = fakeWindow;
      try {
        const result = fn();
        return result;
      } finally {
        global.window = originalWindow;
      }
    }),
    waitForSelector: jest.fn(async () => {}),
    click: jest.fn(async (selector) => {
      if (selector === '#consent-btn' || selector === '.consent-btn') {
        fakeWindow.clicked = true;
      }
    }),
    locator: jest.fn(createLocator),
    frameLocator: jest.fn(() => ({
      locator: jest.fn(createLocator)
    })),
    waitForLoadState: jest.fn(async () => {}),
    waitForFunction: jest.fn(async () => ({
      jsonValue: async () => ({ vendor: { consents: {} } })
    })),
    // Add more methods as needed for other tests
  };
}

module.exports = { makeFakePage };