import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // NOTE: there is deliberately no `images.remotePatterns` entry for the wiki.
  // One existed while item icons were an open question, and it was a standing
  // hole: a remote pattern turns `/_next/image?url=…` into a fetch-and-serve
  // endpoint on our origin that anyone can drive, which is both the open-proxy
  // shape CLAUDE.md warns about and hotlinking the wiki's bandwidth through us
  // (api-terms.md §2 rule 7). Icons are same-origin and packed now (ADR-0022),
  // so nothing needs it. Don't add one back to "just show an image".

  async headers() {
    return [
      {
        /*
         * The atlas sheets are content-hashed by the packer, so a changed sheet
         * is a changed URL and a cached one can never be stale. That is what
         * makes `immutable` safe here and unsafe for the rest of `public/`,
         * which Next serves with `max-age=0`.
         */
        source: '/item-icons/:file*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
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
