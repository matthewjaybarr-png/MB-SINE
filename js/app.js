const materials = MBData.materials;
const UNC = MBData.threads.UNC;
const UNF = MBData.threads.UNF;
const NPT = MBData.threads.NPT;
const METRIC = MBData.threads.METRIC;
const nptPitchMap = MBData.nptPitchMap;
const numberDrills = MBData.numberDrills;
const letterDrills = MBData.letterDrills;
const metricDrills = MBData.metricDrills;
const MACHINE_STORAGE_KEY = "mbSine.machineProfiles.v1";
const ACTIVE_MACHINE_STORAGE_KEY = "mbSine.activeMachine.v1";
const PREFERENCE_STORAGE_KEY = "mbSine.preferences.v1";
const PREFERENCE_IDS = [
"calcType", "units", "drillToolType", "material", "presetLevel",
"turnType", "turnUnits", "turnMaterial", "turnPresetLevel",
"tapCalcStyle", "tapToolMaterial", "tapWorkMaterial", "tapPresetLevel"
];
const NON_EXPORTABLE_RESULTS = new Set(["presetPreview", "turnPresetPreview"]);
let machineProfiles = [];
let latestShopResult = null;

function gid(id){ return document.getElementById(id); }
function num(id){ return parseFloat(gid(id).value) || 0; }
function round(v,d=4){
 if(!isFinite(v)) return "0";
 const text = Number(v).toFixed(d);
 // Only trim trailing zeros after a decimal point; "2000" must stay "2000".
 return text.indexOf(".") === -1 ? text : text.replace(/\.?0+$/,"");
}
function escapeHtml(value){
return String(value).replace(/[&<>'"]/g, character => ({
"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"
})[character]);
}
function readStoredJson(key, fallback){
try{
 const parsed = JSON.parse(localStorage.getItem(key));
 return parsed === null ? fallback : parsed;
}catch(error){
 return fallback;
}
}
function writeStoredJson(key, value){
try{
 localStorage.setItem(key, JSON.stringify(value));
 return true;
}catch(error){
 return false;
}
}
function activeMachineProfile(){
const id = gid("machineProfileSelect").value;
return machineProfiles.find(profile => profile.id === id) || null;
}
function refreshMachineProfileSelect(selectedId){
const select = gid("machineProfileSelect");
select.innerHTML = "";
const blank = document.createElement("option");
blank.value = "";
blank.textContent = "No machine limits selected";
select.appendChild(blank);
machineProfiles.forEach(profile => {
 const option = document.createElement("option");
 option.value = profile.id;
 option.textContent = profile.name;
 select.appendChild(option);
});
select.value = machineProfiles.some(profile => profile.id === selectedId) ? selectedId : "";
}
function renderMachineProfileStatus(message, isError){
const status = gid("machineProfileStatus");
status.textContent = message;
status.classList.toggle("machine-check", Boolean(isError));
status.classList.toggle("warning", Boolean(isError));
}
function initializeMachineProfiles(){
const stored = readStoredJson(MACHINE_STORAGE_KEY, []);
machineProfiles = Array.isArray(stored) ? stored.flatMap(profile => {
 try{return [MBWorkflow.normalizeMachineProfile(profile)];}
 catch(error){return [];}
}) : [];
const activeId = String(readStoredJson(ACTIVE_MACHINE_STORAGE_KEY, "") || "");
refreshMachineProfileSelect(activeId);
selectMachineProfile();
}
function selectMachineProfile(){
const profile = activeMachineProfile();
writeStoredJson(ACTIVE_MACHINE_STORAGE_KEY, profile ? profile.id : "");
gid("machineProfileName").value = profile ? profile.name : "";
gid("machineMaxRpm").value = profile ? profile.maxRpm : "0";
gid("machineMaxFeed").value = profile ? profile.maxFeedIpm : "0";
renderMachineProfileStatus(profile
 ? profile.name + ": " + (profile.maxRpm ? round(profile.maxRpm,0) + " RPM" : "RPM not configured") + " · " + (profile.maxFeedIpm ? round(profile.maxFeedIpm,2) + " IPM" : "feed not configured")
 : "No machine limits selected.", false);
}
function newMachineProfile(){
refreshMachineProfileSelect("");
selectMachineProfile();
gid("machineProfileName").focus();
}
function saveMachineProfile(){
const selected = activeMachineProfile();
let profile;
try{
 profile = MBWorkflow.normalizeMachineProfile({
  id:selected ? selected.id : "machine-" + Date.now(),
  name:gid("machineProfileName").value,
  maxRpm:gid("machineMaxRpm").value,
  maxFeedIpm:gid("machineMaxFeed").value
 });
}catch(error){
 renderMachineProfileStatus(error.message, true);
 return;
}
const existingIndex = machineProfiles.findIndex(item => item.id === profile.id);
if(existingIndex >= 0) machineProfiles[existingIndex] = profile;
else machineProfiles.push(profile);
machineProfiles.sort((a,b) => a.name.localeCompare(b.name));
if(!writeStoredJson(MACHINE_STORAGE_KEY, machineProfiles)){
 renderMachineProfileStatus("This browser could not save the machine profile.", true);
 return;
}
refreshMachineProfileSelect(profile.id);
writeStoredJson(ACTIVE_MACHINE_STORAGE_KEY, profile.id);
selectMachineProfile();
renderMachineProfileStatus(profile.name + " saved and active.", false);
}
function deleteMachineProfile(){
const profile = activeMachineProfile();
if(!profile){
 renderMachineProfileStatus("Select a saved machine profile to delete.", true);
 return;
}
if(!window.confirm("Delete the saved machine profile “" + profile.name + "”?")) return;
machineProfiles = machineProfiles.filter(item => item.id !== profile.id);
writeStoredJson(MACHINE_STORAGE_KEY, machineProfiles);
writeStoredJson(ACTIVE_MACHINE_STORAGE_KEY, "");
refreshMachineProfileSelect("");
selectMachineProfile();
renderMachineProfileStatus(profile.name + " deleted from this browser.", false);
}
function machineLimitMarkup(rpm, feedIpm){
const profile = activeMachineProfile();
if(!profile) return "";
const check = MBWorkflow.evaluateMachineLimits(profile, {rpm, feedIpm});
if(check.withinLimits){
 return '<span class="machine-check ok">Machine check — ' + escapeHtml(profile.name) + ': within configured limits.</span>';
}
const details = check.warnings.map(warning => warning.type === "rpm"
 ? "RPM " + round(warning.actual,0) + " exceeds " + round(warning.limit,0)
 : "Feed " + round(warning.actual,2) + " IPM exceeds " + round(warning.limit,2) + " IPM"
).join(" · ");
return '<span class="machine-check warning">Machine warning — ' + escapeHtml(profile.name) + ': ' + escapeHtml(details) + '.</span>';
}
function restoreShopPreferences(){
const preferences = readStoredJson(PREFERENCE_STORAGE_KEY, {});
PREFERENCE_IDS.forEach(id => {
 const element = gid(id);
 if(element && Object.prototype.hasOwnProperty.call(preferences, id)){
  const value = String(preferences[id]);
  if([...element.options].some(option => option.value === value)) element.value = value;
 }
});
}
function saveShopPreferences(){
const preferences = {};
PREFERENCE_IDS.forEach(id => {
 const element = gid(id);
 if(element) preferences[id] = element.value;
});
writeStoredJson(PREFERENCE_STORAGE_KEY, preferences);
}
function enablePreferenceStorage(){
PREFERENCE_IDS.forEach(id => {
 const element = gid(id);
 if(element) element.addEventListener("change", saveShopPreferences);
});
}
function resultPlainText(element){
const clone = element.cloneNode(true);
clone.querySelectorAll("br").forEach(br => br.replaceWith(document.createTextNode("\n")));
return clone.textContent.trim();
}
function resultLabel(element){
const heading = element.closest(".card")?.querySelector("h2, h3");
return heading ? heading.textContent.trim() : element.id;
}
function recordLatestResult(element){
if(!element || NON_EXPORTABLE_RESULTS.has(element.id) || !element.textContent.trim()) return;
latestShopResult = {
 label:resultLabel(element),
 text:resultPlainText(element),
 machine:activeMachineProfile()?.name || "No machine profile selected",
 created:new Date()
};
gid("latestResultStatus").textContent = latestShopResult.label + " · " + latestShopResult.machine;
document.dispatchEvent(new CustomEvent("mb-sine:result", {detail:{...latestShopResult, note:latestResultNote()}}));
gid("copyLatestButton").disabled = false;
gid("downloadLatestButton").disabled = false;
}
function enableResultTracking(){
const observer = new MutationObserver(records => {
 records.forEach(record => {
  const target = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
  recordLatestResult(target?.closest(".result"));
 });
});
document.querySelectorAll(".result:not(.result-info)").forEach(result => {
 observer.observe(result, {childList:true, subtree:true, characterData:true});
});
}
function latestResultNote(){
if(!latestShopResult) return "";
return [
 "Sine",
 latestShopResult.label,
 "Machine: " + latestShopResult.machine,
 "Generated: " + latestShopResult.created.toLocaleString(),
 "",
 latestShopResult.text,
 "",
 "Verify tool data, workholding, machine limits, and setup before cutting."
].join("\n");
}
async function copyLatestResult(){
const note = latestResultNote();
if(!note) return;
try{
 await navigator.clipboard.writeText(note);
 gid("latestResultStatus").textContent = "Copied " + latestShopResult.label + " to the clipboard.";
}catch(error){
 const textarea = document.createElement("textarea");
 textarea.value = note;
 textarea.style.position = "fixed";
 textarea.style.opacity = "0";
 document.body.appendChild(textarea);
 textarea.select();
 const copied = document.execCommand("copy");
 textarea.remove();
 gid("latestResultStatus").textContent = copied ? "Copied " + latestShopResult.label + " to the clipboard." : "Clipboard access was blocked.";
}
}
function downloadLatestResult(){
const note = latestResultNote();
if(!note) return;
const stamp = latestShopResult.created.toISOString().replace(/[:.]/g,"-");
const filename = "mb-sine-" + latestShopResult.label.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") + "-" + stamp + ".txt";
const url = URL.createObjectURL(new Blob([note], {type:"text/plain;charset=utf-8"}));
const link = document.createElement("a");
link.href = url;
link.download = filename;
document.body.appendChild(link);
link.click();
link.remove();
URL.revokeObjectURL(url);
gid("latestResultStatus").textContent = "Downloaded " + latestShopResult.label + " as a setup note.";
}
function updateConnectionStatus(){
const status = gid("connectionStatus");
const online = navigator.onLine;
status.textContent = online ? "Online" : "Offline ready";
status.classList.toggle("online", online);
status.classList.toggle("offline", !online);
}
function initializeOfflineSupport(){
updateConnectionStatus();
window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);
// Inside MB Forge the app ships the files itself; a service worker there would only go stale.
if(document.documentElement.dataset.host === "forge") return;
if("serviceWorker" in navigator && /^https?:$/.test(location.protocol)){
 navigator.serviceWorker.register("./service-worker.js").catch(() => {
  gid("connectionStatus").textContent = "Offline setup unavailable";
  gid("connectionStatus").classList.remove("online", "offline");
 });
}
}
function showCalculationError(resultId, error){
gid(resultId).textContent = error instanceof Error ? error.message : String(error);
}
function updateSpeedBasisUI(scope){
const fields = scope === "turn"
? {basis:"turnSpeedBasis",sfm:"turnSfm",rpm:"turnRpm"}
: scope === "tap"
? {basis:"tapSpeedBasis",sfm:"tapCalcSfm",rpm:"tapCalcRpm"}
: {basis:"speedBasis",sfm:"sfm",rpm:"rpm"};
const useRpm = gid(fields.basis).value === "rpm";
gid(fields.sfm).disabled = useRpm;
gid(fields.rpm).disabled = !useRpm;
}
function formatRange(range){ return range[0] + " / " + range[1] + " / " + range[2]; }
function millingProfileKey(type){
if(type === "drill") return gid("drillToolType").value === "hss" ? "drillHss" : "drillCarbide";
if(type === "endmill") return "endmillCarbide";
return "indexableMill";
}
function turningProfileKey(type){
if(type === "bore") return "boreCarbide";
if(type === "groove") return "grooveCarbide";
if(type === "drill") return "drillCarbide";
return "turnCarbide";
}
function gcd(a,b){ return b ? gcd(b, a % b) : a; }
function decimalToFraction64(x){
const neg = x < 0 ? "-" : "";
x = Math.abs(x);
const whole = Math.floor(x);
const frac = x - whole;
const denom = 64;
let nume = Math.round(frac * denom);
let w = whole;
if(nume === denom){ w += 1; nume = 0; }
if(nume === 0) return neg + String(w);
const g = gcd(nume, denom);
nume /= g;
const den = denom / g;
return neg + (w ? w + " " : "") + nume + "/" + den;
}
function parseFraction(text){
text = String(text).trim();
if(text.includes(" ")){
const parts = text.split(" ");
return (parseFloat(parts[0]) || 0) + parseFraction(parts[1] || "0");
}
if(text.includes("/")){
const parts = text.split("/");
const a = parseFloat(parts[0]) || 0;
const b = parseFloat(parts[1]) || 1;
return b ? a / b : 0;
}
return parseFloat(text) || 0;
}

