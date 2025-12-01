// BookPesa MVP - clean single-file JS (local storage)
const STORAGE_KEY = "bookpesa_v2_all_users";

let store = {
  users: {}, // username -> {pin, ledger:[], inventory:[], loans:[]}
  currentUser: null
};

function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }
function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { store = JSON.parse(raw); } catch (e) { console.error(e); }
  }
}
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function formatKsh(x){ const n = Number(x)||0; return "Ksh " + n.toLocaleString(); }
function todayISO(){ return new Date().toISOString().slice(0,10); }

// showView: central navigation
function showView(view){
  // hide bottom nav on login
  const nav = document.querySelector(".bottom-nav");
  if(nav) nav.style.display = (view === "loginView") ? "none" : "flex";

  const views = ["loginView","dashboardView","ledgerView","inventoryView","loansView"];
  views.forEach(v=> { const el = document.getElementById(v); if(el) el.style.display = "none"; });

  const logoutBtn = document.getElementById("logoutBtn");
  if(logoutBtn) logoutBtn.style.display = (view === "loginView") ? "none" : "inline-block";
  const badge = document.getElementById("currentUserBadge");
  if(badge) badge.textContent = store.currentUser ? store.currentUser : "";

  if(view === "dashboardView") renderDashboard();
  if(view === "ledgerView") renderLedger();
  if(view === "inventoryView") renderInventory();
  if(view === "loansView") renderLoans();

  const target = document.getElementById(view);
  if(target) target.style.display = "block";
}

// initialization
function init(){
  load();
  attachEvents();
  populateUserList();

  // defaults
  const ld = document.getElementById("ledgerDate"); if(ld) ld.value = todayISO();
  const loanD = document.getElementById("loanDate"); if(loanD) loanD.value = todayISO();
  const ffrom = document.getElementById("filterFrom"); if(ffrom) ffrom.value = "";
  const fto = document.getElementById("filterTo"); if(fto) fto.value = "";

  if(store.currentUser) showView("dashboardView");
  else showView("loginView");
}

