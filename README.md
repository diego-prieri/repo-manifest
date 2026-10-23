# repo-manifest

Generate a compact, accurate map of a TypeScript codebase for AI coding agents.

Agents working in a large codebase fail in predictable ways: they invent helpers that already exist, import from paths that don't resolve, and guess the shape of interfaces. Dumping the whole repo into the context is expensive and noisy. `repo-manifest` sits in between: it parses the code with the TypeScript compiler API and emits a short Markdown file listing what actually exists — components, hooks, functions, types and their signatures — plus the stack, scripts, import aliases and your team's conventions.

Load it into the agent's context (for example from `CLAUDE.md` or a system prompt) and the agent starts from facts instead of guesses. Because the file only changes when the code changes, it is also a good fit for **prompt caching**: it sits in the stable prefix of the prompt, so you pay full price for it once and cheap cache reads after that.

## Example output

```markdown
## Exports

3 files · 1 component · 1 hook · 1 function · 1 class · 1 interface · 1 type · 1 enum · 1 const

### `src/components/`
- `InvoiceTable.tsx` — component: `InvoiceTable({ rows, onSelect })` · interface: `InvoiceTableProps { rows, onSelect }`

### `src/hooks/`
- `useInvoices.ts` — hook: `useInvoices(customerId, page)`
```

On a real ~120k-line Next.js app, the manifest for ~200 files comes out at about 7k tokens.

## Usage

```bash
npx tsx src/cli.ts path/to/repo                    # print to stdout
npx tsx src/cli.ts path/to/repo --out MANIFEST.md  # write a file
npx tsx src/cli.ts path/to/repo --json             # raw scan, for your own tooling
```

After `npm run build`, the same commands work as `repo-manifest …`.

Regenerate it in CI or in a pre-commit hook so it never drifts from the code.

## Configuration

Optional `repo-manifest.config.json` at the repo root:

```json
{
  "include": ["src", "app", "lib"],
  "exclude": ["node_modules", "dist", "__tests__"],
  "extensions": [".ts", ".tsx"],
  "maxExportsPerDir": 40,
  "notes": ["CONVENTIONS.md"]
}
```

| Key | Purpose |
|---|---|
| `include` | Directories whose exports are indexed. |
| `exclude` | Path segments never walked. Test, story and `.d.ts` files are always skipped. |
| `maxExportsPerDir` | Keeps the manifest small in large directories; the rest is summarized as "…N more". |
| `notes` | Markdown files appended verbatim: conventions, gotchas, decisions the code can't express. |

## How it classifies symbols

- `useX` functions → **hook**
- PascalCase functions in `.tsx` files → **component**
- Everything else keeps its TypeScript kind: function, class, interface (with member names), type, enum, const.

## Development

```bash
npm install
npm test        # node:test via tsx
npm run typecheck
npm run build
```

## License

MIT
