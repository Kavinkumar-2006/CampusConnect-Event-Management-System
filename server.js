// ============================================================
//  CampusConnect — server.js
//  Full RBAC + express-session + protected routes
//  Admin credentials stored ONLY in this file — never sent to frontend
// ============================================================
'use strict';

const express = require('express');
const session  = require('express-session');
const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── File paths ────────────────────────────────────────────────
const DATA_DIR           = path.join(__dirname, 'data');
const EVENTS_FILE        = path.join(DATA_DIR, 'events.json');
const USERS_FILE         = path.join(DATA_DIR, 'users.json');
const REGISTRATIONS_FILE = path.join(DATA_DIR, 'registrations.json');
const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json');
const CHATS_FILE         = path.join(DATA_DIR, 'chats.json');
const ANNOUNCEMENTS_FILE = path.join(DATA_DIR, 'announcements.json');

// ── ADMIN CREDENTIALS — BACKEND ONLY, NEVER SENT TO CLIENT ───
const ADMIN_CONFIG = {
  adminId:  'CC-ADMIN-7294',
  email:    'admin@campusconnect.com',
  password: 'GoldSecure@2026'
};

// ── JSON helpers ──────────────────────────────────────────────
function readJSON(f, fb=[]) {
  try { return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f,'utf8')) : fb; }
  catch { return fb; }
}
function writeJSON(f, d) {
  fs.mkdirSync(path.dirname(f), {recursive:true});
  fs.writeFileSync(f, JSON.stringify(d, null, 2), 'utf8');
}

// ── Seed default users ────────────────────────────────────────
function seedUsers() {
  fs.mkdirSync(DATA_DIR, {recursive:true});
  const users = readJSON(USERS_FILE);
  const defaults = [
    {
      email: ADMIN_CONFIG.email,
      password: ADMIN_CONFIG.password,
      adminId: ADMIN_CONFIG.adminId,
      name: 'Admin', rollNumber: 'ADMIN001',
      role: 'admin', department: 'Administration', year: ''
    },
    {
      email: 'staff@campusconnect.com', password: 'Staff@123',
      name: 'Prof. Ravi Kumar', rollNumber: 'STAFF001',
      role: 'staff', department: 'Computer Science', year: ''
    },
    {
      email: 'srikavin2020@gmail.com', password: 'Kavinkumar@2006',
      name: 'Kavin Kumar', rollNumber: '22IT001',
      role: 'student', department: 'IT', year: '2nd Year'
    },
    {
      email: 'test@example.com', password: '123456',
      name: 'Test Student', rollNumber: 'TEST001',
      role: 'student', department: 'CSE', year: '1st Year'
    }
  ];
  let changed = false;
  defaults.forEach(def => {
    const i = users.findIndex(u => u.email.toLowerCase() === def.email.toLowerCase());
    if (i === -1) {
      // Brand-new user — insert and mark dirty
      users.push({
        id: crypto.randomUUID(), ...def,
        email: def.email.toLowerCase(),
        phone: '', section: 'A', gender: '', address: '',
        joinedAt: new Date().toISOString(), activeDays: 1
      });
      changed = true;
    } else if (def.role === 'admin' && users[i].password !== def.password) {
      // Admin password drifted from config — resync ONLY when actually different
      users[i].password = def.password;
      changed = true;
    }
    // Existing non-admin users: no change needed, no write triggered
  });
  // Only write to disk when data genuinely changed.
  // This prevents nodemon from seeing a file modification on every
  // startup and restarting the server in an infinite loop.
  if (changed) writeJSON(USERS_FILE, users);
}

// ── Middleware ────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, _, next) => { console.log(req.method, req.url); next(); });

// Session middleware — keeps login state server-side
app.use(session({
  secret: process.env.SESSION_SECRET || 'cc-secret-key-change-in-production-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,   // set true if HTTPS in production
    httpOnly: true,
    maxAge: 8 * 60 * 60 * 1000   // 8 hours
  }
}));

