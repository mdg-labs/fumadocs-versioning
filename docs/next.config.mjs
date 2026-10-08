import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  output: 'export',
  // Exports docs/0.1/index.html instead of docs/0.1.html beside a docs/0.1/
  // folder, which static hosts would serve as a directory.
  trailingSlash: true,
  // GitHub Pages serves the site below /fumadocs-versioning; the Pages
  // workflow passes the path in.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  reactStrictMode: true,
};

export default withMDX(config);
