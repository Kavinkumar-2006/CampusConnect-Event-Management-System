/* ============================================================
   CampusConnect — script.js  (COMPLETE WITH ALL FEATURES)
   Profile Avatar · Notifications · Countdown · Analytics · Ticket
   ============================================================ */

"use strict";

// ── API Service ──────────────────────────────────────────────
const API = {
  BASE: "/api",
  async request(method, endpoint, body = null) {
    const opts = { method, headers: { "Content-Type": "application/json" } };
    if (body) opts.body = JSON.stringify(body);
    try {
      const res  = await fetch(this.BASE + endpoint, opts);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Request failed");
      return data;
    } catch (err) { console.error(`[API] ${method} ${endpoint}:`, err.message); throw err; }
  },
  get:    (ep)       => API.request("GET",    ep),
  post:   (ep, body) => API.request("POST",   ep, body),
  put:    (ep, body) => API.request("PUT",    ep, body),
  delete: (ep)       => API.request("DELETE", ep),

  getEvents:        (qs="") => API.get(`/events${qs}`),
  getEvent:         (id)    => API.get(`/events/${id}`),
  createEvent:      (d)     => API.post("/events", d),
  updateEvent:      (id,d)  => API.put(`/events/${id}`, d),
  deleteEvent:      (id)    => API.delete(`/events/${id}`),
  registerForEvent: (d)     => API.post("/register", d),
  getRegistrations: (evId)  => API.get(`/registrations/${evId}`),
  getStats:         ()      => API.get("/admin/stats"),
  login:            (d)     => API.post("/auth/login", d),
  register:         (d)     => API.post("/auth/register", d),
  getProfile:       (email) => API.get(`/profile/${encodeURIComponent(email)}`),
  getNotifications: (uid)   => API.get(`/notifications/${uid}`),
  markNotifRead:    (id)    => API.put(`/notifications/${id}/read`, {}),
  markAllRead:      (uid)   => API.put(`/notifications/read-all/${uid}`, {}),
  getTicket:        (regId) => API.get(`/ticket/${regId}`),
};

// ── Toast Notifications ──────────────────────────────────────
const Toast = (() => {
  let container;
  function init() {
    container = document.querySelector(".toast-container");
    if (!container) {
      container = document.createElement("div");
      container.className = "toast-container";
      document.body.appendChild(container);
    }
  }
  const ICONS = { success:"✅", error:"❌", warning:"⚠️", info:"ℹ️" };
  function show(type, title, message, duration=4000) {
    if (!container) init();
    const t = document.createElement("div");
    t.className = `toast ${type}`;
    t.innerHTML = `<div class="toast-icon">${ICONS[type]||"ℹ️"}</div>
      <div><div class="toast-title">${title}</div>${message?`<div class="toast-msg">${message}</div>`:""}</div>`;
    container.appendChild(t);
    const rm = ()=>{ t.classList.add("fade-out"); t.addEventListener("animationend",()=>t.remove()); };
    setTimeout(rm, duration);
    t.addEventListener("click", rm);
  }
  return {
    success: (t,m,d)=>show("success",t,m,d),
    error:   (t,m,d)=>show("error",t,m,d),
    warning: (t,m,d)=>show("warning",t,m,d),
    info:    (t,m,d)=>show("info",t,m,d),
  };
})();

