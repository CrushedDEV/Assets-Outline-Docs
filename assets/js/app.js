/* Easy Outline docs: one <article data-page> per page, hash routing (#/page/section), sidebar, outline,
   global search, tabs, code highlighting and copy, image zoom. No dependencies. */
(function () {
  "use strict";

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var pages = $$("article[data-page]");
  var bySlug = {};
  pages.forEach(function (p) { bySlug[p.dataset.page] = p; });
  var defaultSlug = pages.length ? pages[0].dataset.page : "";

  function slugify(text) {
    return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function storage(key, value) {
    try {
      if (value === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, value);
    } catch (e) { /* storage unavailable */ }
    return null;
  }

  function escapeHtml(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  // ---------------------------------------------------------------- page preparation

  pages.forEach(function (page) {
    var used = {};
    $$("h2, h3", page).forEach(function (h) {
      if (!h.id) {
        var base = slugify(h.textContent) || "seccion";
        var id = base, n = 2;
        while (used[id]) id = base + "-" + n++;
        h.id = id;
      }
      used[h.id] = true;
      h.dataset.label = h.textContent.trim();
      var a = document.createElement("a");
      a.className = "anchor";
      a.href = "#/" + page.dataset.page + "/" + h.id;
      a.textContent = "#";
      a.setAttribute("aria-label", "Enlace a esta sección");
      h.appendChild(a);
    });
  });

  // ---------------------------------------------------------------- sidebar

  var nav = $("#nav");
  var groups = [];
  pages.forEach(function (p) {
    var name = p.dataset.group || "";
    var group = groups.filter(function (g) { return g.name === name; })[0];
    if (!group) { group = { name: name, pages: [] }; groups.push(group); }
    group.pages.push(p);
  });
  groups.forEach(function (g) {
    var wrap = document.createElement("div");
    wrap.className = "nav-group";
    if (g.name) {
      var title = document.createElement("p");
      title.textContent = g.name;
      wrap.appendChild(title);
    }
    var ul = document.createElement("ul");
    g.pages.forEach(function (p) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = "#/" + p.dataset.page;
      a.dataset.page = p.dataset.page;
      if (p.dataset.icon) {
        var icon = document.createElement("span");
        icon.className = "emoji";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = p.dataset.icon;
        a.appendChild(icon);
      }
      a.appendChild(document.createTextNode(p.dataset.title));
      li.appendChild(a);
      ul.appendChild(li);
    });
    wrap.appendChild(ul);
    nav.appendChild(wrap);
  });

  // ---------------------------------------------------------------- routing

  var current = null;
  var tocList = $("#toc-list");
  var tocLinks = [];
  var observer = null;

  function parseHash() {
    var h = decodeURIComponent(location.hash || "");
    if (h.indexOf("#/") !== 0) {
      // Old single-page anchors (#instalacion) still land somewhere sensible.
      var legacy = h.replace(/^#/, "");
      if (legacy && bySlug[legacy]) return { slug: legacy, section: "" };
      if (legacy) {
        for (var i = 0; i < pages.length; i++) {
          if (document.getElementById(legacy) && pages[i].contains(document.getElementById(legacy))) {
            return { slug: pages[i].dataset.page, section: legacy };
          }
        }
      }
      return { slug: defaultSlug, section: "" };
    }
    var parts = h.slice(2).split("/");
    return { slug: bySlug[parts[0]] ? parts[0] : defaultSlug, section: parts[1] || "" };
  }

  function buildToc(page) {
    tocList.innerHTML = "";
    tocLinks = [];
    var heads = $$("h2, h3", page);
    $("#toc").style.visibility = heads.length > 1 ? "visible" : "hidden";
    heads.forEach(function (h) {
      var li = document.createElement("li");
      li.className = h.tagName.toLowerCase();
      var a = document.createElement("a");
      a.href = "#/" + page.dataset.page + "/" + h.id;
      a.textContent = h.dataset.label;
      li.appendChild(a);
      tocList.appendChild(li);
      tocLinks.push({ link: a, head: h });
    });

    if (observer) observer.disconnect();
    if (!("IntersectionObserver" in window) || !tocLinks.length) return;
    var visible = {};
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { visible[e.target.id] = e.isIntersecting; });
      var active = null;
      for (var i = 0; i < tocLinks.length; i++) {
        if (visible[tocLinks[i].head.id]) { active = tocLinks[i]; break; }
      }
      if (!active) return;
      tocLinks.forEach(function (t) { t.link.classList.toggle("active", t === active); });
    }, { rootMargin: "-70px 0px -65% 0px" });
    tocLinks.forEach(function (t) { observer.observe(t.head); });
  }

  function buildPager(page) {
    var pager = $("#pager");
    pager.innerHTML = "";
    var i = pages.indexOf(page);
    function link(p, cls, label) {
      var a = document.createElement("a");
      a.className = cls;
      a.href = "#/" + p.dataset.page;
      var small = document.createElement("small");
      small.textContent = label;
      var strong = document.createElement("strong");
      strong.textContent = p.dataset.title;
      a.appendChild(small);
      a.appendChild(strong);
      pager.appendChild(a);
    }
    if (i > 0) link(pages[i - 1], "prev", "← Anterior");
    if (i < pages.length - 1) link(pages[i + 1], "next", "Siguiente →");
  }

  function show() {
    var route = parseHash();
    var page = bySlug[route.slug];
    if (!page) return;

    if (current !== page) {
      if (current) current.classList.remove("active");
      page.classList.add("active");
      current = page;
      document.title = page.dataset.title + " · Easy Outline";
      $$("#nav a").forEach(function (a) {
        if (a.dataset.page === route.slug) a.setAttribute("aria-current", "page");
        else a.removeAttribute("aria-current");
      });
      $("#breadcrumb").textContent = page.dataset.group || "";
      buildToc(page);
      buildPager(page);
      var activeLink = $("#nav a[aria-current]");
      if (activeLink && document.body.classList.contains("ready")) activeLink.scrollIntoView({ block: "nearest" });
    }
    document.body.classList.remove("nav-open");
    $("#menu-toggle").setAttribute("aria-expanded", "false");

    var target = route.section ? document.getElementById(route.section) : null;
    if (target && page.contains(target)) target.scrollIntoView();
    else window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", show);

  // ---------------------------------------------------------------- tabs

  $$(".tabs").forEach(function (tabs, ti) {
    var panels = $$(".tab-panel", tabs).filter(function (p) { return p.parentNode === tabs; });
    var bar = document.createElement("div");
    bar.className = "tab-bar";
    bar.setAttribute("role", "tablist");
    panels.forEach(function (panel, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "tab");
      b.id = "tab-" + ti + "-" + i;
      b.textContent = panel.dataset.tab || ("Pestaña " + (i + 1));
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", b.id);
      b.addEventListener("click", function () { select(i); });
      bar.appendChild(b);
    });
    tabs.insertBefore(bar, tabs.firstChild);
    function select(index) {
      $$("button", bar).forEach(function (b, i) { b.setAttribute("aria-selected", i === index ? "true" : "false"); });
      panels.forEach(function (p, i) { p.hidden = i !== index; });
    }
    select(0);
  });

  // ---------------------------------------------------------------- code blocks

  var KEYWORDS = /\b(using|namespace|public|private|protected|internal|static|readonly|const|void|var|new|return|if|else|foreach|for|in|true|false|null|class|struct|sealed|override|ref|out|this|bool|int|float|uint|string|typeof)\b/g;
  var TYPES = /\b(OutlineObject|OutlineProfile|OutlineCamera|OutlineSceneSettings|OutlineLayer|EasyOutlineFeature|EdgeDetectionProfile|OutlineRenderingLayers|SmoothNormals|SmoothNormalsCache|OutlineFormats|OutlineTechnique|OutlineOcclusion|OutlineGeometry|FillPattern|OutlineDebugView|OutlineInjectionPoint|EdgeMaskMode|SoftBlendMode|ScriptableObject|GameObject|MonoBehaviour|Color|Mathf|Debug|Time|Mesh|Renderer|Camera|IReadOnlyList|List|UniversalRendererData|EasyOutlineSetup|SmoothNormalsBaker|Vector2)\b/g;

  function highlightCs(src) {
    var out = "";
    var re = /(\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*")|(\b\d+(?:\.\d+)?f?\b)/g;
    var last = 0, m;
    function plain(text) {
      return escapeHtml(text)
        .replace(KEYWORDS, '<span class="tok-kw">$1</span>')
        .replace(TYPES, '<span class="tok-type">$1</span>');
    }
    while ((m = re.exec(src))) {
      out += plain(src.slice(last, m.index));
      if (m[1]) out += '<span class="tok-com">' + escapeHtml(m[1]) + "</span>";
      else if (m[2]) out += '<span class="tok-str">' + escapeHtml(m[2]) + "</span>";
      else out += '<span class="tok-num">' + escapeHtml(m[3]) + "</span>";
      last = re.lastIndex;
    }
    return out + plain(src.slice(last));
  }

  $$("pre > code").forEach(function (code) {
    var pre = code.parentNode;
    var lang = code.dataset.lang || "";
    var raw = code.textContent.replace(/^\n+|\s+$/g, "");
    if (lang === "cs") code.innerHTML = highlightCs(raw);
    else code.textContent = raw;

    var wrap = document.createElement("div");
    wrap.className = "code";
    var head = document.createElement("div");
    head.className = "code-head";
    var label = document.createElement("span");
    label.textContent = code.dataset.title || ({ cs: "C#", json: "JSON" }[lang] || "");
    var copy = document.createElement("button");
    copy.type = "button";
    copy.className = "copy-btn";
    copy.textContent = "Copiar";
    copy.addEventListener("click", function () {
      var done = function () { copy.textContent = "¡Copiado!"; setTimeout(function () { copy.textContent = "Copiar"; }, 1400); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(raw).then(done, function () {});
    });
    head.appendChild(label);
    head.appendChild(copy);
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(head);
    wrap.appendChild(pre);
  });

  // ---------------------------------------------------------------- hints (icons)

  var ICONS = {
    info: '<path d="M12 16v-4M12 8h.01"/><circle cx="12" cy="12" r="9"/>',
    warning: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>',
    success: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    danger: '<circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/>'
  };
  $$(".hint").forEach(function (hint) {
    var type = ["info", "warning", "success", "danger"].filter(function (t) { return hint.classList.contains(t); })[0] || "info";
    var body = document.createElement("div");
    while (hint.firstChild) body.appendChild(hint.firstChild);
    hint.innerHTML = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[type] + "</svg>";
    hint.appendChild(body);
  });

  // ---------------------------------------------------------------- tables: wrap for horizontal scroll

  $$(".page table").forEach(function (t) {
    if (t.parentNode.classList.contains("table-wrap")) return;
    var w = document.createElement("div");
    w.className = "table-wrap";
    t.parentNode.insertBefore(w, t);
    w.appendChild(t);
  });

  // ---------------------------------------------------------------- search

  var index = [];
  pages.forEach(function (page) {
    var slug = page.dataset.page, title = page.dataset.title, group = page.dataset.group || "";
    var lead = $(".lead", page);
    var section = { slug: slug, id: "", page: title, group: group, heading: title, text: (lead ? lead.textContent : "") + " " + (page.dataset.keywords || "") };
    index.push(section);
    $$("h2, h3, p, li, td, figcaption, summary, pre, .card", page).forEach(function (el) {
      if (el.closest(".lead")) return;
      if (/^H[23]$/.test(el.tagName)) {
        section = { slug: slug, id: el.id, page: title, group: group, heading: el.dataset.label, text: "" };
        index.push(section);
      } else if (el.tagName !== "LI" || !el.parentNode.closest("li")) {
        section.text += " " + el.textContent;
      }
    });
  });
  index.forEach(function (s) {
    s.text = s.text.replace(/\s+/g, " ").trim();
    s.norm = slugify(s.page + " " + s.heading).replace(/-/g, " ");
    s.normText = slugify(s.text).replace(/-/g, " ");
  });

  var modal = $("#search-modal"), input = $("#search-input"), results = $("#search-results");
  var selected = 0, items = [];

  function openSearch(query) {
    modal.classList.add("open");
    input.value = query || "";
    runSearch();
    setTimeout(function () { input.focus(); }, 10);
  }
  function closeSearch() { modal.classList.remove("open"); }

  function highlight(text, terms) {
    var html = escapeHtml(text);
    terms.forEach(function (t) {
      if (t.length < 2) return;
      var re = new RegExp("(" + escapeHtml(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig");
      html = html.replace(re, "<mark>$1</mark>");
    });
    return html;
  }

  function snippet(text, terms) {
    var lower = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    var pos = -1;
    for (var i = 0; i < terms.length && pos < 0; i++) pos = lower.indexOf(terms[i]);
    var start = Math.max(0, pos - 60);
    var s = text.slice(start, start + 170);
    return (start > 0 ? "…" : "") + s + (start + 170 < text.length ? "…" : "");
  }

  function runSearch() {
    var q = slugify(input.value).replace(/-/g, " ").trim();
    results.innerHTML = "";
    items = [];
    selected = 0;
    if (!q) {
      var hints = document.createElement("div");
      hints.className = "search-hints";
      ["primer contorno", "glow", "rayos x", "cutout", "rendering layers", "API", "no se ve", "WebGL"].forEach(function (h) {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = h;
        b.addEventListener("click", function () { input.value = h; runSearch(); input.focus(); });
        hints.appendChild(b);
      });
      results.appendChild(hints);
      return;
    }
    var terms = q.split(" ").filter(Boolean);
    // Short terms ("x", "se", "no") must be whole words; longer ones match word starts first.
    var matchers = terms.map(function (t) {
      var esc = t; // slugified: only a-z and 0-9, nothing to escape
      return {
        word: new RegExp("(^| )" + esc + (t.length < 3 ? "( |$)" : "")),
        any: t.length < 3 ? null : t
      };
    });
    var scored = [];
    index.forEach(function (s) {
      var score = 0;
      for (var i = 0; i < matchers.length; i++) {
        var m = matchers[i];
        var headWord = m.word.test(s.norm), textWord = m.word.test(s.normText);
        var headAny = m.any && s.norm.indexOf(m.any) >= 0, textAny = m.any && s.normText.indexOf(m.any) >= 0;
        if (!headWord && !textWord && !headAny && !textAny) return;
        score += headWord ? 14 : headAny ? 8 : textWord ? 2 : 1;
      }
      if (terms.length > 1) {
        if (s.norm.indexOf(q) >= 0) score += 30;
        else if (s.normText.indexOf(q) >= 0) score += 12;
      }
      if (!s.id) score += 3;
      scored.push({ s: s, score: score });
    });
    scored.sort(function (a, b) { return b.score - a.score; });
    var rawTerms = input.value.trim().split(/\s+/);
    scored.slice(0, 14).forEach(function (r, i) {
      var s = r.s;
      var a = document.createElement("a");
      a.href = "#/" + s.slug + (s.id ? "/" + s.id : "");
      a.innerHTML = '<div class="r-path"></div><div class="r-title"></div><div class="r-snippet"></div>';
      a.children[0].textContent = (s.group ? s.group + " › " : "") + s.page;
      a.children[1].innerHTML = highlight(s.heading, rawTerms);
      a.children[2].innerHTML = highlight(snippet(s.text, terms), rawTerms);
      a.addEventListener("click", closeSearch);
      a.addEventListener("mousemove", function () { setSelected(i); });
      results.appendChild(a);
      items.push(a);
    });
    if (!items.length) {
      var empty = document.createElement("div");
      empty.className = "search-empty";
      empty.textContent = "Sin resultados para «" + input.value + "». Prueba con otra palabra.";
      results.appendChild(empty);
    }
    setSelected(0);
  }

  function setSelected(i) {
    if (!items.length) return;
    selected = (i + items.length) % items.length;
    items.forEach(function (a, k) { a.classList.toggle("selected", k === selected); });
    items[selected].scrollIntoView({ block: "nearest" });
  }

  input.addEventListener("input", runSearch);
  input.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected(selected + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelected(selected - 1); }
    else if (e.key === "Enter" && items[selected]) { e.preventDefault(); location.hash = items[selected].getAttribute("href"); closeSearch(); }
  });
  $("#search-open").addEventListener("click", function () { openSearch(); });
  $(".search-backdrop").addEventListener("click", closeSearch);

  // ---------------------------------------------------------------- theme, menu, lightbox

  $("#theme-toggle").addEventListener("click", function () {
    var root = document.documentElement;
    var dark = root.dataset.theme ? root.dataset.theme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    storage("eo-theme", root.dataset.theme);
  });

  $("#menu-toggle").addEventListener("click", function () {
    var open = document.body.classList.toggle("nav-open");
    this.setAttribute("aria-expanded", open ? "true" : "false");
  });
  document.addEventListener("click", function (e) {
    if (document.body.classList.contains("nav-open") && !e.target.closest(".sidebar") && !e.target.closest("#menu-toggle")) {
      document.body.classList.remove("nav-open");
    }
  });

  var lightbox = $("#lightbox");
  function closeLightbox() { lightbox.classList.remove("open"); }
  lightbox.addEventListener("click", closeLightbox);
  $$(".page figure img, .hero img").forEach(function (img) {
    img.addEventListener("click", function () {
      var big = $("img", lightbox);
      big.src = img.currentSrc || img.src;
      big.alt = img.alt;
      lightbox.classList.add("open");
    });
  });

  document.addEventListener("keydown", function (e) {
    var typing = /^(INPUT|TEXTAREA)$/.test((document.activeElement || {}).tagName || "");
    if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) { e.preventDefault(); openSearch(); }
    else if (e.key === "Escape") { closeSearch(); closeLightbox(); document.body.classList.remove("nav-open"); }
  });

  show();
  document.body.classList.add("ready");
})();
