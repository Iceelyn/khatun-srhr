// Bottom tab bar shared by the public pages. Labels follow <html lang>, which each page sets.
(() => {
  const icon = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const TABS = [
    { href: '/', match: ['/', '/chat'], mn: 'Чат', en: 'Chat', icon: icon('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>') },
    { href: '/check', match: ['/check'], mn: 'Асуумж', en: 'Check', icon: icon('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 12l2 2 4-4"/>') },
    { href: '/check#clinics', match: [], mn: 'Эмнэлэг', en: 'Clinics', icon: icon('<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><path d="M12 7v5M9.5 9.5h5"/>') },
    { href: '/feedback', match: ['/feedback'], mn: 'Санал', en: 'Feedback', icon: icon('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>') },
  ];
  const nav = document.createElement('nav');
  nav.className = 'tabbar';
  nav.setAttribute('aria-label', 'Main');
  const links = TABS.map((t) => {
    const a = document.createElement('a');
    a.href = t.href;
    const here = location.pathname === '/check' && location.hash === '#clinics' ? t.href === '/check#clinics' : t.match.includes(location.pathname);
    if (here) a.setAttribute('aria-current', 'page');
    if (t.href === '/check') a.className = 'cta'; // our main goal: get people to the check
    a.innerHTML = `${t.icon}<span></span>`;
    // Same-page hash link: the check page listens for hashchange to open the clinic list.
    nav.appendChild(a);
    return [a, t];
  });
  const label = () => {
    const lang = document.documentElement.lang === 'en' ? 'en' : 'mn';
    for (const [a, t] of links) a.querySelector('span').textContent = t[lang];
  };
  label();
  new MutationObserver(label).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  document.body.classList.add('has-nav');
  document.body.appendChild(nav);
  window.addEventListener('hashchange', () => {
    for (const [a, t] of links) {
      const here = location.hash === '#clinics' ? t.href === '/check#clinics' : t.match.includes(location.pathname);
      if (here) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    }
  });
})();