// ════════════════════════════════════════════════════════════
//  NAVBAR — Profile Avatar + Notification Bell
// ════════════════════════════════════════════════════════════
function initNavbar() {
  const navbar  = document.querySelector(".navbar, nav.nav, nav#navbar");
  if (!navbar) return;

  // Scroll shadow
  window.addEventListener("scroll", ()=>
    navbar.classList.toggle("scrolled", window.scrollY > 30)
  );

  // Active link highlight
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  document.querySelectorAll(".nav-links a").forEach(a => {
    const href = a.getAttribute("href").replace(/\/$/, "") || "/";
    if (href === path) a.classList.add("active");
  });

  // Hamburger
  const burger  = document.querySelector(".hamburger, .burger");
  const navLinks = document.querySelector(".nav-links");
  const navCta   = document.querySelector(".nav-cta, #navCta");
  if (burger) {
    burger.addEventListener("click", ()=>{
      const open = burger.classList.toggle("open");
      navLinks?.classList.toggle("open", open);
      navCta?.classList.toggle("open", open);
    });
    document.addEventListener("click", e=>{
      if (!navbar.contains(e.target)) {
        burger.classList.remove("open");
        navLinks?.classList.remove("open");
        navCta?.classList.remove("open");
      }
    });
  }

  // ── Inject Avatar & Bell if logged in ───────────────────
  let user = null;
  try { user = JSON.parse(sessionStorage.getItem("cc_user")); } catch(e){}
  if (!user) return;

  // Hide Sign In / Join Now buttons
  document.getElementById("nav-signin-btn")?.remove();
  document.getElementById("nav-join-btn")?.remove();

  const initials = (user.name||"U").split(" ").map(w=>w[0]||"").join("").substring(0,2).toUpperCase();
  const cta = navCta || document.querySelector(".nav-cta");
  if (!cta) return;

  // Build notification bell + profile dropdown HTML
  cta.insertAdjacentHTML("beforeend", `
    <!-- Notification Bell -->
    <div class="notif-wrap" id="notif-wrap">
      <button class="notif-btn" id="notif-btn" title="Notifications">🔔</button>
      <span class="notif-badge" id="notif-badge"></span>
      <div class="notif-dropdown" id="notif-dropdown">
        <div class="nd-head">
          <h4>Notifications</h4>
          <button class="nd-mark-all" onclick="markAllNotifRead()">Mark all read</button>
        </div>
        <div class="nd-list" id="notif-list">
          <div class="nd-empty">Loading…</div>
        </div>
      </div>
    </div>

    <!-- Profile Avatar -->
    <div class="nav-profile-wrap" id="nav-profile-wrap">
      <span class="nav-avatar-name">${(user.name||"").split(" ")[0]}</span>
      <div class="nav-avatar" id="nav-avatar" title="My Account">${initials}</div>
      <div class="profile-dropdown" id="profile-dropdown">
        <div class="pd-header">
          <div class="pd-header-name">${escHtml(user.name||"")}</div>
          <div class="pd-header-email">${escHtml(user.email||"")}</div>
        </div>
        <button class="pd-item" onclick="location.href='/profile'">👤 My Profile</button>
        <button class="pd-item" onclick="location.href='/profile#registrations'">📋 My Registrations</button>
        <button class="pd-item" onclick="document.getElementById('notif-dropdown').classList.toggle('open')">🔔 Notifications</button>
        <div class="pd-divider"></div>
        <button class="pd-item logout" onclick="doLogout()">🚪 Logout</button>
      </div>
    </div>
  `);

  // Toggle profile dropdown
  document.getElementById("nav-avatar").addEventListener("click", e=>{
    e.stopPropagation();
    document.getElementById("profile-dropdown").classList.toggle("open");
    document.getElementById("notif-dropdown")?.classList.remove("open");
  });

  // Toggle notification dropdown
  document.getElementById("notif-btn").addEventListener("click", e=>{
    e.stopPropagation();
    const dd = document.getElementById("notif-dropdown");
    dd.classList.toggle("open");
    document.getElementById("profile-dropdown")?.classList.remove("open");
    if (dd.classList.contains("open")) loadNotifications(user.id);
  });

  // Close both dropdowns on outside click
  document.addEventListener("click", e=>{
    if (!document.getElementById("nav-profile-wrap")?.contains(e.target))
      document.getElementById("profile-dropdown")?.classList.remove("open");
    if (!document.getElementById("notif-wrap")?.contains(e.target))
      document.getElementById("notif-dropdown")?.classList.remove("open");
  });

  // Load notification count immediately
  loadNotificationCount(user.id);
}

// ── Notifications ────────────────────────────────────────────
async function loadNotificationCount(userId) {
  if (!userId) return;
  try {
    const res = await API.getNotifications(userId);
    const badge = document.getElementById("notif-badge");
    if (!badge) return;
    if (res.unread > 0) {
      badge.textContent = res.unread > 9 ? "9+" : res.unread;
      badge.classList.add("visible");
    } else {
      badge.classList.remove("visible");
    }
  } catch(e) {}
}

async function loadNotifications(userId) {
  const list = document.getElementById("notif-list");
  if (!list) return;
  list.innerHTML = `<div class="nd-empty">Loading…</div>`;
  try {
    const res   = await API.getNotifications(userId);
    const items = res.data || [];
    if (!items.length) {
      list.innerHTML = `<div class="nd-empty">🎉 You're all caught up!</div>`;
      return;
    }
    list.innerHTML = items.map(n => `
      <div class="nd-item ${n.read?"":"unread"}" data-id="${n.id}" onclick="markNotifRead('${n.id}', this)">
        <div class="nd-dot"></div>
        <div class="nd-text">
          <div class="nd-title">${escHtml(n.title)}</div>
          <div class="nd-msg">${escHtml(n.message||"")}</div>
          <div class="nd-time">${timeAgo(n.createdAt)}</div>
        </div>
      </div>`).join("");
  } catch(e) {
    list.innerHTML = `<div class="nd-empty">Failed to load notifications</div>`;
  }
}

async function markNotifRead(id, el) {
  try {
    await API.markNotifRead(id);
    el?.classList.remove("unread");
    el?.querySelector(".nd-dot")?.style && (el.querySelector(".nd-dot").style.opacity="0");
    const user = JSON.parse(sessionStorage.getItem("cc_user")||"{}");
    loadNotificationCount(user.id);
  } catch(e) {}
}
window.markNotifRead = markNotifRead;

