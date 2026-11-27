#!/usr/bin/env node
// Wrapper: patches process.stdin so Next.js 15 interactive mode
// doesn't crash when running without a TTY (Windows non-interactive env).
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

// Prevent Next.js from calling setRawMode on stdin (crashes on Windows without TTY)
const originalSetRawMode = process.stdin.setRawMode?.bind(process.stdin);
if (process.stdin.setRawMode) {
  process.stdin.setRawMode = (...args) => {
    try { return originalSetRawMode(...args); } catch { /* ignore */ }
    return process.stdin;
  };
}
// Prevent uncaughtException from killing the process on stdin read errors
process.on('uncaughtException', (err) => {
  if (err?.syscall === 'read' && err?.code === 'UNKNOWN') return; // ignore stdin TTY error
  console.error(err);
  process.exit(1);
});

// Now load Next.js CLI
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nextBin = path.resolve(__dirname, '../node_modules/next/dist/bin/next');
process.argv = ['node', nextBin, 'dev', '-p', '2020'];
const require = createRequire(import.meta.url);
require(nextBin);