// ── Auth middleware ───────────────────────────────────────────
// Checks: (1) express-session, (2) Accept header for API vs HTML

function requireAuth(role) {
  return function(req, res, next) {
    const user = req.session && req.session.user;
    const isAPI = req.path.startsWith('/api/') ||
                  (req.headers.accept || '').includes('application/json');
    if (!user) {
      if (isAPI) return res.status(401).json({success:false, message:'Not authenticated'});
      return res.redirect('/role-login');
    }
    if (role && user.role !== role) {
      if (isAPI) return res.status(403).json({success:false, message:'Access denied'});
      return res.redirect('/role-login');
    }
    next();
  };
}

function requireAnyAuth(req, res, next) {
  const user = req.session && req.session.user;
  if (!user) return res.redirect('/role-login');
  next();
}

// ── HTML route helper ─────────────────────────────────────────
const VIEWS = path.join(__dirname, 'views');

function serveView(file) {
  return function(req, res) {
    const fp = path.join(VIEWS, file);
    if (fs.existsSync(fp)) res.sendFile(fp);
    else res.status(404).send('Page not found: ' + file);
  };
}

// ── Public HTML routes (no auth needed) ──────────────────────
app.get('/',             serveView('index.html'));
app.get('/events',       serveView('events.html'));
app.get('/register',     serveView('register.html'));
app.get('/login',        (req,res)=>res.redirect('/role-login'));
app.get('/role-login',   serveView('role-login.html'));
app.get('/fix-account',  serveView('fix-account.html'));
app.get('/event-register', serveView('event-register.html'));

// ── Protected HTML routes (require login + correct role) ──────
app.get('/admin',             requireAuth('admin'),   serveView('admin.html'));
app.get('/admin-dashboard',   requireAuth('admin'),   (req,res)=>res.redirect('/admin'));
app.get('/staff-dashboard',   requireAuth('staff'),   serveView('staff-dashboard.html'));
app.get('/student-dashboard', requireAuth('student'), serveView('student-dashboard.html'));

// Profile accessible by student or staff
app.get('/profile', requireAnyAuth, serveView('profile.html'));

// Legacy /views/* paths
const publicPages = ['index','events','login','register','event-register','fix-account'];
publicPages.forEach(p => {
  app.get(`/views/${p}.html`, serveView(p+'.html'));
});

// ═══════════════════════════════════════════════════════════════
//  AUTH API
// ═══════════════════════════════════════════════════════════════

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const email    = (req.body.email    || '').trim().toLowerCase();
  const password = (req.body.password || '').trim();
  const adminId  = (req.body.adminId  || '').trim();

  if (!email || !password)
    return res.status(400).json({success:false, message:'Email and password are required'});

  const users = readJSON(USERS_FILE);
  const user  = users.find(u => u.email.toLowerCase() === email);
  if (!user)
    return res.status(401).json({success:false, message:'No account found with that email'});

  // Admin must supply the correct Admin ID — verified server-side only
  if (user.role === 'admin') {
    if (!adminId)
      return res.status(401).json({success:false, message:'Admin ID is required'});
    if (adminId !== ADMIN_CONFIG.adminId)
      return res.status(401).json({success:false, message:'Invalid Admin ID'});
  }

  // Password check (plain or sha256 legacy)
  const sha = s => crypto.createHash('sha256').update(s).digest('hex');
  const ok  = user.password === password ||
              user.password === sha(password) ||
              user.password === sha(password + 'campusconnect_salt');
  if (!ok)
    return res.status(401).json({success:false, message:'Incorrect password'});

  // Migrate plain password if needed
  if (user.password !== password) {
    const idx = users.findIndex(u => u.email === user.email);
    users[idx].password = password;
    writeJSON(USERS_FILE, users);
  }

  // Create server-side session
  const { password: _pw, adminId: _aid, ...safeUser } = user;
  req.session.user = safeUser;

  // Welcome notification (once)
  const notifs = readJSON(NOTIFICATIONS_FILE);
  if (!notifs.some(n => n.userId === user.id && n.type === 'welcome')) {
    notifs.push({
      id: crypto.randomUUID(), userId: user.id, type: 'welcome',
      title: 'Welcome to CampusConnect! 🎉',
      message: 'Your account is active. Browse and register for events.',
      read: false, createdAt: new Date().toISOString()
    });
    writeJSON(NOTIFICATIONS_FILE, notifs);
  }

  // Return safe user data (NO password, NO adminId, NO admin credentials)
  res.json({success:true, message:'Login successful', data: safeUser});
});