async function markAllNotifRead() {
  const user = JSON.parse(sessionStorage.getItem("cc_user")||"{}");
  if (!user.id) return;
  try {
    await API.markAllRead(user.id);
    document.querySelectorAll(".nd-item").forEach(el=>{
      el.classList.remove("unread");
      const dot = el.querySelector(".nd-dot");
      if (dot) dot.style.opacity = "0";
    });
    const badge = document.getElementById("notif-badge");
    if (badge) badge.classList.remove("visible");
  } catch(e) {}
}
window.markAllNotifRead = markAllNotifRead;

function doLogout() {
  sessionStorage.removeItem("cc_user");
  window.location.href = "/login";
}
window.doLogout = doLogout;

// ════════════════════════════════════════════════════════════
//  EVENTS PAGE
// ════════════════════════════════════════════════════════════
function initEventsPage() {
  const grid   = document.getElementById("events-grid");
  const search = document.getElementById("search-input");
  const chips  = document.querySelectorAll(".chip[data-category]");
  if (!grid) return;

  let allEvents = [];
  let activeCategory = "all";

  async function loadEvents() {
    showSkeletons(grid, 6);
    try {
      const res = await API.getEvents();
      allEvents  = res.data || [];
      renderEvents(allEvents);
    } catch {
      grid.innerHTML = emptyState("🗓️", "Couldn't load events", "Please refresh the page.");
    }
  }

  function renderEvents(events) {
    if (!events.length) {
      grid.innerHTML = emptyState("🗓️", "No events found", "Try a different filter or search term.");
      return;
    }
    grid.innerHTML = events.map(eventCard).join("");
    grid.querySelectorAll(".event-card").forEach((el, i) => {
      el.style.animationDelay = `${i * 0.06}s`;
      el.classList.add("animate-fade-up");
    });
    grid.querySelectorAll(".btn-register").forEach(btn => {
      btn.addEventListener("click", () => {
        window.location.href = `/event-register?id=${btn.dataset.eventId}`;
      });
    });
    // Start countdown timers on rendered cards
    initCountdowns();
  }

  function filterAndSearch() {
    let filtered = allEvents;
    if (activeCategory !== "all")
      filtered = filtered.filter(e=>(e.category||"general").toLowerCase()===activeCategory);
    const q = (search?.value||"").toLowerCase().trim();
    if (q) filtered = filtered.filter(e=>
      e.title.toLowerCase().includes(q)||
      (e.description||"").toLowerCase().includes(q)||
      (e.venue||"").toLowerCase().includes(q)
    );
    renderEvents(filtered);
  }

  chips.forEach(chip=>{
    chip.addEventListener("click",()=>{
      chips.forEach(c=>c.classList.remove("active"));
      chip.classList.add("active");
      activeCategory = chip.dataset.category;
      filterAndSearch();
    });
  });

  search?.addEventListener("input", debounce(filterAndSearch, 280));
  loadEvents();
}

// ── Event Card (with countdown) ──────────────────────────────
function eventCard(e) {
  const date   = new Date(e.date);
  const day    = date.toLocaleDateString("en-IN",{day:"numeric"});
  const month  = date.toLocaleDateString("en-IN",{month:"short"});
  const pct    = Math.min(100, Math.round((e.registered/e.capacity)*100));
  const isFull = e.registered >= e.capacity;
  const catEmoji = {technical:"💻",cultural:"🎭",sports:"⚽",workshop:"🛠️",seminar:"🎓"};
  const emoji  = catEmoji[(e.category||"").toLowerCase()] || "📅";
  const desc   = e.description ? `<p style="font-size:.85rem;color:var(--clr-text-muted,var(--text-muted));margin-bottom:var(--sp-md);line-height:1.5;">${escHtml(e.description.slice(0,80))}${e.description.length>80?"…":""}</p>` : "";

  return `
  <article class="card event-card">
    <div class="event-card-thumb">
      ${emoji}
      <span class="event-card-category">${(e.category||"General").toUpperCase()}</span>
      <div class="event-card-date-badge"><span class="day">${day}</span>${month}</div>
    </div>
    <div class="card-body">
      <h3 class="event-card-title">${escHtml(e.title)}</h3>
      <div class="event-meta">
        <div class="event-meta-item"><i>📍</i> ${escHtml(e.venue)}</div>
        <div class="event-meta-item"><i>🕐</i> ${escHtml(e.time||"TBD")}</div>
      </div>
      ${desc}
      <!-- ⏱ Countdown Timer -->
      <div class="event-countdown" data-countdown="${e.date}" id="cd-${e.id}">
        <span class="cd-icon">⏱</span>
        <span class="cd-text">Calculating…</span>
      </div>
      <div class="capacity-bar-wrap">
        <div class="capacity-label"><span>Seats</span><span>${e.registered} / ${e.capacity}</span></div>
        <div class="capacity-bar">
          <div class="capacity-fill ${pct>=90?"danger":""}" style="width:${pct}%"></div>
        </div>
      </div>
    </div>
    <div class="card-footer">
      <button class="btn btn-primary btn-sm btn-full btn-register"
        data-event-id="${e.id}" ${isFull?"disabled":""}>
        ${isFull ? "🔒 Event Full" : "Register Now →"}
      </button>
    </div>
  </article>`;
}

