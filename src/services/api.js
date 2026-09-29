// ==========================================================================
// CricBid Central API & Realtime Firebase Bridge
// ==========================================================================

let configCache = null;
let dbInstance = null;

export async function getConfig() {
  if (configCache) return configCache;
  try {
    const res = await fetch('/config.json');
    configCache = await res.json();
    return configCache;
  } catch (err) {
    console.error('Failed to load config.json:', err);
    return {
      sheet_id: '',
      apps_script_url: '',
      firebase_url: 'https://esl2026-default-rtdb.firebaseio.com/',
      drive_base_folder_id: '1YdBiEy8ENXQOmuVJy6lxvpDSbQXYOyKn'
    };
  }
}

export async function getDb() {
  if (dbInstance) return dbInstance;
  const cfg = await getConfig();
  if (window.firebase && cfg.firebase_url) {
    if (!window.firebase.apps.length) {
      window.firebase.initializeApp({ databaseURL: cfg.firebase_url });
    }
    dbInstance = window.firebase.database();
    return dbInstance;
  }
  return null;
}

export function sanitizeKey(k) {
  if (!k) return 'item_' + Date.now();
  return String(k).trim().replace(/[.#$\[\]\/\x00-\x1F\x7F]/g, '_').replace(/\s+/g, '_');
}

export function getDriveFileId(url) {
  if (!url || typeof url !== 'string') return '';
  const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]{20,})/);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  if (m2) return m2[1];
  const m3 = url.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  if (m3) return m3[1];
  return '';
}

export function formatNum(n) {
  if (n === null || n === undefined || isNaN(n)) return '-';
  return '₹' + new Intl.NumberFormat('en-IN').format(n);
}

// ---------------- Realtime Listeners ----------------

export async function listenEvents(callback) {
  const db = await getDb();
  if (!db) return () => {};
  const ref = db.ref('events');
  const handler = snap => {
    const val = snap.val();
    if (val) {
      const list = Array.isArray(val) ? val : Object.values(val);
      callback(list);
    }
  };
  ref.on('value', handler);
  return () => ref.off('value', handler);
}

export async function listenLiveAuction(eventCode, callback) {
  const db = await getDb();
  if (!db) return () => {};
  const code = (eventCode || 'ESL2026').toUpperCase();
  const ref = db.ref(`auctions/${code}/live`);
  const handler = snap => {
    let data = snap.val();
    if (!data && code === 'ESL2026') {
      db.ref('eslAuction/live').once('value', leg => callback(leg.val()));
    } else {
      callback(data);
    }
  };
  ref.on('value', handler);
  return () => ref.off('value', handler);
}

export async function listenTimer(eventCode, callback) {
  const db = await getDb();
  if (!db) return () => {};
  const code = (eventCode || 'ESL2026').toUpperCase();
  const ref = db.ref(`auctions/${code}/timer`);
  const handler = snap => {
    let data = snap.val();
    if (!data && code === 'ESL2026') {
      db.ref('eslAuction/timer').once('value', leg => callback(leg.val()));
    } else {
      callback(data);
    }
  };
  ref.on('value', handler);
  return () => ref.off('value', handler);
}

export async function listenTeams(eventCode, callback) {
  const db = await getDb();
  if (!db) return () => {};
  const code = (eventCode || 'ESL2026').toUpperCase();
  const ref = db.ref(`auctions/${code}/teams`);
  const handler = snap => {
    let data = snap.val();
    if (!data && code === 'ESL2026') {
      db.ref('eslAuction/teams').once('value', leg => {
        const val = leg.val();
        callback(Array.isArray(val) ? val : Object.values(val || {}));
      });
    } else {
      const list = Array.isArray(data) ? data : Object.values(data || {});
      callback(list);
    }
  };
  ref.on('value', handler);
  return () => ref.off('value', handler);
}

export async function listenPlayers(eventCode, callback) {
  const db = await getDb();
  if (!db) return () => {};
  const code = (eventCode || 'ESL2026').toUpperCase();
  const ref = db.ref(`auctions/${code}/players`);
  const handler = snap => {
    let data = snap.val();
    if (!data && code === 'ESL2026') {
      db.ref('eslAuction/players').once('value', leg => {
        const val = leg.val();
        callback(Array.isArray(val) ? val : Object.values(val || {}));
      });
    } else {
      const list = Array.isArray(data) ? data : Object.values(data || {});
      callback(list);
    }
  };
  ref.on('value', handler);
  return () => ref.off('value', handler);
}

export async function listenAuctionLog(eventCode, callback) {
  const db = await getDb();
  if (!db) return () => {};
  const code = (eventCode || 'ESL2026').toUpperCase();
  const ref = db.ref(`auctions/${code}/log`);
  const handler = snap => {
    let data = snap.val();
    if (!data && code === 'ESL2026') {
      db.ref('eslAuction/log').once('value', leg => callback(leg.val() || { sold: [], unsold: [] }));
    } else {
      callback(data || { sold: [], unsold: [] });
    }
  };
  ref.on('value', handler);
  return () => ref.off('value', handler);
}

// ---------------- Authentication & Actions ----------------

export async function authenticateTeam(eventCode, username, password) {
  const code = (eventCode || 'ESL2026').trim().toUpperCase();
  const db = await getDb();

  // 1. Firebase Authentication first
  if (db) {
    try {
      const snap = await db.ref(`auctions/${code}/teams`).once('value');
      let teams = snap.val();
      if (!teams && code === 'ESL2026') {
        const leg = await db.ref('eslAuction/teams').once('value');
        teams = leg.val();
      }
      if (teams) {
        const list = Array.isArray(teams) ? teams : Object.values(teams);
        const match = list.find(t => 
          (t.username || '').toLowerCase() === username.trim().toLowerCase() && 
          t.password === password.trim()
        );
        if (match) {
          return { success: true, team: Object.assign({ eventCode: code }, match) };
        }
      }
    } catch (e) {
      console.warn('Firebase auth attempt error:', e);
    }
  }

  // 2. Apps Script Authentication
  const cfg = await getConfig();
  if (cfg.apps_script_url) {
    try {
      const url = new URL(cfg.apps_script_url);
      url.searchParams.set('action', 'authenticate');
      url.searchParams.set('username', username.trim());
      url.searchParams.set('password', password.trim());
      url.searchParams.set('eventCode', code);
      const res = await (await fetch(url.toString())).json();
      if (res && res.success && res.team) {
        return { success: true, team: Object.assign({ eventCode: code }, res.team) };
      }
      if (res && res.error) {
        return { success: false, error: res.error };
      }
    } catch (e) {
      console.warn('Apps Script auth error:', e);
    }
  }

  return { success: false, error: `Invalid team credentials for tournament ${code}` };
}

export async function apiPost(data) {
  const cfg = await getConfig();
  if (!cfg.apps_script_url) return { error: 'No Apps Script URL configured' };
  
  // Use text/plain to avoid CORS preflight options block in Google Apps Script
  const res = await fetch(cfg.apps_script_url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(data)
  });
  return await res.json();
}
