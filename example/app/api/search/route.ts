import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';
import { versionedBuildIndex } from 'fumadocs-versioning/search';
import { versionsConfig } from '@/lib/versions';

export const revalidate = false;

export const { staticGET: GET } = createFromSource(source, {
  // https://docs.orama.com/docs/orama-js/supported-languages
  language: 'english',
  // Tags every page with its version, so the dialog only searches the version being read.
  buildIndex: versionedBuildIndex(versionsConfig),
});
