// Version resolution, with Docusaurus' rules. Pure and serializable, so the
// same config can be built on the server and in client components.

/** The name of the unversioned docs, as in Docusaurus. */
export const CURRENT = 'current';

export type VersionBanner = 'none' | 'unreleased' | 'unmaintained';

export interface VersionOptions {
  /** Label in the version dropdown. Default: the version name, or `Next` for the current docs. */
  label?: string;
  /**
   * URL segment after the docs base URL. Default: empty for the last version,
   * `next` for the current docs and the version name for the others.
   */
  path?: string;
  /** Default: `unreleased` above the last version, `unmaintained` below it, `none` for it. */
  banner?: VersionBanner;
  /** Ask search engines not to index the version's pages. Default: false. */
  noIndex?: boolean;
}

export interface VersioningOptions {
  /** The contents of `versions.json`: version names, newest first. */
  versions: readonly string[];
  /** The version served at the docs base URL. Default: the newest version, or the current docs when there is none. */
  lastVersion?: string;
  /** Publish the current docs beside the versions. Default: true. */
  includeCurrentVersion?: boolean;
  /** Build only these versions (`current` names the current docs). Default: all. */
  onlyIncludeVersions?: readonly string[];
  /** Per-version overrides, keyed by version name or `current`. */
  versionOptions?: Readonly<Record<string, VersionOptions>>;
}

export interface VersionInfo {
  /** `current` or the name in `versions.json`. */
  name: string;
  label: string;
  /** URL segment after the docs base URL; empty for the last version. */
  path: string;
  isLast: boolean;
  isCurrent: boolean;
  banner: VersionBanner;
  noIndex: boolean;
}

export interface VersionsConfig {
  /** Every built version in dropdown order: the current docs first, then newest to oldest. */
  versions: VersionInfo[];
  /** The name of the version served at the docs base URL. */
  lastVersion: string;
}

const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const PATH = /^[A-Za-z0-9._-]*$/;

/** Resolves the versions to build, their labels, URL segments and banners. */
export function resolveVersions(options: VersioningOptions): VersionsConfig {
  const {versions, includeCurrentVersion = true, onlyIncludeVersions, versionOptions = {}} = options;

  const seen = new Set<string>();
  for (const name of versions) {
    if (typeof name !== 'string' || !NAME.test(name)) throw new Error(`fumadocs-versioning: invalid version name ${JSON.stringify(name)}`);
    if (name === CURRENT) throw new Error(`fumadocs-versioning: "${CURRENT}" is reserved for the current docs and cannot be a version name`);
    if (seen.has(name)) throw new Error(`fumadocs-versioning: version ${name} is listed twice`);
    seen.add(name);
  }
  if (!includeCurrentVersion && versions.length === 0) {
    throw new Error('fumadocs-versioning: includeCurrentVersion is false but there is no version');
  }

  // Dropdown order, as in Docusaurus: the current docs, then newest to oldest.
  const all = [...(includeCurrentVersion ? [CURRENT] : []), ...versions];
  const lastVersion = options.lastVersion ?? versions[0] ?? CURRENT;
  if (!all.includes(lastVersion)) throw new Error(`fumadocs-versioning: lastVersion ${lastVersion} is not a built version`);

  for (const key of Object.keys(versionOptions)) {
    if (!all.includes(key)) throw new Error(`fumadocs-versioning: versionOptions names ${key}, which is not a built version`);
  }

  let included = all;
  if (onlyIncludeVersions) {
    for (const name of onlyIncludeVersions) {
      if (!all.includes(name)) throw new Error(`fumadocs-versioning: onlyIncludeVersions names ${name}, which is not a built version`);
    }
    if (!onlyIncludeVersions.includes(lastVersion)) {
      throw new Error(`fumadocs-versioning: onlyIncludeVersions must include the last version (${lastVersion})`);
    }
    included = all.filter((name) => onlyIncludeVersions.includes(name));
  }

  const lastIndex = all.indexOf(lastVersion);
  const paths = new Map<string, string>();
  const resolved = included.map((name): VersionInfo => {
    const own = versionOptions[name] ?? {};
    const isCurrent = name === CURRENT;
    const isLast = name === lastVersion;
    const path = own.path ?? (isLast ? '' : isCurrent ? 'next' : name);
    if (!PATH.test(path)) throw new Error(`fumadocs-versioning: version ${name} has an invalid path ${JSON.stringify(path)}`);
    const clash = paths.get(path);
    if (clash !== undefined) throw new Error(`fumadocs-versioning: versions ${clash} and ${name} share the path ${JSON.stringify(path)}`);
    paths.set(path, name);

    const index = all.indexOf(name);
    return {
      name,
      label: own.label ?? (isCurrent ? 'Next' : name),
      path,
      isLast,
      isCurrent,
      banner: own.banner ?? (index < lastIndex ? 'unreleased' : index > lastIndex ? 'unmaintained' : 'none'),
      noIndex: own.noIndex ?? false,
    };
  });

  return {versions: resolved, lastVersion};
}

/** The version with this name, if it is built. */
export function findVersion(config: VersionsConfig, name: string): VersionInfo | undefined {
  return config.versions.find((version) => version.name === name);
}

/** The version served at the docs base URL. */
export function getLastVersion(config: VersionsConfig): VersionInfo {
  // resolveVersions guarantees the last version is built.
  return findVersion(config, config.lastVersion)!;
}

/**
 * The version a pathname belongs to, for client components such as a search
 * dialog. Returns undefined outside the docs.
 */
export function getVersionFromPathname(config: VersionsConfig, baseUrl: string, pathname: string): VersionInfo | undefined {
  const base = trimSlashes(baseUrl);
  const rest = trimSlashes(pathname);
  let inner: string;
  if (base === '') inner = rest;
  else if (rest === base) inner = '';
  else if (rest.startsWith(`${base}/`)) inner = rest.slice(base.length + 1);
  else return undefined;

  const first = inner.split('/')[0] ?? '';
  return config.versions.find((version) => version.path !== '' && version.path === first) ?? getLastVersion(config);
}

function trimSlashes(path: string): string {
  return path.replace(/^\/+|\/+$/g, '');
}
