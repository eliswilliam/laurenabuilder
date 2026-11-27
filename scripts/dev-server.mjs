/**
 * Custom Next.js dev server — bypasses the interactive TTY keyboard shortcuts
 * that crash on Windows when running without a real terminal (Claude Code, CI, etc.)
 *
 * Usage:  node scripts/dev-server.mjs
 */
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';

const port = parseInt(process.env.PORT ?? '2020', 10);
const hostname = 'localhost';

const app = next({ dev: true, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  }).listen(port, hostname, () => {
    console.log(`\n   ▲ Next.js dev server (custom)\n   - Local: http://${hostname}:${port}\n`);
  });
});
