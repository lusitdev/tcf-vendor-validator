const fs = require('fs');

/**
 * Reads a sitelist file and returns an array of HTTPS URLs.
 * Handles domains, http:// URLs (converts to https://), and https:// URLs (keeps as is).
 * @param {string} filePath - Path to the sitelist.txt file.
 * @returns {string[]} Array of HTTPS URLs.
 */
function parseSiteList(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return content.trim().split('\n').filter(line => line.trim()).map(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('https://')) {
      return trimmed;
    } else if (trimmed.startsWith('http://')) {
      return 'https://' + trimmed.slice(7);
    } else {
      return 'https://' + trimmed;
    }
  });
}

/**
 * Generates CSV content from validation results.
 * @param {Object[]} results - Array of validation result objects.
 * @returns {string} CSV formatted string.
 */
function generateCSV(results) {
  const headers = ['Site', 'Vendor ID', 'Has TCF', 'CMP ID', 'Vendor Found', 'Timestamp', 'Error'];
  const rows = results.map(result => [
    result.site,
    result.vendorId,
    String(result.hasTCF || ''),
    result.cmpId || '',
    String(result.vendorPresent || ''),
    result.timestamp || '',
    result.error || ''
  ]);

  return [headers, ...rows].map(row => row.map(field => `"${field}"`).join(',')).join('\n');
}

module.exports = { 
  parseSiteList,
  generateCSV
};