function toolDiaInches(){ const d = num("toolDia"); return gid("units").value === "metric" ? d/25.4 : d; }
function stepoverInches(){ const s = num("stepover"); return gid("units").value === "metric" ? s/25.4 : s; }
function peckDiaInches(){ const d = num("peckDia"); return gid("peckUnits").value === "metric" ? d/25.4 : d; }
function holeDepthInches(){ const d = num("holeDepth"); return gid("peckUnits").value === "metric" ? d/25.4 : d; }
function turnDiaInches(){ const d = num("turnDia"); return gid("turnUnits").value === "metric" ? d/25.4 : d; }

function buildFractionalDrills(){
const arr = [];
for(let n=1;n<=128;n++){
const dec = n/64;
arr.push([decimalToFraction64(dec), dec]);
}
return arr;
}
const fractionalDrills = buildFractionalDrills();
const allDrills = [...fractionalDrills, ...numberDrills, ...letterDrills, ...metricDrills]
.map(d => ({name:d[0], dec:d[1]}))
.filter(d => d.dec <= 2.0001)
.sort((a,b)=>a.dec-b.dec);

function populateMaterials(){
const sel = gid("material");
const turnSel = gid("turnMaterial");
sel.innerHTML = "";
turnSel.innerHTML = "";
materials.forEach((m,i)=>{
const o = document.createElement("option");
o.value = i;
o.textContent = m.name;
sel.appendChild(o);
const o2 = document.createElement("option");
o2.value = i;
o2.textContent = m.name;
turnSel.appendChild(o2);
});
const body = gid("materialBody");
body.innerHTML = "";
materials.forEach(m=>{
const tr = document.createElement("tr");
tr.innerHTML =
"<td>"+m.name+"</td>" +
"<td>"+m.isoGroup+"</td>" +
"<td>"+m.desc+"</td>" +
"<td>"+formatRange(m.sfm.drillHss)+"</td>" +
"<td>"+formatRange(m.sfm.drillCarbide)+"</td>" +
"<td>"+formatRange(m.sfm.endmillCarbide)+"</td>" +
"<td>"+formatRange(m.sfm.indexableMill)+"</td>" +
"<td>"+formatRange(m.sfm.turnCarbide)+"</td>" +
"<td>"+formatRange(m.sfm.tapHss)+"</td>";
body.appendChild(tr);
});
updatePresetPreview();
updateTurningPresetPreview();
}