// ════════════════════════════════════════════════════════════
//  COUNTDOWN TIMERS
// ════════════════════════════════════════════════════════════
const _countdownTimers = {};

function initCountdowns() {
  document.querySelectorAll("[data-countdown]").forEach(el => {
    const key = el.id || el.dataset.countdown;
    if (_countdownTimers[key]) clearInterval(_countdownTimers[key]);

    const target = new Date(el.dataset.countdown);
    const textEl = el.querySelector(".cd-text") || el;

    function tick() {
      const diff = target - Date.now();
      if (diff <= 0) {
        textEl.textContent = "Event started";
        el.classList.remove("urgent");
        el.classList.add("started");
        clearInterval(_countdownTimers[key]);
        return;
      }
      const days  = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins  = Math.floor((diff % 3600000) / 60000);
      const secs  = Math.floor((diff % 60000) / 1000);

      if (days > 0)
        textEl.textContent = `${days}d ${hours}h ${mins}m`;
      else if (hours > 0)
        textEl.textContent = `${hours}h ${mins}m ${secs}s`;
      else {
        textEl.textContent = `${mins}m ${secs}s`;
        el.classList.add("urgent");
      }
    }
    tick();
    _countdownTimers[key] = setInterval(tick, 1000);
  });
}

// ════════════════════════════════════════════════════════════
//  REGISTRATION FORM
// ════════════════════════════════════════════════════════════
function initRegistrationForm() {
  const form = document.getElementById("reg-form");
  if (!form) return;
  const params  = new URLSearchParams(window.location.search);
  const eventId = params.get("id");

  if (eventId) {
    document.getElementById("event-id-hidden").value = eventId;
    API.getEvent(eventId).then(res => {
      const e = res.data;
      const infoEl = document.getElementById("event-info");
      if (infoEl) infoEl.innerHTML = `
        <div class="badge badge-primary" style="margin-bottom:var(--sp-sm)">${(e.category||"General").toUpperCase()}</div>
        <h2>${escHtml(e.title)}</h2>
        <div class="event-meta" style="margin-top:var(--sp-md)">
          <div class="event-meta-item"><i>📅</i> ${formatDate(e.date)}</div>
          <div class="event-meta-item"><i>🕐</i> ${escHtml(e.time||"TBD")}</div>
          <div class="event-meta-item"><i>📍</i> ${escHtml(e.venue)}</div>
          <div class="event-meta-item"><i>👥</i> ${e.registered}/${e.capacity} registered</div>
        </div>`;
    }).catch(()=>{});

    // Pre-fill from session
    let user = null;
    try { user = JSON.parse(sessionStorage.getItem("cc_user")); } catch(e){}
    if (user) {
      const f = (id,v) => { const el=document.getElementById(id); if(el&&v) el.value=v; };
      f("name", user.name); f("email", user.email);
      f("roll-number", user.rollNumber); f("department", user.department);
    }
  }

  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (!validateForm(form)) return;
    const btn = form.querySelector('[type="submit"]');
    setLoading(btn, true, "Registering…");
    const payload = {
      eventId:    form.querySelector("#event-id-hidden").value,
      name:       form.querySelector("#name").value.trim(),
      email:      form.querySelector("#email").value.trim(),
      rollNumber: form.querySelector("#roll-number").value.trim(),
      department: form.querySelector("#department").value.trim(),
      year:       form.querySelector("#year")?.value || "",
    };
    try {
      const res = await API.registerForEvent(payload);
      Toast.success("Registered! 🎉", `You're in for ${res.data.event}`);
      form.reset();
      document.getElementById("reg-success")?.classList.remove("hidden");
      form.classList.add("hidden");
      // Show ticket automatically
      if (res.data.ticketId) {
        setTimeout(()=> showTicket(res.data.ticketId), 600);
      }
    } catch(err) {
      Toast.error("Registration Failed", err.message);
    } finally {
      setLoading(btn, false, "Register Now");
    }
  });
}

