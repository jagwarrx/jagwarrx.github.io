// Opens a list/card link in the third panel instead of navigating.
// Falls back to normal navigation below 1000px. Hash keeps the open item linkable.
(function () {
  var reader = document.querySelector('.reader');
  if (!reader) return;
  var frame = reader.querySelector('iframe');
  var title = reader.querySelector('.title');
  var openPage = reader.querySelector('.open-page');
  var links = Array.prototype.slice.call(document.querySelectorAll('[data-reader] a[href$=".html"]'));

  function wide() { return matchMedia('(min-width: 1000px)').matches; }
  function itemOf(a) { return a.closest('li, .card'); }

  function open(href, replace) {
    var link = links.filter(function (a) { return a.getAttribute('href') === href; })[0];
    if (!link) return;
    frame.src = href;
    title.textContent = link.textContent;
    openPage.href = href;
    document.body.classList.add('reading');
    links.forEach(function (a) { itemOf(a).classList.toggle('selected', a === link); });
    var hash = '#' + href.replace(/\.html$/, '');
    if (location.hash !== hash) history[replace ? 'replaceState' : 'pushState'](null, '', hash);
  }

  function close(keepHistory) {
    frame.src = 'about:blank';
    title.textContent = '';
    document.body.classList.remove('reading');
    links.forEach(function (a) { itemOf(a).classList.remove('selected'); });
    if (!keepHistory && location.hash) history.pushState(null, '', location.pathname);
  }

  links.forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (!wide()) return;
      e.preventDefault();
      open(a.getAttribute('href'));
    });
  });
  reader.querySelector('.close').addEventListener('click', function (e) { e.preventDefault(); close(); });

  function fromHash() {
    var slug = location.hash.slice(1);
    if (slug && wide()) open(slug + '.html', true);
    else if (!slug) close(true);
  }
  addEventListener('popstate', fromHash);
  fromHash();
})();
