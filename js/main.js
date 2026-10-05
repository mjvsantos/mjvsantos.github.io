(() => {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Runs `callback` once an image has loaded (straight away if it already has).
  // A missing file never loads, so nothing happens and its placeholder stays.
  function whenLoaded(img, callback) {
    if (img.complete && img.naturalWidth > 0) {
      callback();
    } else {
      img.addEventListener('load', callback, { once: true });
    }
  }

  // Light/dark switch. A small script in <head> applies the saved theme (dark by
  // default) before first paint; this wires up the button.
  function initTheme() {
    const button = document.querySelector('.theme-toggle');
    if (!button) return;

    const root = document.documentElement;
    const metaColor = document.querySelector('meta[name="theme-color"]');
    const barColor = { dark: '#101317', light: '#F5F5F3' };

    function apply(theme) {
      root.setAttribute('data-theme', theme);
      button.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
      if (metaColor) metaColor.setAttribute('content', barColor[theme]);
    }

    apply(root.getAttribute('data-theme') === 'light' ? 'light' : 'dark');

    button.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      apply(next);
      try {
        localStorage.setItem('theme', next);
      } catch (error) {
        // Storage can be blocked; the choice then lasts for this visit only
      }
    });
  }

  // Fade/slide entrance for elements marked with .reveal
  function initReveal() {
    const items = document.querySelectorAll('.reveal');
    if (!items.length) return;

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target); // animate once
        });
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.1 }
    );

    items.forEach((el) => observer.observe(el));
  }

  // Mobile/tablet full-screen menu
  function initNav() {
    const toggle = document.querySelector('.nav-toggle');
    const nav = document.getElementById('site-nav');
    const main = document.getElementById('main');
    if (!toggle || !nav) return;

    const label = toggle.querySelector('.nav-toggle__label');
    const desktop = window.matchMedia('(min-width: 1200px)');

    function setOpen(open) {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      label.textContent = open ? 'Close' : 'Menu';
      document.documentElement.classList.toggle('nav-open', open);
      main.inert = open; // keeps keyboard and screen-reader users out of the page behind the menu
    }

    toggle.addEventListener('click', () => {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    // Close after choosing a link
    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) setOpen(false);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && nav.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });

    // Reset if the window grows to the desktop layout while the menu is open
    desktop.addEventListener('change', (event) => {
      if (event.matches) setOpen(false);
    });
  }

  // Marks the nav link of the section being read. A thin band just above the
  // middle of the screen decides which section is "current".
  function initActiveNav() {
    const links = Array.from(document.querySelectorAll('.site-nav__list a[href^="#"]'));
    const sections = document.querySelectorAll('main > section[id]');
    if (!links.length || !sections.length || !('IntersectionObserver' in window)) return;

    const linkFor = new Map();
    links.forEach((link) => {
      const target = document.getElementById(link.getAttribute('href').slice(1));
      if (target) linkFor.set(target, link);
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const current = linkFor.get(entry.target); // sections without a nav link clear the highlight
          links.forEach((link) => {
            if (link === current) {
              link.setAttribute('aria-current', 'location');
            } else {
              link.removeAttribute('aria-current');
            }
          });
        });
      },
      { rootMargin: '-40% 0px -55% 0px' }
    );

    sections.forEach((section) => observer.observe(section));
  }

  // Counts the Proven Impact numbers up from zero once, when they scroll into
  // view. The real value stays in the page for screen readers.
  function initCountUp() {
    if (prefersReducedMotion || !('IntersectionObserver' in window)) return;

    const duration = 1200;
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    const counters = [];

    document.querySelectorAll('.metric__value').forEach((el) => {
      const text = el.textContent.trim();
      const match = text.match(/^(\d+(?:\.\d+)?)(.*)$/); // a number, then a suffix such as "+"
      if (!match) return;

      const target = parseFloat(match[1]);
      const decimals = (match[1].split('.')[1] || '').length;
      const format = (value) => value.toFixed(decimals) + match[2];

      const real = document.createElement('span');
      real.className = 'visually-hidden';
      real.textContent = text;

      const visual = document.createElement('span');
      visual.setAttribute('aria-hidden', 'true');
      visual.textContent = format(0);

      el.textContent = '';
      el.append(real, visual);
      counters.push({ el, visual, target, format });
    });

    function run({ visual, target, format }) {
      const start = performance.now();

      function frame(now) {
        const progress = Math.min((now - start) / duration, 1);
        visual.textContent = format(target * easeOut(progress));
        if (progress < 1) requestAnimationFrame(frame);
      }

      requestAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          run(counters.find((counter) => counter.el === entry.target));
          obs.unobserve(entry.target); // count once
        });
      },
      { threshold: 0.6 }
    );

    counters.forEach((counter) => observer.observe(counter.el));
  }

  // Skills ticker: copies the list once so the loop has no seam, then starts it.
  function initTicker() {
    const track = document.querySelector('.ticker__track');
    const list = track && track.querySelector('.ticker__list');
    if (!list) return;

    track.append(list.cloneNode(true));
    track.closest('.ticker').classList.add('is-ready');
  }

  // Shared image viewer (native <dialog>). Returns a function that opens it with
  // (src, alt, caption), or null if the browser does not support <dialog>.
  function initLightbox() {
    const dialog = document.getElementById('lightbox');
    if (!dialog || typeof dialog.showModal !== 'function') return null;

    const root = document.documentElement;
    const image = dialog.querySelector('.lightbox__img');
    const caption = dialog.querySelector('.lightbox__caption');

    dialog.querySelector('.lightbox__close').addEventListener('click', () => dialog.close());

    // A click on the dark area outside the box targets the dialog itself
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      const outside =
        event.clientX < box.left || event.clientX > box.right ||
        event.clientY < box.top || event.clientY > box.bottom;
      if (outside) dialog.close();
    });

    // Fires for Escape, the Close button and clicks outside
    dialog.addEventListener('close', () => root.classList.remove('modal-open'));

    return (src, alt, text) => {
      image.src = src;
      image.alt = alt;
      caption.textContent = text;
      root.classList.add('modal-open');
      dialog.showModal();
    };
  }

  // Image slots (project screenshots, honors, About photo): each .shot shows a
  // placeholder until its image loads, then reveals it and opens it in the viewer.
  function initShots(openLightbox) {
    const canOpen = typeof openLightbox === 'function';

    document.querySelectorAll('.shot').forEach((shot) => {
      const frame = shot.querySelector('.shot__frame');
      const img = frame && frame.querySelector('img');
      const caption = shot.querySelector('figcaption');
      if (!img) return;

      const captionText = () => (caption ? caption.textContent.trim() : img.alt);

      whenLoaded(img, () => {
        shot.classList.add('is-loaded');
        if (!canOpen) return;
        frame.disabled = false;
        frame.setAttribute('aria-label', `View larger: ${captionText()}`);
      });

      frame.addEventListener('click', () => {
        if (canOpen) openLightbox(img.currentSrc || img.src, img.alt, captionText());
      });
    });
  }

  // Logo slots: a generic glyph shows until the logo file loads.
  function initLogos() {
    document.querySelectorAll('.logo').forEach((slot) => {
      const img = slot.querySelector('.logo__img');
      if (img) whenLoaded(img, () => slot.classList.add('is-loaded'));
    });
  }

  // Certification rows get their buttons here. "Visit" appears only for a valid
  // https link in data-credly; "Expand" only once the image in data-cert loads.
  function initCerts(openLightbox) {
    document.querySelectorAll('.cert').forEach((cert) => {
      const name = cert.querySelector('.cert__name').textContent.trim();
      const actions = document.createElement('div');
      actions.className = 'cert__actions';
      cert.append(actions);

      try {
        const url = new URL((cert.dataset.credly || '').trim());
        if (url.protocol === 'https:') {
          const link = document.createElement('a');
          link.className = 'cert__btn';
          link.href = url.href;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.innerHTML = 'Visit<span aria-hidden="true"> ↗</span><span class="visually-hidden"> badge (opens in a new tab)</span>';
          actions.append(link);
        }
      } catch (error) {
        // No valid link, so no Visit button
      }

      const path = cert.dataset.cert;
      if (typeof openLightbox !== 'function' || !path) return;

      const probe = new Image();
      probe.src = path;
      whenLoaded(probe, () => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'cert__btn';
        button.textContent = 'Expand';
        button.setAttribute('aria-label', `Expand certificate: ${name}`);
        button.addEventListener('click', () => openLightbox(path, `Certificate: ${name}`, name));
        actions.prepend(button);
      });
    });
  }

  // Contact form. Messages appear only after the visitor presses Send with
  // something wrong. After that, each field updates as it is edited. A valid
  // form opens the visitor's email app with the message filled in (no backend).
  function initContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;

    const status = document.getElementById('contact-status');
    const recipient = form.dataset.to;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    const fields = Array.from(form.querySelectorAll('.field__control'));
    let triedToSend = false;

    // Each rule returns an error message, or '' when the value is valid
    const rules = {
      name: (value) => (value.length < 2 ? 'Please enter your name (at least 2 characters).' : ''),
      email: (value) => {
        if (!value) return 'Please enter your email address.';
        return emailPattern.test(value) ? '' : 'Please enter a valid email address, like name@example.com.';
      },
      subject: (value) => (value.length < 3 ? 'Please add a subject (at least 3 characters).' : ''),
      message: (value) => (value.length < 10 ? 'Please write a message (at least 10 characters).' : ''),
    };

    function setStatus(text, isError) {
      status.textContent = text;
      status.classList.toggle('is-error', isError);
    }

    function validate(field) {
      const message = rules[field.name](field.value.trim());
      field.setAttribute('aria-invalid', String(Boolean(message)));
      document.getElementById(`${field.id}-error`).textContent = message;
      return !message;
    }

    // After the first Send attempt, re-check a field as it is edited
    fields.forEach((field) => {
      field.addEventListener('input', () => {
        if (!triedToSend) return;
        validate(field);

        // Clear the "fix the fields" note once nothing is left to fix
        const allValid = fields.every((item) => item.getAttribute('aria-invalid') !== 'true');
        if (allValid && status.classList.contains('is-error')) setStatus('', false);
      });
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      triedToSend = true;

      // Check every field (no early exit, so all messages appear together)
      const invalid = fields.filter((field) => !validate(field));
      if (invalid.length) {
        setStatus('Please fix the highlighted fields and try again.', true);
        invalid[0].focus();
        return;
      }

      const value = (name) => form.elements[name].value.trim();
      const subject = encodeURIComponent(value('subject'));
      const body = encodeURIComponent(`${value('message')}\r\n\r\n— ${value('name')} (${value('email')})`);

      setStatus(`Your email app should open with your message ready to send. If nothing happens, email me directly at ${recipient}.`, false);
      window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;
    });
  }

  initTheme();
  initReveal();
  initNav();
  initActiveNav();
  initCountUp();
  initTicker();

  const openLightbox = initLightbox();
  initShots(openLightbox);
  initLogos();
  initCerts(openLightbox);
  initContactForm();
})();