// events and handlers
function attachEvents(){
  // create account
  const createBtn = document.getElementById("createBtn");
  if(createBtn) createBtn.addEventListener("click", ()=> {
    const user = (document.getElementById("usernameInput").value || "").trim().toLowerCase();
    const pin = (document.getElementById("pinInput").value || "").trim();
    if(!user || !/^[a-z0-9_-]{2,20}$/.test(user)){ alert("Enter username (2-20 letters/numbers/_/-)"); return; }
    if(!/^\d{5}$/.test(pin)){ alert("PIN must be 5 digits"); return; }
    if(store.users[user]){ alert("User exists. Choose another username."); return; }
    store.users[user] = { pin, ledger:[], inventory:[], loans:[] };
    store.currentUser = user; save(); populateUserList(); showView("dashboardView");
  });

  // sign in
  const loginBtn = document.getElementById("loginBtn");
  if(loginBtn) loginBtn.addEventListener("click", ()=> {
    const user = (document.getElementById("usernameInput").value || "").trim().toLowerCase();
    const pin = (document.getElementById("pinInput").value || "").trim();
    if(!store.users[user]){ alert("No such user. Create account first."); return; }
    if(store.users[user].pin !== pin){ alert("Wrong PIN"); return; }
    store.currentUser = user; save(); populateUserList(); showView("dashboardView");
  });

  // logout
  const logoutBtn = document.getElementById("logoutBtn");
  if(logoutBtn) logoutBtn.addEventListener("click", ()=> {
    store.currentUser = null; save(); showView("loginView");
  });

  // clicking existing user in list (use)
  const userList = document.getElementById("userList");
  if(userList) userList.addEventListener("click", (e)=> {
    if(e.target && e.target.dataset && e.target.dataset.user){
      const u = e.target.dataset.user;
      const p = prompt("Enter PIN for " + u);
      if(p === null) return;
      if(store.users[u] && store.users[u].pin === p){ store.currentUser = u; save(); showView("dashboardView"); }
      else alert("Wrong PIN");
    }
  });

  // nav buttons (data-nav)
  document.querySelectorAll("[data-nav]").forEach(b=>{
    b.addEventListener("click", (e)=> {
      const nav = e.currentTarget.dataset.nav;
      if(nav) showView(nav);
    });
  });

  // ledger form
  const ledgerForm = document.getElementById("ledgerForm");
  if(ledgerForm) ledgerForm.addEventListener("submit", (e)=> {
    e.preventDefault();
    if(!ensureUser()) return;
    const desc = (document.getElementById("ledgerDesc").value || "").trim();
    const amt = Number(document.getElementById("ledgerAmount").value) || 0;
    const date = document.getElementById("ledgerDate").value || todayISO();
    const tag = document.getElementById("ledgerTag").value || "other";
    if(!desc){ alert("Enter description"); return; }
    const entry = { id: uid(), desc, amt, date, tag, created: new Date().toISOString() };
    store.users[store.currentUser].ledger.unshift(entry);
    save(); ledgerForm.reset(); const ld = document.getElementById("ledgerDate"); if(ld) ld.value = todayISO();
    renderLedger(); renderDashboard();
  });
  const clearLedger = document.querySelector("[data-action='clear-ledger']");
  if(clearLedger) clearLedger.addEventListener("click", (e)=>{ e.preventDefault(); if(!ensureUser()) return; if(confirm("Clear all ledger entries?")){ store.users[store.currentUser].ledger=[]; save(); renderLedger(); renderDashboard(); }});
  const exportLedger = document.querySelector("[data-action='export-ledger']");
  if(exportLedger) exportLedger.addEventListener("click",(e)=>{ e.preventDefault(); exportCSV('ledger'); });

  // inventory
  const invForm = document.getElementById("inventoryForm");
  if(invForm) invForm.addEventListener("submit",(e)=>{
    e.preventDefault(); if(!ensureUser()) return;
    const name = (document.getElementById("itemName").value || "").trim();
    const qty = Number(document.getElementById("itemQty").value) || 0;
    const price = Number(document.getElementById("itemPrice").value) || 0;
    if(!name){ alert("Enter item name"); return; }
    const inv = store.users[store.currentUser].inventory;
    const existing = inv.find(it=>it.name.toLowerCase()===name.toLowerCase());
    if(existing){ existing.qty = existing.qty + qty; existing.price = price; } else { inv.unshift({ id: uid(), name, qty, price, created: new Date().toISOString() }); }
    save(); invForm.reset(); renderInventory(); renderDashboard();
  });
  const clearInv = document.querySelector("[data-action='clear-inv']");
  if(clearInv) clearInv.addEventListener("click",(e)=>{ e.preventDefault(); if(!ensureUser()) return; if(confirm("Clear all inventory?")){ store.users[store.currentUser].inventory=[]; save(); renderInventory(); renderDashboard(); }});
  const exportInv = document.querySelector("[data-action='export-inv']");
  if(exportInv) exportInv.addEventListener("click",(e)=>{ e.preventDefault(); exportCSV('inventory'); });

  // loans
  const loanForm = document.getElementById("loanForm");
  if(loanForm) loanForm.addEventListener("submit",(e)=>{
    e.preventDefault(); if(!ensureUser()) return;
    const name = (document.getElementById("loanName").value || "").trim();
    const amt = Number(document.getElementById("loanAmount").value) || 0;
    const date = document.getElementById("loanDate").value || todayISO();
    if(!name){ alert("Enter name"); return; }
    store.users[store.currentUser].loans.unshift({ id: uid(), name, amt, date, created: new Date().toISOString() });
    save(); loanForm.reset(); const ld = document.getElementById("loanDate"); if(ld) ld.value = todayISO();
    renderLoans(); renderDashboard();
  });
  const clearLoans = document.querySelector("[data-action='clear-loans']");
  if(clearLoans) clearLoans.addEventListener("click",(e)=>{ e.preventDefault(); if(!ensureUser()) return; if(confirm("Clear all loans?")){ store.users[store.currentUser].loans=[]; save(); renderLoans(); renderDashboard(); }});
  const exportLoans = document.querySelector("[data-action='export-loans']");
  if(exportLoans) exportLoans.addEventListener("click",(e)=>{ e.preventDefault(); exportCSV('loans'); });

  // delegate delete buttons
  document.body.addEventListener("click",(e)=>{
    if(e.target && e.target.dataset && e.target.dataset.deleteId){
      const id = e.target.dataset.deleteId;
      ["ledger","inventory","loans"].forEach(k=>{
        const arr = store.users[store.currentUser][k];
        const idx = arr.findIndex(x=>x.id===id);
        if(idx>-1){ arr.splice(idx,1); save(); renderLedger(); renderInventory(); renderLoans(); renderDashboard(); }
      });
    }
  });

  // filter apply/clear
  const applyFilter = document.getElementById("applyFilter");
  if(applyFilter) applyFilter.addEventListener("click", ()=> renderDashboard());
  const clearFilter = document.getElementById("clearFilter");
  if(clearFilter) clearFilter.addEventListener("click", ()=>{ const ffrom = document.getElementById("filterFrom"); const fto = document.getElementById("filterTo"); if(ffrom) ffrom.value=""; if(fto) fto.value=""; renderDashboard(); });
}

// helpers
function ensureUser(){ if(!store.currentUser){ alert("No user signed in."); return false; } if(!store.users[store.currentUser]){ alert("User not found."); return false; } return true; }

function populateUserList(){
  const out = document.getElementById("userList"); if(!out) return;
  out.innerHTML = "";
  const names = Object.keys(store.users || {});
  if(names.length===0){ out.innerHTML = "<p class='muted'>No users yet.</p>"; return; }
  names.forEach(n=>{
    const row = document.createElement("div"); row.className = "row";
    const left = document.createElement("div"); left.textContent = n;
    const btn = document.createElement("button"); btn.className="btn ghost small"; btn.textContent="Use"; btn.dataset.user = n;
    row.append(left,btn); out.append(row);
  });
}

