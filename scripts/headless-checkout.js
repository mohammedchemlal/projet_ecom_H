const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const LOG = (v) => console.log(JSON.stringify(v, null, 2));

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  // Capture console messages
  page.on('console', (msg) => {
    const args = msg.args();
    Promise.all(args.map((a) => a.jsonValue())).then((vals) => {
      console.log('[PAGE-LOG]', vals.join(' '));
    }).catch(() => {});
  });

  // Intercept request/response for /api/orders
  let captured = { request: null, response: null };

  page.on('request', (req) => {
    try {
      if (req.url().includes('/api/orders') && req.method() === 'POST') {
        captured.request = {
          url: req.url(),
          method: req.method(),
          headers: req.headers(),
          postData: req.postData()
        };
        console.log('[CAPTURE] request captured');
      }
    } catch (e) {
      console.error(e);
    }
  });

  page.on('response', async (res) => {
    try {
      if (res.url().includes('/api/orders') && res.request().method() === 'POST') {
        const headers = res.headers();
        let body = null;
        try { body = await res.text(); } catch (e) { body = `<unable to read>`; }
        captured.response = { status: res.status(), headers, body };
        console.log('[CAPTURE] response captured');
      }
    } catch (e) {
      console.error(e);
    }
  });

  // Prepare localStorage payloads (adjust as needed)
  const appUrl = 'http://localhost:57655/';
  const LOCAL = {
    authToken: '4|wOGkm6COcTOGMpNusURY2tDJplY8euWwE1GrPOr1a41de5dc',
    currentUser: JSON.stringify({ id: 2, fullName: 'testuser', role: 'visitor' }),
    cart: JSON.stringify([{ productId: 1, product: { id:1, name:'Collier Elegance Doree', price:299.99, discountPrice:199.99 }, quantity: 1 }]),
    // set an applied promo (WELCOME10) so discount is sent
    cartPromo: JSON.stringify({ code: 'WELCOME10', discount: 10, type: 'percentage' })
  };

  // Ensure localStorage is seeded before the app bootstraps
  await page.evaluateOnNewDocument((local) => {
    try {
      localStorage.setItem('authToken', local.authToken);
      localStorage.setItem('currentUser', local.currentUser);
      localStorage.setItem('cart', local.cart);
      localStorage.setItem('cartPromo', local.cartPromo);
    } catch (e) {
      // noop
    }
  }, LOCAL);

  // Now load the app (localStorage already seeded)
  await page.goto(appUrl, { waitUntil: 'networkidle2' }).catch(() => {});

  // Navigate to checkout route using history API to ensure SPA routing works
  await page.goto(appUrl, { waitUntil: 'networkidle2' }).catch(() => {});
  await page.evaluate(() => { history.pushState({}, '', '/checkout'); window.dispatchEvent(new PopStateEvent('popstate')); });
  // give SPA time to react and lazy-load the component
  await new Promise((r) => setTimeout(r, 1200));

  // Wait for form to exist (longer timeout due to lazy loading)
  try {
    await page.waitForSelector('form.checkout-form', { timeout: 10000 });
  } catch (e) {
    console.error('Checkout form not found');
  }

  // Diagnostic: list forms and inputs present
  try {
    const diag = await page.evaluate(() => {
      const forms = document.querySelectorAll('form');
      return {
        formsCount: forms.length,
        firstForm: forms.length ? forms[0].outerHTML.slice(0, 200) : null,
        checkoutFormHTML: document.querySelector('form.checkout-form')?.outerHTML?.slice(0, 200) ?? null,
        inputs: Array.from(document.querySelectorAll('input')).map((i) => ({ formControlName: i.getAttribute('formControlName'), type: i.type, outer: i.outerHTML.slice(0, 200) }))
      };
    });
    console.log('--- PAGE DIAGNOSTIC ---');
    console.log(JSON.stringify(diag, null, 2));
  } catch (e) {
    console.error('Diag eval failed', e);
  }

  // Fill required fields and submit
  try {
    await page.click('input[formControlName="fullName"]');
    await page.type('input[formControlName="fullName"]', 'Jean Test');
    await page.click('input[formControlName="address"]');
    await page.type('input[formControlName="address"]', '1 Rue Test, Casablanca');
    await page.click('input[formControlName="phone"]');
    await page.type('input[formControlName="phone"]', '0612345678');
  } catch (e) {
    console.error('Unable to fill form fields', e);
  }

  // Submit the form by clicking the submit button and wait for the POST to /api/orders
  try {
    await page.click('button[type="submit"]');
  } catch (e) {
    console.error('Click submit failed', e);
  }

  // wait up to 8s for the network response to be captured
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 8; i++) {
    if (captured.response || captured.request) break;
    // eslint-disable-next-line no-await-in-loop
    await wait(1000);
  }

  console.log('--- CAPTURED REQUEST ---');
  console.log(JSON.stringify(captured.request, null, 2));
  console.log('--- CAPTURED RESPONSE ---');
  console.log(JSON.stringify(captured.response, null, 2));

  // Save to file
  fs.writeFileSync('scripts/headless-capture.json', JSON.stringify(captured, null, 2));

  await browser.close();
})();
