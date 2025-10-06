# TCF Vendor Validator

CLI tool to validate TCF vendor consent collection by CMPs across list of websites.

## Install

```bash
npm install
```

Requires Node.js >= 18.

## Usage

```bash
npm run validate 30                    # headless mode, vendor ID 30
npm run validate --headfull 30         # visible browser mode

# direct invocation
node run.js 30
node run.js --headfull 30 sitelist.txt
```

### Arguments

- `<vendorId>` (required) - TCF vendor ID (integer > 0). Falls back to `config.yml` if omitted.
- `[siteListPath]` (optional) - Path to newline-separated site list. Defaults to `sitelists/sitelist.txt` from `config.yml`.

### Flags

- `--headfull` - Launch browser in visible mode (default: headless).
- `--siteList=<path>` - Alternative syntax for site list path.

## Output

Results: `results/validation-<vendorId>-<timestamp>.csv`

## Configuration

`config.yml` sets defaults for `vendorId` and `siteList`.

## Notes

- Exit codes: 0 (success), non-zero (error).
- Install globally: `npm link` (enables `tcfvv` command).