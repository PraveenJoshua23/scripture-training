import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Every route is prerendered and all state lives in the browser, so the app
  // exports to plain HTML/CSS/JS and is served from Cloudflare Pages. Adding a
  // *Next* server route (an API handler, middleware, or auth callback) means
  // moving back to a server target — see the deployment notes in the README.
  // Server work that Pages can host instead lives in `functions/`, which Pages
  // deploys beside this export without changing the target.
  output: 'export',
};

export default nextConfig;
