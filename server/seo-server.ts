import http from 'http';
import url from 'url';

// ⚠️ LAST RESORT: Native HTTP server for SEO routes
// This server runs BEFORE Express and handles only robots.txt and sitemap.xml
export function createSEOServer(port: number, expressApp: any) {
  const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url || '', true);
    const pathname = parsedUrl.pathname;
    
    console.log(`🔍 SEO Server intercepting: ${pathname}`);
    
    // Handle robots.txt with raw HTTP
    if (pathname === '/robots.txt') {
      console.log('🤖 NATIVE HTTP: robots.txt');
      
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=86400',
        'X-Native-HTTP': 'true',
        'Access-Control-Allow-Origin': '*'
      });
      
      const robotsContent = `User-agent: *
Allow: /

# Sitemap
Sitemap: ${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}/sitemap.xml

# Google-specific rules
User-agent: Googlebot
Allow: /
Crawl-delay: 1

# Bing-specific rules  
User-agent: Bingbot
Allow: /
Crawl-delay: 1

# Block private areas
Disallow: /admin/
Disallow: /employee/
Disallow: /api/
Disallow: /uploads/private/`;

      res.end(robotsContent);
      return;
    }
    
    // Handle sitemap.xml with raw HTTP
    if (pathname === '/sitemap.xml') {
      console.log('🗺️ NATIVE HTTP: sitemap.xml');
      
      res.writeHead(200, {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=86400',
        'X-Native-HTTP': 'true',
        'Access-Control-Allow-Origin': '*'
      });
      
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const host = req.headers.host;
      const baseUrl = `${protocol}://${host}`;
      const currentDate = new Date().toISOString().split('T')[0];
      
      const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>${baseUrl}/</loc>
        <lastmod>${currentDate}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>1.0</priority>
    </url>
    <url>
        <loc>${baseUrl}/privacy</loc>
        <lastmod>${currentDate}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.3</priority>
    </url>
    <url>
        <loc>${baseUrl}/terms</loc>
        <lastmod>${currentDate}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.3</priority>
    </url>
    <url>
        <loc>${baseUrl}/cookies</loc>
        <lastmod>${currentDate}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.3</priority>
    </url>
</urlset>`;

      res.end(sitemapContent);
      return;
    }
    
    // For all other routes, proxy to Express
    console.log(`🔄 Proxying to Express: ${pathname}`);
    proxyToExpress(req, res, expressApp);
  });
  
  return server;
}

// Proxy non-SEO requests to Express
function proxyToExpress(req: any, res: any, expressApp: any) {
  // Create a new request object for Express
  const expressReq = Object.assign(req, {
    app: expressApp,
    route: undefined
  });
  
  const expressRes = Object.assign(res, {
    locals: {}
  });
  
  // Handle the request with Express
  expressApp.handle(expressReq, expressRes);
}