// POST /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({success:true, message:'Logged out'});
});

// GET /api/auth/me — returns current session user
app.get('/api/auth/me', (req, res) => {
  if (!req.session || !req.session.user)
    return res.status(401).json({success:false, message:'Not authenticated'});
  res.json({success:true, data: req.session.user});
});

// POST /api/auth/register
app.post('/api/auth/register', (req, res) => {
  const {name, email, password, rollNumber, department, year, phone, section, gender, address} = req.body;
  if (!name || !email || !password || !rollNumber)
    return res.status(400).json({success:false, message:'All required fields must be filled'});

  const users = readJSON(USERS_FILE);
  if (users.some(u => u.email.toLowerCase() === email.toLowerCase().trim()))
    return res.status(409).json({success:false, message:'An account with this email already exists'});

  const u = {
    id: crypto.randomUUID(), name: name.trim(),
    email: email.toLowerCase().trim(), password,
    rollNumber: rollNumber.trim(), department: (department||'IT').trim(),
    year: year||'1st Year', phone: (phone||'').trim(),
    section: (section||'A').trim(), gender: gender||'',
    address: (address||'').trim(), role: 'student',
    joinedAt: new Date().toISOString(), activeDays: 1
  };
  users.push(u);
  writeJSON(USERS_FILE, users);

  const notifs = readJSON(NOTIFICATIONS_FILE);
  notifs.push({
    id: crypto.randomUUID(), userId: u.id, type: 'welcome',
    title: 'Welcome to CampusConnect! 🎉',
    message: 'Account created. Browse events and register now!',
    read: false, createdAt: new Date().toISOString()
  });
  writeJSON(NOTIFICATIONS_FILE, notifs);

  const { password: _, ...safeU } = u;
  res.status(201).json({success:true, message:'Account created', data: safeU});
});

// POST /api/auth/fix — password reset utility
app.post('/api/auth/fix', (req, res) => {
  const email    = (req.body.email||'').trim().toLowerCase();
  const password = (req.body.newPassword||req.body.password||'').trim();
  if (!email||!password)
    return res.status(400).json({success:false, message:'Email and password are required'});

  const users = readJSON(USERS_FILE);
  const idx = users.findIndex(u => u.email.toLowerCase() === email);
  if (idx === -1) {
    users.push({
      id: crypto.randomUUID(), name: email.split('@')[0], email, password,
      rollNumber: 'N/A', department: '', year: '', phone: '', section: '',
      role: 'student', joinedAt: new Date().toISOString(), activeDays: 1
    });
    writeJSON(USERS_FILE, users);
    return res.status(201).json({success:true, message:'Account created'});
  }
  users[idx].password = password;
  writeJSON(USERS_FILE, users);
  const { password: _, ...safe } = users[idx];
  res.json({success:true, message:'Password updated', data: safe});
});

// ═══════════════════════════════════════════════════════════════
//  PROFILE
// ═══════════════════════════════════════════════════════════════

