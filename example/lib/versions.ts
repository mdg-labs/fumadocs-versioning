import { resolveVersions } from 'fumadocs-versioning';
import versions from '../versions.json';

// Shared by the server and client components (the search dialog), so both
// agree on which versions exist and where they are served.
export const versionsConfig = resolveVersions({
  versions,
  versionOptions: {
    // The current docs stay out of search engines once a release exists.
    current: { noIndex: versions.length > 0 },
  },
});
