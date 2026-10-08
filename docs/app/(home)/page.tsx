import Link from 'next/link';

const features = [
  {
    title: 'Snapshots from the command line',
    body: "npx fumadocs-versioning version 1.0 freezes content/docs into versioned_docs/version-1.0 and records it in versions.json.",
  },
  {
    title: 'The Docusaurus URL layout',
    body: 'The latest release at /docs, the docs in progress at /docs/next, older releases at /docs/<version>.',
  },
  {
    title: 'A dropdown that keeps your page',
    body: "Switching versions in Fumadocs' sidebar lands on the same page when it exists in the other version.",
  },
  {
    title: 'Banners, noindex and per-version search',
    body: 'Old and unreleased versions say so and link to the latest; search stays inside the version being read.',
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-12 px-4 py-16 md:py-24">
      <section className="flex flex-col gap-5">
        <p className="text-sm font-medium text-fd-muted-foreground">fumadocs-versioning</p>
        <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">Versioned docs for Fumadocs, the way Docusaurus does them.</h1>
        <p className="max-w-2xl text-fd-muted-foreground md:text-lg">
          Publish the docs for every release side by side, from one Fumadocs <code>loader()</code>. These docs are built with it: switch
          between 0.1 and Next in the sidebar.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/docs" className="rounded-lg bg-fd-primary px-4 py-2 text-sm font-medium text-fd-primary-foreground">
            Read the docs
          </Link>
          <a
            href="https://github.com/mdg-labs/fumadocs-versioning"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-fd-accent"
          >
            GitHub
          </a>
        </div>
        <pre className="w-fit max-w-full overflow-x-auto rounded-lg border bg-fd-card px-4 py-3 text-sm">
          <code>npm install fumadocs-versioning</code>
        </pre>
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        {features.map((feature) => (
          <div key={feature.title} className="rounded-xl border bg-fd-card p-5">
            <h2 className="mb-2 font-medium">{feature.title}</h2>
            <p className="text-sm text-fd-muted-foreground">{feature.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