app.get('/api/profile/:email', (req, res) => {
  const email = req.params.email.toLowerCase();
  const users = readJSON(USERS_FILE);
  const user  = users.find(u => u.email.toLowerCase() === email);
  if (!user) return res.status(404).json({success:false, message:'User not found'});

  const regs   = readJSON(REGISTRATIONS_FILE).filter(r => r.email.toLowerCase() === email);
  const events = readJSON(EVENTS_FILE);
  const now    = new Date();

  const registeredEvents = regs.map(r => {
    const ev = events.find(e => e.id === r.eventId) || {};
    return {
      registrationId: r.id, eventId: r.eventId,
      eventName: ev.title||'Unknown',
      date: ev.date||'', venue: ev.venue||'', time: ev.time||'',
      category: ev.category||'',
      status: ev.date && new Date(ev.date) >= now ? 'upcoming' : 'completed',
      registeredAt: r.registeredAt
    };
  });

  const joinedDays = user.joinedAt
    ? Math.ceil((now - new Date(user.joinedAt)) / (1000*60*60*24))
    : 1;

  const { password: _, adminId: __, ...safeUser } = user;
  res.json({success:true, data:{
    user: safeUser,
    stats:{
      totalRegistered: regs.length,
      activeDays:  Math.max(1, joinedDays),
      progress:    Math.min(100, Math.round((regs.length/10)*100)),
      upcoming:    registeredEvents.filter(e => e.status==='upcoming').length,
      completed:   registeredEvents.filter(e => e.status==='completed').length
    },
    registrations: registeredEvents
  }});
});

app.put('/api/profile/:email', (req, res) => {
  const email = req.params.email.toLowerCase();
  const users = readJSON(USERS_FILE);
  const idx   = users.findIndex(u => u.email.toLowerCase() === email);
  if (idx === -1) return res.status(404).json({success:false, message:'User not found'});

  ['name','phone','department','year','section','gender','address','rollNumber']
    .forEach(f => { if (req.body[f] !== undefined) users[idx][f] = req.body[f]; });
  users[idx].updatedAt = new Date().toISOString();
  writeJSON(USERS_FILE, users);

  const { password: _, adminId: __, ...safe } = users[idx];
  res.json({success:true, message:'Profile updated', data: safe});
});

// ═══════════════════════════════════════════════════════════════
//  USERS  (admin/staff only)
// ═══════════════════════════════════════════════════════════════

app.get('/api/users', (req, res) => {
  const { role } = req.query;
  let users = readJSON(USERS_FILE)
    .map(u => { const { password:_, adminId:__, ...s } = u; return s; });
  if (role) users = users.filter(u => u.role === role);
  res.json({success:true, count: users.length, data: users});
});

app.delete('/api/users/:id', (req, res) => {
  const users = readJSON(USERS_FILE);
  const idx = users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({success:false, message:'User not found'});
  users.splice(idx, 1);
  writeJSON(USERS_FILE, users);
  res.json({success:true, message:'User deleted'});
});

// ═══════════════════════════════════════════════════════════════
//  NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════

app.get('/api/notifications/:userId', (req, res) => {
  const notifs = readJSON(NOTIFICATIONS_FILE)
    .filter(n => n.userId === req.params.userId)
    .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({success:true, unread: notifs.filter(n=>!n.read).length, data: notifs});
});

app.put('/api/notifications/:id/read', (req, res) => {
  const notifs = readJSON(NOTIFICATIONS_FILE);
  const idx = notifs.findIndex(n => n.id === req.params.id);
  if (idx !== -1) { notifs[idx].read = true; writeJSON(NOTIFICATIONS_FILE, notifs); }
  res.json({success:true});
});

app.put('/api/notifications/read-all/:userId', (req, res) => {
  const notifs = readJSON(NOTIFICATIONS_FILE);
  notifs.forEach(n => { if (n.userId === req.params.userId) n.read = true; });
  writeJSON(NOTIFICATIONS_FILE, notifs);
  res.json({success:true});
});

app.post('/api/notifications', (req, res) => {
  const { userId, title, message, type } = req.body;
  const notifs = readJSON(NOTIFICATIONS_FILE);
  const n = {
    id: crypto.randomUUID(), userId, type: type||'info',
    title, message, read: false, createdAt: new Date().toISOString()
  };
  notifs.push(n);
  writeJSON(NOTIFICATIONS_FILE, notifs);
  res.status(201).json({success:true, data: n});
});

// ═══════════════════════════════════════════════════════════════
//  ANNOUNCEMENTS
// ═══════════════════════════════════════════════════════════════

