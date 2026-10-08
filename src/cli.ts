#!/usr/bin/env node
// Docusaurus' `docs:version` for Fumadocs: snapshots the current docs into
// versioned_docs/version-<name>/ and records the version in versions.json.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {parseArgs} from 'node:util';
import {CURRENT} from './versions.js';

const USAGE = `usage: fumadocs-versioning <command> [options]

commands:
  version <name>   snapshot the current docs as <name> and add it to versions.json
  remove <name>    delete the snapshot <name> and drop it from versions.json
  list             print the versions in versions.json, newest first

options:
  --cwd <dir>             project directory (default: the working directory)
  --content <dir>         the current docs (default: content/docs)
  --versioned-dir <dir>   the snapshots (default: versioned_docs)
  --versions-file <file>  the version list (default: versions.json)
  --exclude <path>        a path under the current docs to leave out of a snapshot; repeatable
  -h, --help              show this help

Defaults can also be set in fumadocs-versioning.json in the project directory,
with the keys content, versionedDir, versionsFile and exclude.`;

const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export interface CliConfig {
  content: string;
  versionedDir: string;
  versionsFile: string;
  exclude: string[];
}

class UsageError extends Error {}

function loadConfig(cwd: string, flags: Partial<CliConfig>): CliConfig {
  const file = path.join(cwd, 'fumadocs-versioning.json');
  const fromFile: Partial<CliConfig> = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const pick = <K extends keyof CliConfig>(key: K, fallback: CliConfig[K]): CliConfig[K] => flags[key] ?? fromFile[key] ?? fallback;
  return {
    content: path.resolve(cwd, pick('content', 'content/docs')),
    versionedDir: path.resolve(cwd, pick('versionedDir', 'versioned_docs')),
    versionsFile: path.resolve(cwd, pick('versionsFile', 'versions.json')),
    exclude: pick('exclude', []),
  };
}

function readVersions(file: string): string[] {
  if (!fs.existsSync(file)) return [];
  const versions: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(versions) || !versions.every((v) => typeof v === 'string')) {
    throw new Error(`${file} must be a JSON array of version names`);
  }
  return versions;
}

function writeVersions(file: string, versions: string[]) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, `${JSON.stringify(versions, null, 2)}\n`);
}

function checkName(name: string | undefined): string {
  if (!name) throw new UsageError('a version name is required');
  if (!NAME.test(name)) throw new UsageError(`invalid version name ${JSON.stringify(name)}: use letters, digits, dots, dashes and underscores`);
  if (name === CURRENT) throw new UsageError(`"${CURRENT}" is reserved for the current docs`);
  return name;
}

export function createVersion(config: CliConfig, name: string, log: (line: string) => void = console.log) {
  const versions = readVersions(config.versionsFile);
  if (versions.includes(name)) throw new Error(`version ${name} already exists in ${config.versionsFile}`);
  if (!fs.existsSync(config.content) || !fs.statSync(config.content).isDirectory()) {
    throw new Error(`the current docs ${config.content} do not exist`);
  }
  const target = path.join(config.versionedDir, `version-${name}`);
  if (fs.existsSync(target)) throw new Error(`${target} already exists; remove it or pick another name`);

  const excluded = config.exclude.map((entry) => path.resolve(config.content, entry));
  fs.mkdirSync(config.versionedDir, {recursive: true});
  fs.cpSync(config.content, target, {
    recursive: true,
    filter: (src) => !excluded.some((entry) => src === entry || src.startsWith(entry + path.sep)),
  });
  writeVersions(config.versionsFile, [name, ...versions]);
  log(`fumadocs-versioning: snapshot ${name} written to ${path.relative(process.cwd(), target) || target}`);
}

export function removeVersion(config: CliConfig, name: string, log: (line: string) => void = console.log) {
  const versions = readVersions(config.versionsFile);
  if (!versions.includes(name)) throw new Error(`version ${name} is not in ${config.versionsFile}`);
  fs.rmSync(path.join(config.versionedDir, `version-${name}`), {recursive: true, force: true});
  writeVersions(config.versionsFile, versions.filter((v) => v !== name));
  log(`fumadocs-versioning: version ${name} removed`);
}

export function main(argv: string[]): number {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        cwd: {type: 'string'},
        content: {type: 'string'},
        'versioned-dir': {type: 'string'},
        'versions-file': {type: 'string'},
        exclude: {type: 'string', multiple: true},
        help: {type: 'boolean', short: 'h'},
      },
    });
  } catch (error) {
    console.error(`fumadocs-versioning: ${(error as Error).message}\n\n${USAGE}`);
    return 2;
  }
  const {values, positionals} = parsed;
  const [command, name, ...extra] = positionals;
  if (values.help || !command) {
    console.log(USAGE);
    return values.help ? 0 : 2;
  }

  try {
    if (extra.length > 0) throw new UsageError(`unexpected arguments: ${extra.join(' ')}`);
    const config = loadConfig(path.resolve(values.cwd ?? '.'), {
      content: values.content,
      versionedDir: values['versioned-dir'],
      versionsFile: values['versions-file'],
      exclude: values.exclude,
    });
    switch (command) {
      case 'version':
        createVersion(config, checkName(name));
        return 0;
      case 'remove':
        removeVersion(config, checkName(name));
        return 0;
      case 'list':
        if (name) throw new UsageError('list takes no argument');
        for (const version of readVersions(config.versionsFile)) console.log(version);
        return 0;
      default:
        throw new UsageError(`unknown command ${command}`);
    }
  } catch (error) {
    console.error(`fumadocs-versioning: ${(error as Error).message}`);
    if (error instanceof UsageError) {
      console.error(`\n${USAGE}`);
      return 2;
    }
    return 1;
  }
}

const invoked = process.argv[1] && fs.realpathSync(process.argv[1]);
if (invoked && invoked === fs.realpathSync(new URL(import.meta.url))) process.exitCode = main(process.argv.slice(2));
