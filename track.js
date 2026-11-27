/* Bardeque – ανώνυμη καταγραφή επισκέψεων → Telegram + μπάνερ cookies
   Χωρίς συγκατάθεση: τίποτα δεν αποθηκεύεται στη συσκευή (μόνο ανώνυμη ειδοποίηση για τη σελίδα).
   Με συγκατάθεση: η επίσκεψη ενώνεται σε όλες τις σελίδες + μετρητής επιστροφών. Καμία IP δεν αποθηκεύεται. */
(function () {
  var API = 'https://cuagotbmdxmuxnwnoybu.supabase.co/functions/v1/visit-notify';
  var ss = window.sessionStorage, ls = window.localStorage;

  function lsGet(k) { try { return ls.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { ls.setItem(k, v); } catch (e) {} }

  if (location.search.indexOf('me=1') > -1) lsSet('bq_me', '1');
  var isMe = !!lsGet('bq_me');
  var consent = lsGet('bq_consent'); // 'yes' | 'no' | null

  /* ---------------- μπάνερ cookies ---------------- */
  function banner() {
    if (consent) return;
    var en = (document.documentElement.lang || '').indexOf('en') === 0;
    var T = en ? {
      t: 'We use only anonymous statistics to improve our site. No ads, no personal data.',
      a: 'Accept', d: 'Essential only', m: 'Learn more'
    } : {
      t: 'Χρησιμοποιούμε μόνο ανώνυμα στατιστικά για να βελτιώνουμε το σάιτ. Χωρίς διαφημίσεις, χωρίς προσωπικά δεδομένα.',
      a: 'Αποδοχή', d: 'Μόνο απαραίτητα', m: 'Περισσότερα'
    };
    var css = document.createElement('style');
    css.textContent =
      '#bqc{position:fixed;left:16px;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:99999;max-width:560px;margin:0 auto;' +
      'background:rgba(13,13,12,.97);border:1px solid rgba(212,175,55,.35);color:#F3EBDD;padding:18px 18px 16px;' +
      'font:300 13.5px/1.55 Inter,system-ui,Arial,sans-serif;box-shadow:0 18px 50px rgba(0,0,0,.5);backdrop-filter:blur(8px);' +
      'opacity:0;transform:translateY(12px);transition:.4s}' +
      '#bqc.on{opacity:1;transform:none}' +
      '#bqc p{margin:0 0 14px}#bqc a{color:#D4AF37;text-decoration:underline;text-underline-offset:3px}' +
      '#bqc .r{display:flex;gap:10px;flex-wrap:wrap}' +
      '#bqc button{flex:1;min-width:130px;cursor:pointer;padding:12px 14px;font:500 10.5px Inter,system-ui,sans-serif;letter-spacing:.22em;text-transform:uppercase;border:1px solid #D4AF37}' +
      '#bqc .y{background:#D4AF37;color:#0a0a0a}#bqc .n{background:transparent;color:#D4AF37}';
    document.head.appendChild(css);
    var el = document.createElement('div');
    el.id = 'bqc'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Cookies');
    el.innerHTML = '<p>' + T.t + ' <a href="/privacy.html">' + T.m + '</a></p>' +
      '<div class="r"><button class="n" type="button">' + T.d + '</button><button class="y" type="button">' + T.a + '</button></div>';
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('on'); });
    function close(v) {
      consent = v; lsSet('bq_consent', v);
      el.classList.remove('on'); setTimeout(function () { el.remove(); }, 400);
      if (v === 'yes') upgrade();
    }
    el.querySelector('.y').onclick = function () { close('yes'); };
    el.querySelector('.n').onclick = function () { close('no'); };
  }
  if (document.body) banner(); else document.addEventListener('DOMContentLoaded', banner);

  if (isMe) return;

  /* ---------------- αποθήκευση: session μόνο με συγκατάθεση ---------------- */
  var mem = {};
  function get(k, d) {
    if (consent === 'yes') { try { var v = ss.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
    return k in mem ? mem[k] : d;
  }
  function put(k, v) {
    mem[k] = v;
    if (consent === 'yes') { try { ss.setItem(k, JSON.stringify(v)); } catch (e) {} }
  }
  function upgrade() { // ο επισκέπτης δέχτηκε: συνέχισε την ίδια επίσκεψη και στις επόμενες σελίδες
    for (var k in mem) put(k, mem[k]);
    if (!lsGet('bq_n')) lsSet('bq_n', '1');
  }

  var st = get('bq_t', null) || { start: Date.now(), sections: [], clicks: [], booking: '', scroll: 0 };
  var page = location.pathname.replace(/index\.html$/, '') || '/';
  var maxScroll = 0, dirty = false;

  function add(list, v) { if (st[list].indexOf(v) < 0) { st[list].push(v); dirty = true; } }
  function save() { put('bq_t', st); }

  function payload(final) {
    var v = get('bq_v', null);
    if (!v || !v.id) return null;
    return JSON.stringify({
      action: 'update', id: v.id, token: v.token, page: page,
      elapsed: Math.round((Date.now() - st.start) / 1000),
      scroll: Math.max(st.scroll, maxScroll), sections: st.sections, clicks: st.clicks,
      booking: st.booking, final: !!final
    });
  }
  function send(final) {
    st.scroll = Math.max(st.scroll, maxScroll); save();
    var body = payload(final); if (!body) { dirty = true; return; }
    dirty = false;
    if (final && navigator.sendBeacon) { navigator.sendBeacon(API, new Blob([body], { type: 'text/plain' })); return; }
    try { fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: body, keepalive: true }); } catch (e) {}
  }

  /* ---- 1. Νέα επίσκεψη ---- */
  if (!get('bq_v', null)) {
    var n = 1;
    if (consent === 'yes') { n = (parseInt(lsGet('bq_n'), 10) || 0) + 1; lsSet('bq_n', String(n)); }
    var src = '';
    try { src = new URLSearchParams(location.search).get('src') || ''; } catch (e) {}
    put('bq_v', { pending: true });
    save();
    fetch(API, {
      method: 'POST', headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ page: page, ref: document.referrer, lang: navigator.language, ua: navigator.userAgent, src: src, n: n })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.id) { put('bq_v', { id: j.id, token: j.token }); if (dirty) send(false); }
    }).catch(function () {});
  } else {
    dirty = true; // νέα σελίδα μέσα στην ίδια επίσκεψη
    setTimeout(function () { send(false); }, 1500);
  }

  /* ---- 2. Ενότητες που είδε & πόσο κύλισε ---- */
  var ids = ['top', 'story', 'book', 'gallery'];
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) add('sections', e.target.getAttribute('data-bqs')); });
    }, { threshold: 0.35 });
    ids.forEach(function (id) { var el = document.getElementById(id); if (el) { el.setAttribute('data-bqs', id); io.observe(el); } });
    var f = document.querySelector('footer'); if (f) { f.setAttribute('data-bqs', 'footer'); io.observe(f); }
  }
  addEventListener('scroll', function () {
    var h = document.documentElement, p = (h.scrollTop + innerHeight) / Math.max(h.scrollHeight, 1) * 100;
    if (p > maxScroll) maxScroll = Math.min(100, Math.round(p));
  }, { passive: true });

  /* ---- 3. Κλικ σε επαφή / social ---- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a'); if (!a) return;
    var h = a.getAttribute('href') || '', k = '';
    if (/^tel:/.test(h)) k = 'call';
    else if (/wa\.me|whatsapp/.test(h)) k = 'whatsapp';
    else if (/instagram\.com/.test(h)) k = 'instagram';
    else if (/^mailto:/.test(h)) k = 'email';
    else if (/\.vcf/.test(h)) k = 'contact';
    if (k) { add('clicks', k); send(false); }
  }, true);

  /* ---- 4. Κράτηση: ξεκίνησε / ολοκληρώθηκε ---- */
  var book = document.getElementById('book');
  if (book) {
    var mark = function () { if (!st.booking) { st.booking = 'started'; save(); send(false); } };
    book.addEventListener('click', mark, true);
    book.addEventListener('input', mark, true);
  }
  try {
    var orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === 'bq-done' && this === ss) { st.booking = 'done'; save(); send(false); }
      return orig.apply(this, arguments);
    };
  } catch (e) {}

  /* ---- 5. Αποχώρηση ---- */
  document.addEventListener('visibilitychange', function () { send(document.visibilityState === 'hidden'); });
  addEventListener('pagehide', function () { send(true); });
  setInterval(function () { if (dirty && document.visibilityState === 'visible') send(false); }, 20000);
})();
