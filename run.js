#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { generateCSV } = require('./src/utils');
const { validateVendorConsent } = require('./src/validator');

// Load default configuration
const configPath = path.join(__dirname, 'config.yml');
const defaultConfig = yaml.load(fs.readFileSync(configPath, 'utf8'));

// arg parser: flags (--headfull, --siteList=path) and positional vendorId/siteList
const rawArgs = process.argv.slice(2);
let headfull = false;
let vendorIdArg = null;
let siteListArg = null;

for (const a of rawArgs) {
  if (a === '--headfull' || a === '--headfull=true') {
    headfull = true;
    continue;
  }
  if (a.startsWith('--siteList=')) {
    siteListArg = a.split('=')[1];
    continue;
  }
  // numeric positional -> vendorId
  if (!vendorIdArg && !Number.isNaN(Number(a))) {
    vendorIdArg = a;
    continue;
  }
  // otherwise treat as siteList path if not set
  if (!siteListArg) siteListArg = a;
}

const headless = !headfull;
const vendorId = vendorIdArg ? parseInt(vendorIdArg, 10) : defaultConfig.vendorId;
const siteListPath = siteListArg || path.join(__dirname, 'sitelists', defaultConfig.siteList);

// Validate inputs
if (isNaN(vendorId) || vendorId <= 0) {
  console.error('Error: Vendor ID must be a positive integer greater than 0.');
  process.exit(1);
}

if (!fs.existsSync(siteListPath)) {
  console.error(`Error: Site list file not found at ${siteListPath}`);
  process.exit(1);
}

// Execute validation and save results
async function main() {
  console.log(`Starting TCF vendor consent validation for Vendor ID: ${vendorId}`);
  console.log(`Using site list: ${siteListPath}`);
  console.log(`Browser mode: ${headless ? 'headless' : 'headfull'}`);

  try {
    // pass headless option into validator
    const results = await validateVendorConsent(vendorId, siteListPath, { headless });

    // Save results to CSV in results/ directory
    const csvContent = generateCSV(results);
    const resultsDir = path.join(__dirname, 'results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir);
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const csvPath = path.join(resultsDir, `validation-${vendorId}-${timestamp}.csv`);
    fs.writeFileSync(csvPath, csvContent);

    console.log(`Validation completed. Results saved to: ${csvPath}`);
    console.log(`Processed ${results.length} sites`);
  } catch (error) {
    console.error('Validation failed:', error);
    process.exit(1);
  }
}

main();