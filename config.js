// config.js
const API_BASE = "https://donghua-tt55.vercel.app"; 
const API_SCHED = "https://www.sankavollerei.com";
const CLIENT_ID = "879575887567-dpebn221ucih4hs73lu8mbbl528lb89o.apps.googleusercontent.com"; 

function checkAuth() {
    const path = window.location.pathname;
    const isLoginPage = path.includes('login'); 
    const token = localStorage.getItem('gToken');

    if (!token && !isLoginPage) {
        window.location.href = '/login'; 
    } else if (token && isLoginPage) {
        window.location.href = '/';
    }
}

function initGoogle() {
    const script = document.createElement('script');
    script.src = "https://accounts.google.com/gsi/client";
    script.onload = () => {
        google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/drive.appdata',
            callback: (response) => {
                if (response.access_token) {
                    localStorage.setItem('gToken', response.access_token);
                    syncCloud('pull').then(() => window.location.href = '/');
                }
            },
        }).requestAccessToken();
    };
    document.head.appendChild(script);
}

async function syncCloud(action = 'push') {
    const token = localStorage.getItem('gToken');
    if (!token) return;
    const fileName = 'raystream_v12.json';
    try {
        const q = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and 'appDataFolder' in parents&spaces=appDataFolder`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const res = await q.json();
        const fileId = res.files && res.files.length > 0 ? res.files[0].id : null;

        if (action === 'push') {
            const data = { history: JSON.parse(localStorage.getItem('ach_hist') || '[]') };
            const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
            const metadata = { name: fileName, parents: ['appDataFolder'] };
            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', blob);

            let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
            if (fileId) {
                url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
                await fetch(url, { method: 'PATCH', headers: { 'Authorization': `Bearer ${token}` }, body: blob });
            } else {
                await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: form });
            }
        } else {
            if (fileId) {
                const dl = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const cloudData = await dl.json();
                localStorage.setItem('ach_hist', JSON.stringify(cloudData.history || []));
            }
        }
    } catch (e) {
        if(e.status === 401) { localStorage.removeItem('gToken'); window.location.href = '/login'; }
    }
}

function setActiveNav(id) {
    if(document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            document.querySelectorAll('.nav a').forEach(el => el.classList.remove('active'));
            if(document.getElementById(id)) document.getElementById(id).classList.add('active');
        });
    } else {
        document.querySelectorAll('.nav a').forEach(el => el.classList.remove('active'));
        if(document.getElementById(id)) document.getElementById(id).classList.add('active');
    }
}

checkAuth();
