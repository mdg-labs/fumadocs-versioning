import {loader} from 'fumadocs-core/source';
import {findProjection, type Folder} from 'fumadocs-core/page-tree';
import {describe, expect, it} from 'vitest';
import {getLastVersionAlternate, getPageVersion, getVersionAlternates, getVersionMetadata, getVersionRelativePath, versionedSource} from '../src/source.js';
import {resolveVersions} from '../src/versions.js';
import {current, meta, page, source, versioned} from './fixtures.js';

function load(versions: string[], extra = {}) {
  const {source: combined, config} = versionedSource({current: current(), versioned: versioned(), versions, ...extra});
  return {config, docs: loader({source: combined, baseUrl: '/docs'})};
}

describe('versionedSource', () => {
  it('serves the last version at the base URL and the others below their path', () => {
    const {docs} = load(['1.0', '0.9']);
    const urls = Object.fromEntries(docs.getPages().map((p) => [p.path, p.url]));
    expect(urls).toEqual({
      'current/index.mdx': '/docs/next',
      'current/guide/install.mdx': '/docs/next/guide/install',
      'current/new-feature.mdx': '/docs/next/new-feature',
      '1.0/index.mdx': '/docs',
      '1.0/guide/install.mdx': '/docs/guide/install',
      '0.9/index.mdx': '/docs/0.9',
      '0.9/old.mdx': '/docs/0.9/old',
    });
    expect(docs.getPage([])?.path).toBe('1.0/index.mdx');
    expect(docs.getPage(['next', 'guide', 'install'])?.path).toBe('current/guide/install.mdx');
    expect(docs.generateParams()).toHaveLength(7);
  });

  it('ignores snapshots that versions.json does not list', () => {
    const {docs} = load(['1.0', '0.9']);
    expect(docs.getPages().some((p) => p.path.includes('gone'))).toBe(false);
  });

  it('makes each version a root folder of one type, in dropdown order', () => {
    const {docs} = load(['1.0', '0.9']);
    const roots = docs.getPageTree().children as Folder[];
    expect(roots.map((f) => [f.type, f.name, f.root])).toEqual([
      ['folder', 'Next', 'version'],
      ['folder', '1.0', 'version'],
      ['folder', '0.9', 'version'],
    ]);
    // The user's own meta.json of the current docs is kept, with the version's root and title.
    expect(roots[0]!.children.map((n) => n.name)).toEqual(['Home', 'Guide', 'New']);
  });

  it("lets Fumadocs UI's dropdown keep the page when switching versions", () => {
    const {docs} = load(['1.0', '0.9']);
    const [next, v1, v09] = docs.getPageTree().children as Folder[];
    const install = (next!.children.find((n) => n.type === 'folder') as Folder).children[0]!;
    expect(install.type).toBe('page');
    expect(findProjection(next!, v1!, install as never)?.url).toBe('/docs/guide/install');
    expect(findProjection(next!, v09!, install as never)).toBeUndefined();
  });

  it('serves the current docs at the base URL while there is no version', () => {
    const {source: combined, config} = versionedSource({current: current(), versions: []});
    const docs = loader({source: combined, baseUrl: '/docs'});
    expect(config.lastVersion).toBe('current');
    expect(docs.getPages().map((p) => p.url).sort()).toEqual(['/docs', '/docs/guide/install', '/docs/new-feature']);
  });

  it('refuses a listed version without a snapshot', () => {
    expect(() => versionedSource({current: current(), versioned: versioned(), versions: ['2.0', '1.0']})).toThrow(/lists 2.0, but version-2.0\/ has no page/);
    expect(() => versionedSource({current: current(), versions: ['1.0']})).toThrow(/lists 1.0/);
  });

  it('refuses a page of the last version that would shadow another version', () => {
    const snapshots = source(page('version-1.0/index.mdx'), page('version-1.0/next/thing.mdx'));
    expect(() => versionedSource({current: current(), versioned: snapshots, versions: ['1.0']})).toThrow(/would be served at the path of version current/);
  });

  it('keeps the slugs a source sets, below the version path', () => {
    const custom = source({type: 'page', path: 'intro.mdx', slugs: ['start'], data: {title: 'Intro'}}, meta('meta.json'));
    const {source: combined} = versionedSource({current: custom, versioned: source(page('version-1.0/intro.mdx')), versions: ['1.0']});
    const docs = loader({source: combined, baseUrl: '/docs'});
    expect(docs.getPages().map((p) => p.url).sort()).toEqual(['/docs/intro', '/docs/next/start']);
  });

  it('runs the configureStatic hooks of both sources', () => {
    const calls: string[] = [];
    const a = {...current(), configureStatic: () => void calls.push('current')};
    const b = {...versioned(), configureStatic: () => void calls.push('versioned')};
    const {source: combined} = versionedSource({current: a, versioned: b, versions: ['1.0', '0.9']});
    loader({source: combined, baseUrl: '/docs'});
    expect(calls).toEqual(['current', 'versioned']);
  });
});

describe('page helpers', () => {
  const {docs, config} = load(['1.0', '0.9'], {versionOptions: {current: {noIndex: true}}});
  const byPath = (path: string) => docs.getPages().find((p) => p.path === path)!;

  it('finds the version and relative path of a page', () => {
    expect(getPageVersion(config, byPath('0.9/old.mdx')).name).toBe('0.9');
    expect(getVersionRelativePath(byPath('current/guide/install.mdx'))).toBe('guide/install.mdx');
  });

  it('lists the same page in every version, falling back to the entry page', () => {
    expect(getVersionAlternates(docs, config, byPath('current/guide/install.mdx')).map((a) => [a.version.name, a.url, a.exact])).toEqual([
      ['current', '/docs/next/guide/install', true],
      ['1.0', '/docs/guide/install', true],
      ['0.9', '/docs/0.9', false],
    ]);
    expect(getLastVersionAlternate(docs, config, byPath('0.9/old.mdx'))).toMatchObject({url: '/docs', exact: false});
  });

  it('asks search engines to skip a noIndex version', () => {
    expect(getVersionMetadata(config, byPath('current/index.mdx'))).toEqual({robots: {index: false, follow: true}});
    expect(getVersionMetadata(config, byPath('1.0/index.mdx'))).toEqual({});
  });
});

describe('a resolved config', () => {
  it('can be passed instead of the options', () => {
    const config = resolveVersions({versions: ['1.0', '0.9'], versionOptions: {current: {label: 'Main'}}});
    const result = versionedSource({current: current(), versioned: versioned(), config});
    expect(result.config).toBe(config);
    expect((loader({source: result.source, baseUrl: '/docs'}).getPageTree().children[0] as Folder).name).toBe('Main');
  });
});
