---
name: fumadocs-versioning
description: Set up and run Docusaurus-style versioned docs in a Fumadocs site with the fumadocs-versioning package — wiring versionedSource() into lib/source.ts, the version banner, noindex and per-version search, cutting a version with `npx fumadocs-versioning version`, where doc fixes go (content/docs vs versioned_docs), and what each build error means.
---

# fumadocs-versioning

`fumadocs-versioning` adds Docusaurus-style versioned docs to a
[Fumadocs](https://fumadocs.dev) site. Use this skill when you add
versioning to a Fumadocs project, cut a new docs version, fix docs in an
old version, or debug a versioning build error.

## The model

| Path | What it holds |
|---|---|
| `content/docs/` | The **current** docs: what `main` documents, not yet released |
| `versioned_docs/version-<name>/` | A frozen **snapshot** per release, written by the CLI |
| `versions.json` | The versions, **newest first**, e.g. `["1.0", "0.9"]` |

URLs follow Docusaurus:

- The last version (`versions.json[0]` by default) is at `/docs/...`.
- The current docs are at `/docs/next/...`.
- Older versions are at `/docs/<name>/...`.
- With no versions yet (`versions.json` is `[]`), the current docs are at `/docs/...`.

`versionedSource()` merges the current docs and every snapshot into **one**
Fumadocs source, and each version becomes a root folder of type `version`.
So the project keeps a single `loader()`. Search, `llms.txt`, OG images,
`generateStaticParams` and Fumadocs UI's sidebar dropdown all work over every
version without extra code.

## Cutting a version

When a release ships (normally its first stable `X.Y.0`):

```bash
npx fumadocs-versioning version 1.0
```

This copies `content/docs` to `versioned_docs/version-1.0/` and puts `1.0` at
the top of `versions.json`. Commit both. Other commands are `remove <name>`
(deletes the snapshot and its entry) and `list`.

- **Don't hand-edit `versions.json` to add a version.** A listed version
  without a snapshot fails the build. Always use the CLI. Removing a version
  also goes through `remove`, so the folder and the entry go together.
- Version names: letters, digits, `.`, `-` and `_`. `current` is reserved.
- `--exclude <path>` (repeatable) leaves paths under `content/docs` out of
  the snapshot, e.g. pages a generator recreates at build time. Defaults can
  live in `fumadocs-versioning.json` (`content`, `versionedDir`,
  `versionsFile`, `exclude`). Check for that file before passing flags.

## Where a docs change goes

- **New behaviour:** edit `content/docs/` only. It appears in the next
  snapshot.
- **A fix to something already released:** edit `content/docs/`, and also
  the snapshot of each version where the error matters, usually only the
  latest. Snapshots are ordinary files; editing one is a normal commit.
- **Never move or rename `versioned_docs/version-*` folders by hand.**

## Links between pages

Use relative **file** links, which stay inside the version being read:

```mdx
See [Install](./guide/install.mdx).
```

They need the page's MDX `a` component to be `createRelativeLink(source, page)`
from `fumadocs-ui/mdx`, which the Fumadocs templates already set. An absolute
link such as `/docs/guide/install` always points at the **last** version,
even from inside an old snapshot. Don't write absolute links between docs
pages.

## Setting it up in a Fumadocs project

Requirements: `fumadocs-core` and `fumadocs-ui` 16.16 or later, and
`fumadocs-mdx`. **Fumadocs i18n is not supported.** If the project uses
`i18n` in its loader, stop and tell the user instead of wiring this in.

1. Install the package, and create `versions.json` containing `[]` if it
   doesn't exist. The `versioned_docs/` folder may be missing until the first
   snapshot.

   ```bash
   npm install fumadocs-versioning
   ```

2. Resolve the versions once, in a module that server and client
   components can both import:

   ```ts
   // lib/versions.ts
   import { resolveVersions } from 'fumadocs-versioning';
   import versions from '../versions.json';

   export const versionsConfig = resolveVersions({
     versions,
     versionOptions: { current: { noIndex: versions.length > 0 } },
   });
   ```

   Importing `versions.json` needs `resolveJsonModule` in `tsconfig.json`
   (the Fumadocs templates have it).

3. Add a collection for the snapshots and pass both sources to
   `versionedSource()`, with the **same collection options** as the
   existing docs collection. Keep the project's existing `loader()` options
   and plugins. The snippet below matches current templates, which call
   `defineDocs` from `fumadocs-mdx/macro` in `lib/source.ts`. If the project
   defines its collections in `source.config.ts`, add
   `defineDocs({ dir: 'versioned_docs' })` there beside the existing one, and
   import it in `lib/source.ts` the same way the existing collection is imported.

   ```ts
   // lib/source.ts
   import { versionedSource } from 'fumadocs-versioning';
   import { versionsConfig } from './versions';

   const docs = defineDocs({ dir: 'content/docs', ...options });
   const versionedDocs = defineDocs({ dir: 'versioned_docs', ...options });

   const versioned = versionedSource({
     current: docs.toFumadocsSource(),
     versioned: versionedDocs.toFumadocsSource(),
     config: versionsConfig,
   });

   export const source = loader({ baseUrl: '/docs', source: versioned.source });
   ```

4. The version dropdown needs nothing: `DocsLayout` with
   `tree={source.getPageTree()}` shows it.

5. In the docs page (`app/docs/[[...slug]]/page.tsx` in Next.js), add the
   banner as the first child of `<DocsPage>`, above the title, and the robots
   metadata. `siteName` is optional and only prefixes the label in the text
   ("This is unreleased documentation for Acme Next.").

   ```tsx
   import { getVersionMetadata } from 'fumadocs-versioning';
   import { VersionBanner } from 'fumadocs-versioning/ui';

   <DocsPage toc={page.data.toc} full={page.data.full}>
     <VersionBanner source={source} config={versionsConfig} page={page} siteName="Acme" />
     <DocsTitle>{page.data.title}</DocsTitle>
     …

   // in generateMetadata():
   return { title: page.data.title, ...getVersionMetadata(versionsConfig, page) };
   ```

6. Optional, to search only the version being read. On the server:

   ```ts
   import { versionedBuildIndex } from 'fumadocs-versioning/search';
   createFromSource(source, { buildIndex: versionedBuildIndex(versionsConfig) });
   ```

   In the search dialog (client component, `components/search.tsx` in the
   templates), add the version tag. The tag is the version's name: `current`
   for the current docs, otherwise the name in `versions.json`. The template's
   `useI18n()`/`locale` lines can go, since i18n isn't supported.

   ```tsx
   import { useVersion } from 'fumadocs-versioning/client';
   // Outside the docs (e.g. the home page), search the last version.
   const version = useVersion(versionsConfig, '/docs')?.name ?? versionsConfig.lastVersion;
   useDocsSearch({ client: staticClient({ tag: version }) }, [version]);
   ```

7. **Static export** (`output: 'export'`): set `trailingSlash: true` in
   `next.config`. Without it, Next writes both `docs/0.9.html` and a
   `docs/0.9/` folder, and static hosts (GitHub Pages included) serve the
   folder listing instead of the page.

8. **`page.path` now starts with the version** (`current/guide/install.mdx`,
   `1.0/guide/install.mdx`), but URLs do not. Code that maps `page.path` to a
   file, such as "Edit on GitHub" links, must strip it:

   ```ts
   import { getPageVersion, getVersionRelativePath } from 'fumadocs-versioning';

   // getPageVersion() returns { name, label, path, isCurrent, isLast, banner, noIndex }.
   function getFilePath(page: { path: string }) {
     const version = getPageVersion(versionsConfig, page);
     const dir = version.isCurrent ? 'content/docs' : `versioned_docs/version-${version.name}`;
     return `${dir}/${getVersionRelativePath(page)}`;
   }
   ```

## Options

Pass these to `resolveVersions()`. Defaults match Docusaurus.

- `lastVersion`: the version served at `/docs`. Default: the newest.
- `includeCurrentVersion`: default `true`.
- `onlyIncludeVersions`: e.g. `['current', '1.0']` for fast local builds.
  It must include the last version.
- `versionOptions`: per version, keyed by name or `current`. Each takes
  `label` (default `Next` for current), `path` (URL segment), `banner`
  (`none`, `unreleased` or `unmaintained`) and `noIndex`.
  Set `versionOptions: { current: { noIndex: versions.length > 0 } }` unless
  the user wants otherwise. It keeps the unreleased docs out of search engines
  once a release exists, so searches land on the released docs.

## Build errors

All errors start with `fumadocs-versioning:`.

| Error says | Cause and fix |
|---|---|
| `versions.json lists X, but version-X/ has no page` | An entry without a snapshot. Run `npx fumadocs-versioning version X` from the right commit, or `remove X`. |
| `the page … of the last version would be served at the path of version …` | A top-level page or folder in the last version has the same name as another version's path (e.g. a `next.mdx`). Rename the page, or set that version's `path` in `versionOptions`. |
| `"current" is reserved` | Pick another version name. |
| `lastVersion X is not a built version` / `onlyIncludeVersions must include the last version` | The options don't match `versions.json`. |
| `versions A and B share the path` | Two versions resolve to the same URL segment; change a `path`. |
| `the current docs have no page` | `content/docs` is empty, or the wrong collection was passed as `current`. |

## Checking the result

Build the site. With a static export, check the output:

- `out/docs/index.html` has no `data-version-banner` and shows the last version's content. Compare a sentence that differs between versions.
- `out/docs/next/index.html` exists once a version exists. It contains `data-version-banner="unreleased"`, and `<meta name="robots" content="noindex` if `noIndex` is set for current.
- Each older version has `out/docs/<name>/index.html` with `data-version-banner="unmaintained"`.

Then open a page and switch versions in the sidebar dropdown. It should stay
on the same page when that page exists in the other version.