function toggleCalcType(){
const type = gid("calcType").value;
const isDrill = type === "drill";
const isEndmill = type === "endmill";
const isFace45 = type === "face45";
const isShoulder90 = type === "shoulder90";

gid("drillBox").style.display = isDrill ? "" : "none";
gid("millingBox").style.display = isDrill ? "none" : "";
gid("drillToolTypeBox").style.display = isDrill ? "" : "none";
gid("stepoverWrap").style.display = isEndmill ? "" : "none";

if(isDrill){
 gid("flutes").value = "2";
 gid("fpt").value = "";
 gid("stepover").value = "";
 gid("ipr").value = gid("ipr").value || "0.004";
}
if(isEndmill){
 gid("fptLabel").textContent = "FPT or IPT";
 if(!gid("flutes").value || Number(gid("flutes").value) > 8) gid("flutes").value = "4";
 if(!gid("fpt").value || Number(gid("fpt").value) > 0.005) gid("fpt").value = "0.0025";
 if(!gid("stepover").value) gid("stepover").value = round(toolDiaInches() * 0.25,4);
}
if(isFace45){
 gid("fptLabel").textContent = "FPT";
 if(!gid("flutes").value || Number(gid("flutes").value) < 3 || Number(gid("flutes").value) > 12) gid("flutes").value = "6";
 if(!gid("fpt").value || Number(gid("fpt").value) > 0.004) gid("fpt").value = "0.0025";
 gid("stepover").value = "";
}
if(isShoulder90){
 gid("fptLabel").textContent = "FPT";
 if(!gid("flutes").value || Number(gid("flutes").value) > 8) gid("flutes").value = "4";
 if(!gid("fpt").value || Number(gid("fpt").value) > 0.004) gid("fpt").value = "0.0025";
 gid("stepover").value = "";
}
updatePresetPreview();
}

function updatePresetPreview(){
const m = materials[parseInt(gid("material").value || 0,10)];
const type = gid("calcType").value;
const profile = MBData.materialProfile(m, millingProfileKey(type), gid("presetLevel").value);
let text = "MB baseline—not manufacturer tool data.<br>Material: " + m.name + " · ISO " + m.isoGroup +
"<br>SFM low / standard / upper: " + formatRange(profile.range) +
"<br>Selected SFM: " + profile.sfm + " (" + profile.level + ")<br>";
if(type === "drill"){
text += gid("drillToolType").value === "hss"
? "Estimated drill IPR = HSS factor × sqrt(diameter in inches)"
: "Estimated drill IPR = carbide factor × sqrt(diameter in inches)";
}else if(type === "endmill"){
text += "Endmill mode uses radial stepover to show chip thinning when stepover is under 50 percent of cutter diameter.";
}else if(type === "face45"){
text += "45 degree face mill mode shows programmed feed and actual chip thickness at the lead angle. Radial stepover is not used here.";
}else{
text += "90 degree shoulder mill mode shows programmed feed at the entered FPT. Radial stepover is not used here.";
}
gid("presetPreview").innerHTML = text;
}

function applyPreset(){
const m = materials[parseInt(gid("material").value || 0,10)];
const d = toolDiaInches();
const type = gid("calcType").value;
const profile = MBData.materialProfile(m, millingProfileKey(type), gid("presetLevel").value);
gid("speedBasis").value = "sfm";
updateSpeedBasisUI("main");
gid("sfm").value = profile.sfm;
gid("rpm").value = "";
if(type === "drill"){
 gid("flutes").value = 2;
 const factor = gid("drillToolType").value === "hss" ? m.feed.hssDrillFactor : m.feed.carbideDrillFactor;
 if(d > 0) gid("ipr").value = round(factor * Math.sqrt(d), 4);
}else if(type === "endmill"){
 gid("flutes").value = d <= 0.375 ? 4 : 5;
 if(d > 0) gid("fpt").value = round(Math.min(0.004, Math.max(0.0012, m.feed.endmillFactor * Math.sqrt(d) * 0.45)), 4);
 if(d > 0) gid("stepover").value = round(d * 0.25,4);
}else if(type === "face45"){
 gid("flutes").value = d < 1 ? 4 : 6;
 if(d > 0) gid("fpt").value = round(Math.min(0.006, Math.max(0.0015, m.feed.indexableFactor * Math.sqrt(d) * 0.35)), 4);
 gid("stepover").value = "";
}else{
 gid("flutes").value = d <= 0.5 ? 4 : 5;
 if(d > 0) gid("fpt").value = round(Math.min(0.005, Math.max(0.001, m.feed.indexableFactor * Math.sqrt(d) * 0.30)), 4);
 gid("stepover").value = "";
}
calcMain();
}

function calcMain(){
const d = toolDiaInches();
const flutes = num("flutes");
const type = gid("calcType").value;
let out = "";
let warnings = [];
let feedIpm = null;

if(d <= 0){
 gid("mainResult").innerHTML = "Enter a valid tool diameter.";
 return;
}

let speed;
try{
 speed = MBCalc.resolveSurfaceSpeed({
  basis: gid("speedBasis").value,
  sfm: num("sfm"),
  rpm: num("rpm"),
  diameterInches: d
 });
}catch(error){
 showCalculationError("mainResult", error);
 return;
}
const {rpm, sfm} = speed;
gid("rpm").value = round(rpm,0);
gid("sfm").value = round(sfm,1);
out += "Basis: " + (speed.basis === "sfm" ? "entered SFM" : "entered RPM") + "<br>";
out += "RPM: " + round(rpm,0) + "<br>";
out += "SFM: " + round(sfm,1) + "<br>";

if(type === "drill"){
 const ipr = num("ipr");
 if(ipr <= 0 || rpm <= 0){
  gid("mainResult").innerHTML = out + "Enter IPR to calculate feed.";
  return;
 }
 const fpt = flutes ? ipr / flutes : 0;
 const ipm = rpm * ipr;
 feedIpm = ipm;
 out += "FPT from IPR: " + round(fpt,5) + "<br>";
 out += "IPM from RPM × IPR: " + round(ipm,4);
}
else if(type === "endmill"){
 const fpt = num("fpt");
 const stepover = stepoverInches();
 if(fpt <= 0 || flutes <= 0 || rpm <= 0){
  gid("mainResult").innerHTML = out + "Enter FPT and flutes to calculate feed.";
  return;
 }
 if(stepover <= 0){
  gid("mainResult").innerHTML = out + "Enter radial stepover for endmill mode.";
  return;
 }
 const ratio = stepover / d;
 let chipThin;
 try{
  chipThin = MBCalc.radialChipThinningFactor(stepover, d);
 }catch(error){
  showCalculationError("mainResult", error);
  return;
 }
 const adjustedFpt = fpt * chipThin;
 const programmedIpm = rpm * flutes * fpt;
 const adjustedIpm = rpm * flutes * adjustedFpt;
 feedIpm = adjustedIpm;
 out += "Stepover ratio: " + round(ratio,4) + "<br>";
 out += "Chip thinning factor: " + round(chipThin,4) + "<br>";
 out += "Programmed FPT: " + round(fpt,5) + "<br>";
 out += "Adjusted FPT for chip thinning: " + round(adjustedFpt,5) + "<br>";
 out += "Programmed IPM: " + round(programmedIpm,4) + "<br>";
 out += "Adjusted IPM at same RPM: " + round(adjustedIpm,4);
}
else if(type === "face45"){
 const fpt = num("fpt");
 if(fpt <= 0 || flutes <= 0 || rpm <= 0){
  gid("mainResult").innerHTML = out + "Enter FPT and teeth to calculate feed.";
  return;
 }
 if(d < 0.75){
  warnings.push("Entered diameter looks too small for a typical face mill.");
 }
 if(flutes > 8 && d < 1.5){
  warnings.push("Tooth count looks high for this face mill diameter.");
 }
 const ipm = rpm * flutes * fpt;
 feedIpm = ipm;
 const actualChip = fpt * Math.sin(Math.PI/4);
 const multiplier = actualChip ? fpt / actualChip : 1;
 out += "Programmed FPT: " + round(fpt,5) + "<br>";
 out += "Programmed IPM: " + round(ipm,4) + "<br>";
 out += "Actual chip thickness at 45 degrees: " + round(actualChip,5) + "<br>";
 out += "Feed advantage multiplier versus 90 degree: " + round(multiplier,4);
}
else{
 const fpt = num("fpt");
 if(fpt <= 0 || flutes <= 0 || rpm <= 0){
  gid("mainResult").innerHTML = out + "Enter FPT and teeth to calculate feed.";
  return;
 }
 if(flutes > 8 && d < 1){
  warnings.push("Tooth count looks high for this shoulder mill diameter.");
 }
 const ipm = rpm * flutes * fpt;
 feedIpm = ipm;
 out += "Programmed FPT: " + round(fpt,5) + "<br>";
 out += "Programmed IPM: " + round(ipm,4) + "<br>";
 out += "Actual chip thickness at 90 degrees: " + round(fpt,5) + "<br>";
 out += "90 degree shoulder cutters are best when wall straightness matters.";
}

if(warnings.length){
 out = "Warning: " + warnings.join(" ") + "<br><br>" + out;
}
out += machineLimitMarkup(rpm, feedIpm);
gid("mainResult").innerHTML = out;
}