// ════════════════════════════════════════════════════════════
//  AUTH FORMS
// ════════════════════════════════════════════════════════════
function initAuthForms() {
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async e => {
      e.preventDefault();
      if (!validateForm(loginForm)) return;
      const btn = loginForm.querySelector('[type="submit"]');
      setLoading(btn, true, "Signing in…");
      try {
        const res = await API.login({
          email:    loginForm.querySelector("#email").value.trim(),
          password: loginForm.querySelector("#password").value,
        });
        sessionStorage.setItem("cc_user", JSON.stringify(res.data));
        Toast.success("Welcome back! 👋", res.data.name);
        setTimeout(()=> window.location.href = res.data.role==="admin"?"/admin":"/events", 800);
      } catch(err) {
        Toast.error("Login Failed", err.message);
      } finally {
        setLoading(btn, false, "Sign In");
      }
    });
  }

  const regForm = document.getElementById("register-form");
  if (regForm) {
    regForm.addEventListener("submit", async e => {
      e.preventDefault();
      if (!validateForm(regForm)) return;
      const pass    = regForm.querySelector("#password").value;
      const confirm = regForm.querySelector("#confirm-password").value;
      if (pass !== confirm) { showFieldError(regForm.querySelector("#confirm-password"),"Passwords do not match"); return; }
      const btn = regForm.querySelector('[type="submit"]');
      setLoading(btn, true, "Creating account…");
      try {
        await API.register({
          name:       regForm.querySelector("#name").value.trim(),
          email:      regForm.querySelector("#email").value.trim(),
          password:   pass,
          rollNumber: regForm.querySelector("#roll-number").value.trim(),
          department: regForm.querySelector("#department")?.value.trim()||"",
        });
        Toast.success("Account Created! 🎉", "Please sign in.");
        setTimeout(()=> window.location.href="/login", 1200);
      } catch(err) {
        Toast.error("Registration Failed", err.message);
      } finally {
        setLoading(btn, false, "Create Account");
      }
    });
  }
}

// ════════════════════════════════════════════════════════════
//  ADMIN DASHBOARD + ANALYTICS
// ════════════════════════════════════════════════════════════
function initAdmin() {
  if (!document.querySelector(".admin-layout")) return;
  loadStats();
  loadAdminEvents();
  initAdminAnalytics();

  const form = document.getElementById("create-event-form");
  if (form) {
    form.addEventListener("submit", async e => {
      e.preventDefault();
      if (!validateForm(form)) return;
      const btn = form.querySelector('[type="submit"]');
      setLoading(btn, true, "Creating…");
      const payload = {
        title:       form.querySelector("#title").value.trim(),
        date:        form.querySelector("#date").value,
        time:        form.querySelector("#time").value,
        venue:       form.querySelector("#venue").value.trim(),
        description: form.querySelector("#description").value.trim(),
        category:    form.querySelector("#category").value,
        capacity:    form.querySelector("#capacity").value,
      };
      try {
        await API.createEvent(payload);
        Toast.success("Event Created! ✅", payload.title);
        form.reset(); closeModal("event-modal");
        loadAdminEvents(); loadStats(); initAdminAnalytics();
      } catch(err) { Toast.error("Failed", err.message); }
      finally { setLoading(btn, false, "Create Event"); }
    });
  }
}

async function loadStats() {
  try {
    const res = await API.getStats();
    const s   = res.data;
    setText("stat-total-events",        s.totalEvents);
    setText("stat-upcoming-events",     s.upcomingEvents);
    setText("stat-total-registrations", s.totalRegistrations);
    setText("stat-fill-rate",           s.fillRate+"%");
    // Popular event
    if (s.popularEvent) {
      const pe = document.getElementById("popular-event-info");
      if (pe) {
        pe.innerHTML = `
          <div class="popular-event-card">
            <div class="pe-label">🏆 Most Popular Event</div>
            <div class="pe-name">${escHtml(s.popularEvent.name)}</div>
            <div class="pe-count">${s.popularEvent.registered} registrations</div>
          </div>`;
      }
    }
  } catch(e) {}
}

async function initAdminAnalytics() {
  // Inject analytics section if not present
  const adminMain = document.querySelector(".admin-main, .admin-content, main");
  if (!adminMain) return;
  if (document.getElementById("analytics-section")) return; // already injected

  const section = document.createElement("div");
  section.id = "analytics-section";
  section.innerHTML = `
    <div class="card" style="margin-bottom:1.5rem">
      <div class="card-header" style="padding:1.25rem 1.5rem;border-bottom:1px solid var(--border)">
        <h3 style="font-size:1rem;font-weight:800;color:var(--gold)">📊 Analytics Dashboard</h3>
      </div>
      <div class="card-body" style="padding:1.5rem">
        <div id="popular-event-info"></div>
        <div class="analytics-grid">
          <div class="chart-card">
            <h4>Registrations per Event</h4>
            <div class="chart-wrap"><canvas id="chart-per-event"></canvas></div>
          </div>
          <div class="chart-card">
            <h4>Registrations Last 7 Days</h4>
            <div class="chart-wrap"><canvas id="chart-last7"></canvas></div>
          </div>
          <div class="chart-card">
            <h4>Events by Category</h4>
            <div class="chart-wrap"><canvas id="chart-categories"></canvas></div>
          </div>
          <div class="chart-card">
            <h4>Capacity Fill Rate</h4>
            <div class="chart-wrap"><canvas id="chart-fill"></canvas></div>
          </div>
        </div>
      </div>
    </div>`;

  adminMain.insertBefore(section, adminMain.firstChild);

  // Load Chart.js dynamically then render
  if (!window.Chart) {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js";
    script.onload = renderAdminCharts;
    document.head.appendChild(script);
  } else {
    renderAdminCharts();
  }
}

