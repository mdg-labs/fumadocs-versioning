import {describe, expect, it} from 'vitest';
import {getVersionFromPathname, resolveVersions} from '../src/versions.js';

describe('resolveVersions', () => {
  it('serves the current docs at the base URL while there is no version', () => {
    expect(resolveVersions({versions: []})).toEqual({
      lastVersion: 'current',
      versions: [{name: 'current', label: 'Next', path: '', isLast: true, isCurrent: true, banner: 'none', noIndex: false}],
    });
  });

  it('follows the Docusaurus layout once versions exist', () => {
    const {versions, lastVersion} = resolveVersions({versions: ['2.0', '1.0']});
    expect(lastVersion).toBe('2.0');
    expect(versions.map((v) => [v.name, v.label, v.path, v.banner])).toEqual([
      ['current', 'Next', 'next', 'unreleased'],
      ['2.0', '2.0', '', 'none'],
      ['1.0', '1.0', '1.0', 'unmaintained'],
    ]);
  });

  it('marks versions newer than an explicit lastVersion as unreleased', () => {
    const {versions} = resolveVersions({versions: ['3.0-beta', '2.0', '1.0'], lastVersion: '2.0'});
    expect(versions.map((v) => [v.name, v.path, v.banner])).toEqual([
      ['current', 'next', 'unreleased'],
      ['3.0-beta', '3.0-beta', 'unreleased'],
      ['2.0', '', 'none'],
      ['1.0', '1.0', 'unmaintained'],
    ]);
  });

  it('applies per-version options', () => {
    const {versions} = resolveVersions({
      versions: ['1.0'],
      versionOptions: {current: {label: 'Main', path: 'main', noIndex: true}, '1.0': {banner: 'unmaintained'}},
    });
    expect(versions[0]).toMatchObject({name: 'current', label: 'Main', path: 'main', noIndex: true});
    expect(versions[1]).toMatchObject({name: '1.0', banner: 'unmaintained'});
  });

  it('can leave out the current docs and unlisted versions', () => {
    expect(resolveVersions({versions: ['2.0', '1.0'], includeCurrentVersion: false}).versions.map((v) => v.name)).toEqual(['2.0', '1.0']);
    expect(resolveVersions({versions: ['2.0', '1.0'], onlyIncludeVersions: ['current', '2.0']}).versions.map((v) => v.name)).toEqual(['current', '2.0']);
  });

  it('rejects invalid layouts', () => {
    expect(() => resolveVersions({versions: ['1.0', '1.0']})).toThrow(/listed twice/);
    expect(() => resolveVersions({versions: ['current']})).toThrow(/reserved/);
    expect(() => resolveVersions({versions: ['../x']})).toThrow(/invalid version name/);
    expect(() => resolveVersions({versions: ['1.0'], lastVersion: '9.9'})).toThrow(/not a built version/);
    expect(() => resolveVersions({versions: ['1.0'], onlyIncludeVersions: ['current']})).toThrow(/must include the last version/);
    expect(() => resolveVersions({versions: ['1.0'], versionOptions: {'1.0': {path: 'next'}}})).toThrow(/share the path/);
    expect(() => resolveVersions({versions: [], includeCurrentVersion: false})).toThrow(/no version/);
  });
});

describe('getVersionFromPathname', () => {
  const config = resolveVersions({versions: ['2.0', '1.0']});
  it.each([
    ['/docs', '2.0'],
    ['/docs/guide/install', '2.0'],
    ['/docs/next', 'current'],
    ['/docs/next/guide/', 'current'],
    ['/docs/1.0/old', '1.0'],
    ['/docs/1.0x', '2.0'],
  ])('%s is in %s', (pathname, name) => {
    expect(getVersionFromPathname(config, '/docs', pathname)?.name).toBe(name);
  });
  it('is undefined outside the docs', () => {
    expect(getVersionFromPathname(config, '/docs', '/blog')).toBeUndefined();
    expect(getVersionFromPathname(config, '/docs', '/docsx')).toBeUndefined();
  });
});