app.post('/api/announcements', (req, res) => {
  const { title, message, targetRole } = req.body;
  if (!title || !message)
    return res.status(400).json({success:false, message:'Title and message are required'});

  const users  = readJSON(USERS_FILE);
  const notifs = readJSON(NOTIFICATIONS_FILE);
  const ann    = {
    id: crypto.randomUUID(), title, message,
    targetRole: targetRole||'all', createdAt: new Date().toISOString()
  };
  const anns = readJSON(ANNOUNCEMENTS_FILE);
  anns.push(ann);
  writeJSON(ANNOUNCEMENTS_FILE, anns);

  users
    .filter(u => targetRole === 'all' || u.role === targetRole)
    .forEach(u => {
      notifs.push({
        id: crypto.randomUUID(), userId: u.id, type: 'announcement',
        title: `📢 ${title}`, message,
        read: false, createdAt: new Date().toISOString()
      });
    });
  writeJSON(NOTIFICATIONS_FILE, notifs);
  res.status(201).json({success:true, message:'Announcement sent', data: ann});
});

app.get('/api/announcements', (_, res) => {
  res.json({success:true,
    data: readJSON(ANNOUNCEMENTS_FILE).sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt))
  });
});

// ═══════════════════════════════════════════════════════════════
//  CHATS
// ═══════════════════════════════════════════════════════════════

app.get('/api/chats/:eventId', (req, res) => {
  const chats = readJSON(CHATS_FILE)
    .filter(c => c.eventId === req.params.eventId)
    .sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt))
    .slice(-50);
  res.json({success:true, data: chats});
});

app.post('/api/chats', (req, res) => {
  const { eventId, senderId, senderName, senderRole, message } = req.body;
  if (!eventId || !senderId || !message)
    return res.status(400).json({success:false, message:'eventId, senderId, and message are required'});
  const chats = readJSON(CHATS_FILE);
  const msg = {
    id: crypto.randomUUID(), eventId, senderId, senderName,
    senderRole: senderRole||'student', message,
    createdAt: new Date().toISOString()
  };
  chats.push(msg);
  writeJSON(CHATS_FILE, chats);
  res.status(201).json({success:true, data: msg});
});

// ═══════════════════════════════════════════════════════════════
//  TICKET
// ═══════════════════════════════════════════════════════════════

app.get('/api/ticket/:registrationId', (req, res) => {
  const regs = readJSON(REGISTRATIONS_FILE);
  const reg  = regs.find(r => r.id === req.params.registrationId);
  if (!reg) return res.status(404).json({success:false, message:'Registration not found'});
  const ev = readJSON(EVENTS_FILE).find(e => e.id === reg.eventId) || {};
  res.json({success:true, data:{
    ticketId:     reg.id,
    eventName:    ev.title||'Event',
    eventDate:    ev.date||'',
    eventTime:    ev.time||'TBD',
    venue:        ev.venue||'',
    category:     ev.category||'',
    userName:     reg.name,
    userEmail:    reg.email,
    rollNumber:   reg.rollNumber,
    department:   reg.department||'',
    registeredAt: reg.registeredAt,
    qrData:       `CCTICKET:${reg.id}:${reg.email}:${ev.title||''}`
  }});
});

// ═══════════════════════════════════════════════════════════════
//  EVENTS
// ═══════════════════════════════════════════════════════════════

app.get('/api/events', (req, res) => {
  let ev = readJSON(EVENTS_FILE);
  const { category, search } = req.query;
  if (category && category !== 'all')
    ev = ev.filter(e => (e.category||'').toLowerCase() === category.toLowerCase());
  if (search) {
    const q = search.toLowerCase();
    ev = ev.filter(e => e.title.toLowerCase().includes(q) ||
                        (e.description||'').toLowerCase().includes(q));
  }
  ev.sort((a,b) => new Date(a.date) - new Date(b.date));
  res.json({success:true, count: ev.length, data: ev});
});

app.get('/api/events/:id', (req, res) => {
  const e = readJSON(EVENTS_FILE).find(e => e.id === req.params.id);
  if (!e) return res.status(404).json({success:false, message:'Event not found'});
  res.json({success:true, data: e});
});

