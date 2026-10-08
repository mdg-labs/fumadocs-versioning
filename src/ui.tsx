import Link from 'fumadocs-core/link';
import type {LoaderOutput} from 'fumadocs-core/source';
import {Callout} from 'fumadocs-ui/components/callout';
import type {ReactNode} from 'react';
import {getLastVersionAlternate, getPageVersion, type VersionAlternate} from './source.js';
import {getLastVersion, type VersionInfo, type VersionsConfig} from './versions.js';

export interface VersionBannerContext {
  version: VersionInfo;
  last: VersionInfo;
  /** The same page in the last version, or its entry page. */
  latest: VersionAlternate;
}

export interface VersionBannerProps {
  source: Pick<LoaderOutput, 'getPages'>;
  config: VersionsConfig;
  page: {path: string};
  /** Shown before the version label, e.g. `Acme` gives "Acme 1.0". */
  siteName?: string;
  /** Replaces the default banner. */
  render?: (context: VersionBannerContext) => ReactNode;
}

/**
 * The Docusaurus version banner: on an unreleased or unmaintained version, a
 * notice linking to the same page in the last version. Renders nothing on a
 * version whose banner is `none`.
 */
export function VersionBanner({source, config, page, siteName, render}: VersionBannerProps) {
  const version = getPageVersion(config, page);
  if (version.banner === 'none') return null;
  const context: VersionBannerContext = {version, last: getLastVersion(config), latest: getLastVersionAlternate(source, config, page)};
  if (render) return render(context);

  const name = siteName ? `${siteName} ${version.label}` : version.label;
  return (
    <Callout type="warn" data-version-banner={version.banner}>
      {version.banner === 'unreleased' ? (
        <>This is unreleased documentation for {name}.</>
      ) : (
        <>This is documentation for {name}, which is no longer actively maintained.</>
      )}{' '}
      For up-to-date documentation, see the{' '}
      <Link href={context.latest.url} className="font-medium underline underline-offset-4">
        latest version ({context.last.label})
      </Link>
      .
    </Callout>
  );
}