// renderers
function renderLedger(){
  if(!ensureUser()){ document.getElementById("ledgerList").innerHTML = "<p class='muted'>Sign in to see ledger.</p>"; return; }
  const entries = store.users[store.currentUser].ledger || [];
  const out = document.getElementById("ledgerList"); out.innerHTML = "";
  if(entries.length===0){ out.innerHTML = "<p class='muted'>No entries yet.</p>"; return; }
  entries.forEach(it=>{
    const row = document.createElement("div"); row.className="row";
    const left = document.createElement("div"); left.innerHTML = `<strong>${it.desc}</strong><div class='muted'>${it.date} • ${it.tag}</div>`;
    const right = document.createElement("div"); right.innerHTML = `<div>${formatKsh(it.amt)}</div><button class='link small' data-delete-id='${it.id}'>Delete</button>`;
    row.append(left,right); out.append(row);
  });
}

function renderInventory(){
  if(!ensureUser()){ document.getElementById("inventoryList").innerHTML = "<p class='muted'>Sign in to see inventory.</p>"; return; }
  const inv = store.users[store.currentUser].inventory || [];
  const out = document.getElementById("inventoryList"); out.innerHTML = "";
  if(inv.length===0){ out.innerHTML = "<p class='muted'>No stock yet.</p>"; return; }
  inv.forEach(it=>{
    const row = document.createElement("div"); row.className="row";
    const left = document.createElement("div"); left.innerHTML = `<strong>${it.name}</strong><div class='muted'>Qty: ${it.qty} • Unit: ${formatKsh(it.price)}</div>`;
    const right = document.createElement("div"); right.innerHTML = `<div>${formatKsh(it.qty * it.price)}</div><button class='link small' data-delete-id='${it.id}'>Delete</button>`;
    row.append(left,right); out.append(row);
  });
}

function renderLoans(){
  if(!ensureUser()){ document.getElementById("loanList").innerHTML = "<p class='muted'>Sign in to see loans.</p>"; return; }
  const loans = store.users[store.currentUser].loans || [];
  const out = document.getElementById("loanList"); out.innerHTML = "";
  if(loans.length===0){ out.innerHTML = "<p class='muted'>No loans yet.</p>"; return; }
  loans.forEach(it=>{
    const row = document.createElement("div"); row.className="row";
    const left = document.createElement("div"); left.innerHTML = `<strong>${it.name}</strong><div class='muted'>${it.date}</div>`;
    const right = document.createElement("div"); right.innerHTML = `<div>${formatKsh(it.amt)}</div><button class='link small' data-delete-id='${it.id}'>Delete</button>`;
    row.append(left,right); out.append(row);
  });
}

function parseDate(s){ return new Date(s + "T00:00:00"); }

function renderDashboard(){
  if(!ensureUser()){ document.getElementById("balance").textContent = "Ksh 0"; document.getElementById("pnl").textContent="Ksh 0"; document.getElementById("stockVal").textContent="Ksh 0"; return; }
  const user = store.users[store.currentUser];
  const ledgerSum = (user.ledger || []).reduce((s,i)=>s + Number(i.amt),0);
  const loansSum = (user.loans || []).reduce((s,i)=>s + Number(i.amt),0);
  const stockVal = (user.inventory || []).reduce((s,i)=>s + (Number(i.qty) * Number(i.price)),0);
  const balance = ledgerSum + loansSum;
  document.getElementById("balance").textContent = formatKsh(balance);
  document.getElementById("stockVal").textContent = formatKsh(stockVal);

  let from = document.getElementById("filterFrom").value;
  let to = document.getElementById("filterTo").value;
  if(!from || !to){
    const d = new Date(); const toD = d.toISOString().slice(0,10);
    const fromD = new Date(); fromD.setDate(fromD.getDate()-30);
    from = from || fromD.toISOString().slice(0,10);
    to = to || toD;
  }
  const fromDate = parseDate(from); const toDate = parseDate(to);
  const pnl = (user.ledger || []).filter(i=>{
    const d = parseDate(i.date);
    return d >= fromDate && d <= toDate;
  }).reduce((s,i)=>s + Number(i.amt),0);
  document.getElementById("pnl").textContent = formatKsh(pnl);
}

// CSV export
function exportCSV(kind){
  if(!ensureUser()) return;
  let rows = [], filename = "export.csv";
  const user = store.users[store.currentUser];
  if(kind==='ledger'){
    rows.push(["id","date","desc","tag","amount"]);
    (user.ledger||[]).forEach(r=> rows.push([r.id,r.date,r.desc,r.tag,r.amt]));
    filename = `${store.currentUser}_ledger.csv`;
  } else if(kind==='inventory'){
    rows.push(["id","name","qty","price"]);
    (user.inventory||[]).forEach(r=> rows.push([r.id,r.name,r.qty,r.price]));
    filename = `${store.currentUser}_inventory.csv`;
  } else if(kind==='loans'){
    rows.push(["id","date","name","amount"]);
    (user.loans||[]).forEach(r=> rows.push([r.id,r.date,r.name,r.amt]));
    filename = `${store.currentUser}_loans.csv`;
  }
  const csv = rows.map(r=> r.map(c=> `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], {type: "text/csv"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

// start
// init() is called from index.html DOMContentLoaded listener
