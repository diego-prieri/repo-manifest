import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import ts from 'typescript';
import type { ManifestConfig } from './config.js';

export type SymbolKind = 'component' | 'hook' | 'function' | 'class' | 'type' | 'interface' | 'enum' | 'const';

export interface ExportedSymbol {
  name: string;
  kind: SymbolKind;
  /** Compact signature: params for functions, member names for interfaces. */
  detail?: string;
}

export interface SourceFile {
  path: string;
  exports: ExportedSymbol[];
}

export interface PackageInfo {
  name?: string;
  scripts: Record<string, string>;
  dependencies: string[];
  devDependencies: string[];
}

export interface RepoScan {
  root: string;
  pkg?: PackageInfo;
  pathAliases: Record<string, string[]>;
  files: SourceFile[];
}

export function walk(dir: string, config: ManifestConfig, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (config.exclude.includes(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, config, out);
    else if (config.extensions.includes(extname(entry)) && !/\.(test|spec|stories|d)\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

function hasExportModifier(node: ts.Node): boolean {
  return ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

function paramList(params: ts.NodeArray<ts.ParameterDeclaration>, sf: ts.SourceFile): string {
  return params.map((p) => p.name.getText(sf)).join(', ');
}

/** React heuristics: PascalCase functions in .tsx are components, useX are hooks. */
function classifyFunction(name: string, isTsx: boolean): SymbolKind {
  if (/^use[A-Z]/.test(name)) return 'hook';
  if (isTsx && /^[A-Z]/.test(name)) return 'component';
  return 'function';
}

export function extractExports(code: string, fileName: string): ExportedSymbol[] {
  const isTsx = fileName.endsWith('.tsx');
  const sf = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true, isTsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const symbols: ExportedSymbol[] = [];

  for (const node of sf.statements) {
    if (ts.isFunctionDeclaration(node) && hasExportModifier(node)) {
      const name = node.name?.text ?? 'default';
      symbols.push({ name, kind: classifyFunction(name, isTsx), detail: `(${paramList(node.parameters, sf)})` });
    } else if (ts.isClassDeclaration(node) && hasExportModifier(node)) {
      symbols.push({ name: node.name?.text ?? 'default', kind: 'class' });
    } else if (ts.isInterfaceDeclaration(node) && hasExportModifier(node)) {
      const members = node.members.map((m) => m.name?.getText(sf)).filter(Boolean);
      symbols.push({ name: node.name.text, kind: 'interface', detail: `{ ${members.join(', ')} }` });
    } else if (ts.isTypeAliasDeclaration(node) && hasExportModifier(node)) {
      symbols.push({ name: node.name.text, kind: 'type' });
    } else if (ts.isEnumDeclaration(node) && hasExportModifier(node)) {
      symbols.push({ name: node.name.text, kind: 'enum' });
    } else if (ts.isVariableStatement(node) && hasExportModifier(node)) {
      for (const decl of node.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue;
        const name = decl.name.text;
        const init = decl.initializer;
        if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
          symbols.push({ name, kind: classifyFunction(name, isTsx), detail: `(${paramList(init.parameters, sf)})` });
        } else {
          symbols.push({ name, kind: 'const' });
        }
      }
    } else if (ts.isExportAssignment(node) && ts.isIdentifier(node.expression)) {
      const target = symbols.find((s) => s.name === (node.expression as ts.Identifier).text);
      if (target) target.name = `${target.name} (default)`;
    }
  }
  return symbols;
}

function readJson(path: string): any {
  if (!existsSync(path)) return undefined;
  // tsconfig allows comments and trailing commas; the TS parser handles both.
  const { config, error } = ts.parseConfigFileTextToJson(path, readFileSync(path, 'utf8'));
  return error ? undefined : config;
}

export function scanRepo(root: string, config: ManifestConfig): RepoScan {
  const pkgJson = readJson(join(root, 'package.json'));
  const pkg: PackageInfo | undefined = pkgJson && {
    name: pkgJson.name,
    scripts: pkgJson.scripts ?? {},
    dependencies: Object.keys(pkgJson.dependencies ?? {}),
    devDependencies: Object.keys(pkgJson.devDependencies ?? {}),
  };

  const tsconfig = readJson(join(root, 'tsconfig.json'));
  const pathAliases: Record<string, string[]> = tsconfig?.compilerOptions?.paths ?? {};

  const files: SourceFile[] = [];
  for (const dir of config.include) {
    const abs = join(root, dir);
    if (!existsSync(abs) || !statSync(abs).isDirectory()) continue;
    for (const file of walk(abs, config)) {
      const exports = extractExports(readFileSync(file, 'utf8'), file);
      if (exports.length) files.push({ path: relative(root, file).split(sep).join('/'), exports });
    }
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { root, pkg, pathAliases, files };
}
