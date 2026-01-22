// config.js
const API_BASE = "https://anichin-seven.vercel.app"; // ganti kalau domain beda
const CLIENT_ID = "879575887567-dpebn221ucih4hs73lu8mbbl528lb89o.apps.googleusercontent.com"; // dari Google Cloud Console

// Storage keys
const LS_TOKEN = "gToken";
const LS_HIST  = "ach_hist";
const LS_NAME  = "gProfileName";
const LS_PIC   = "gProfilePic";

// --- ROUTE HELPER (buat Vercel clean url) ---
function currentPath() {
  return window.location.pathname.replace(/\/+$/, "") || "/";
}

// --- AUTH GUARD ---
function checkAuth() {
  const path = currentPath();
  const token = localStorage.getItem(LS_TOKEN);

  const isLogin = (path === "/login" || path === "/login.html");
  if (!token && !isLogin) {
    window.location.href = "/login";
    return;
  }
  if (token && isLogin) {
    window.location.href = "/home";
  }
}

// --- GOOGLE TOKEN CLIENT ---
let tokenClient;

function initGoogle() {
  const btn = document.getElementById("gLoginBtn");
  if (btn) btn.disabled = true;

  const script = document.createElement("script");
  script.src = "https://accounts.google.com/gsi/client";
  script.async = true;
  script.defer = true;

  script.onerror = () => {
    console.error("Gagal load Google GSI script");
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Gagal memuat Google. Coba lagi.";
    }
  };

  script.onload = () => {
    if (!window.google?.accounts?.oauth2) {
      console.error("Google GSI loaded tapi object tidak ada");
      if (btn) {
        btn.disabled = false;
        btn.innerText = "Google error. Coba reload.";
      }
      return;
    }

    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: "https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.profile",
      callback: async (response) => {
        if (!response?.access_token) return;

        localStorage.setItem(LS_TOKEN, response.access_token);

        // ambil profil sederhana (opsional, buat UI)
        await fetchGoogleProfile().catch(() => {});

        // tarik history dari cloud lalu masuk home
        await syncCloud("pull").catch(() => {});
        window.location.href = "/home";
      },
    });

    if (btn) {
      btn.disabled = false;
      btn.onclick = () => tokenClient.requestAccessToken();
      btn.innerText = "Masuk dengan Google";
    }
  };

  document.head.appendChild(script);
}

async function fetchGoogleProfile() {
  const token = localStorage.getItem(LS_TOKEN);
  if (!token) return;
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return;
  const p = await res.json();
  if (p?.name) localStorage.setItem(LS_NAME, p.name);
  if (p?.picture) localStorage.setItem(LS_PIC, p.picture);
}

// --- API FETCH WRAPPER ---
async function apiGet(path) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const r = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!r.ok) throw new Error(`API error ${r.status}`);
  return r.json();
}

// --- HISTORY (LOCAL + CLOUD SYNC) ---
function readHistory() {
  try { return JSON.parse(localStorage.getItem(LS_HIST) || "[]"); }
  catch { return []; }
}
function writeHistory(arr) {
  localStorage.setItem(LS_HIST, JSON.stringify(arr || []));
}

function addHistory(item) {
  // item minimal: { animeId, title, poster, lastEpisodeId, lastEpisodeTitle, ts }
  const hist = readHistory();
  const idx = hist.findIndex(x => x?.animeId === item.animeId);
  const payload = { ...item, ts: Date.now() };

  if (idx >= 0) hist[idx] = { ...hist[idx], ...payload };
  else hist.unshift(payload);

  // limit biar nggak jadi museum
  writeHistory(hist.slice(0, 200));
}

// --- GOOGLE DRIVE APPDATA SYNC ---
// file di appDataFolder tidak ganggu Drive user
async function syncCloud(action = "push") {
  const token = localStorage.getItem(LS_TOKEN);
  if (!token) return;

  const fileName = "raystream_data.json";

  // 1) cari file di appDataFolder
  const qUrl =
    "https://www.googleapis.com/drive/v3/files" +
    `?q=${encodeURIComponent(`name='${fileName}' and 'appDataFolder' in parents`)}` +
    "&spaces=appDataFolder&fields=files(id,name)";

  const q = await fetch(qUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (q.status === 401) return forceLogout();
  const qr = await q.json();
  const fileId = qr?.files?.[0]?.id || null;

  if (action === "push") {
    const data = { history: readHistory() };
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });

    if (fileId) {
      // update (media)
      const up = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: blob,
      });
      if (up.status === 401) return forceLogout();
      if (!up.ok) console.warn("Push update failed", up.status);
    } else {
      // create (multipart)
      const metadata = { name: fileName, parents: ["appDataFolder"] };
      const form = new FormData();
      form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
      form.append("file", blob);

      const cr = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (cr.status === 401) return forceLogout();
      if (!cr.ok) console.warn("Push create failed", cr.status);
    }
  } else {
    // pull
    if (!fileId) return; // belum ada
    const dl = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (dl.status === 401) return forceLogout();

    // file content JSON
    const cloud = await dl.json().catch(() => null);
    if (cloud?.history) writeHistory(cloud.history);
  }
}

function forceLogout() {
  localStorage.removeItem(LS_TOKEN);
  window.location.href = "/login";
}

// --- UI HELPERS ---
function qs(sel, root=document){ return root.querySelector(sel); }
function qsa(sel, root=document){ return [...root.querySelectorAll(sel)]; }

function escapeHtml(s="") {
  return String(s).replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function timeAgoLabel(releasedOn="") {
  return releasedOn || "";
}

// Navbar active highlight (optional)
function setActiveNav(id) {
  const el = document.getElementById(id);
  if (!el) return;
  qsa(".nav a").forEach(a => a.classList.remove("active"));
  el.classList.add("active");
}

// Auto guard
checkAuth();
