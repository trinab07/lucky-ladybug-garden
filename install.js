/* Install-first gate. Never initialize garden code in an ordinary tab. */
(() => {
  'use strict';
  const mode = matchMedia('(display-mode: standalone)');
  const standalone = () => mode.matches || navigator.standalone === true;
  const byId = id => document.getElementById(id);
  const unlockKey = 'llg_unlocked_v1', deviceKey = 'llg_device_id_v1';
  let started = false, starting = false, busy = false, installPrompt;
  const message = text => { byId('llgUnlockError').textContent = text; };
  async function startGarden() {
    if (!standalone() || started || starting) return;
    starting = true;
    try {
      for (const placeholder of document.querySelectorAll('script[data-garden-script]')) {
        const script = document.createElement('script');
        if (placeholder.id) { script.id = placeholder.id; placeholder.removeAttribute('id'); }
        if (placeholder.dataset.src) {
          script.src = placeholder.dataset.src;
          await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = () => reject(new Error('Could not load the garden. Check your connection and reopen this icon.'));
            placeholder.replaceWith(script);
          });
        } else { script.textContent = placeholder.textContent; placeholder.replaceWith(script); }
      }
      started = true;
      if (standalone()) { byId('gardenApp').hidden = false; byId('gardenApp').inert = false; byId('llgAccess').hidden = true; }
    } catch (error) { message(error.message); }
    finally { starting = false; }
  }
  function updateGate() {
    const installed = standalone();
    byId('installPanel').hidden = installed;
    byId('activationForm').hidden = !installed;
    byId('accessTitle').textContent = installed ? 'Activate your garden' : 'Install Lucky Lady Bug Garden';
    byId('gardenApp').hidden = true; byId('gardenApp').inert = true; byId('llgAccess').hidden = false;
    if (!installed) return;
    try {
      if (localStorage.getItem(unlockKey) === 'yes') {
        if (started) { byId('gardenApp').hidden = false; byId('gardenApp').inert = false; byId('llgAccess').hidden = true; }
        else startGarden();
      }
    } catch { message('Local storage is unavailable. Use a regular installed app with storage enabled. Activation is blocked to protect your purchase.'); }
  }
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  byId('deviceHint').textContent = ios ? 'It looks like you are using an iPhone or iPad.' : android ? 'It looks like you are using Android.' : 'Use a supported phone browser to install, or your desktop browser’s Install app option if available.';
  byId('installSteps').innerHTML = ios
    ? '<ol><li>Open this page in Safari.</li><li>Tap Share, then Add to Home Screen.</li><li>If shown, leave Open as Web App enabled and tap Add.</li><li>Open the new Home Screen icon to activate.</li></ol>'
    : android ? '<ol><li>Open this page in Chrome.</li><li>Open the three-dot menu and choose Install app or Add to Home screen, then Install.</li><li>Open the new Home Screen icon to activate.</li></ol>'
    : '<p>If your browser offers Install app, install and open the app window. Otherwise use Safari on iPhone or Chrome on Android. Activation is unavailable in an ordinary browser tab.</p>';
  try { byId('existingGarden').hidden = !localStorage.getItem('llg_full_app_v58'); } catch {}
  byId('activationForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (!standalone() || busy) return;
    const code = byId('llgUnlockInput').value.trim();
    if (!code) { message('Enter your Etsy order number.'); return; }
    busy = true; byId('llgUnlockBtn').disabled = true; message('');
    try {
      // Check writable storage before a request can consume the activation.
      const probe = 'llg_storage_probe'; localStorage.setItem(probe, '1'); localStorage.removeItem(probe);
      let deviceId = localStorage.getItem(deviceKey);
      if (!deviceId) { deviceId = crypto.randomUUID(); localStorage.setItem(deviceKey, deviceId); }
      const response = await fetch('/.netlify/functions/etsy-verify', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,deviceId})});
      if (!response.ok) throw new Error('Activation could not finish. Check your connection and try again from this icon.');
      const result = await response.json();
      if (!result.valid) { message(result.message || 'That order number was not recognized. Check your Etsy purchase confirmation.'); return; }
      localStorage.setItem(unlockKey, 'yes');
      if (localStorage.getItem(unlockKey) !== 'yes') throw new Error('Activation could not be saved. Reopen this icon with storage enabled.');
      updateGate();
    } catch (error) { message(error.name === 'QuotaExceededError' || error.name === 'SecurityError' ? 'Storage is unavailable. Enable local storage and reopen this installed app. Do not clear existing garden data.' : error.message); }
    finally { busy = false; byId('llgUnlockBtn').disabled = false; }
  });
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; byId('installButton').hidden = false; });
  byId('installButton').addEventListener('click', async () => {
    if (!installPrompt) return;
    try { await installPrompt.prompt(); await installPrompt.userChoice; }
    finally { installPrompt = null; byId('installButton').hidden = true; }
  });
  // Installing never activates or unlocks the ordinary browser tab.
  window.addEventListener('appinstalled', () => { byId('installButton').hidden = true; });
  mode.addEventListener('change', updateGate);
  window.addEventListener('pageshow', updateGate);
  updateGate();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => { if (!standalone()) message('Installation support could not load. Check your connection and reload this page.'); });
})();
