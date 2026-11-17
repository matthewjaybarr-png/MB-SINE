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
    const out = [last], notes = [];
    children.forEach((c, i) => {
      if(i > last && has(c.cls, "shop-tool-list")) out.push(i);
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
    const pages = pageEls().map(p => ({ id: p.id, tabs: [] }));
    showPage(resolveView(location.hash, saved, pages).page);
    // Menu links change the hash themselves, so Back/Forward and links all land here.
    window.addEventListener("hashchange", () => showPage(location.hash.slice(1), { focus: true }));
  }

  const api = { resolveView, splitCard, parseSaved, showPage, initLayout };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.MBLayout = api;
  root.showPage = showPage;
  if (typeof document !== "undefined"){
    if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", initLayout);
    else initLayout();
  }
})(typeof window !== "undefined" ? window : globalThis);
