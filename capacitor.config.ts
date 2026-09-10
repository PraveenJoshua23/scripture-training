import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Wraps the `output: 'export'` build in an Android WebView. `webDir` is the
 * same `out/` directory Cloudflare Pages serves, audio and all, so the APK
 * ships every drill offline — see the bundling note in the README.
 */
const config: CapacitorConfig = {
  // Baked into the Play listing on first publish and painful to change after.
  appId: 'com.praveenjoshua.scripturetraining',
  appName: 'Scripture Training',
  webDir: 'out',
};

export default config;