function updateTurningPresetPreview(){
const m = materials[parseInt(gid("turnMaterial").value || 0,10)];
const type = gid("turnType").value;
const profile = MBData.materialProfile(m, turningProfileKey(type), gid("turnPresetLevel").value);
let text = "MB baseline—not manufacturer tool data.<br>Material: " + m.name + " · ISO " + m.isoGroup +
"<br>SFM low / standard / upper: " + formatRange(profile.range) +
"<br>Selected SFM: " + profile.sfm + " (" + profile.level + ")<br>";
if(type === "turn") text += "OD or face turning uses IPR and solves the missing RPM or SFM from diameter.";
else if(type === "bore") text += "ID boring uses the same speed math as turning, with a slightly lighter preset feed.";
else if(type === "groove") text += "Grooving uses the same speed math, with a lighter preset feed to give a safer starting point.";
else text += "Lathe drill mode uses IPR and solves the missing RPM or SFM from drill diameter.";
gid("turnPresetPreview").innerHTML = text;
}

function applyTurningPreset(){
const m = materials[parseInt(gid("turnMaterial").value || 0,10)];
const d = turnDiaInches();
const type = gid("turnType").value;
let iprFactor = 1;
const profile = MBData.materialProfile(m, turningProfileKey(type), gid("turnPresetLevel").value);
if(type === "bore"){
 iprFactor = 0.85;
}else if(type === "groove"){
 iprFactor = 0.65;
}else if(type === "drill"){
 iprFactor = 0.7;
}
gid("turnSpeedBasis").value = "sfm";
updateSpeedBasisUI("turn");
gid("turnSfm").value = round(profile.sfm,0);
gid("turnRpm").value = "";
if(d > 0){
 let baseIpr = Math.max(0.0025, Math.min(0.018, m.feed.turnFactor * Math.sqrt(d)));
 gid("turnIpr").value = round(baseIpr * iprFactor,4);
}
calcTurningMain();
updateTurningPresetPreview();
}

function clearMillingCalc(){
gid("calcType").value = "endmill";
gid("units").value = "inch";
gid("speedBasis").value = "sfm";
gid("drillToolType").value = "carbide";
gid("material").value = "0";
gid("presetLevel").value = "standard";
gid("toolDia").value = "";
gid("sfm").value = "";
gid("rpm").value = "";
gid("flutes").value = "";
gid("ipr").value = "";
gid("fpt").value = "";
gid("stepover").value = "";
gid("mainResult").innerHTML = "";
toggleCalcType();
updateSpeedBasisUI("main");
updatePresetPreview();
}

function clearTurningCalc(){
gid("turnType").value = "turn";
gid("turnUnits").value = "inch";
gid("turnSpeedBasis").value = "sfm";
gid("turnMaterial").value = "0";
gid("turnPresetLevel").value = "standard";
gid("turnDia").value = "";
gid("turnSfm").value = "";
gid("turnRpm").value = "";
gid("turnIpr").value = "";
gid("turnResult").innerHTML = "";
updateSpeedBasisUI("turn");
updateTurningPresetPreview();
}

function calcTurningMain(){
const d = turnDiaInches();
const ipr = num("turnIpr");
const type = gid("turnType").value;
let out = "";
if(d <= 0){
 gid("turnResult").innerHTML = "Enter a valid turning diameter.";
 return;
}
let speed;
try{
 speed = MBCalc.resolveSurfaceSpeed({
  basis: gid("turnSpeedBasis").value,
  sfm: num("turnSfm"),
  rpm: num("turnRpm"),
  diameterInches: d
 });
}catch(error){
 showCalculationError("turnResult", error);
 return;
}
const {rpm, sfm} = speed;
gid("turnRpm").value = round(rpm,0);
gid("turnSfm").value = round(sfm,1);
out += "Basis: " + (speed.basis === "sfm" ? "entered SFM" : "entered RPM") + "<br>";
out += "RPM: " + round(rpm,0) + "<br>";
out += "SFM: " + round(sfm,1) + "<br>";
if(ipr <= 0 || rpm <= 0){
 gid("turnResult").innerHTML = out + "Enter IPR to calculate feed.";
 return;
}
const ipm = rpm * ipr;
out += "IPR: " + round(ipr,4) + "<br>";
out += "IPM from RPM × IPR: " + round(ipm,4) + "<br>";
if(type === "turn") out += "Operation: OD or face turning";
else if(type === "bore") out += "Operation: ID boring";
else if(type === "groove") out += "Operation: Grooving";
else out += "Operation: Drilling in lathe";
out += machineLimitMarkup(rpm, ipm);
gid("turnResult").innerHTML = out;
}

function populateDrillTable(){
const sel = gid("drillQuick");
if(!sel) return;
sel.innerHTML = "";
allDrills.forEach((d,i)=>{
const o = document.createElement("option");
o.value = String(i);
o.textContent = d.name;
sel.appendChild(o);
});
sel.selectedIndex = 0;
showQuickDrill();
}

function populateNptSizes(){
const select = gid("nptSize");
select.innerHTML = "";
NPT.forEach(thread => {
 const option = document.createElement("option");
 option.value = thread.size;
 option.textContent = thread.size;
 select.appendChild(option);
});
}

function normalizeDrillSearchText(text){
return String(text || "").trim().toLowerCase();
}

function findNamedDrill(text){
const q = normalizeDrillSearchText(text);
return allDrills.find(d => normalizeDrillSearchText(d.name) === q) || null;
}

function parseDrillInputToInches(text){
const raw = String(text || "").trim();
if(!raw) return null;
const named = findNamedDrill(raw);
if(named) return {name:named.name, dec:named.dec, source:"chart"};

let q = raw.toLowerCase().replace(/ø/g,"").trim();
q = q.replace(/\s+/g," ");

if(/mm$/.test(q) || q.includes(" mm")){
const mm = parseFloat(q.replace("mm","").trim());
if(isFinite(mm) && mm > 0) return {name:raw, dec:mm/25.4, source:"metric"};
}
if(/in$/.test(q) || q.includes(" inch") || q.includes(" inches")){
const inches = parseFloat(q.replace("inches","").replace("inch","").replace("in","").trim());
if(isFinite(inches) && inches > 0) return {name:raw, dec:inches, source:"inch"};
}
if(q.includes("/")){
const frac = parseFraction(q);
if(isFinite(frac) && frac > 0) return {name:raw, dec:frac, source:"fraction"};
}
const val = parseFloat(q);
if(isFinite(val) && val > 0){
return {name:raw, dec:val, source:"decimal"};
}
return null;
}

function calculateDrillSearch(){
const raw = gid("drillSearch").value;
const result = gid("drillSearchResult");
const parsed = parseDrillInputToInches(raw);
if(!raw.trim()){
result.innerHTML = "Enter a drill size to convert or search.";
return;
}
if(!parsed){
result.innerHTML = "Could not read that size. Try formats like 3/16, #7, A, 10.2 mm, or .257.";
return;
}
const nearest = nearestDrill(parsed.dec);

result.innerHTML =
"Entered size: " + escapeHtml(parsed.name) + "<br>" +
"Decimal inch: " + round(parsed.dec,4) + "<br>" +
"Millimeters: " + round(parsed.dec*25.4,3) + "<br>" +
"Nearest listed drill: " + nearest.name + " (" + round(nearest.dec,4) + " inch, " + round(nearest.dec*25.4,3) + " mm)";
}

function showQuickDrill(){
const idx = parseInt(gid("drillQuick").value || 0,10);
const d = allDrills[idx] || allDrills[0];
gid("drillQuickResult").innerHTML =
"Drill size: " + d.name + "<br>" +
"Decimal inch: " + round(d.dec,4) + "<br>" +
"Millimeters: " + round(d.dec*25.4,3);
}


