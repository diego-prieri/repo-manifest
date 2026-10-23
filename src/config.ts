import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface ManifestConfig {
  /** Directories (relative to root) whose exports are indexed. */
  include: string[];
  /** Path segments that are never walked. */
  exclude: string[];
  /** File extensions treated as source. */
  extensions: string[];
  /** Cap on symbols listed per directory, so the manifest stays small. */
  maxExportsPerDir: number;
  /** Markdown files appended verbatim (team conventions, gotchas). */
  notes: string[];
}

export const DEFAULT_CONFIG: ManifestConfig = {
  include: ['src', 'app', 'pages', 'components', 'lib', 'hooks', 'api'],
  exclude: ['node_modules', 'dist', 'build', '.next', 'coverage', '.git', '__tests__', '__mocks__'],
  extensions: ['.ts', '.tsx'],
  maxExportsPerDir: 40,
  notes: [],
};

export const CONFIG_FILE = 'repo-manifest.config.json';

export function loadConfig(root: string): ManifestConfig {
  const path = join(root, CONFIG_FILE);
  if (!existsSync(path)) return DEFAULT_CONFIG;
  const user = JSON.parse(readFileSync(path, 'utf8')) as Partial<ManifestConfig>;
  return { ...DEFAULT_CONFIG, ...user };
}
