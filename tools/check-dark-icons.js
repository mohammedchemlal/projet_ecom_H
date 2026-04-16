const puppeteer = require('puppeteer');
const fs = require('fs');
(async ()=>{
  const outDir = './tmp/dark-check';
  try{ fs.mkdirSync(outDir, { recursive: true }); } catch(e){}

  const routes = [
    '/',
    'products',
    'product/5',
    'cart',
    'wishlist',
    'auth/login'
  ];

  const browser = await puppeteer.launch({args:['--no-sandbox','--disable-setuid-sandbox']});
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  const results = [];

  for(const route of routes){
    const url = `http://localhost:8080/${route}`;
    try{
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    }catch(e){
      results.push({ route, url, error: e.message });
      continue;
    }

    const snapshotPath = `${outDir}/${route.replace(/\//g,'_') || 'home'}.png`;
    await page.screenshot({ path: snapshotPath, fullPage: true });

    const icons = await page.evaluate(()=>{
      const nodes = Array.from(document.querySelectorAll('.pi, i[class^="pi-"], i[class*=" pi-"]'));
      if(nodes.length===0) return { count:0 };
      return nodes.slice(0,50).map(el=>{
        const comp = window.getComputedStyle(el);
        const before = window.getComputedStyle(el, '::before');
        return {
          tag: el.tagName,
          classes: el.className,
          fontFamily: comp.getPropertyValue('font-family'),
          color: comp.getPropertyValue('color'),
          opacity: comp.getPropertyValue('opacity'),
          display: comp.getPropertyValue('display'),
          beforeContent: before.getPropertyValue('content'),
          beforeColor: before.getPropertyValue('color'),
          beforeOpacity: before.getPropertyValue('opacity')
        };
      });
    });

    results.push({ route, url, snapshotPath, iconsCount: icons.count||icons.length, icons: icons.slice(0,20) });
  }

  const out = { timestamp: new Date().toISOString(), results };
  fs.writeFileSync(outDir+'/report.json', JSON.stringify(out, null, 2));
  console.log('Dark-mode icon check finished. Report:', outDir + '/report.json');
  await browser.close();
})();
