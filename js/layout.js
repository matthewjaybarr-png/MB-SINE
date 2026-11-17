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

  const api = { resolveView, splitCard, parseSaved };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.MBLayout = api;
})(typeof window !== "undefined" ? window : globalThis);
