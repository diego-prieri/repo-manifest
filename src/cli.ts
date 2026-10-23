#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { loadConfig } from './config.js';
import { renderMarkdown } from './render.js';
import { scanRepo } from './scan.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string', short: 'o' },
    json: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (values.help) {
  console.log(`Usage: repo-manifest [root] [--out FILE] [--json]

Scans a TypeScript repo and prints a compact manifest for AI agents.
Configure with repo-manifest.config.json at the repo root.`);
  process.exit(0);
}

const root = resolve(positionals[0] ?? '.');
const config = loadConfig(root);
const scan = scanRepo(root, config);
const output = values.json ? JSON.stringify(scan, null, 2) + '\n' : renderMarkdown(scan, config);

if (values.out) {
  writeFileSync(values.out, output);
  console.error(`repo-manifest: wrote ${scan.files.length} files to ${values.out} (~${Math.round(output.length / 4)} tokens)`);
} else {
  process.stdout.write(output);
}
