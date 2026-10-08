import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  output: 'export',
  // Exports docs/0.9/index.html instead of docs/0.9.html beside a docs/0.9/
  // folder, which static hosts would serve as a directory.
  trailingSlash: true,
  reactStrictMode: true,
};

export default withMDX(config);
