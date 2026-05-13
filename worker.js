/**
 * Cloudflare Worker for matein3store.com
 * 
 * This worker acts as a middleware on the Edge:
 * 1. Checks if the visitor's IP is in the KV namespace (blocked-ips)
 * 2. If blocked -> Returns the custom blocked.html page from Cloudflare Pages
 * 3. If not blocked -> Forwards the request to the origin server (Coolify)
 * 4. If origin server returns 502/503 (maintenance/restart) -> Returns index.html (maintenance page)
 */

export default {
  async fetch(request, env, ctx) {
    // 1. Get visitor IP
    const ip = request.headers.get('cf-connecting-ip');
    
    // 2. Check if IP is blocked in KV
    // Requires binding KV namespace to 'BLOCKED_IPS' in worker settings
    if (env.BLOCKED_IPS && ip) {
      const isBlocked = await env.BLOCKED_IPS.get(ip);
      
      if (isBlocked) {
        // IP is blocked! Fetch the custom blocked page from Cloudflare Pages
        // Replace with your actual Cloudflare Pages URL
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
    }

    // 3. IP is not blocked, forward request to origin
    try {
      const response = await fetch(request);
      
      // 4. Check if origin is down (502 Bad Gateway or 503 Service Unavailable)
      if (response.status === 502 || response.status === 503) {
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
                'Retry-After': '60'
              },
            });
          }
        } catch (e) {
          // Fallback
          return response;
        }
      }
      
      // Normal response
      return response;
      
    } catch (e) {
      // Network error reaching origin (server completely down)
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
            },
          });
        }
      } catch (err) {
        return new Response('Origin Server Unreachable', { status: 502 });
      }
    }
  },
};
