// Layout: one section (page) at a time, tabs per calculator card, and each card split into
// inputs | result. Only moves existing nodes, so ids and data-click actions stay intact.
(function(root){
  const has = (cls, name) => String(cls || "").split(/\s+/).includes(name);
  const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);

  function resolveView(hash, saved, pages){
    const ids = pages.map(p => p.id);
    const fromHash = String(hash || "").replace(/^#/, "");
    const page = ids.includes(fromHash) ? fromHash
      : (saved && ids.includes(saved.page)) ? saved.page
      : ids[0];
    const visible = (pages.find(p => p.id === page)?.tabs || []).filter(t => t.visible).map(t => t.id);
    const want = saved && isObj(saved.tabs) ? saved.tabs[page] : undefined;
    return { page, tab: visible.includes(want) ? want : (visible[0] ?? null) };
  }

  function splitCard(children){
    let last = -1, lastButton = -1;
    children.forEach((c, i) => {
      if(has(c.cls, "result")) last = i;
      if(String(c.tag).toLowerCase() === "button") lastButton = i;
    });
    if(last < 0) return { out: [], notes: [] };
    const out = [], notes = [];
    children.forEach((c, i) => {
      if(has(c.cls, "result") || (i > last && has(c.cls, "shop-tool-list"))) out.push(i);
      if(i > lastButton && has(c.cls, "note") && !out.includes(i)) notes.push(i);
    });
    return { out, notes };
  }

  function parseSaved(text){
    let v;
    try { v = JSON.parse(text); } catch(e){ return { tabs: {} }; }
    if(!isObj(v)) return { tabs: {} };
    const tabs = {};
    if(isObj(v.tabs)) for(const [k, t] of Object.entries(v.tabs)) if(typeof t === "string") tabs[k] = t;
    return typeof v.page === "string" ? { page: v.page, tabs } : { tabs };
  }

  // ---- DOM side (browser only) ----
  const KEY = "mb-sine:view";
  const view = { page: null, tabs: {} };
  const pageEls = () => [...document.querySelectorAll("main .page")];

  function save(){
    try { localStorage.setItem(KEY, JSON.stringify(view)); } catch(e){}
  }

  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const cardsOf = page => [...page.querySelectorAll(".card")].filter(c => c.querySelector("h2"));
  const pageInfo = page => ({ id: page.id, tabs: cardsOf(page).map(c => ({ id: c.dataset.tab, visible: !c.hidden })) });

  // Card children → header (h2 / workflow heading) | .card-in (inputs + folded notes) | .card-out (result).
  function splitCardEl(card){
    const kids = [...card.children];
    if(kids.filter(k => /^H[23]$/.test(k.tagName)).length > 1) return; // several calculators in one card (Conversions)
    const { out, notes } = splitCard(kids.map(k => ({ tag: k.tagName, cls: k.className })));
    if(!out.length) return;
    const head = (k, i) => i === 0 && (k.tagName === "H2" || k.classList.contains("workflow-heading"));
    const cin = document.createElement("div"), cout = document.createElement("div");
    cin.className = "card-in"; cout.className = "card-out";
    kids.forEach((k, i) => {
      if(head(k, i)) return;
      if(out.includes(i)) cout.appendChild(k);
      else if(!notes.includes(i)) cin.appendChild(k);
    });
    if(notes.length){
      const help = document.createElement("details");
      help.className = "card-help";
      help.innerHTML = "<summary>How this is worked out</summary>";
      notes.forEach(i => help.appendChild(kids[i]));
      cin.appendChild(help);
    }
    card.append(cin, cout);
    card.classList.add("split");
  }

  function buildTabs(page){
    const cards = cardsOf(page);
    cards.forEach(c => {
      const h2 = c.querySelector("h2");
      c.dataset.tab = c.id || slug(h2.textContent);
      if(!c.id) c.id = page.id + "-" + c.dataset.tab;
    });
    if(cards.length < 2) return;
    const list = document.createElement("div");
    list.className = "tabs";
    list.setAttribute("role", "tablist");
    list.setAttribute("aria-label", page.querySelector(".sectionhead")?.textContent.trim() || page.id);
    cards.forEach(c => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tab ghost";
      b.id = "tab-" + c.id;
      b.dataset.tab = c.dataset.tab;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-controls", c.id);
      b.textContent = c.querySelector("h2").textContent.trim().replace(/\s+/g, " ").replace(/ Calculator$/, "");
      b.addEventListener("click", () => showTab(page.id, c.dataset.tab, { focus: true }));
      list.appendChild(b);
      c.setAttribute("role", "tabpanel");
      c.setAttribute("aria-labelledby", b.id);
    });
    list.addEventListener("keydown", e => {
      const tabs = [...list.querySelectorAll(".tab:not([hidden])")];
      const at = tabs.indexOf(document.activeElement);
      const to = { ArrowRight: at + 1, ArrowDown: at + 1, ArrowLeft: at - 1, ArrowUp: at - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if(at < 0 || to === undefined) return;
      e.preventDefault();
      tabs[(to + tabs.length) % tabs.length].focus();
    });
    page.querySelector(".sectionhead").after(list);
    new MutationObserver(() => applyTab(page)).observe(page, { subtree: true, attributes: true, attributeFilter: ["hidden"] });
  }

  // Shows the page's chosen tab, falling back to the first visible one (Review Focus 2).
  function applyTab(page){
    const tab = resolveView("#" + page.id, view, [pageInfo(page)]).tab;
    view.tabs[page.id] = tab;
    const list = page.querySelector(".tabs");
    cardsOf(page).forEach(c => {
      c.classList.toggle("tab-off", !!list && c.dataset.tab !== tab);
      const b = list && list.querySelector(`.tab[data-tab="${c.dataset.tab}"]`);
      if(!b) return;
      if(b.hidden !== c.hidden) b.hidden = c.hidden;
      b.setAttribute("aria-selected", String(c.dataset.tab === tab));
      b.tabIndex = c.dataset.tab === tab ? 0 : -1;
    });
    if(list){
      const one = list.querySelectorAll(".tab:not([hidden])").length < 2;
      if(list.hidden !== one) list.hidden = one;
    }
    return tab;
  }

  function showTab(pageId, tabId, opts){
    const page = document.getElementById(pageId);
    if(!page || !page.classList.contains("page")) return;
    view.tabs[pageId] = tabId;
    const tab = applyTab(page);
    save();
    if(opts && opts.focus){
      const card = cardsOf(page).find(c => c.dataset.tab === tab);
      const field = card && card.querySelector("input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea");
      if(field && field.offsetParent) field.focus({ preventScroll: true });
    }
  }

  function showPage(id, opts){
    const pages = pageEls();
    const target = pages.find(p => p.id === id) || pages[0];
    if(!target) return;
    pages.forEach(p => { p.hidden = p !== target; });
    document.querySelectorAll(".nav a").forEach(a => {
      if(a.getAttribute("href") === "#" + target.id) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    if(location.hash !== "#" + target.id){
      try { history.replaceState(null, "", "#" + target.id); } catch(e){}
    }
    view.page = target.id;
    applyTab(target);
    save();
    window.scrollTo(0, 0);
    if(opts && opts.focus){
      const head = target.querySelector(".sectionhead");
      if(head){ head.tabIndex = -1; head.focus({ preventScroll: true }); }
    }
  }

  function initLayout(){
    let saved = { tabs: {} };
    try { saved = parseSaved(localStorage.getItem(KEY)); } catch(e){}
    Object.assign(view.tabs, saved.tabs);
    pageEls().forEach(p => { cardsOf(p).forEach(splitCardEl); buildTabs(p); });
    showPage(resolveView(location.hash, saved, pageEls().map(pageInfo)).page);
    // Menu links change the hash themselves, so Back/Forward and links all land here.
    window.addEventListener("hashchange", () => showPage(location.hash.slice(1), { focus: true }));
  }

  const api = { resolveView, splitCard, parseSaved, showPage, showTab, initLayout };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.MBLayout = api;
  root.showPage = showPage;
  if (typeof document !== "undefined"){
    if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", initLayout);
    else initLayout();
  }
})(typeof window !== "undefined" ? window : globalThis);
