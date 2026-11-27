/* Bardeque – ανώνυμη καταγραφή επισκέψεων → Telegram (χωρίς cookies, χωρίς αποθήκευση IP) */
(function () {
  var API = 'https://cuagotbmdxmuxnwnoybu.supabase.co/functions/v1/visit-notify';
  var ss = window.sessionStorage, ls = window.localStorage;
  try {
    if (location.search.indexOf('me=1') > -1) ls.setItem('bq_me', '1');
    if (ls.getItem('bq_me')) return;
  } catch (e) { return; }

  function get(k, d) { try { var v = ss.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function put(k, v) { try { ss.setItem(k, JSON.stringify(v)); } catch (e) {} }

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
    var body = payload(final); if (!body) return;
    dirty = false;
    if (final && navigator.sendBeacon) { navigator.sendBeacon(API, new Blob([body], { type: 'text/plain' })); return; }
    try { fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: body, keepalive: true }); } catch (e) {}
  }

  // ---- 1. Νέα επίσκεψη (μία φορά ανά επίσκεψη) ----
  if (!get('bq_v', null)) {
    var n = 1;
    try { n = (parseInt(ls.getItem('bq_n'), 10) || 0) + 1; ls.setItem('bq_n', String(n)); } catch (e) {}
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

  // ---- 2. Ενότητες που είδε & πόσο κύλισε ----
  var names = { top: 'top', story: 'story', book: 'book', gallery: 'gallery' };
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) add('sections', names[e.target.id] || e.target.id); });
    }, { threshold: 0.35 });
    Object.keys(names).forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });
    var f = document.querySelector('footer'); if (f) { names.footer = 'footer'; f.id = f.id || 'footer'; io.observe(f); }
  }
  addEventListener('scroll', function () {
    var h = document.documentElement, p = (h.scrollTop + innerHeight) / Math.max(h.scrollHeight, 1) * 100;
    if (p > maxScroll) maxScroll = Math.min(100, Math.round(p));
  }, { passive: true });

  // ---- 3. Κλικ σε επαφή / social ----
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

  // ---- 4. Κράτηση: ξεκίνησε / ολοκληρώθηκε ----
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

  // ---- 5. Αποχώρηση: χρόνος παραμονής, τελική ενημέρωση ----
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') send(true);
    else send(false);
  });
  addEventListener('pagehide', function () { send(true); });
  setInterval(function () { if (dirty && document.visibilityState === 'visible') send(false); }, 20000);
})();
