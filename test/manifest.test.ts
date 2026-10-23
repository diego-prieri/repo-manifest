import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { DEFAULT_CONFIG, extractExports, loadConfig, renderMarkdown, scanRepo } from '../src/index.js';

const FIXTURE = join(import.meta.dirname, 'fixtures', 'sample-app');

test('classifies components, hooks and plain functions', () => {
  const code = `
    export function OrderCard(props: unknown) { return null }
    export const useOrders = (id: string) => id
    export function formatTotal(amount: number, currency: string) { return '' }
  `;
  assert.deepEqual(extractExports(code, 'x.tsx'), [
    { name: 'OrderCard', kind: 'component', detail: '(props)' },
    { name: 'useOrders', kind: 'hook', detail: '(id)' },
    { name: 'formatTotal', kind: 'function', detail: '(amount, currency)' },
  ]);
});

test('PascalCase functions in .ts files are not components', () => {
  assert.equal(extractExports('export function Build() {}', 'x.ts')[0].kind, 'function');
});

test('lists interface members and ignores non-exported symbols', () => {
  const symbols = extractExports('interface Hidden {}\nexport interface Row { id: string; total: number }', 'x.ts');
  assert.deepEqual(symbols, [{ name: 'Row', kind: 'interface', detail: '{ id, total }' }]);
});

test('marks the default export when it points to an exported symbol', () => {
  const symbols = extractExports('export const Page = () => null\nexport default Page', 'x.tsx');
  assert.equal(symbols[0].name, 'Page (default)');
});

test('scans the fixture repo, skipping test files', () => {
  const scan = scanRepo(FIXTURE, loadConfig(FIXTURE));
  assert.deepEqual(scan.files.map((f) => f.path), [
    'src/api/invoices.ts',
    'src/components/InvoiceTable.tsx',
    'src/hooks/useInvoices.ts',
  ]);
  assert.deepEqual(scan.pathAliases, { '@/*': ['./src/*'] });
  assert.deepEqual(scan.pkg?.dependencies, ['next', 'react']);
});

test('renders a markdown manifest with stack, aliases, exports and notes', () => {
  const config = loadConfig(FIXTURE);
  const md = renderMarkdown(scanRepo(FIXTURE, config), config);
  assert.match(md, /^# Repo manifest: sample-app/);
  assert.match(md, /`@\/\*` → `\.\/src\/\*`/);
  assert.match(md, /`useInvoices\(customerId, page\)`/);
  assert.match(md, /component: `InvoiceTable\(\{ rows, onSelect \}\)`/);
  assert.match(md, /## Notes: CONVENTIONS\.md/);
  assert.doesNotMatch(md, /shouldBeIgnored/);
});

test('caps exports per directory', () => {
  const config = { ...loadConfig(FIXTURE), maxExportsPerDir: 2 };
  const md = renderMarkdown(scanRepo(FIXTURE, config), config);
  assert.match(md, /…3 more exports omitted/);
});

test('falls back to defaults without a config file', () => {
  assert.equal(loadConfig(join(FIXTURE, 'src')), DEFAULT_CONFIG);
});
