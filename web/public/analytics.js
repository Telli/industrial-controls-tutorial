/* Shared by the React app and the standalone reading pages. Measurement IDs are public. */
(() => {
  const id = 'G-GLF0GGX9RJ';
  const key = 'industrial-controls-analytics';
  const production = location.hostname === 'ic.agentqi.dev' || location.hostname === 'www.ic.agentqi.dev';
  if (!production) return;
  let consent;
  try { consent = localStorage.getItem(key); } catch { /* Use this visit only. */ }
  const privacySignal = navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';
  if (privacySignal) consent = 'denied';
  let started = false;
  let current;
  let lastLocation;
  let previous = document.referrer ? new URL(document.referrer).origin : '';
  let panel;
  let settings;
  const tag = function () { (window.dataLayer = window.dataLayer || []).push(arguments); };
  function sendView() {
    if (!started || consent !== 'granted' || !current || current.location === lastLocation) return;
    const context = {
      page_title: current.title, page_location: current.location,
      page_referrer: previous, content_group: current.group,
    };
    tag('set', context);
    tag('event', 'page_view', context);
    previous = current.location;
    lastLocation = current.location;
  }
  function start() {
    if (consent !== 'granted' || privacySignal) return;
    window['ga-disable-' + id] = false;
    if (!started) {
      started = true;
      window.gtag = tag;
      tag('consent', 'default', {
        analytics_storage: 'granted', ad_storage: 'denied',
        ad_user_data: 'denied', ad_personalization: 'denied',
      });
      tag('js', new Date());
      tag('config', id, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
      document.head.append(script);
    } else {
      tag('consent', 'update', { analytics_storage: 'granted' });
    }
    sendView();
  }
  function choose(value) {
    consent = value;
    try { localStorage.setItem(key, value); } catch { /* Keep the choice for this visit. */ }
    panel.hidden = true;
    settings.textContent = 'Analytics: ' + (value === 'granted' ? 'on' : 'off');
    if (value === 'granted') start();
    else {
      window['ga-disable-' + id] = true;
      if (started) tag('consent', 'update', { analytics_storage: 'denied' });
      // Remove GA cookies when visitors withdraw their choice.
      document.cookie.split(';').forEach(cookie => {
        const name = cookie.trim().split('=')[0];
        if (!/^_ga(?:_|$)/.test(name)) return;
        for (const domain of ['', '; domain=ic.agentqi.dev', '; domain=.agentqi.dev']) {
          document.cookie = name + '=; Max-Age=0; path=/' + domain;
        }
      });
    }
  }
  window.addEventListener('course:pageview', event => {
    const { path, title, group } = event.detail || {};
    if (typeof path !== 'string' || !/^\/(?:$|tutorials$|labs(?:\/[a-z0-9-]+)?$)/.test(path)) return;
    current = { location: location.origin + '/#' + path, title, group };
    sendView();
  });
  function ready() {
    if (!document.getElementById('root')) {
      current = {
        location: location.origin + location.pathname,
        title: document.title, group: location.pathname.includes('english-articles') ? 'Tutorials' : 'Handbook',
      };
    }
    const style = document.createElement('style');
    style.textContent = '.analytics-settings{position:fixed;bottom:8px;left:8px;z-index:90;font:12px system-ui;color:#18365f;background:#fff;border:1px solid #aabbd2;border-radius:6px;padding:6px 10px;cursor:pointer}.analytics-panel{position:fixed;bottom:48px;left:12px;width:min(390px,calc(100vw - 24px));box-sizing:border-box;z-index:1000;background:#fff;color:#18365f;border:1px solid #aabbd2;border-radius:12px;padding:18px;box-shadow:0 8px 32px #10233e33;font:14px/1.5 system-ui}.analytics-panel[hidden]{display:none}.analytics-panel p{margin:8px 0 14px}.analytics-panel button{font:inherit;padding:8px 14px;border:1px solid #18365f;border-radius:6px;cursor:pointer;margin-right:8px;background:#fff;color:#18365f}.analytics-panel button:first-of-type{background:#18365f;color:#fff}@media print{.analytics-settings,.analytics-panel{display:none!important}}';
    document.head.append(style);
    panel = document.createElement('section');
    panel.className = 'analytics-panel';
    panel.setAttribute('aria-label', 'Usage analytics preferences');
    panel.innerHTML = '<strong>Help improve these lessons</strong><p>Allow Google Analytics to measure page visits, reading engagement and downloads? We do not send exercise answers or search text. Your choice is optional and can be changed here.</p><button type="button">Allow analytics</button><button type="button">No thanks</button>';
    panel.querySelectorAll('button')[0].addEventListener('click', () => choose('granted'));
    panel.querySelectorAll('button')[1].addEventListener('click', () => choose('denied'));
    panel.hidden = consent === 'granted' || consent === 'denied';
    settings = document.createElement('button');
    settings.type = 'button';
    settings.className = 'analytics-settings';
    settings.textContent = 'Analytics: ' + (consent === 'granted' ? 'on' : 'off');
    settings.addEventListener('click', () => {
      if (privacySignal) {
        settings.textContent = 'Analytics off: browser privacy preference';
        return;
      }
      panel.hidden = !panel.hidden;
      if (!panel.hidden) panel.querySelector('button').focus();
    });
    document.body.append(panel, settings);
    start();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once: true });
  else ready();
})();