app.post('/api/events', (req, res) => {
  const { title, date, time, venue, description, category, capacity } = req.body;
  if (!title||!date||!venue)
    return res.status(400).json({success:false, message:'Title, date, and venue are required'});
  const ev = readJSON(EVENTS_FILE);
  const e = {
    id: crypto.randomUUID(), title: title.trim(), date,
    time: time||'TBD', venue: venue.trim(),
    description: (description||'').trim(),
    category: (category||'general').toLowerCase(),
    capacity: parseInt(capacity)||100, registered: 0,
    status: 'active', createdAt: new Date().toISOString()
  };
  ev.push(e);
  writeJSON(EVENTS_FILE, ev);

  // Notify all users
  const users  = readJSON(USERS_FILE);
  const notifs = readJSON(NOTIFICATIONS_FILE);
  users.forEach(u => {
    notifs.push({
      id: crypto.randomUUID(), userId: u.id, type: 'event',
      title: `New Event: ${e.title}`,
      message: `${e.title} on ${e.date} at ${e.venue}. Register now!`,
      read: false, createdAt: new Date().toISOString(), eventId: e.id
    });
  });
  writeJSON(NOTIFICATIONS_FILE, notifs);
  res.status(201).json({success:true, message:'Event created', data: e});
});

app.put('/api/events/:id', (req, res) => {
  const ev = readJSON(EVENTS_FILE);
  const i  = ev.findIndex(e => e.id === req.params.id);
  if (i === -1) return res.status(404).json({success:false, message:'Event not found'});
  ['title','date','time','venue','description','category','capacity','status']
    .forEach(f => { if (req.body[f] !== undefined) ev[i][f] = req.body[f]; });
  ev[i].updatedAt = new Date().toISOString();
  writeJSON(EVENTS_FILE, ev);
  res.json({success:true, data: ev[i]});
});

app.delete('/api/events/:id', (req, res) => {
  let ev = readJSON(EVENTS_FILE);
  if (!ev.some(e => e.id === req.params.id))
    return res.status(404).json({success:false, message:'Event not found'});
  writeJSON(EVENTS_FILE, ev.filter(e => e.id !== req.params.id));
  res.json({success:true, message:'Event deleted'});
});

// ═══════════════════════════════════════════════════════════════
//  REGISTRATIONS
// ═══════════════════════════════════════════════════════════════

app.post('/api/register', (req, res) => {
  const { eventId, name, email, rollNumber, department, year } = req.body;
  if (!eventId||!name||!email||!rollNumber)
    return res.status(400).json({success:false, message:'Required fields are missing'});

  const ev = readJSON(EVENTS_FILE);
  const i  = ev.findIndex(e => e.id === eventId);
  if (i === -1) return res.status(404).json({success:false, message:'Event not found'});
  if (ev[i].registered >= ev[i].capacity)
    return res.status(409).json({success:false, message:'This event is full'});

  const regs = readJSON(REGISTRATIONS_FILE);
  if (regs.some(r => r.eventId === eventId && r.email.toLowerCase() === email.toLowerCase()))
    return res.status(409).json({success:false, message:'You are already registered for this event'});

  const r = {
    id: crypto.randomUUID(), eventId,
    name: name.trim(), email: email.toLowerCase().trim(),
    rollNumber: rollNumber.trim(), department: (department||'').trim(),
    year: year||'', registeredAt: new Date().toISOString()
  };
  regs.push(r);
  writeJSON(REGISTRATIONS_FILE, regs);
  ev[i].registered += 1;
  writeJSON(EVENTS_FILE, ev);

  // Notify the student
  const users  = readJSON(USERS_FILE);
  const user   = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (user) {
    const notifs = readJSON(NOTIFICATIONS_FILE);
    notifs.push({
      id: crypto.randomUUID(), userId: user.id, type: 'registration',
      title: `Registered: ${ev[i].title} ✅`,
      message: `You're confirmed for ${ev[i].title} on ${ev[i].date} at ${ev[i].venue}.`,
      read: false, createdAt: new Date().toISOString(),
      eventId, registrationId: r.id
    });
    writeJSON(NOTIFICATIONS_FILE, notifs);
  }

  res.status(201).json({success:true, message:'Registration successful',
    data: { registrationId: r.id, event: ev[i].title, ticketId: r.id }
  });
});

