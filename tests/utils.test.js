const { parseSiteList, cleanError } = require('../src/utils');

describe('parseSiteList', () => {
  it('should convert sitelist.txt to array of URLs', () => {
    // Mock fs.readFileSync to simulate reading the file
    const mockReadFileSync = jest.spyOn(require('fs'), 'readFileSync');
    mockReadFileSync.mockReturnValue('example.com\nanother.com\n');

    const result = parseSiteList('dummy/path');

    expect(result).toEqual(['https://example.com', 'https://another.com']);

    mockReadFileSync.mockRestore();
  });

  it('should handle mixed domains and URLs', () => {
    const mockReadFileSync = jest.spyOn(require('fs'), 'readFileSync');
    mockReadFileSync.mockReturnValue('example.com\nhttps://secure.com\nhttp://insecure.com\n');

    const result = parseSiteList('dummy/path');

    expect(result).toEqual(['https://example.com', 'https://secure.com', 'https://insecure.com']);

    mockReadFileSync.mockRestore();
  });

  it('should filter out empty lines', () => {
    const mockReadFileSync = jest.spyOn(require('fs'), 'readFileSync');
    mockReadFileSync.mockReturnValue('example.com\n\nanother.com\n');

    const result = parseSiteList('dummy/path');

    expect(result).toEqual(['https://example.com', 'https://another.com']);

    mockReadFileSync.mockRestore();
  });
});

describe('cleanError', () => {
  it('should convert Error objects to strings', () => {
    const error = new Error('Something failed');
    expect(cleanError(error)).toBe('Error: Something failed');
  });

  it('should handle Error with stack traces', () => {
    const error = new Error('Test\nwith newline');
    const result = cleanError(error);
    expect(result).toContain('Error: Test | with newline');
  });

  it('should remove ANSI escape codes', () => {
    const input = '\x1B[2mDim text\x1B[22m Normal text\x1B[31m Red\x1B[0m';
    const expected = 'Dim text Normal text Red';
    expect(cleanError(input)).toBe(expected);
  });

  it('should remove control characters', () => {
    const input = 'Hello\x00\x01\x02World\x1F';
    const expected = 'HelloWorld';
    expect(cleanError(input)).toBe(expected);
  });

  it('should replace Unix line breaks with pipe separator', () => {
    const input = 'Line 1\nLine 2\nLine 3';
    const expected = 'Line 1 | Line 2 | Line 3';
    expect(cleanError(input)).toBe(expected);
  });

  it('should replace Windows line breaks with pipe separator', () => {
    const input = 'Line 1\r\nLine 2\r\nLine 3';
    const expected = 'Line 1 | Line 2 | Line 3';
    expect(cleanError(input)).toBe(expected);
  });

  it('should handle real Playwright error messages', () => {
    const input = 'page.goto: net::ERR_NAME_NOT_RESOLVED\n\x1B[2m  - navigating to https://example.com\x1B[22m';
    const expected = 'page.goto: net::ERR_NAME_NOT_RESOLVED |   - navigating to https://example.com';
    expect(cleanError(input)).toBe(expected);
  });

  it('should handle combined issues', () => {
    const input = '\x1B[31mError:\x1B[0m\nSomething\x00failed\nCheck\x1B[2mthis\x1B[22m';
    const expected = 'Error: | Somethingfailed | Checkthis';
    expect(cleanError(input)).toBe(expected);
  });

  it('should replace double quotes with double double quotes', () => {
    expect(cleanError('"domcontentloaded"')).toBe('""domcontentloaded""');
  });

  it('should handle empty and whitespace strings', () => {
    expect(cleanError('')).toBe('');
    expect(cleanError('   ')).toBe('   ');
  });
});