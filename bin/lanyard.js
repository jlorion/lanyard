#!/usr/bin/env node
'use strict';

// Thin launcher for the compiled CLI (built by `npm run build` into out/main/cli.js).
const fs = require('fs');
const path = require('path');

const entry = path.join(__dirname, '..', 'out', 'main', 'cli.js');
if (!fs.existsSync(entry)) {
  process.stderr.write('lanyard is not built yet. Run `npm run build` in the project directory first.\n');
  process.exit(1);
}
require(entry).run(process.argv);
