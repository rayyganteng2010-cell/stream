// config.js - RAYSTREAM V12
const API_BASE = "https://anichin-seven.vercel.app";
const CLIENT_ID = "879575887567-dpebn221ucih4hs73lu8mbbl528lb89o.apps.googleusercontent.com"; 

const REQ_OPTIONS = {
    method: 'GET',
    headers: {
        'Accept': 'application/json',
        // Jangan pakai User-Agent aneh-aneh di browser, nanti diblokir CORS
    }
};

async function fetchAPI(endpoint) {
    try {
        const url = endpoint.startsWith('http') ? endpoint : API_BASE + endpoint;
        const res = await fetch(url, REQ_OPTIONS);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (e) {
        console.error("API Error:", e);
        return null;
    }
}

function checkAuth() {
    const path = window.location.pathname;
    const token = localStorage.getItem('gToken');
    // Simple logic: Kalau gak ada token & bukan di login -> lempar ke login
    if (!token && !path.includes('login')) window.location.href = 'login.html';
    if (token && path.includes('login')) window.location.href = 'index.html';
}

function initGoogle() {
    const script = document.createElement('script');
    script.src = "https://accounts.google.com/gsi/client";
    script.onload = () => {
        const client = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/drive.appdata',
            callback: (resp) => {
                if (resp.access_token) {
                    localStorage.setItem('gToken', resp.access_token);
                    window.location.href = 'index.html';
                }
            },
        });
        document.getElementById('gLoginBtn').onclick = () => client.requestAccessToken();
    };
    document.head.appendChild(script);
}

// Format Angka Episode (misal: "Soul Land Episode 250" -> "250")
function formatEp(str) {
    if(!str) return '??';
    const match = str.match(/Episode\s+(\d+)/i);
    return match ? match[1] : 'Ep';
}

function setActiveNav(id) {
    setTimeout(() => {
        document.querySelectorAll('.nav a').forEach(e => e.classList.remove('active'));
        if(document.getElementById(id)) document.getElementById(id).classList.add('active');
    }, 50);
}

checkAuth();
