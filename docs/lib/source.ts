import { llms, loader } from 'fumadocs-core/source';
import { docsRoute } from './shared';
import { defineDocs } from 'fumadocs-mdx/macro';
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';
import { versionedSource } from 'fumadocs-versioning';
import { versionsConfig } from './versions';

const collectionOptions = {
  docs: {
    schema: pageSchema,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
} as const;

// The current docs, and the snapshots written by `fumadocs-versioning version`.
const docs = defineDocs({ dir: 'content/docs', ...collectionOptions });
const versionedDocs = defineDocs({ dir: 'versioned_docs', ...collectionOptions });

// One source with every version as a root folder: the last version at /docs,
// the current docs at /docs/next and older versions at /docs/<version>.
const versioned = versionedSource({
  current: docs.toFumadocsSource(),
  versioned: versionedDocs.toFumadocsSource(),
  config: versionsConfig,
});

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader({
  baseUrl: docsRoute,
  source: versioned.source,
  plugins: [],
});

export const docsLlms = llms(source, {
  renderPage: async (page) => `# ${page.data.title} (${page.url})

${await page.data.getText('processed')}`,
});
