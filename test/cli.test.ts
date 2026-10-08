import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {createVersion, removeVersion, type CliConfig} from '../src/cli.js';

let dir: string;
let config: CliConfig;
const quiet = () => {};

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fumadocs-versioning-'));
  fs.mkdirSync(path.join(dir, 'content/docs/reference/api'), {recursive: true});
  fs.writeFileSync(path.join(dir, 'content/docs/index.mdx'), '# Home\n');
  fs.writeFileSync(path.join(dir, 'content/docs/meta.json'), '{"pages":["index"]}\n');
  fs.writeFileSync(path.join(dir, 'content/docs/reference/api/generated.mdx'), '# Generated\n');
  config = {
    content: path.join(dir, 'content/docs'),
    versionedDir: path.join(dir, 'versioned_docs'),
    versionsFile: path.join(dir, 'versions.json'),
    exclude: [],
  };
});
afterEach(() => fs.rmSync(dir, {recursive: true, force: true}));

const versions = () => JSON.parse(fs.readFileSync(config.versionsFile, 'utf8'));

describe('createVersion', () => {
  it('copies the current docs and prepends the version', () => {
    createVersion(config, '1.0', quiet);
    createVersion(config, '2.0', quiet);
    expect(versions()).toEqual(['2.0', '1.0']);
    expect(fs.readFileSync(path.join(dir, 'versioned_docs/version-2.0/index.mdx'), 'utf8')).toBe('# Home\n');
    expect(fs.existsSync(path.join(dir, 'versioned_docs/version-1.0/meta.json'))).toBe(true);
  });

  it('leaves excluded paths out of the snapshot', () => {
    createVersion({...config, exclude: ['reference/api']}, '1.0', quiet);
    expect(fs.existsSync(path.join(dir, 'versioned_docs/version-1.0/reference'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'versioned_docs/version-1.0/reference/api'))).toBe(false);
  });

  it('refuses an existing version or snapshot', () => {
    createVersion(config, '1.0', quiet);
    expect(() => createVersion(config, '1.0', quiet)).toThrow(/already exists in/);
    fs.mkdirSync(path.join(dir, 'versioned_docs/version-3.0'));
    expect(() => createVersion(config, '3.0', quiet)).toThrow(/version-3.0 already exists/);
  });
});

describe('removeVersion', () => {
  it('deletes the snapshot and the entry', () => {
    createVersion(config, '1.0', quiet);
    createVersion(config, '2.0', quiet);
    removeVersion(config, '1.0', quiet);
    expect(versions()).toEqual(['2.0']);
    expect(fs.existsSync(path.join(dir, 'versioned_docs/version-1.0'))).toBe(false);
    expect(() => removeVersion(config, '1.0', quiet)).toThrow(/not in/);
  });
});

describe('the built command', () => {
  const cli = path.resolve('dist/cli.js');
  const run = (...args: string[]) => spawnSync(process.execPath, [cli, ...args], {cwd: dir, encoding: 'utf8'});

  it.runIf(fs.existsSync(cli))('runs from the project directory with fumadocs-versioning.json defaults', () => {
    fs.writeFileSync(path.join(dir, 'fumadocs-versioning.json'), JSON.stringify({exclude: ['reference/api']}));
    expect(run('version', '1.0').status).toBe(0);
    expect(fs.existsSync(path.join(dir, 'versioned_docs/version-1.0/reference/api'))).toBe(false);
    expect(run('list').stdout).toBe('1.0\n');
    const bad = run('version', 'current');
    expect(bad.status).toBe(2);
    expect(bad.stderr).toMatch(/reserved/);
    expect(run('frobnicate').status).toBe(2);
  });
});
