# Project Overview

Utility script that verifies whether consent for specified TCF vendor is being collected by CMP across a list of websites.

## Languages and Runtimes
- JavaScript running on Node.js.
- YAML for configuration file.

## Folder Structure

- `/src`: Source code files for the main logic and utilities.
- `/sitelists`: Target sitelists as TXT files.
- `/results`: Result of execution saved as CSV files.
- `/tests`: Test files.
- `./config.yml`: Configuration file.
- `./run.js`: Entry point.

## Libraries and Frameworks

- Playwright for loading sites and testing CMPs.
- Jest for testing code.

## Coding Standards

- Adhere to KISS principle when possible.
- Use strategy pattern rather than long chain of if-else or switch statements.
- Code should be largely self-documenting; add comments only when necessary for understanding or prevent confusion.
- Use descriptive variable names only when meaningful. Short-lived local variables with obvious meaning should use single letter names when appropriate or abbreviations.