function calcPeck(){
const dia = peckDiaInches();
const depth = holeDepthInches();
const material = gid("peckMaterial").value;
if(dia <= 0){
gid("peckResult").innerHTML = "Enter a valid drill diameter";
return;
}
const ratio = depth / dia;
let peck = 0;
let note = "";
if(ratio <= 3){
peck = 0;
note = material === "cast" ? "Usually no peck needed under 3xD in cast iron" : "Usually no peck or very light chip break under 3xD";
}else if(ratio <= 5){
peck = dia * 0.5;
note = "Moderate peck range";
}else if(ratio <= 8){
peck = dia * 0.3;
note = "Deeper hole. Use smaller pecks";
}else{
peck = dia * 0.2;
note = "Deep hole. Prefer brand data and better chip evacuation";
}
const showPeck = gid("peckUnits").value === "metric" ? peck * 25.4 : peck;
gid("peckResult").innerHTML =
"Depth to diameter ratio: " + round(ratio,2) + "<br>" +
"Suggested peck depth: " + round(showPeck,4) + "<br>" +
note;
}

function currentThreadArrayFromType(type){
if(type === "UNC") return UNC;
if(type === "UNF") return UNF;
if(type === "NPT") return NPT;
return METRIC;
}

function loadThreadChart(){
const arr = currentThreadArrayFromType(gid("threadType").value);
const sel = gid("threadSelect");
if(!sel) return;
sel.innerHTML = "";
arr.forEach((t,i)=>{
const o = document.createElement("option");
o.value = String(i);
o.textContent = t.thread;
sel.appendChild(o);
});
sel.selectedIndex = 0;
syncThreadToolsFromTap();
calcTapSearch();
}

function loadTapCalcThreadChart(){
const type = gid("tapCalcThreadType").value;
const arr = currentThreadArrayFromType(type);
const sel = gid("tapCalcSelect");
if(!sel) return;
sel.innerHTML = "";
arr.forEach((t,i)=>{
const o = document.createElement("option");
o.value = String(i);
o.textContent = t.thread;
sel.appendChild(o);
});
sel.selectedIndex = 0;
applyTapCalcSelect();
}

function applyTapCalcSelect(){
const type = gid("tapCalcThreadType").value;
const arr = currentThreadArrayFromType(type);
const t = arr[parseInt(gid("tapCalcSelect").value || 0,10)] || arr[0];
if(!t) return;
gid("tapCalcMajor").value = t.major;
gid("tapCalcPitch").value = t.pitch;
calcTapSpeedFeed();
}

function loadThreadMillChart(){
const type = gid("tmThreadType").value;
const arr = currentThreadArrayFromType(type);
const sel = gid("tmSelect");
if(!sel) return;
sel.innerHTML = "";
arr.forEach((t,i)=>{
const o = document.createElement("option");
o.value = String(i);
o.textContent = t.thread;
sel.appendChild(o);
});
sel.selectedIndex = 0;
applyThreadMillSelect();
}

function applyThreadMillSelect(){
const type = gid("tmThreadType").value;
const arr = currentThreadArrayFromType(type);
const t = arr[parseInt(gid("tmSelect").value || 0,10)] || arr[0];
if(!t) return;
gid("tmMajor").value = t.major;
gid("tmPitch").value = t.pitch;
calcThreadMill();
}

function syncThreadToolsFromTap(){
const type = gid("threadType").value;
const idx = gid("threadSelect").value || "0";
if(gid("tapCalcThreadType")) gid("tapCalcThreadType").value = type;
if(gid("tmThreadType")) gid("tmThreadType").value = type;
loadTapCalcThreadChart();
loadThreadMillChart();
if(gid("tapCalcSelect") && gid("tapCalcSelect").options.length){
 const maxIdx = gid("tapCalcSelect").options.length - 1;
 gid("tapCalcSelect").value = String(Math.min(parseInt(idx || 0,10), maxIdx));
 applyTapCalcSelect();
}
if(gid("tmSelect") && gid("tmSelect").options.length){
 const maxIdx = gid("tmSelect").options.length - 1;
 gid("tmSelect").value = String(Math.min(parseInt(idx || 0,10), maxIdx));
 applyThreadMillSelect();
}
}

function nearestDrill(dec){
let best = allDrills[0];
let bestDiff = Math.abs(best.dec - dec);
allDrills.forEach(d=>{
const diff = Math.abs(d.dec - dec);
if(diff < bestDiff){ best = d; bestDiff = diff; }
});
return best;
}

function drillAlternativesInRange(minDec,maxDec,preferredDec){
const arr = allDrills.filter(d => d.dec >= minDec - 0.00001 && d.dec <= maxDec + 0.00001);
arr.sort((a,b)=>Math.abs(a.dec - preferredDec) - Math.abs(b.dec - preferredDec));
const unique = [];
arr.forEach(d=>{
if(!unique.find(x=>x.name===d.name)) unique.push(d);
});
return unique.slice(0,6);
}



function calcTapSearch(){
const idx = parseInt(gid("threadSelect").value || 0,10);
const arr = currentThreadArrayFromType(gid("threadType").value);
const type = gid("threadType").value;
const tapStyle = gid("tapStyle").value;
const t = arr[idx] || arr[0];
if(!t){
 gid("tapResult").innerHTML = "No matching thread found.";
 return;
}
const range = MBCalc.tapDrillRange(type, t, tapStyle);
if(range.unsupported){
 gid("tapResult").textContent = range.note;
 return;
}
// chart drills inside the calculated range; the ends are never outside it
const inRange = range.exact ? [] : allDrills.filter(d => d.dec >= range.minDec - 0.00001 && d.dec <= range.maxDec + 0.00001);
const typicalDrill = range.exact ? {name:t.tap,dec:t.tapDec}
: inRange.length ? inRange.reduce((a,b) => Math.abs(b.dec - range.typicalDec) < Math.abs(a.dec - range.typicalDec) ? b : a)
: nearestDrill(range.typicalDec);
const minDrill = range.exact ? typicalDrill : inRange[0];
const maxDrill = range.exact ? typicalDrill : inRange[inRange.length - 1];
const alts = range.exact ? [] : drillAlternativesInRange(range.minDec, range.maxDec, typicalDrill.dec);
const pct = range.percentRange ? range.percentRange.map(p => Math.round(p * 100)) : null;
let out = "";
out += "Thread: " + t.thread + "<br>";
out += "Tap style: " + (tapStyle === "form" ? "Form tap" : "Cutting tap") + "<br>";
out += (range.exact ? "Listed tap drill: " : "Typical tap drill: ") + typicalDrill.name + " (" + round(typicalDrill.dec,4) + " inch, " + round(typicalDrill.dec*25.4,3) + " mm)<br>";
if(!range.exact){
 out += "Calculated range (" + pct[2] + "% to " + pct[0] + "% thread): " + round(range.minDec,4) + " to " + round(range.maxDec,4) + " inch<br>";
 if(minDrill){
  out += "Smallest drill in range: " + minDrill.name + " (" + round(minDrill.dec,4) + " inch, " + round(minDrill.dec*25.4,3) + " mm)<br>";
  out += "Largest drill in range: " + maxDrill.name + " (" + round(maxDrill.dec,4) + " inch, " + round(maxDrill.dec*25.4,3) + " mm)<br>";
 }else{
  out += "No chart drill falls inside this range; the typical drill above is the nearest.<br>";
 }
 if(tapStyle === "cut" && t.tap) out += "Standard chart tap drill (cutting tap): " + t.tap + " (" + round(t.tapDec,4) + " inch)<br>";
 out += "Acceptable alternatives: " + (alts.length ? alts.map(d=>d.name + " (" + round(d.dec,4) + ")").join(", ") : "None found in chart range") + "<br>";
}
const raw = gid("candidateDrill").value.trim();
if(raw){
 const parsed = parseDrillInputToInches(raw);
 if(parsed){
  const inRange = parsed.dec >= range.minDec - 0.00001 && parsed.dec <= range.maxDec + 0.00001;
  const relation = parsed.dec < range.minDec ? "smaller than listed" : parsed.dec > range.maxDec ? "larger than listed" : "equal to the listed size";
  out += "Checked drill: " + escapeHtml(raw) + " = " + round(parsed.dec,4) + " inch, " + round(parsed.dec*25.4,3) + " mm<br>";
  out += range.exact
  ? "Comparison: It is " + relation + ". Verify the final drill with the tap manufacturer.<br>"
  : "Result: " + (inRange ? "This drill is within the calculated range." : "This drill is outside the calculated range.") + " It is " + relation + ".<br>";
 }else{
  out += "Checked drill: could not read that size. Try formats like #7, 13/64, .201, or 5.1 mm.<br>";
 }
}
out += range.note;
gid("tapResult").innerHTML = out;
}

