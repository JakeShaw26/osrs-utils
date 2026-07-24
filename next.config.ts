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
          // Now settable: this was omitted while Discord OAuth existed, because
          // a strict COOP severs the popup/redirect handoff. With no OAuth flow
          // (ADR-0012) nothing needs cross-origin window access, so isolating
          // our browsing context costs us nothing.
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
