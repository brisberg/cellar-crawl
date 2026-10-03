// Builds the test story: the real game (src/) plus test-only passages (tests/fixtures/),
// starting at TestRouter. The production build (`npm run build`) runs before Playwright
// via the `test` npm script, so both artifacts are fresh.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const TEST_BUILD = 'test-output/cellar-crawl.test.html';

export default function globalSetup() {
  mkdirSync('test-output', { recursive: true });

  // Tweego takes a single --head file; Spindle concatenates header/* the same way.
  const head = readdirSync('header')
    .filter((f) => f.endsWith('.html'))
    .sort()
    .map((f) => readFileSync(join('header', f), 'utf8'))
    .join('\n');
  writeFileSync('test-output/head.html', head);

  // Tweego finds the vendored format in ./storyformats because we run from the repo root.
  execFileSync(
    'tweego',
    ['-s', 'TestRouter', '--head=test-output/head.html', '-o', TEST_BUILD, 'src', 'tests/fixtures'],
    { stdio: 'inherit' },
  );
}
