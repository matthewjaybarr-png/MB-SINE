(function(root, factory){
  const api = factory();
  if(typeof module === "object" && module.exports) module.exports = api;
  root.MBWorkflow = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function(){
  "use strict";

  function finiteNonNegative(value, label){
    const number = Number(value);
    if(!Number.isFinite(number) || number < 0){
      throw new Error(label + " must be zero or a positive number.");
    }
    return number;
  }

  // A toolbook renamed after profiles were saved: old name -> current name.
  const BOOK_ALIASES = {"487-488":"387-388"};
  const bookName = name => { const n = String(name || "").trim(); return BOOK_ALIASES[n] || n; };

  // Profiles may also hold ticked toolbooks and single extra tools ({book, id}). Fields this
  // version doesn't know are dropped; a profile from before 1.3.0 loads with both lists empty.
  function normalizeMachineProfile(input){
    const source = input || {};
    const name = String(source.name || "").trim();
    if(!name) throw new Error("Enter a machine profile name.");
    const maxRpm = finiteNonNegative(source.maxRpm || 0, "Maximum RPM");
    const maxFeedIpm = finiteNonNegative(source.maxFeedIpm || 0, "Maximum feed");
    const toolbooks = [...new Set((Array.isArray(source.toolbooks) ? source.toolbooks : []).map(bookName).filter(Boolean))];
    const seen = new Set();
    const tools = (Array.isArray(source.tools) ? source.tools : []).flatMap(t => {
      const tool = {book:bookName(t && t.book), id:String((t && t.id) || "").trim()};
      const key = tool.book + "|" + tool.id;
      if(!tool.book || !tool.id || seen.has(key)) return [];
      seen.add(key);
      return [tool];
    });
    if(maxRpm === 0 && maxFeedIpm === 0 && !toolbooks.length && !tools.length){
      throw new Error("Enter at least one machine limit, or tick a toolbook.");
    }
    return {
      id: String(source.id || ""),
      name,
      maxRpm,
      maxFeedIpm,
      toolbooks,
      tools
    };
  }

  // The shop tools a profile puts in play. No profile, or one with nothing ticked, shows every tool.
  // missingTools / missingBooks count saved entries no longer in the toolbooks (skipped, never an error).
  function profileShopTools(profile, allTools, books){
    const list = Array.isArray(allTools) ? allTools : [];
    const toolbooks = (profile && profile.toolbooks) || [];
    const picked = (profile && profile.tools) || [];
    if(!toolbooks.length && !picked.length) return {tools:list, missingTools:0, missingBooks:0, filtered:false};
    const bookSet = new Set(toolbooks);
    const pickSet = new Set(picked.map(t => t.book + "|" + t.id));
    const tools = list.filter(t => bookSet.has(t.book) || pickSet.has(t.book + "|" + t.id));
    const have = new Set(list.map(t => t.book + "|" + t.id));
    const known = new Set((books || []).map(b => b.name).concat(list.map(t => t.book)));
    return {
      tools,
      missingTools: picked.filter(t => !have.has(t.book + "|" + t.id)).length,
      missingBooks: toolbooks.filter(b => !known.has(b)).length,
      filtered: true
    };
  }

  // "M391" or "391 Okuma" -> the toolbooks whose name holds 391 ("391-392").
  function toolbooksForName(name, books){
    const numbers = String(name || "").match(/\d{3}/g) || [];
    return (books || []).map(b => b.name).filter(n => n.split("-").some(part => numbers.includes(part)));
  }

  function evaluateMachineLimits(profileInput, values){
    if(!profileInput) return {profile:null, warnings:[], withinLimits:true};
    const profile = normalizeMachineProfile(profileInput);
    const rpm = Number(values && values.rpm);
    const feedIpm = Number(values && values.feedIpm);
    const warnings = [];
    if(profile.maxRpm > 0 && Number.isFinite(rpm) && rpm > profile.maxRpm){
      warnings.push({
        type:"rpm",
        actual:rpm,
        limit:profile.maxRpm,
        message:"Calculated RPM exceeds the saved spindle limit."
      });
    }
    if(profile.maxFeedIpm > 0 && Number.isFinite(feedIpm) && feedIpm > profile.maxFeedIpm){
      warnings.push({
        type:"feed",
        actual:feedIpm,
        limit:profile.maxFeedIpm,
        message:"Calculated feed exceeds the saved feed limit."
      });
    }
    return {profile, warnings, withinLimits:warnings.length === 0};
  }

  // Copy values saved under an old key to its new key, once, without ever overwriting
  // something already saved under the new key. Old keys are left in place (harmless, and
  // lets an older copy of the page keep working). Returns how many keys were copied.
  function migrateLegacyKeys(storage, keyMap){
    let migrated = 0;
    if(!storage || !keyMap) return migrated;
    Object.keys(keyMap).forEach(oldKey => {
      try{
        const newKey = keyMap[oldKey];
        if(storage.getItem(newKey) !== null) return;
        const value = storage.getItem(oldKey);
        if(value === null) return;
        storage.setItem(newKey, value);
        migrated += 1;
      }catch(error){
        /* storage blocked or full: skip; the page falls back to defaults */
      }
    });
    return migrated;
  }

  return {normalizeMachineProfile,
    profileShopTools,
    toolbooksForName,
    bookName, evaluateMachineLimits, migrateLegacyKeys};
});
