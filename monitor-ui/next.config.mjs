import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export so NestJS can serve the dashboard from a single process/port.
  output: 'export',
  // All generated asset URLs are prefixed with /monitor.
  basePath: '/monitor',
  images: { unoptimized: true },
  reactStrictMode: true,
  // The backend owns the root lockfile; keep Next's workspace detection scoped here.
  outputFileTracingRoot: resolve(here, '..'),
};

export default nextConfig;
