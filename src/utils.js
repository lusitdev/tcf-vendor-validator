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
    String(result.vendorIsPresent ?? 'N/A'),
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

async function pollTCFAPI(page, command, timeout, target) {
  const start = Date.now();
  const step = 500;
  let i = 0;

  async function poll() {
    let result;
    if (Date.now() - start > timeout) throw new Error('timeout');
    try {
      result = await page.evaluate(c => {
        switch (c) {

          case 'ping':
            let pData;
            window.__tcfapi('ping', 2, d => pData = d);
            return pData;

          case 'addEventListener':
            return new Promise(r => {
              window.__tcfapi('addEventListener', 2, (tcData, success) => {
              // useractioncomplete event may be missed or not used
                if (success && ((tcData.eventStatus === 'useractioncomplete' || tcData.eventStatus === 'tcloaded'))) {
                  window.__tcfapi('removeEventListener', 2, () => {}, tcData.listenerId);
                  r(tcData);
                }
              });
            });
          }
      }, 
      command)
    } catch(e) {
      // Suppress error when page context is destroyed to continue polling
    }

    if (result?.[target]) return result;
    await new Promise(r => setTimeout(r, step));
    return poll();
  }

  return await poll();
}


module.exports = { 
  parseSiteList,
  generateCSV,
  cleanError,
  pollTCFAPI
};