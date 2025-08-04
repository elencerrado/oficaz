import { createServer } from 'http';
import { URL } from 'url';

// ⚠️ CRITICAL SEO SERVER - DO NOT MODIFY
// Native HTTP server that ONLY handles SEO routes without any framework interference

const PORT = 3001; // Different port to avoid conflicts

const server = createServer((req, res) => {
  const url = new URL(req.url || '', `http://localhost:${PORT}`);
  const pathname = url.pathname;

  console.log(`🌐 Native SEO Server - Request: ${req.method} ${pathname}`);

  // Only handle robots.txt and sitemap.xml
  if (pathname === '/robots.txt') {
    console.log('📋 Native server serving robots.txt');
    
    const robotsContent = `User-agent: *
Allow: /

# Sitemap
Sitemap: https://oficaz.es/sitemap.xml

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

    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Length': Buffer.byteLength(robotsContent, 'utf8'),
      'Cache-Control': 'public, max-age=86400',
      'X-SEO-Server': 'native-http'
    });
    res.end(robotsContent);
    return;
  }

  if (pathname === '/sitemap.xml') {
    console.log('🗺️ Native server serving sitemap.xml');
    
    const currentDate = new Date().toISOString().split('T')[0];
    const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>https://oficaz.es/</loc>
        <lastmod>${currentDate}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>1.0</priority>
    </url>
    <url>
        <loc>https://oficaz.es/privacy</loc>
        <lastmod>${currentDate}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.3</priority>
    </url>
    <url>
        <loc>https://oficaz.es/terms</loc>
        <lastmod>${currentDate}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.3</priority>
    </url>
    <url>
        <loc>https://oficaz.es/cookies</loc>
        <lastmod>${currentDate}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.3</priority>
    </url>
</urlset>`;

    res.writeHead(200, {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Length': Buffer.byteLength(sitemapContent, 'utf8'),
      'Cache-Control': 'public, max-age=86400',
      'X-SEO-Server': 'native-http'
    });
    res.end(sitemapContent);
    return;
  }

  // For any other route, return 404
  res.writeHead(404, {
    'Content-Type': 'text/plain; charset=utf-8'
  });
  res.end('Not Found - SEO Server only handles /robots.txt and /sitemap.xml');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Native SEO Server running on port ${PORT}`);
  console.log(`📋 Robots.txt: http://localhost:${PORT}/robots.txt`);
  console.log(`🗺️ Sitemap.xml: http://localhost:${PORT}/sitemap.xml`);
});

export { server };