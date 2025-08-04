# Oficaz SEO Files - Netlify CDN

## Setup Instructions:

1. Create a new Netlify account at https://netlify.com
2. Connect this folder as a new site (drag & drop deployment)
3. Note the generated URL (e.g., `amazing-site-123.netlify.app`)
4. Update the redirect URLs in your main application

## Files:
- `robots.txt` - Robots exclusion file
- `sitemap.xml` - XML sitemap with current date
- `netlify.toml` - Configuration to force correct MIME types

## Usage:
Replace the redirect URLs in server/index.ts with your Netlify URLs:
- https://your-site.netlify.app/robots.txt
- https://your-site.netlify.app/sitemap.xml

This ensures Google PageSpeed Insights will see proper content-types served by Netlify's CDN infrastructure.