import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // The OSRS Wiki serves item icons. Allow-list rather than opening remote images
  // entirely — an unrestricted image host is an open proxy for arbitrary content.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'oldschool.runescape.wiki', pathname: '/images/**' },
    ],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Discord OAuth redirects break under an over-strict COOP, so it is
          // deliberately omitted here rather than set and later debugged.
        ],
      },
    ];
  },
};

export default nextConfig;
