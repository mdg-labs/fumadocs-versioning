import {getSlugs, type LoaderOutput, type StaticSource, type VirtualFile} from 'fumadocs-core/source';
import {findVersion, getLastVersion, resolveVersions, type VersioningOptions, type VersionInfo, type VersionsConfig} from './versions.js';

interface SourceInputs<S extends StaticSource> {
  /** The current docs (the `content/docs` collection). */
  current: S;
  /**
   * The snapshots (the `versioned_docs` collection), one `version-<name>/`
   * folder per entry of `versions.json`. May be left out while there is none.
   */
  versioned?: S;
  /**
   * The `root` type given to each version's folder. Fumadocs UI shows the
   * root folders of one type as a dropdown. Default: `version`.
   */
  rootType?: string;
}

/**
 * The sources, plus either the versioning options or a config already made by
 * `resolveVersions()` (handy when client components need the same config).
 */
export type VersionedSourceOptions<S extends StaticSource> = SourceInputs<S> & (VersioningOptions | {config: VersionsConfig});

export interface VersionedSource<S extends StaticSource> {
  /** One source holding every built version, to pass to Fumadocs' `loader()`. */
  source: S;
  config: VersionsConfig;
}

const ROOT_META = /^meta\.[A-Za-z]+$/;
const SNAPSHOT_PREFIX = 'version-';

/**
 * Combines the current docs and the snapshots into one Fumadocs source. Each
 * version becomes a root folder named after it, so search, `llms.txt`, OG
 * images and the version dropdown all come from one `loader()`. The last
 * version is served at the base URL, the others below their path.
 */
export function versionedSource<S extends StaticSource>(options: VersionedSourceOptions<S>): VersionedSource<S> {
  const config = 'config' in options ? options.config : resolveVersions(options);
  const rootType = options.rootType ?? 'version';

  const byVersion = new Map<string, VirtualFile[]>();
  const add = (name: string, file: VirtualFile) => {
    const list = byVersion.get(name);
    if (list) list.push(file);
    else byVersion.set(name, [file]);
  };

  if (config.versions.some((version) => version.isCurrent)) {
    for (const file of options.current.files) add('current', file);
  }
  for (const file of options.versioned?.files ?? []) {
    const slash = file.path.indexOf('/');
    const dir = slash === -1 ? '' : file.path.slice(0, slash);
    if (!dir.startsWith(SNAPSHOT_PREFIX)) continue;
    const name = dir.slice(SNAPSHOT_PREFIX.length);
    if (!findVersion(config, name) || name === 'current') continue;
    add(name, {...file, path: file.path.slice(slash + 1)});
  }

  const reserved = new Map(config.versions.filter((version) => version.path !== '').map((version) => [version.path, version.name]));
  const files: VirtualFile[] = [];
  for (const version of config.versions) {
    const own = byVersion.get(version.name) ?? [];
    if (!own.some((file) => file.type === 'page')) {
      throw new Error(
        version.isCurrent
          ? 'fumadocs-versioning: the current docs have no page'
          : `fumadocs-versioning: versions.json lists ${version.name}, but ${SNAPSHOT_PREFIX}${version.name}/ has no page; run the version command or remove it from versions.json`,
      );
    }

    let hasRootMeta = false;
    for (const file of own) {
      const path = `${version.name}/${file.path}`;
      if (file.type === 'page') {
        const slugs = [...(version.path === '' ? [] : [version.path]), ...(file.slugs ?? getSlugs(file.path))];
        const clash = version.path === '' && slugs.length > 0 ? reserved.get(slugs[0]!) : undefined;
        if (clash !== undefined) {
          throw new Error(`fumadocs-versioning: the page ${path} of the last version would be served at the path of version ${clash}; rename the page or set that version's path`);
        }
        files.push({...file, path, slugs});
      } else if (ROOT_META.test(file.path)) {
        hasRootMeta = true;
        files.push({...file, path, data: {...file.data, title: version.label, root: rootType}});
      } else {
        files.push({...file, path});
      }
    }
    if (!hasRootMeta) files.push({type: 'meta', path: `${version.name}/meta.json`, data: {title: version.label, root: rootType}});
  }
  files.push({type: 'meta', path: 'meta.json', data: {pages: config.versions.map((version) => version.name)}});

  const hooks = [options.current, options.versioned].flatMap((source) => (source?.configureStatic ? [source.configureStatic] : []));
  const source = {
    files,
    ...(hooks.length > 0 && {configureStatic: (opts: Parameters<NonNullable<StaticSource['configureStatic']>>[0]) => hooks.forEach((hook) => hook(opts))}),
  } as unknown as S;
  return {source, config};
}

interface PageLike {
  path: string;
  url: string;
}

/** The version a page of the combined source belongs to. */
export function getPageVersion(config: VersionsConfig, page: Pick<PageLike, 'path'>): VersionInfo {
  const name = page.path.slice(0, page.path.indexOf('/'));
  const version = findVersion(config, name);
  if (!version) throw new Error(`fumadocs-versioning: ${page.path} is not in a built version`);
  return version;
}

/** The page's path within its version, e.g. `guides/install.mdx`. */
export function getVersionRelativePath(page: Pick<PageLike, 'path'>): string {
  return page.path.slice(page.path.indexOf('/') + 1);
}

export interface VersionAlternate {
  version: VersionInfo;
  url: string;
  /** False when the version has no page at the same path, and `url` is its first page. */
  exact: boolean;
}

const indexes = new WeakMap<object, {byPath: Map<string, PageLike>; first: Map<string, PageLike>}>();

function indexOf(source: Pick<LoaderOutput, 'getPages'>) {
  let index = indexes.get(source);
  if (!index) {
    index = {byPath: new Map(), first: new Map()};
    for (const page of source.getPages()) {
      index.byPath.set(page.path, page);
      const name = page.path.slice(0, page.path.indexOf('/'));
      const rel = page.path.slice(name.length + 1);
      const known = index.first.get(name);
      // A version's entry page is its root index page, or else its first page.
      if (!known || (/^index\.[A-Za-z]+$/.test(rel) && !/^[^/]+\/index\.[A-Za-z]+$/.test(known.path))) index.first.set(name, page);
    }
    indexes.set(source, index);
  }
  return index;
}

/** The same page in each built version, or that version's entry page when it has none. */
export function getVersionAlternates(source: Pick<LoaderOutput, 'getPages'>, config: VersionsConfig, page: Pick<PageLike, 'path'>): VersionAlternate[] {
  const index = indexOf(source);
  const rel = getVersionRelativePath(page);
  const out: VersionAlternate[] = [];
  for (const version of config.versions) {
    const same = index.byPath.get(`${version.name}/${rel}`);
    const target = same ?? index.first.get(version.name);
    if (target) out.push({version, url: target.url, exact: same !== undefined});
  }
  return out;
}

/** The same page in the last version, or that version's entry page. */
export function getLastVersionAlternate(source: Pick<LoaderOutput, 'getPages'>, config: VersionsConfig, page: Pick<PageLike, 'path'>): VersionAlternate {
  const last = getLastVersion(config);
  return getVersionAlternates(source, config, page).find((alternate) => alternate.version.name === last.name)!;
}

/** Metadata to merge into a page's `generateMetadata()` result: `noindex` for a version that sets `noIndex`. */
export function getVersionMetadata(config: VersionsConfig, page: Pick<PageLike, 'path'>): {robots?: {index: false; follow: true}} {
  return getPageVersion(config, page).noIndex ? {robots: {index: false, follow: true}} : {};
}
