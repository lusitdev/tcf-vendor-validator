const { parseSiteList } = require('../src/utils');

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