function calcNptHelper(){
const size = gid("nptSize").value;
const turns = num("nptTurns");
const tpi = nptPitchMap[size];
const depth = tpi ? turns / tpi : 0;
gid("nptHelperResult").innerHTML =
"Approximate thread advance after " + turns + " turns: " + round(depth,4) + " inch<br>" +
"NPT taper on diameter: 0.0625 inch per inch of thread length<br>" +
"NPT taper per side: 1.7899°<br>" +
"NPT is tapered, so use this only as a rough programming helper and verify with the proper gage.";
}

function tapCalcMajorInches(){
const type = gid("tapCalcThreadType").value;
const major = num("tapCalcMajor");
return type === "METRIC" ? major / 25.4 : major;
}

function pitchInchesForType(type, pitchVal){
return type === "METRIC" ? pitchVal / 25.4 : (pitchVal ? 1 / pitchVal : 0);
}

function populateTapWorkMaterials(){
const sel = gid("tapWorkMaterial");
if(!sel) return;
sel.innerHTML = "";
materials.forEach((m,i)=>{
const o = document.createElement("option");
o.value = String(i);
o.textContent = m.name;
sel.appendChild(o);
});
sel.selectedIndex = 0;
sel.addEventListener("change", applyTapPreset);
}

function applyTapPreset(){
const material = materials[parseInt(gid("tapWorkMaterial").value || 0,10)] || materials[0];
const toolMaterial = gid("tapToolMaterial").value;
const profileKey = toolMaterial === "carbide" ? "tapCarbide" : "tapHss";
const profile = MBData.materialProfile(material, profileKey, gid("tapPresetLevel").value);
const styleFactor = gid("tapCalcStyle").value === "form" ? 0.8 : 1;
const threadFactor = gid("tapCalcThreadType").value === "NPT" ? 0.85 : 1;
gid("tapSpeedBasis").value = "sfm";
updateSpeedBasisUI("tap");
gid("tapCalcSfm").value = round(profile.sfm * styleFactor * threadFactor,1);
gid("tapCalcRpm").value = "";
calcTapSpeedFeed();
}

function calcTapSpeedFeed(){
const type = gid("tapCalcThreadType").value;
const style = gid("tapCalcStyle").value;
const toolMaterial = gid("tapToolMaterial").value;
const material = materials[parseInt(gid("tapWorkMaterial").value || 0,10)] || materials[0];
const majorIn = tapCalcMajorInches();
const pitchVal = num("tapCalcPitch");
const pitchIn = pitchInchesForType(type, pitchVal);
const profileKey = toolMaterial === "carbide" ? "tapCarbide" : "tapHss";
const profile = MBData.materialProfile(material, profileKey, gid("tapPresetLevel").value);
let recommended = profile.sfm * (style === "form" ? 0.8 : 1.0) * (type === "NPT" ? 0.85 : 1.0);
if(gid("tapSpeedBasis").value === "sfm" && num("tapCalcSfm") <= 0){
 gid("tapCalcSfm").value = round(recommended,1);
}
let speed;
try{
 speed = MBCalc.resolveSurfaceSpeed({
  basis: gid("tapSpeedBasis").value,
  sfm: num("tapCalcSfm"),
  rpm: num("tapCalcRpm"),
  diameterInches: majorIn
 });
}catch(error){
 showCalculationError("tapSpeedResult", error);
 return;
}
const {rpm, sfm} = speed;
gid("tapCalcRpm").value = round(rpm,0);
gid("tapCalcSfm").value = round(sfm,1);
const ipm = rpm * pitchIn;
const mmPerRev = type === "METRIC" ? pitchVal : pitchIn * 25.4;
const mmMin = rpm * mmPerRev;
gid("tapSpeedResult").innerHTML =
"Material: " + material.name + " · ISO " + material.isoGroup + "<br>" +
"MB tap baseline low / standard / upper: " + formatRange(profile.range) + " SFM<br>" +
"Adjusted selected baseline (verify with tap data): " + round(recommended,1) + " SFM<br>" +
"Basis: " + (speed.basis === "sfm" ? "entered SFM" : "entered RPM") + "<br>" +
"Calculated RPM: " + round(rpm,0) + "<br>" +
"Calculated SFM: " + round(sfm,1) + "<br>" +
"Feed per revolution: " + round(pitchIn,5) + " inch/rev<br>" +
"Feed rate: " + round(ipm,4) + " IPM<br>" +
"Metric feed rate: " + round(mmMin,2) + " mm/min" +
machineLimitMarkup(rpm, ipm);
}

function clearTapCalc(){
gid("tapSpeedBasis").value = "sfm";
gid("tapCalcSfm").value = "";
gid("tapCalcRpm").value = "";
gid("tapSpeedResult").innerHTML = "";
updateSpeedBasisUI("tap");
}

function calcThreadMill(){
const type = gid("tmThreadType").value;
const major = num("tmMajor");
const toolDiaInput = num("tmToolDia");
const pitchVal = num("tmPitch");
const rpm = num("tmRpm");
const fpt = num("tmFpt");
const depthInput = num("tmDepth");
const flutes = num("tmFlutes");
const location = gid("tmLocation").value;
const pitchIn = pitchInchesForType(type, pitchVal);
const majorIn = type === "METRIC" ? major / 25.4 : major;
const toolDia = gid("tmUnits").value === "metric" ? toolDiaInput / 25.4 : toolDiaInput;
const depth = gid("tmUnits").value === "metric" ? depthInput / 25.4 : depthInput;
let result;
try{
 result = MBCalc.threadMill({
  threadMajorInches: majorIn,
  toolDiameterInches: toolDia,
  rpm,
  cuttingEdges: flutes,
  chipLoad: fpt,
  pitchInches: pitchIn,
  threadLocation: location
 });
}catch(error){
 showCalculationError("threadMillResult", error);
 return;
}
const pathDia = result.centerlineDiameter;
const feed = result.feedIpm;
let out = "";
out += "Thread location: " + (location === "internal" ? "Internal" : "External") + "<br>";
out += "Pitch per revolution in inches: " + round(pitchIn,5) + "<br>";
out += "Toolpath centerline diameter: " + round(pathDia,5) + "<br>";
out += "Cutting teeth or flutes: " + round(flutes,0) + "<br>";
out += "Feed at the cutting edge (RPM × teeth × FPT): " + round(result.peripheryFeedIpm,4) + " IPM<br>";
out += "Programmed centerline feed (× " + round(result.compensationRatio,4) + "): " + round(feed,4) + " IPM<br>";
if(type === "NPT"){
 const diameterChange = depth * 0.0625;
 out += "NPT taper angle per side: 1.7899°<br>";
 out += "Centerline diameter change over depth: " + round(diameterChange,5) + " inch<br>";
 out += "NPT path direction must be verified for the selected internal/external toolpath and cutting direction.";
}else{
 out += "Straight thread axial travel per revolution: " + round(pitchIn,5) + " inch";
}
out += machineLimitMarkup(rpm, feed);
gid("threadMillResult").innerHTML = out;
}

const POINT_TOOLS = {
 drill118:{angle:118, label:"Drill 118°"}, drill135:{angle:135, label:"Drill 135°"}, drill140:{angle:140, label:"Drill 140°"},
 spot90:{angle:90, label:"Spot drill 90°"}, spot120:{angle:120, label:"Spot drill 120°"}, spot140:{angle:140, label:"Spot drill 140°"},
 center60:{angle:60, label:"Center drill 60°"}
};
function applySpotToolType(){
const tool = POINT_TOOLS[gid("spotToolType").value];
if(tool) gid("spotAngle").value = String(tool.angle);
calcSpotDrill();
}

function calcSpotDrill(){
const type = gid("spotToolType").value;
const angle = num("spotAngle");
const dia = num("followDrillDia");
if(dia <= 0 || angle <= 0 || angle >= 180){
 gid("spotDrillResult").innerHTML = "Enter a diameter and an included angle between 0 and 180 degrees.";
 return;
}
const depth = (dia/2) / Math.tan((angle/2) * Math.PI / 180);
const isDrill = type.startsWith("drill");
gid("spotDrillResult").innerHTML =
"Tool: " + (POINT_TOOLS[type] ? POINT_TOOLS[type].label : "Custom " + round(angle,2) + "°") + "<br>" +
"Diameter: " + round(dia,5) + "<br>" +
(isDrill ? "Point length (tip to full diameter): " : "Depth to make this diameter: ") + round(depth,5);
}


