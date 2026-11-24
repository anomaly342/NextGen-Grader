import type { NextConfig } from 'next';

/** Where the Next server reaches Nest. Only server code knows it; the browser uses `/api`. */
const API_INTERNAL_URL =
  process.env['API_INTERNAL_URL'] ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  transpilePackages: ['@repo/lib', '@repo/ui'],
  // The browser talks to Nest only through `/api` (ADR 0002), so auth cookies such as
  // `ngg.sid` are first-party on this host. A rewrite, never a redirect: a redirect
  // would send the browser to the Nest host and its cookies would land there.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_INTERNAL_URL}/api/v1/:path*`,
      },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