async function renderAdminCharts() {
  try {
    const res = await API.getStats();
    const s   = res.data;

    const GOLD = "#d4a017", GOLD_A = "rgba(212,160,23,";
    const defaults = {
      color: "#f0ece0",
      plugins: { legend:{ labels:{ color:"#f0ece0", font:{size:11} } } },
      scales: {
        x: { ticks:{ color:"rgba(240,236,224,.5)", font:{size:10} }, grid:{ color:"rgba(255,255,255,.05)" } },
        y: { ticks:{ color:"rgba(240,236,224,.5)", font:{size:10} }, grid:{ color:"rgba(255,255,255,.05)" } }
      }
    };

    // 1. Registrations per event
    const c1 = document.getElementById("chart-per-event");
    if (c1 && s.perEvent?.length) {
      new Chart(c1, {
        type:"bar",
        data:{
          labels: s.perEvent.slice(0,6).map(e=> e.name.length>18 ? e.name.slice(0,16)+"…" : e.name),
          datasets:[{
            label:"Registered",
            data: s.perEvent.slice(0,6).map(e=>e.registered),
            backgroundColor: GOLD_A+"0.7)",
            borderColor: GOLD, borderWidth:1, borderRadius:4
          }]
        },
        options:{ responsive:true, maintainAspectRatio:false, plugins:defaults.plugins, scales:defaults.scales }
      });
    }

    // 2. Last 7 days
    const c2 = document.getElementById("chart-last7");
    if (c2 && s.last7Days?.length) {
      new Chart(c2, {
        type:"line",
        data:{
          labels: s.last7Days.map(d=>{ const dt=new Date(d.date); return dt.toLocaleDateString("en-IN",{day:"numeric",month:"short"}); }),
          datasets:[{
            label:"Registrations",
            data: s.last7Days.map(d=>d.count),
            borderColor: GOLD, backgroundColor: GOLD_A+"0.12)",
            borderWidth:2, fill:true, tension:.4,
            pointBackgroundColor: GOLD, pointRadius:4
          }]
        },
        options:{ responsive:true, maintainAspectRatio:false, plugins:defaults.plugins, scales:defaults.scales }
      });
    }

    // 3. Category doughnut
    const c3 = document.getElementById("chart-categories");
    if (c3 && s.categoryBreakdown?.length) {
      const COLORS = ["#d4a017","#f5c842","#a07810","rgba(212,160,23,.5)","rgba(212,160,23,.3)"];
      new Chart(c3, {
        type:"doughnut",
        data:{
          labels: s.categoryBreakdown.map(c=>c.cat),
          datasets:[{ data: s.categoryBreakdown.map(c=>c.count),
            backgroundColor: COLORS, borderColor:"#0f0f0f", borderWidth:2 }]
        },
        options:{ responsive:true, maintainAspectRatio:false,
          plugins:{ legend:{ position:"right", labels:{ color:"#f0ece0", font:{size:10}, boxWidth:12 } } } }
      });
    }

    // 4. Fill rate horizontal bar
    const c4 = document.getElementById("chart-fill");
    if (c4 && s.perEvent?.length) {
      new Chart(c4, {
        type:"bar",
        data:{
          labels: s.perEvent.slice(0,5).map(e=> e.name.length>16 ? e.name.slice(0,14)+"…" : e.name),
          datasets:[{
            label:"Fill %",
            data: s.perEvent.slice(0,5).map(e=>Math.min(100,Math.round((e.registered/e.capacity)*100))),
            backgroundColor: s.perEvent.slice(0,5).map(e=>{
              const pct=Math.min(100,Math.round((e.registered/e.capacity)*100));
              return pct>80?"rgba(239,68,68,.7)":GOLD_A+"0.7)";
            }),
            borderColor: GOLD, borderWidth:1, borderRadius:4
          }]
        },
        options:{
          indexAxis:"y",
          responsive:true, maintainAspectRatio:false,
          plugins:{ ...defaults.plugins, tooltip:{ callbacks:{ label: ctx=>`${ctx.raw}% filled` } } },
          scales:{
            x:{ max:100, ticks:{ color:"rgba(240,236,224,.5)", font:{size:10}, callback:v=>v+"%" }, grid:{color:"rgba(255,255,255,.05)"} },
            y:{ ticks:{ color:"rgba(240,236,224,.5)", font:{size:10} }, grid:{color:"rgba(255,255,255,.05)"} }
          }
        }
      });
    }

    // Also update popular event
    loadStats();

  } catch(e) { console.error("Chart error:", e); }
}