function updateChamferSizeBy(){
const byMajor = gid("chamferSizeBy").value === "major";
const input = gid("chamferWidth");
const hole = num("chamferHoleDia");
const value = num("chamferWidth");
gid("chamferWidthLabel").textContent = byMajor ? "Top (countersink) diameter" : "Target chamfer size per side";
// keep the same chamfer when switching how it is given
if(hole > 0 && value > 0) input.value = round(byMajor ? hole + 2 * value : Math.max(0, (value - hole) / 2), 4);
calcChamfer();
}

function calcChamfer(){
const holeDia = num("chamferHoleDia");
const byMajor = gid("chamferSizeBy").value === "major";
const width = byMajor ? (num("chamferWidth") - holeDia) / 2 : num("chamferWidth");
const angle = num("chamferAngle");
const tipDia = num("chamferTipDia");
const toolMaxDia = num("chamferToolMaxDia");
if(holeDia <= 0 || width <= 0 || angle <= 0 || angle >= 180){
 gid("chamferResult").innerHTML = byMajor
 ? "Enter a hole diameter, a top diameter larger than the hole, and a tool angle."
 : "Enter a valid hole diameter, chamfer size, and tool angle.";
 return;
}
const half = angle / 2 * Math.PI / 180;
const targetMajor = holeDia + (2 * width);
const depthFromPoint = Math.tan(half) ? (targetMajor - tipDia) / (2 * Math.tan(half)) : 0;
const touchOffDepth = Math.tan(half) ? (holeDia - tipDia) / (2 * Math.tan(half)) : 0;
const additionalDepth = MBCalc.countersinkDepth(holeDia, targetMajor, angle);   // = depthFromPoint - touchOffDepth
const chamferFaceLength = Math.sin(half) ? width / Math.sin(half) : 0;
let out = "";
out += "Starting hole diameter: " + round(holeDia,4) + "<br>";
out += "Target chamfer size per side: " + round(width,4) + "<br>";
out += "Target top diameter after chamfer: " + round(targetMajor,4) + "<br>";
out += "Tool included angle: " + round(angle,4) + "°<br>";
out += "Tool tip diameter: " + round(tipDia,4) + "<br>";
out += (tipDia > 0 ? "Program depth from the tool tip: " : "Program depth from the theoretical point: ") + round(depthFromPoint,4) + "<br>";
out += "Depth when tool just touches the existing hole edge: " + round(touchOffDepth,4) + "<br>";
out += "Additional Z depth past touch off to hold the chamfer: " + round(additionalDepth,4) + "<br>";
out += "Chamfer face length: " + round(chamferFaceLength,4);
if(toolMaxDia > 0){
 const maxPossibleWidth = Math.max(0, (toolMaxDia - holeDia) / 2);
 out += "<br>Chamfer tool cutting diameter: " + round(toolMaxDia,4);
 out += "<br>Maximum chamfer size this tool can make in this hole: " + round(maxPossibleWidth,4);
 if(targetMajor > toolMaxDia + 0.000001){
  out += "<br>Warning: this tool is not large enough to open the hole to the target top diameter.";
 } else {
  out += "<br>This tool is large enough to make the target chamfer diameter.";
 }
}
gid("chamferResult").innerHTML = out;
}


function calcPitchFromAngle(){
const bore = num("boreDia");
const tool = num("helixToolDia");
const angle = num("helixAngleDeg");
let result;
try{
 result = MBCalc.helixPitch(bore, tool, angle);
}catch(error){
 showCalculationError("helixPitchResult", error);
 return;
}
const {radius, circumference: circ, pitch} = result;
gid("targetPitch").value = round(pitch,6);
gid("helixPitchResult").innerHTML =
"Cutting radius: " + round(radius,6) + "<br>" +
"Circumference: " + round(circ,6) + "<br>" +
"Pitch per rev: " + round(pitch,6) + "<br>" +
"Helix angle: " + round(angle,6) + " deg";
}

function calcAngleFromPitch(){
const bore = num("boreDia");
const tool = num("helixToolDia");
const pitch = num("targetPitch");
let result;
try{
 result = MBCalc.helixAngle(bore, tool, pitch);
}catch(error){
 showCalculationError("helixPitchResult", error);
 return;
}
const {radius, circumference: circ, angleDegrees: angle} = result;
gid("helixAngleDeg").value = round(angle,6);
gid("helixPitchResult").innerHTML =
"Cutting radius: " + round(radius,6) + "<br>" +
"Circumference: " + round(circ,6) + "<br>" +
"Pitch per rev: " + round(pitch,6) + "<br>" +
"Helix angle: " + round(angle,6) + " deg";
}

function clearHelixPitch(){
gid("boreDia").value = "";
gid("helixToolDia").value = "";
gid("helixAngleDeg").value = "";
gid("targetPitch").value = "";
gid("helixPitchResult").innerHTML = "";
}

function calcCircularInterpolation(){
let result;
try{
 result = MBCalc.circularInterpolationFeed({
  featureDiameter:num("arcFeatureDia"),
  toolDiameter:num("arcToolDia"),
  surfaceFeedIpm:num("arcSurfaceFeed"),
  location:gid("arcLocation").value
 });
}catch(error){
 showCalculationError("arcFeedResult", error);
 return;
}
gid("arcFeedResult").innerHTML =
"Feature: " + (result.location === "internal" ? "Internal bore" : "External boss") + "<br>" +
"Cutter-centerline diameter: " + round(result.centerlineDiameter,5) + "<br>" +
"Centerline-to-surface ratio: " + round(result.compensationRatio,5) + "<br>" +
"Programmed centerline feed: " + round(result.centerlineFeedIpm,4) + " IPM";
}

function toggleEffectiveToolType(){
gid("effectiveTaperFields").style.display = gid("effectiveToolType").value === "taper" ? "" : "none";
}

function calcEffectiveDiameter(){
let result;
let effectiveSfm;
try{
 result = MBCalc.effectiveCuttingDiameter({
  toolType:gid("effectiveToolType").value,
  toolDiameter:num("effectiveToolDia"),
  axialDepth:num("effectiveAxialDepth"),
  tipDiameter:num("effectiveTipDia"),
  includedAngleDegrees:num("effectiveIncludedAngle")
 });
 effectiveSfm = MBCalc.sfmFromRpm(num("effectiveRpm"), result.effectiveDiameter);
}catch(error){
 showCalculationError("effectiveDiameterResult", error);
 return;
}
gid("effectiveDiameterResult").innerHTML =
"Tool type: " + (result.toolType === "ball" ? "Ball nose" : "Tapered") + "<br>" +
"Effective cutting diameter: " + round(result.effectiveDiameter,5) + "<br>" +
"Effective SFM at entered RPM: " + round(effectiveSfm,1);
}

function toggleScallopSource(){
const fromHeight = gid("scallopSolveFrom").value === "height";
gid("scallopStepover").disabled = fromHeight;
gid("scallopHeight").disabled = !fromHeight;
}

function calcScallop(){
let result;
try{
 result = MBCalc.scallopGeometry({
  solveFrom:gid("scallopSolveFrom").value,
  ballDiameter:num("scallopBallDia"),
  stepover:num("scallopStepover"),
  scallopHeight:num("scallopHeight")
 });
}catch(error){
 showCalculationError("scallopResult", error);
 return;
}
gid("scallopStepover").value = round(result.stepover,6);
gid("scallopHeight").value = round(result.scallopHeight,6);
gid("scallopResult").innerHTML =
"Stepover: " + round(result.stepover,6) + "<br>" +
"Theoretical scallop height: " + round(result.scallopHeight,6) + "<br>" +
"Verify finish against tool runout, deflection, surface angle, and machine motion.";
}

