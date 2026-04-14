#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = process.cwd();
const ROUTES_FILE = path.join(ROOT, 'src', 'app', 'app.routes.ts');
const OUT_DIR = path.join(ROOT, 'dist', 'projet-ecom', 'browser');
const OUT_FILE = path.join(OUT_DIR, 'sitemap.xml');
const BASE_URL = process.env.SITE_URL || 'https://example.com';
const PRODUCTS_API = process.env.PRODUCTS_API_URL || null;

function extractStaticRoutes(fileContent) {
  const routeRegex = /path:\s*'(.*?)'/g;
  const paths = new Set();
  let m;
  while ((m = routeRegex.exec(fileContent)) !== null) {
    const route = m[1];
    if (!route.includes(':') && route !== '') {
      paths.add('/' + route.replace(/^\//, ''));
    }
    if (route === '') {
      paths.add('/');
    }
  }
  return Array.from(paths);
}

function writeSitemap(urls) {
  const now = new Date().toISOString();
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'
  ];

  urls.forEach(u => {
    xml.push('  <url>');
    xml.push(`    <loc>${u}</loc>`);
    xml.push(`    <lastmod>${now}</lastmod>`);
    xml.push('    <changefreq>weekly</changefreq>');
    xml.push('    <priority>0.7</priority>');
    xml.push('  </url>');
  });

  xml.push('</urlset>');

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, xml.join('\n'));
  console.log('Wrote sitemap to', OUT_FILE);
}

async function fetchProducts() {
  if (!PRODUCTS_API) return [];
  return new Promise((resolve) => {
    https.get(PRODUCTS_API, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          // Expect array of products with id or slug
          const urls = [];
          if (Array.isArray(json)) {
            json.forEach(p => {
              if (p.id) urls.push('/product/' + p.id);
              else if (p.slug) urls.push('/product/' + p.slug);
            });
          }
          resolve(urls);
        } catch (e) {
          console.error('Failed to parse products API response', e.message);
          resolve([]);
        }
      });
    }).on('error', (err) => {
      console.error('Failed to fetch products', err.message);
      resolve([]);
    });
  });
}

(async () => {
  try {
    const routesSrc = fs.readFileSync(ROUTES_FILE, 'utf8');
    const staticPaths = extractStaticRoutes(routesSrc);
    const productPaths = await fetchProducts();

    const unique = new Set();
    staticPaths.forEach(p => unique.add(p));
    productPaths.forEach(p => unique.add(p));

    const urls = Array.from(unique).map(p => {
      if (p === '/') return BASE_URL + '/';
      return BASE_URL.replace(/\/$/, '') + p;
    });

    writeSitemap(urls);
  } catch (e) {
    console.error('Error generating sitemap:', e.message);
    process.exit(1);
  }
})();
