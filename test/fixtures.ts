import type {StaticSource, VirtualFile} from 'fumadocs-core/source';

export const page = (path: string, title = path): VirtualFile => ({
  type: 'page',
  path,
  data: {title, structuredData: {headings: [], contents: [{heading: undefined, content: `${title} body`}]}},
});
export const meta = (path: string, data: Record<string, unknown> = {}): VirtualFile => ({type: 'meta', path, data});
export const source = (...files: VirtualFile[]): StaticSource => ({files});

export const current = () =>
  source(page('index.mdx', 'Home'), page('guide/install.mdx', 'Install'), meta('guide/meta.json', {title: 'Guide'}), page('new-feature.mdx', 'New'), meta('meta.json', {pages: ['index', 'guide', 'new-feature']}));

export const versioned = () =>
  source(
    page('version-1.0/index.mdx', 'Home'),
    page('version-1.0/guide/install.mdx', 'Install'),
    meta('version-1.0/guide/meta.json', {title: 'Guide'}),
    page('version-0.9/index.mdx', 'Home'),
    page('version-0.9/old.mdx', 'Old'),
    page('version-0.8/gone.mdx', 'Not listed'),
  );
