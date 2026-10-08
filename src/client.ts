'use client';
import {usePathname} from 'fumadocs-core/framework';
import {getVersionFromPathname, type VersionInfo, type VersionsConfig} from './versions.js';

/** The version of the page being viewed, or undefined outside the docs. */
export function useVersion(config: VersionsConfig, baseUrl: string): VersionInfo | undefined {
  return getVersionFromPathname(config, baseUrl, usePathname());
}