function calcTruePosition(){
const deltaX = num("positionActualX") - num("positionNominalX");
const deltaY = num("positionActualY") - num("positionNominalY");
let result;
try{
 result = MBCalc.truePosition(deltaX, deltaY);
}catch(error){
 showCalculationError("truePositionResult", error);
 return;
}
gid("truePositionResult").innerHTML =
"X deviation: " + round(deltaX,6) + "<br>" +
"Y deviation: " + round(deltaY,6) + "<br>" +
"Radial center error: " + round(result.radialError,6) + "<br>" +
"Diametrical true position: " + round(result.diametricalTruePosition,6);
}

function calcBoreStockPlan(){
let result;
try{
 result = MBCalc.boreStockPlan({
  currentDiameter:num("boreCurrentDia"),
  finishDiameter:num("boreFinishDia"),
  maxRadialDepth:num("boreMaxRadialDepth"),
  finishAllowanceDiameter:num("boreFinishAllowance")
 });
}catch(error){
 showCalculationError("boreStockResult", error);
 return;
}
gid("boreStockResult").innerHTML =
"Total stock on diameter: " + round(result.diameterRemoval,5) + "<br>" +
"Total radial stock: " + round(result.totalRadialStock,5) + "<br>" +
"Roughing passes: " + result.roughPasses + "<br>" +
"Equal radial depth per rough pass: " + round(result.radialDepthPerRoughPass,5) + "<br>" +
"Prefinish diameter: " + round(result.prefinishDiameter,5) + "<br>" +
"Final radial stock: " + round(result.finishRadialStock,5);
}

function calcLengthConversion(){
const inch = num("convInchInput");
const mm = num("convMmInput");
gid("convLengthResult").innerHTML =
"Inches to mm: " + round(inch * 25.4,4) + "<br>" +
"mm to inches: " + round(mm / 25.4,4);
}

function calcFractionConversion(){
const dec = num("convDecInput");
const fracText = gid("convFracInput").value;
gid("convFractionResult").innerHTML =
"Decimal to nearest 64ths: " + decimalToFraction64(dec) + "<br>" +
"Fraction to decimal: " + round(parseFraction(fracText),6);
}

function calcPitchSpeedConversion(){
const tpi = num("convTpiInput");
const pitch = num("convPitchInput");
const sfm = num("convSfmInput");
const smm = num("convSmmInput");
gid("convPitchSpeedResult").innerHTML =
"TPI to pitch: " + round(tpi ? 1 / tpi : 0,6) + " inch<br>" +
"Pitch to TPI: " + round(pitch ? 1 / pitch : 0,4) + "<br>" +
"SFM to meters per minute: " + round(sfm * 0.3048,4) + "<br>" +
"Meters per minute to SFM: " + round(smm / 0.3048,4);
}

function calcBoltCircle(){
const bcd = num("bcd");
const count = Math.max(1, Math.floor(num("holeCount")));
const start = num("startAngle");
const cx = num("centerX");
const cy = num("centerY");
const r = bcd / 2;
const body = gid("boltBody");
body.innerHTML = "";
for(let i=0;i<count;i++){
const angle = start + i * 360 / count;
const rad = angle * Math.PI / 180;
const x = cx + r * Math.cos(rad);
const y = cy + r * Math.sin(rad);
const tr = document.createElement("tr");
tr.innerHTML = "<td>"+(i+1)+"</td><td>"+round(angle,4)+"</td><td>"+round(x,4)+"</td><td>"+round(y,4)+"</td>";
body.appendChild(tr);
}
gid("boltSummaryResult").innerHTML =
"Radius: " + round(r,4) + "<br>" +
"Angle step: " + round(360 / count,4) + "°<br>" +
"Center: X " + round(cx,4) + "  Y " + round(cy,4);
}

function calcCircle(){
const source = gid("circleSource").value;
const sourceId = source === "radius" ? "circleRad" : source === "circumference" ? "circleCirc" : "circleDia";
let result;
try{
 result = MBCalc.circleFrom(source, num(sourceId));
}catch(error){
 showCalculationError("circleResult", error);
 return;
}
const useDia = result.diameter;
const useRad = result.radius;
const useCirc = result.circumference;
const area = result.area;
gid("circleDia").value = round(useDia,6);
gid("circleRad").value = round(useRad,6);
gid("circleCirc").value = round(useCirc,6);
gid("circleResult").innerHTML =
"Diameter: " + round(useDia,6) + "<br>" +
"Radius: " + round(useRad,6) + "<br>" +
"Circumference: " + round(useCirc,6) + "<br>" +
"Area: " + round(area,6);
}

function calcTaper(){
const large = num("largeDia");
const small = num("smallDia");
const len = num("taperLen");
const diamChange = large - small;
const perSide = len ? Math.atan((diamChange / 2) / len) * 180 / Math.PI : 0;
const included = perSide * 2;
const taperPerInch = len ? diamChange / len : 0;
const taperPerFoot = taperPerInch * 12;
gid("taperResult").innerHTML =
"Diameter change: " + round(diamChange,5) + "<br>" +
"Per side angle: " + round(perSide,4) + "°<br>" +
"Included angle: " + round(included,4) + "°<br>" +
"Taper per inch: " + round(taperPerInch,5) + "<br>" +
"Taper per foot: " + round(taperPerFoot,5);
}

function calcPointDistance(){
const x1 = num("x1");
const y1 = num("y1");
const x2 = num("x2");
const y2 = num("y2");
const dx = x2 - x1;
const dy = y2 - y1;
const dist = Math.sqrt(Math.pow(dx,2) + Math.pow(dy,2));
const angle = Math.atan2(dy, dx) * 180 / Math.PI;
gid("pointDistanceResult").innerHTML =
"Delta X: " + round(dx,5) + "<br>" +
"Delta Y: " + round(dy,5) + "<br>" +
"Distance: " + round(dist,5) + "<br>" +
"Angle from X axis: " + round(angle,4) + "°";
}


function solveRightTriangle(){
let result;
try{
 result = MBCalc.rightTriangle({
  solveFrom: gid("trigSolveFrom").value,
  sideA: num("trigSideA"),
  sideB: num("trigSideB"),
  hypotenuse: num("trigHyp"),
  angleA: num("trigAngleDeg")
 });
}catch(error){
 showCalculationError("trigResult", error);
 return;
}
const {sideA:a, sideB:b, hypotenuse:h, angleA, angleB} = result;
gid("trigSideA").value = round(a,6);
gid("trigSideB").value = round(b,6);
gid("trigHyp").value = round(h,6);
gid("trigAngleDeg").value = round(angleA,6);

gid("trigResult").innerHTML =
"Solved from: " + escapeHtml(gid("trigSolveFrom").options[gid("trigSolveFrom").selectedIndex].textContent) + "<br>" +
"Side A: " + round(a,6) + "<br>" +
"Side B: " + round(b,6) + "<br>" +
"Hypotenuse: " + round(h,6) + "<br>" +
"Angle A: " + round(angleA,4) + "°<br>" +
"Angle B: " + round(angleB,4) + "°";
}

// One-time carry-over of saved profiles/preferences from the pre-rename storage keys.
MBWorkflow.migrateLegacyKeys(window.localStorage, {
"grCalculator.machineProfiles.v1": MACHINE_STORAGE_KEY,
"grCalculator.activeMachine.v1": ACTIVE_MACHINE_STORAGE_KEY,
"grCalculator.preferences.v1": PREFERENCE_STORAGE_KEY
});
populateMaterials();
populateTapWorkMaterials();
populateDrillTable();
populateNptSizes();
loadThreadChart();
initializeMachineProfiles();
restoreShopPreferences();
toggleCalcType();
updateSpeedBasisUI("main");
updateSpeedBasisUI("turn");
updateSpeedBasisUI("tap");
applyPreset();
applyTapPreset();
calcPeck();
calcTapSearch();
calcNptHelper();
calcThreadMill();
calcSpotDrill();
calcChamfer();
calcPitchFromAngle();
toggleEffectiveToolType();
toggleScallopSource();
calcCircularInterpolation();
calcEffectiveDiameter();
calcScallop();
calcTruePosition();
calcBoreStockPlan();
calcLengthConversion();
calcFractionConversion();
calcPitchSpeedConversion();
calcBoltCircle();
calcCircle();
calcTaper();
calcPointDistance();
solveRightTriangle();
applyTurningPreset();
enablePreferenceStorage();
document.querySelectorAll(".result").forEach(result => {
 result.setAttribute("role", "status");
 result.setAttribute("aria-live", "polite");
});
enableResultTracking();
initializeOfflineSupport();
