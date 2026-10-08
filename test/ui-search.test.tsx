import {loader} from 'fumadocs-core/source';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import {versionedBuildIndex} from '../src/search.js';
import {versionedSource} from '../src/source.js';
import {VersionBanner} from '../src/ui.js';
import {current, versioned} from './fixtures.js';

const {source, config} = versionedSource({current: current(), versioned: versioned(), versions: ['1.0', '0.9']});
const docs = loader({source, baseUrl: '/docs'});
const byPath = (path: string) => docs.getPages().find((p) => p.path === path)!;

describe('VersionBanner', () => {
  const banner = (path: string) => renderToStaticMarkup(<VersionBanner source={docs} config={config} page={byPath(path)} siteName="Acme" />);

  it('marks the current docs as unreleased and links the same page in the last version', () => {
    const html = banner('current/guide/install.mdx');
    expect(html).toContain('unreleased documentation for Acme Next');
    expect(html).toContain('href="/docs/guide/install"');
    expect(html).toContain('latest version (1.0)');
  });

  it('marks older versions as unmaintained', () => {
    expect(banner('0.9/old.mdx')).toContain('Acme 0.9, which is no longer actively maintained');
  });

  it('renders nothing on the last version', () => {
    expect(banner('1.0/index.mdx')).toBe('');
  });

  it('accepts a custom render', () => {
    const html = renderToStaticMarkup(
      <VersionBanner source={docs} config={config} page={byPath('0.9/old.mdx')} render={({version, latest}) => <p>{`${version.name}->${latest.url}`}</p>} />,
    );
    expect(html).toBe('<p>0.9-&gt;/docs</p>');
  });
});

describe('versionedBuildIndex', () => {
  it('tags each page with its version', async () => {
    const build = versionedBuildIndex(config);
    const index = await build(byPath('current/guide/install.mdx') as never);
    expect(index).toMatchObject({id: '/docs/next/guide/install', url: '/docs/next/guide/install', title: 'Install', tag: 'current'});
    expect((await build(byPath('0.9/old.mdx') as never)).tag).toBe('0.9');
  });
});
