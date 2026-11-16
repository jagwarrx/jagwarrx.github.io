// toc.js: builds an "On this page" list from the essay's headings, sticky on the right, highlights the section in view.
(function () {
  var main = document.querySelector('.doc main');
  if (!main) return;
  var hs = [].slice.call(main.querySelectorAll('h2, h3')).filter(function (h) { return h.textContent.trim(); });
  if (hs.filter(function (h) { return h.tagName === 'H2'; }).length < 3) return;
  var used = {};
  var nav = document.createElement('nav');
  nav.className = 'toc-side';
  nav.setAttribute('aria-label', 'On this page');
  nav.innerHTML = '<div class="toc-label">On this page</div>';
  var links = hs.map(function (h) {
    if (!h.id) {
      var id = h.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
      while (used[id]) id += '-';
      h.id = id;
    }
    used[h.id] = 1;
    var a = document.createElement('a');
    a.href = '#' + h.id;
    a.textContent = h.textContent.trim();
    if (h.tagName === 'H3') a.className = 'sub';
    nav.appendChild(a);
    return a;
  });
  var wrap = document.querySelector('.doc .wrap');
  wrap.classList.add('has-toc');
  wrap.appendChild(nav);
  var current = null;
  function spy() {
    var y = window.scrollY + 120, idx = 0;
    hs.forEach(function (h, i) { if (h.offsetTop <= y) idx = i; });
    if (current !== idx) {
      if (current !== null) links[current].classList.remove('on');
      links[idx].classList.add('on');
      current = idx;
    }
  }
  window.addEventListener('scroll', spy, { passive: true });
  spy();
})();