async function loadAdminEvents() {
  const tbody = document.getElementById("events-tbody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem"><div class="spinner" style="margin:0 auto;width:28px;height:28px"></div></td></tr>`;
  try {
    const res    = await API.getEvents();
    const events = res.data||[];
    if (!events.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted)">No events yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = events.map(e=>`
      <tr>
        <td><strong>${escHtml(e.title)}</strong></td>
        <td><span class="badge badge-primary">${escHtml(e.category||"general")}</span></td>
        <td>${formatDate(e.date)}</td>
        <td>${escHtml(e.venue)}</td>
        <td>${e.registered}/${e.capacity}
          <div class="capacity-bar" style="margin-top:4px">
            <div class="capacity-fill" style="width:${Math.min(100,(e.registered/e.capacity)*100).toFixed(0)}%"></div>
          </div>
        </td>
        <td>
          <div class="flex gap-sm">
            <button class="btn btn-ghost btn-sm" onclick="viewRegistrations('${e.id}')">👥 View</button>
            <button class="btn btn-danger btn-sm" onclick="deleteEvent('${e.id}')">🗑</button>
          </div>
        </td>
      </tr>`).join("");
  } catch {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--danger)">Failed to load events.</td></tr>`;
  }
}

async function deleteEvent(id) {
  if (!confirm("Are you sure you want to delete this event?")) return;
  try {
    await API.deleteEvent(id);
    Toast.success("Deleted","Event removed.");
    loadAdminEvents(); loadStats();
  } catch(err) { Toast.error("Error", err.message); }
}

async function viewRegistrations(eventId) {
  try {
    const res  = await API.getRegistrations(eventId);
    const list = res.data||[];
    const modal = document.getElementById("reg-list-modal");
    if (!modal) return;
    modal.querySelector(".modal-body").innerHTML = list.length
      ? `<div class="table-wrap"><table class="data-table">
          <thead><tr><th>Name</th><th>Roll No.</th><th>Email</th><th>Dept.</th><th>Ticket</th></tr></thead>
          <tbody>${list.map(r=>`<tr>
            <td>${escHtml(r.name)}</td>
            <td>${escHtml(r.rollNumber)}</td>
            <td>${escHtml(r.email)}</td>
            <td>${escHtml(r.department||"—")}</td>
            <td><button class="btn btn-ghost btn-sm" onclick="showTicket('${r.id}')">🎫 Ticket</button></td>
          </tr>`).join("")}</tbody>
        </table></div>`
      : `<p style="color:var(--text-muted);text-align:center;padding:2rem">No registrations yet.</p>`;
    openModal("reg-list-modal");
  } catch(err) { Toast.error("Error", err.message); }
}

// ════════════════════════════════════════════════════════════
//  TICKET SYSTEM
// ════════════════════════════════════════════════════════════
async function showTicket(registrationId) {
  try {
    const res = await API.getTicket(registrationId);
    const tk  = res.data;

    // Fill modal fields
    setText("tk-event-name", tk.eventName);
    setText("tk-category",   (tk.category||"General").toUpperCase());
    setText("tk-name",       tk.userName);
    setText("tk-roll",       tk.rollNumber||"—");
    setText("tk-datetime",   (tk.eventDate ? formatDate(tk.eventDate) : "TBD") + (tk.eventTime ? " · " + tk.eventTime : ""));
    setText("tk-venue",      tk.venue||"—");
    setText("tk-id",         tk.ticketId.split("-")[0].toUpperCase());

    // Generate QR code on canvas
    const canvas = document.getElementById("tk-qr-canvas");
    if (canvas) drawQR(canvas, tk.qrData);

    // Store for PDF download
    window._currentTicket = tk;

    document.getElementById("ticket-modal")?.classList.add("open");
  } catch(err) {
    Toast.error("Ticket Error", err.message||"Could not load ticket");
  }
}
window.showTicket = showTicket;

function closeTicketModal() {
  document.getElementById("ticket-modal")?.classList.remove("open");
}
window.closeTicketModal = closeTicketModal;

// Simple QR using Canvas (no lib required — grid pattern encoding the text)
function drawQR(canvas, data) {
  const ctx = canvas.getContext("2d");
  const size = canvas.width;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0,0,size,size);
  // Simple visual QR-like pattern based on string hash
  const hash = Array.from(data).reduce((a,c)=>((a<<5)-a)+c.charCodeAt(0)|0, 0);
  const cells = 10;
  const cell  = size / cells;
  ctx.fillStyle = "#000";
  for (let r=0; r<cells; r++) {
    for (let c=0; c<cells; c++) {
      const bit = ((hash >> ((r*cells+c)%30)) & 1) ^ ((r+c)%2===0?1:0);
      if (bit) ctx.fillRect(c*cell+1, r*cell+1, cell-2, cell-2);
    }
  }
  // Corner anchors (QR-style)
  [[0,0],[0,cells-3],[cells-3,0]].forEach(([r,c])=>{
    ctx.fillStyle="#000";
    ctx.fillRect(c*cell, r*cell, 3*cell, 3*cell);
    ctx.fillStyle="#fff";
    ctx.fillRect(c*cell+cell*.2, r*cell+cell*.2, 3*cell-cell*.4, 3*cell-cell*.4);
    ctx.fillStyle="#000";
    ctx.fillRect(c*cell+cell*.6, r*cell+cell*.6, 3*cell-cell*1.2, 3*cell-cell*1.2);
  });
}

