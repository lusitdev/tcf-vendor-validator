const validator = require('../src/validator');
const { VendorPresent } = validator;
const { CMPService } = require('../src/CMPService');
const { makeFakePage } = require('./helpers/fakePage');

// Pragmatic unit tests: use injected helpers and a tiny fake context so tests run
// fast and deterministically without launching Playwright.

describe('VendorPresent.check - unit tests with injected helpers', () => {
  const vendorId = 42;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Minimal fake context that mimics the small subset used by VendorPresent.check
  const makeFakeContext = () => {
    const fakePage = makeFakePage();

    return {
      cookies: async () => [],
      clearCookies: async () => {},
      newPage: async () => fakePage
    };
  };

  it('returns hasTCF=false when TCF API is absent', async () => {
    const site = 'http://example/no-tcf';

    const fakeContext = makeFakeContext();

    // Inject fast helpers
    const mockHas = jest.fn().mockResolvedValue(false);
    const mockGet = jest.fn().mockImplementation(async () => { throw new Error('Timeout: test'); });

    const result = await VendorPresent.check(fakeContext, site, vendorId, { hasTCFAPI: mockHas, getCMPId: mockGet });

    expect(result).toMatchObject({
      site,
      vendorId,
      hasTCF: false,
      cmpId: null,
      vendorIsPresent: null,
    });
    expect(result.timestamp).toBeTruthy();
    expect(mockHas).toHaveBeenCalled();
  });

  it('preserves hasTCF when getCMPId throws', async () => {
    const site = 'http://example/tcf-present-no-cmpid';
    const fakeContext = makeFakeContext();

    const mockHas = jest.fn().mockResolvedValue(true);
    const mockGet = jest.fn().mockImplementation(async () => { throw new Error('TCF API ping failed: test'); });

    const result = await VendorPresent.check(fakeContext, site, vendorId, { hasTCFAPI: mockHas, getCMPId: mockGet });

    expect(result.hasTCF).toBe(true);
    expect(result.cmpId).toBeNull();
    expect(result.vendorIsPresent).toBeNull();
    expect(result.error).toMatch(/TCF API ping failed/);
    expect(result.timestamp).toBeTruthy();
    expect(mockHas).toHaveBeenCalled();
    expect(mockGet).toHaveBeenCalled();
  });

  it('preserves previous fields when CMPService.run throws', async () => {
    const site = 'http://example/cmp-run-throws';
    const fakeContext = makeFakeContext();
    const testCmpId = 999;

    const mockHas = jest.fn().mockResolvedValue(true);
    const mockGet = jest.fn().mockResolvedValue(testCmpId);

    jest.spyOn(CMPService, 'init').mockImplementation(() => ({ executeStrategy: async () => { throw new Error(`CMP ID ${testCmpId} not yet added`); } }));

    const result = await VendorPresent.check(fakeContext, site, vendorId, { hasTCFAPI: mockHas, getCMPId: mockGet });

    expect(result.hasTCF).toBe(true);
    expect(result.cmpId).toBe(testCmpId);
    expect(result.vendorIsPresent).toBeNull();
    expect(result.error).toMatch(/CMP ID 999 not yet added/);
    expect(result.timestamp).toBeTruthy();
  });

  it('returns vendorIsPresent=true on successful flow (mocked CMPService)', async () => {
    const site = 'http://example/success-mocked-cmp';
    const fakeContext = makeFakeContext();
    const testCmpId = 300;

    const mockHas = jest.fn().mockResolvedValue(true);
    const mockGet = jest.fn().mockResolvedValue(testCmpId);

    jest.spyOn(CMPService, 'init').mockImplementation(() => ({ executeStrategy: async () => true }));

    const result = await VendorPresent.check(fakeContext, site, 755, { hasTCFAPI: mockHas, getCMPId: mockGet });

    expect(result.hasTCF).toBe(true);
    expect(result.cmpId).toBe(testCmpId);
    expect(result.vendorIsPresent).toBe(true);
    expect(result.error).toBeNull();
    expect(result.timestamp).toBeTruthy();
  });

  it('returns vendorIsPresent=false when CMPService reports vendor absent', async () => {
    const site = 'http://example/vendor-absent';
    const fakeContext = makeFakeContext();
    const testCmpId = 300;

    const mockHas = jest.fn().mockResolvedValue(true);
    const mockGet = jest.fn().mockResolvedValue(testCmpId);

    jest.spyOn(CMPService, 'init').mockImplementation(() => ({ executeStrategy: async () => false }));

    const result = await VendorPresent.check(fakeContext, site, 999, { hasTCFAPI: mockHas, getCMPId: mockGet });

    expect(result.hasTCF).toBe(true);
    expect(result.cmpId).toBe(testCmpId);
    expect(result.vendorIsPresent).toBe(false);
    expect(result.error).toBeNull();
    expect(result.timestamp).toBeTruthy();
  });
});