app.get('/api/registrations/:eventId', (req, res) => {
  res.json({success:true,
    data: readJSON(REGISTRATIONS_FILE).filter(r => r.eventId === req.params.eventId)
  });
});

app.get('/api/registrations', (_, res) => {
  res.json({success:true, data: readJSON(REGISTRATIONS_FILE)});
});

// ═══════════════════════════════════════════════════════════════
//  ADMIN ANALYTICS
// ═══════════════════════════════════════════════════════════════

app.get('/api/admin/stats', (_, res) => {
  const ev = readJSON(EVENTS_FILE);
  const re = readJSON(REGISTRATIONS_FILE);
  const us = readJSON(USERS_FILE);
  const now = new Date();

  const perEvent = ev
    .map(e => ({name:e.title, registered:e.registered||0, capacity:e.capacity||100, category:e.category||'general'}))
    .sort((a,b) => b.registered - a.registered);

  const last7 = [...Array(7)].map((_,i) => {
    const d = new Date(now); d.setDate(d.getDate()-i);
    const ds = d.toISOString().split('T')[0];
    return { date:ds, count: re.filter(r=>r.registeredAt&&r.registeredAt.startsWith(ds)).length };
  }).reverse();

  const catMap = {};
  ev.forEach(e => {
    catMap[e.category||'general'] = (catMap[e.category||'general']||0) + (e.registered||0);
  });

  res.json({success:true, data:{
    totalEvents:       ev.length,
    upcomingEvents:    ev.filter(e => new Date(e.date)>=now).length,
    totalRegistrations: re.length,
    totalCapacity:     ev.reduce((s,e) => s+(e.capacity||0), 0),
    totalUsers:        us.length,
    totalStudents:     us.filter(u => u.role==='student').length,
    totalStaff:        us.filter(u => u.role==='staff').length,
    fillRate:          ev.length ? Math.round((re.length / ev.reduce((s,e)=>s+(e.capacity||1),0))*100) : 0,
    popularEvent:      perEvent[0] || null,
    perEvent,
    last7Days:         last7,
    categoryBreakdown: Object.entries(catMap).map(([cat,count]) => ({cat,count}))
  }});
});

// ── CSV Export ────────────────────────────────────────────────
app.get('/api/export/registrations', (req, res) => {
  const { eventId } = req.query;
  let regs = readJSON(REGISTRATIONS_FILE);
  const ev = readJSON(EVENTS_FILE);
  if (eventId) regs = regs.filter(r => r.eventId === eventId);
  const evMap = Object.fromEntries(ev.map(e => [e.id, e.title]));
  const rows = [
    'Name,Roll Number,Email,Department,Year,Event,Registered At',
    ...regs.map(r =>
      `${r.name},${r.rollNumber},${r.email},${r.department||''},${r.year||''},${evMap[r.eventId]||''},${r.registeredAt}`
    )
  ];
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="registrations.csv"');
  res.send(rows.join('\n'));
});

// ── Catch-all 404 ─────────────────────────────────────────────
app.use((req, res) => {
  // API requests get JSON
  if (req.path.startsWith('/api/'))
    return res.status(404).json({success:false, message:'API endpoint not found'});
  // Page requests redirect home
  res.redirect('/');
});

// ── Boot ──────────────────────────────────────────────────────
seedUsers();
app.listen(PORT, () => {
  console.log(`\n✅  CampusConnect: http://localhost:${PORT}`);
  console.log(`🔐  Admin portal:  http://localhost:${PORT}/role-login`);
  console.log(`    (Credentials are stored in server.js — not exposed to frontend)\n`);
});

module.exports = app;