async function downloadTicketPDF() {
  const tk = window._currentTicket;
  if (!tk) return;

  // Load html2canvas + jsPDF if not present
  async function loadLib(src) {
    if (document.querySelector(`script[src="${src}"]`)) return;
    return new Promise(resolve=>{
      const s=document.createElement("script"); s.src=src; s.onload=resolve;
      document.head.appendChild(s);
    });
  }

  Toast.info("Preparing PDF…","Please wait a moment.");

  try {
    await loadLib("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
    await loadLib("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");

    const card = document.getElementById("ticket-card");
    const canvas = await window.html2canvas(card, {
      backgroundColor:"#0d0d0d", scale:2, useCORS:true
    });

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation:"portrait", unit:"mm", format:"a5" });
    const imgData = canvas.toDataURL("image/png");
    const pw = pdf.internal.pageSize.getWidth();
    const ratio = canvas.height / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 10, pw, pw*ratio);
    pdf.save(`CampusConnect-Ticket-${tk.ticketId.split("-")[0]}.pdf`);
    Toast.success("Downloaded! 🎫","Your ticket PDF is ready.");
  } catch(err) {
    Toast.error("PDF Failed", "Could not generate PDF. Try screenshot instead.");
    console.error(err);
  }
}
window.downloadTicketPDF = downloadTicketPDF;

// ════════════════════════════════════════════════════════════
//  MODAL HELPERS
// ════════════════════════════════════════════════════════════
function openModal(id) { document.getElementById(id)?.classList.add("open"); document.body.style.overflow="hidden"; }
function closeModal(id) { document.getElementById(id)?.classList.remove("open"); document.body.style.overflow=""; }
document.addEventListener("click", e=>{
  if (e.target.classList.contains("modal-overlay")) { e.target.classList.remove("open"); document.body.style.overflow=""; }
});

// ════════════════════════════════════════════════════════════
//  UTILITIES
// ════════════════════════════════════════════════════════════
function validateForm(form) {
  let valid=true;
  form.querySelectorAll("[required]").forEach(field=>{
    clearFieldError(field);
    if (!field.value.trim()) { showFieldError(field,"This field is required"); valid=false; }
    else if (field.type==="email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value)) { showFieldError(field,"Enter a valid email"); valid=false; }
    else if (field.type==="password" && field.value.length<6) { showFieldError(field,"Password must be at least 6 characters"); valid=false; }
  });
  return valid;
}
function showFieldError(field,msg) {
  field.classList.add("error");
  let el=field.parentElement.querySelector(".form-error");
  if (!el) { el=document.createElement("div"); el.className="form-error"; field.insertAdjacentElement("afterend",el); }
  el.textContent=msg; el.classList.add("show");
}
function clearFieldError(field) {
  field.classList.remove("error");
  field.parentElement.querySelector(".form-error")?.classList.remove("show");
}
function showSkeletons(container,count) {
  container.innerHTML=Array.from({length:count},()=>`
    <div class="card" style="overflow:hidden">
      <div class="skeleton" style="height:180px;border-radius:0"></div>
      <div class="card-body" style="display:flex;flex-direction:column;gap:.75rem">
        <div class="skeleton" style="height:20px;width:70%"></div>
        <div class="skeleton" style="height:14px;width:90%"></div>
        <div class="skeleton" style="height:36px;margin-top:.5rem"></div>
      </div>
    </div>`).join("");
}
function emptyState(icon,title,sub) {
  return `<div class="empty-state" style="grid-column:1/-1">
    <div class="empty-state-icon">${icon}</div><h3>${title}</h3><p>${sub}</p></div>`;
}
function escHtml(str="") {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function formatDate(ds) {
  const d=new Date(ds);
  return d.toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"});
}
function debounce(fn,ms) { let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args),ms); }; }
function setLoading(btn,loading,label) {
  if (!btn) return;
  btn.disabled=loading;
  btn.textContent=loading?label:(btn.dataset.defaultLabel||label);
  if (!btn.dataset.defaultLabel&&!loading) btn.dataset.defaultLabel=label;
}
function setText(id,val) { const el=document.getElementById(id); if(el) el.textContent=val; }
function timeAgo(dateStr) {
  const diff=Date.now()-new Date(dateStr); const mins=Math.floor(diff/60000);
  if (mins<1) return "Just now";
  if (mins<60) return `${mins}m ago`;
  const hrs=Math.floor(mins/60);
  if (hrs<24) return `${hrs}h ago`;
  const days=Math.floor(hrs/24);
  return `${days}d ago`;
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded",()=>{
  initNavbar();
  initEventsPage();
  initRegistrationForm();
  initAuthForms();
  initAdmin();
  initCountdowns();
});

window.deleteEvent       = deleteEvent;
window.viewRegistrations = viewRegistrations;
window.openModal         = openModal;
window.closeModal        = closeModal;
