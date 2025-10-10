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
    String(result.hasTCF ?? 'N/A'),
    result.cmpId || 'N/A',
    String(result.vendorPresent ?? 'N/A'),
    result.timestamp || 'N/A',
    result.error ? cleanError(result.error) : 'N/A'
  ]);

  return [headers, ...rows].map(row => row.map(field => `"${field}"`).join(';')).join('\n');
}

function cleanError(err) {
  // Remove ANSI escape codes (like [2m, [22m)
  // Remove other control characters (except newlines and tabs)
  return String(err)
    .replace(/\x1B\[[0-9;]*[A-Za-z]/g, '')
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\r?\n/g, ' | ')
    .replace(/"/g, '""');
}


module.exports = { 
  parseSiteList,
  generateCSV,
  cleanError
};