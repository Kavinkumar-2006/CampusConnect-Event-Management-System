// ============================================================
//  PASTE THIS SCRIPT at the bottom of index.html, events.html,
//  admin.html — any page that has the navbar
//  It auto-shows the avatar when user is logged in
// ============================================================
(function() {
  var user = null;
  try { user = JSON.parse(sessionStorage.getItem('cc_user')); } catch(e){}
  if (!user) return; // not logged in — keep original Sign In button

  // Find Sign In / Join Now buttons and replace with avatar
  var signInBtn = document.querySelector('a[href="/login"], a[href="/views/login.html"], .btn-nav-ghost, #signin-btn');
  var joinBtn   = document.querySelector('a[href="/register"], a[href="/views/register.html"], .btn-nav-fill, #join-btn');

  // Build avatar + dropdown HTML
  var initials = (user.name||'U').split(' ').map(function(w){return w[0]||'';}).join('').substring(0,2).toUpperCase();
  var navUserHtml = `
    <div id="nav-profile-wrap" style="position:relative;display:flex;align-items:center;gap:.65rem;">
      <span style="font-size:.88rem;color:rgba(240,236,224,.5);">${(user.name||'').split(' ')[0]}</span>
      <div id="nav-profile-avatar" onclick="window.__toggleProfileDD()" style="
        width:42px;height:42px;border-radius:50%;
        background:linear-gradient(135deg,#d4a017,#a07810);
        display:grid;place-items:center;font-size:1rem;font-weight:900;
        cursor:pointer;border:2px solid rgba(212,160,23,.45);
        box-shadow:0 0 16px rgba(212,160,23,.3);color:#0a0800;
        user-select:none;flex-shrink:0;
      ">${initials}</div>
      <div id="nav-profile-dd" style="
        display:none;position:absolute;top:calc(100% + .75rem);right:0;width:220px;
        background:#111;border:1.5px solid rgba(212,160,23,.28);
        border-radius:14px;overflow:hidden;
        box-shadow:0 20px 60px rgba(0,0,0,.7);z-index:999;
        animation:ddIn .2s ease;
      ">
        <style>@keyframes ddIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}</style>
        <div style="padding:.9rem 1.2rem;border-bottom:1px solid rgba(255,255,255,.06)">
          <div style="font-weight:800;color:#f0ece0;font-size:.95rem">${user.name||''}</div>
          <div style="font-size:.78rem;color:rgba(240,236,224,.38);margin-top:.1rem">${user.email||''}</div>
        </div>
        <button onclick="location.href='/profile'" style="display:flex;align-items:center;gap:.75rem;width:100%;padding:.8rem 1.2rem;background:none;border:none;color:rgba(240,236,224,.7);cursor:pointer;font-size:.9rem;font-family:Georgia,serif;transition:background .15s" onmouseover="this.style.background='rgba(212,160,23,.08)';this.style.color='#d4a017'" onmouseout="this.style.background='none';this.style.color='rgba(240,236,224,.7)'">👤 My Profile</button>
        <button onclick="location.href='/profile#registrations'" style="display:flex;align-items:center;gap:.75rem;width:100%;padding:.8rem 1.2rem;background:none;border:none;color:rgba(240,236,224,.7);cursor:pointer;font-size:.9rem;font-family:Georgia,serif;transition:background .15s" onmouseover="this.style.background='rgba(212,160,23,.08)';this.style.color='#d4a017'" onmouseout="this.style.background='none';this.style.color='rgba(240,236,224,.7)'">📋 My Registrations</button>
        <button onclick="location.href='/profile#settings'" style="display:flex;align-items:center;gap:.75rem;width:100%;padding:.8rem 1.2rem;background:none;border:none;color:rgba(240,236,224,.7);cursor:pointer;font-size:.9rem;font-family:Georgia,serif;transition:background .15s" onmouseover="this.style.background='rgba(212,160,23,.08)';this.style.color='#d4a017'" onmouseout="this.style.background='none';this.style.color='rgba(240,236,224,.7)'">⚙️ Settings</button>
        <div style="height:1px;background:rgba(255,255,255,.06)"></div>
        <button onclick="window.__logout()" style="display:flex;align-items:center;gap:.75rem;width:100%;padding:.8rem 1.2rem;background:none;border:none;color:rgba(239,68,68,.65);cursor:pointer;font-size:.9rem;font-family:Georgia,serif;transition:background .15s" onmouseover="this.style.background='rgba(239,68,68,.08)';this.style.color='#ef4444'" onmouseout="this.style.background='none';this.style.color='rgba(239,68,68,.65)'">🚪 Logout</button>
      </div>
    </div>`;

  // Replace Sign In + Join buttons with avatar
  var target = signInBtn || joinBtn;
  if (target && target.parentNode) {
    var wrapper = document.createElement('div');
    wrapper.innerHTML = navUserHtml;
    // hide original buttons
    if (signInBtn) signInBtn.style.display = 'none';
    if (joinBtn)   joinBtn.style.display   = 'none';
    // insert avatar after whichever button we found
    target.parentNode.insertBefore(wrapper.firstElementChild, target.nextSibling);
  }

  // Toggle dropdown
  window.__toggleProfileDD = function() {
    var dd = document.getElementById('nav-profile-dd');
    dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
  };
  // Close on outside click
  document.addEventListener('click', function(e) {
    var wrap = document.getElementById('nav-profile-wrap');
    if (wrap && !wrap.contains(e.target)) {
      var dd = document.getElementById('nav-profile-dd');
      if (dd) dd.style.display = 'none';
    }
  });
  // Logout
  window.__logout = function() {
    sessionStorage.removeItem('cc_user');
    location.href = '/login';
  };
})();
