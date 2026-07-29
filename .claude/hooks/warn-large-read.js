#!/usr/bin/env node
'use strict';

// PreToolUse hook for the Read tool: warns (does not block) when a file is
// read in full past a line-count threshold, since that spends a lot of
// context. Skipped for partial reads (offset/limit already set) and for
// binary formats (docs/ ships PDFs) where a line count is meaningless.

const fs = require('fs');
const path = require('path');

const LINE_THRESHOLD = 1000;
const BINARY_EXTENSIONS = new Set([
  '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp',
  '.zip', '.gz', '.tar', '.7z',
  '.woff', '.woff2', '.ttf', '.eot',
  '.mp3', '.mp4', '.wav', '.mov',
]);

let raw = '';
process.stdin.on('data', (chunk) => {
  raw += chunk;
});

process.stdin.on('end', () => {
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return;
  }

  const toolInput = input.tool_input || {};
  const filePath = toolInput.file_path;
  if (!filePath) return;
  if (toolInput.limit || toolInput.offset) return; // already a scoped read

  if (BINARY_EXTENSIONS.has(path.extname(filePath).toLowerCase())) return;

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return; // unreadable / not text — nothing useful to say
  }

  const lineCount = content.split('\n').length;
  if (lineCount <= LINE_THRESHOLD) return;

  process.stdout.write(
    JSON.stringify({
      systemMessage: `⚠️ ${filePath} is ~${lineCount} lines. Reading it in full spends a lot of context — consider Grep for the symbol you need, or Read with offset/limit.`,
    })
  );
});
