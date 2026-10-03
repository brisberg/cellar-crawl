// Static checks on the compiled story (no browser): every passage reference resolves,
// and every item is wired up. Catches typos that would otherwise surface only when a
// player reaches that exact link.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const unescape = (s) =>
  s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

function loadPassages() {
  const html = readFileSync('test-output/cellar-crawl.test.html', 'utf8');
  const passages = new Map();
  for (const m of html.matchAll(/<tw-passagedata\b([^>]*)>([\s\S]*?)<\/tw-passagedata>/g)) {
    const attr = (n) => unescape(m[1].match(new RegExp(`\\b${n}="([^"]*)"`))?.[1] ?? '');
    passages.set(attr('name'), { tags: attr('tags').split(/\s+/).filter(Boolean), text: unescape(m[2]) });
  }
  return passages;
}

const passages = loadPassages();

/** Every literal passage reference in a passage's source. */
function references(text) {
  const refs = [];
  for (const [, inner] of text.matchAll(/\[\[(.+?)\]\]/g)) {
    // [[label->Target]], [[Target<-label]], [[Target]]
    refs.push(inner.includes('->') ? inner.split('->').pop() : inner.includes('<-') ? inner.split('<-')[0] : inner);
  }
  for (const [, target] of text.matchAll(/\((?:display|goto):\s*"([^"]+)"\)/g)) refs.push(target);
  for (const [, target] of text.matchAll(/\(link-goto:\s*"[^"]*",\s*"([^"]+)"\)/g)) refs.push(target);
  // ($useOn: "target", (dm: "item", "Passage", ...), ...): every second string is a passage.
  for (const [, pairs] of text.matchAll(/\(\$useOn:\s*"[^"]*",\s*\(dm:([^)]*)\)/g)) {
    const strings = [...pairs.matchAll(/"([^"]*)"/g)].map((s) => s[1]);
    refs.push(...strings.filter((_, i) => i % 2 === 1));
  }
  return refs.map((r) => r.trim());
}

test('every passage reference resolves', () => {
  const broken = [];
  for (const [name, { text }] of passages) {
    for (const ref of references(text)) if (!passages.has(ref)) broken.push(`${name} -> ${ref}`);
  }
  expect(broken).toEqual([]);
});

test('every item has a description passage and a valid starting location', () => {
  const startup = passages.get('Startup').text;
  const where = startup.match(/\(set: \$where to \(dm:([\s\S]*?)\)\)/)[1];
  const strings = [...where.matchAll(/"([^"]*)"/g)].map((s) => s[1]);
  expect(strings.length % 2).toBe(0);

  const problems = [];
  for (let i = 0; i < strings.length; i += 2) {
    const [id, loc] = [strings[i], strings[i + 1]];
    const desc = passages.get(`${id}-item`);
    if (!desc) problems.push(`${id}: missing passage "${id}-item"`);
    else if (!desc.tags.includes('item')) problems.push(`${id}: "${id}-item" is not tagged "item"`);
    if (loc !== 'player' && loc !== 'gone' && !passages.has(loc)) problems.push(`${id}: location "${loc}" is not a passage`);
  }
  expect(problems).toEqual([]);
});

test('$useOn outcome passages are tagged "use"', () => {
  const untagged = [];
  for (const [name, { text }] of passages) {
    for (const [, pairs] of text.matchAll(/\(\$useOn:\s*"[^"]*",\s*\(dm:([^)]*)\)/g)) {
      const strings = [...pairs.matchAll(/"([^"]*)"/g)].map((s) => s[1]);
      for (const target of strings.filter((_, i) => i % 2 === 1)) {
        if (name.startsWith('Fixture-')) continue;
        if (!passages.get(target)?.tags.includes('use')) untagged.push(`${name} -> ${target}`);
      }
    }
  }
  expect(untagged).toEqual([]);
});
