// Local-only checks for the simplified page hierarchy.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:8765');
    await page.locator('#llgUnlockInput').fill(process.env.TEST_UNLOCK_CODE);
    await page.locator('#llgUnlockBtn').click();
    await page.locator('#llgLockScreen').waitFor({ state: 'hidden' });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [view, first] of [['plants','.pageTools'], ['wishlist','#wishlistBudgetPrompt'], ['budget','.budgetScrap'], ['propagation','#propSellPrompt']]) {
        await page.evaluate(view => go(view), view);
        assert.ok(await page.locator('#' + view).isVisible());
        assert.ok(await page.locator('#pageTitle').innerText());
        assert.ok(await page.locator('#pageSub').innerText());
        assert.equal(await page.locator('.pageRibbon').count(), 0);
        const layout = await page.evaluate(({view,first}) => {
          const section = document.getElementById(view), content = section.querySelector(first);
          return { gap: content.getBoundingClientRect().top - section.getBoundingClientRect().top, overflow: document.documentElement.scrollWidth > innerWidth };
        }, {view,first});
        assert.ok(layout.gap >= 0 && layout.gap <= 24, JSON.stringify({width,view,...layout}));
        assert.equal(layout.overflow, false, view + ' overflow');
        assert.ok(!/sticker book/i.test(await page.locator('#' + view).innerText()));
        if (process.env.TEST_ARTIFACT_DIR) await page.screenshot({path: `${process.env.TEST_ARTIFACT_DIR}/hierarchy-${view}-${width}.png`});
        console.log('PASS', width, view, 'top gap', layout.gap);
      }
    }
    for (const [view, label] of [['plants', /Add plant/i], ['wishlist', /Add wishlist plant/i], ['propagation', /Start a cutting/i], ['budget', /Add purchase/i]]) {
      await page.evaluate(view => go(view), view);
      await page.locator('#' + view).getByRole('button', {name: label}).click();
      assert.ok(await page.locator('#sheet').isVisible());
      await page.getByRole('button', {name: 'Close', exact: true}).click();
    }
    assert.deepEqual(errors, []);
    console.log('PASS all four action forms; no browser errors');
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
