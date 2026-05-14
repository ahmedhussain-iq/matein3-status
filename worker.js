/**
 * Cloudflare Worker for matein3store.com
 * 
 * This worker acts as a middleware on the Edge:
 * 1. Checks if the visitor's IP is in TRUSTED_IPS KV → bypass all checks
 * 2. Checks if the visitor's IP is in BLOCKED_IPS KV → show custom block page
 * 3. If not blocked → forwards the request to the origin server (Coolify)
 * 4. If origin returns 502/503 (maintenance/restart) → show maintenance page
 *
 * KV Bindings required:
 *   - BLOCKED_IPS  → KV namespace "blocked-ips"
 *   - TRUSTED_IPS  → KV namespace "trusted-ips"
 *
 * Environment Variables:
 *   - PAGES_URL → Cloudflare Pages URL (e.g. https://matein3-status.pages.dev)
 */

export default {
  async fetch(request, env, ctx) {
    // 1. Get visitor IP
    const ip = request.headers.get('cf-connecting-ip');

    // 2. Check if IP is TRUSTED → bypass ALL checks (block, rate limit, etc.)
    // Trusted IPs are never blocked on Edge, even if they appear in blocked-ips
    if (env.TRUSTED_IPS && ip) {
      try {
        const isTrusted = await env.TRUSTED_IPS.get(ip);
        if (isTrusted) {
          // Trusted IP — forward directly to origin, skip block check
          try {
            const response = await fetch(request);
            // Even trusted IPs get maintenance page if origin is down
            if (response.status === 502 || response.status === 503) {
              return await serveMaintenance(env);
            }
            return response;
          } catch (e) {
            return await serveMaintenance(env);
          }
        }
      } catch (e) {
        // KV error — fail-open, continue with normal flow
      }
    }

    // 3. Check if IP is BLOCKED in KV
    if (env.BLOCKED_IPS && ip) {
      try {
        const isBlocked = await env.BLOCKED_IPS.get(ip);
        
        if (isBlocked) {
          // IP is blocked! Fetch the custom blocked page from Cloudflare Pages
          const pagesUrl = env.PAGES_URL || 'https://matein3-status.pages.dev';
          
          try {
            const blockedPageRes = await fetch(`${pagesUrl}/blocked.html`);
            if (blockedPageRes.ok) {
              const html = await blockedPageRes.text();
              return new Response(html, {
                status: 403,
                headers: {
                  'Content-Type': 'text/html;charset=UTF-8',
                  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                },
              });
            }
          } catch (e) {
            // Fallback if Pages is down
            return new Response('Access Denied (IP Blocked)', { status: 403 });
          }
        }
      } catch (e) {
        // KV error — fail-open, allow request through
      }
    }

    // 4. IP is not blocked, forward request to origin
    try {
      const response = await fetch(request);
      
      // 5. Check if origin is down (502 Bad Gateway or 503 Service Unavailable)
      if (response.status === 502 || response.status === 503) {
        return await serveMaintenance(env);
      }
      
      // Normal response
      return response;
      
    } catch (e) {
      // Network error reaching origin (server completely down)
      return await serveMaintenance(env);
    }
  },
};

/**
 * Serve the maintenance page from Cloudflare Pages.
 * Extracted as a helper to avoid code duplication.
 */
async function serveMaintenance(env) {
  const pagesUrl = env.PAGES_URL || 'https://matein3-status.pages.dev';
  
  try {
    const maintenancePageRes = await fetch(`${pagesUrl}/index.html`);
    if (maintenancePageRes.ok) {
      const html = await maintenancePageRes.text();
      return new Response(html, {
        status: 503,
        headers: {
          'Content-Type': 'text/html;charset=UTF-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Retry-After': '60',
        },
      });
    }
  } catch (e) {
    // Pages also down
  }
  
  return new Response('Service Temporarily Unavailable', { status: 503 });
}
