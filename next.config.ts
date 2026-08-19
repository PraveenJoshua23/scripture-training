import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Every route is prerendered and all state lives in the browser, so the app
  // exports to plain HTML/CSS/JS and is served from Cloudflare Pages. Adding a
  // server route (an API handler, middleware, or auth callback) means moving
  // back to a server target — see the deployment notes in the README.
  output: 'export',
};

export default nextConfig;
