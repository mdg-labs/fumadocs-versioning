# fumadocs-versioning

Docusaurus-style versioned docs for [Fumadocs](https://fumadocs.dev).

**Documentation: https://mdg-labs.github.io/fumadocs-versioning/**. The site is built with this package and versioned with it.

- `fumadocs-versioning version 1.0` snapshots `content/docs` into `versioned_docs/version-1.0/` and records it in `versions.json`.
- The last version is served at `/docs`, the current docs at `/docs/next`, and older versions at `/docs/<version>`.
- Fumadocs UI shows a version dropdown in the sidebar. Switching versions keeps you on the same page when it exists in the other version.
- Unreleased and unmaintained versions get a banner that links to the same page in the latest version.
- Search can be limited to the version being read. A version can be kept out of search engines.
- The package builds one ordinary Fumadocs `loader()`, so `llms.txt`, OG images, relative links and static export work as before.

The layout and option names follow [Docusaurus versioning](https://docusaurus.io/docs/versioning), so its rules carry over.

## Install

```bash
npm install fumadocs-versioning
```

Requires `fumadocs-core` and `fumadocs-ui` 16.16 or later, and `fumadocs-mdx` for the collections below.

## Agent skill

If an AI coding agent (Claude Code, Cursor, etc.) works on your docs, install the [`fumadocs-versioning` skill](skills/fumadocs-versioning/SKILL.md). It tells the agent how to set the package up, when to cut a version, where doc fixes go, and what each build error means:

```sh
npx skills add mdg-labs/fumadocs-versioning --skill fumadocs-versioning
```

## Set up

### 1. Collections

Add a second collection for the snapshots, then combine both into one source:

```ts
// lib/versions.ts — shared by server and client components
import { resolveVersions } from 'fumadocs-versioning';
import versions from '../versions.json';

export const versionsConfig = resolveVersions({ versions });
```

```ts
// lib/source.ts
import { loader } from 'fumadocs-core/source';
import { defineDocs } from 'fumadocs-mdx/macro';
import { versionedSource } from 'fumadocs-versioning';
import { versionsConfig } from './versions';

const docs = defineDocs({ dir: 'content/docs' });
const versionedDocs = defineDocs({ dir: 'versioned_docs' });

const versioned = versionedSource({
  current: docs.toFumadocsSource(),
  versioned: versionedDocs.toFumadocsSource(),
  config: versionsConfig,
});

export const source = loader({ baseUrl: '/docs', source: versioned.source });
```

Start with a `versions.json` containing `[]`. The `versioned_docs/` folder can be missing until the first snapshot. Until then the current docs are served at `/docs`.

### 2. The version dropdown

Nothing to add. Each version is a root folder of type `version`, and `DocsLayout` shows root folders of one type as a dropdown. Use `<DocsLayout tree={source.getPageTree()}>` as usual.

### 3. Banner and metadata

```tsx
// app/docs/[[...slug]]/page.tsx
import { getVersionMetadata } from 'fumadocs-versioning';
import { VersionBanner } from 'fumadocs-versioning/ui';
import { versionsConfig } from '@/lib/versions';

<DocsPage toc={page.data.toc}>
  <VersionBanner source={source} config={versionsConfig} page={page} siteName="Acme" />
  …
</DocsPage>

export async function generateMetadata(props) {
  // …
  return { title: page.data.title, ...getVersionMetadata(versionsConfig, page) };
}
```

`VersionBanner` takes a `render` prop if you want your own markup.

### 4. Search per version (optional)

```ts
// app/api/search/route.ts
import { versionedBuildIndex } from 'fumadocs-versioning/search';

export const { staticGET: GET } = createFromSource(source, {
  buildIndex: versionedBuildIndex(versionsConfig),
});
```

```tsx
// components/search.tsx ('use client')
import { useVersion } from 'fumadocs-versioning/client';

const version = useVersion(versionsConfig, '/docs')?.name ?? versionsConfig.lastVersion;
const { search, setSearch, query } = useDocsSearch(
  { client: staticClient({ tag: version }) },
  [version],
);
```

## Making a version

```bash
npx fumadocs-versioning version 1.0
```

This copies `content/docs` to `versioned_docs/version-1.0/` and puts `1.0` at the top of `versions.json`. Commit both. From then on `/docs` serves 1.0 and `/docs/next` serves `content/docs`.

| Command | |
|---|---|
| `version <name>` | Snapshot the current docs as `<name>` |
| `remove <name>` | Delete the snapshot and its `versions.json` entry |
| `list` | Print the versions, newest first |

Options: `--content` (default `content/docs`), `--versioned-dir` (`versioned_docs`), `--versions-file` (`versions.json`), `--exclude <path>` (repeatable, e.g. generated pages that a build recreates), `--cwd`. You can also put them in `fumadocs-versioning.json` as `content`, `versionedDir`, `versionsFile` and `exclude`.

## Options

`resolveVersions()` and `versionedSource()` take the same options:

| Option | Default | |
|---|---|---|
| `versions` | — | The contents of `versions.json`, newest first |
| `lastVersion` | newest version, or `current` | The version served at the base URL |
| `includeCurrentVersion` | `true` | Publish the current docs |
| `onlyIncludeVersions` | all | Build only these versions, e.g. for fast local builds |
| `versionOptions` | — | Per version (key `current` for the current docs): `label`, `path`, `banner` (`none`, `unreleased`, `unmaintained`), `noIndex` |
| `rootType` | `version` | `versionedSource()` only: the `root` type of the version folders |

Defaults match Docusaurus. The current docs are labelled `Next` and served at `next`. Versions newer than `lastVersion` get the `unreleased` banner and older ones get `unmaintained`.

## Helpers

From `fumadocs-versioning`:

- `getPageVersion(config, page)`: the version a page belongs to.
- `getVersionRelativePath(page)`: the page's path inside its version, e.g. for "Edit on GitHub" links. The current docs live in `content/docs`, a snapshot in `versioned_docs/version-<name>`.
- `getVersionAlternates(source, config, page)`: the same page in every version, or that version's start page when it has no such page.
- `getVersionFromPathname(config, baseUrl, pathname)`: the version of a URL.

## Notes

- **Links between pages:** use relative file links (`[Install](./guide/install.mdx)`) with Fumadocs' `createRelativeLink`. They resolve inside the version being read. Absolute links like `/docs/guide/install` always point at the last version.
- **Static export:** set `trailingSlash: true` in `next.config` when you use `output: 'export'`. Without it, Next writes both `docs/0.9.html` and a `docs/0.9/` folder, and static hosts such as GitHub Pages serve the folder.
- **Hosting below a path** (e.g. a GitHub Pages project site): besides Next's `basePath`, pass ``from: `${basePath}/api/search` `` to `staticClient()`. Fumadocs only adds the base path itself under Vite.
- **Page paths:** a page's `page.path` is prefixed with its version (`current/…`, `1.0/…`). The URLs are not affected.
- **Coming from Docusaurus:** `versioned_docs/version-*` and `versions.json` use the same layout. Sidebars become `meta.json` files inside each version.
- **Not supported yet:** Fumadocs i18n, and a page in the last version whose first URL segment matches another version's path. That page is refused at build time.

## Example

[`example/`](./example) is the Fumadocs Next.js static template with three versions (0.9, 1.0 and Next). To run it:

```bash
npm install
npm run build
npm run build --workspace example   # static export in example/out
```

## Documentation site

[`docs/`](./docs) holds the documentation site: the current docs in `docs/content/docs`, the released ones in `docs/versioned_docs`. `pages.yml` deploys it to GitHub Pages on every push to `main`. When a release changes the docs, snapshot them with `npx fumadocs-versioning version X.Y` in `docs/`.

## Releasing

The `version` in `package.json` drives releases:

1. Bump `version` in `package.json` and merge it to `main`.
2. `release-draft.yml` tags that commit `v<version>` and opens a draft release with generated notes.
3. Edit the notes if needed, then publish the draft. `publish.yml` checks that the tag matches `package.json`, runs the checks and publishes to npm through trusted publishing.

A prerelease such as `0.2.0-stage` goes out under the dist-tag `stage`, so `latest` only moves to stable versions. A version already on npm is skipped.

## License

MIT
