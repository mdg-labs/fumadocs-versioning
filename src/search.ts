import type {StructuredData} from 'fumadocs-core/mdx-plugins';
import type {AdvancedIndex} from 'fumadocs-core/search/server';
import {getPageVersion} from './source.js';
import type {VersionsConfig} from './versions.js';

interface IndexablePage {
  path: string;
  url: string;
  data: {
    title?: string;
    description?: string;
    structuredData?: StructuredData | (() => StructuredData | Promise<StructuredData>);
    load?: () => Promise<{structuredData?: StructuredData}>;
  };
}

/**
 * A `buildIndex` for `createFromSource()` that tags each page with its version
 * name, so a search client can be limited to one version with `tag`.
 */
export function versionedBuildIndex(config: VersionsConfig) {
  return async (page: IndexablePage): Promise<AdvancedIndex> => {
    let structuredData: StructuredData | undefined;
    const {data} = page;
    if (data.structuredData) structuredData = typeof data.structuredData === 'function' ? await data.structuredData() : data.structuredData;
    else if (typeof data.load === 'function') structuredData = (await data.load()).structuredData;
    if (!structuredData) throw new Error(`fumadocs-versioning: ${page.path} has no structured data to index`);

    return {
      id: page.url,
      url: page.url,
      title: data.title ?? page.path,
      description: data.description,
      structuredData,
      tag: getPageVersion(config, page).name,
    };
  };
}
