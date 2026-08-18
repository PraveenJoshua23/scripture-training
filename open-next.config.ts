import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Every route in this app is statically prerendered and all state lives in the
// browser, so there is no ISR cache to configure. If server routes are added
// later, wire up an incremental cache here.
export default defineCloudflareConfig();
