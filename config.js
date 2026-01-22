// config.js
const API_BASE = "https://anichin-seven.vercel.app";

// --- PASTIKAN CLIENT ID INI BENAR DARI GOOGLE CLOUD CONSOLE ---
const CLIENT_ID = "879575887567-076iou55sct92iddv4feid04dflotgc5.apps.googleusercontent.com"; 

// Fungsi Cek Login yang Lebih Aman (Support Vercel Clean URL)
function checkAuth() {
    const path = window.location.pathname;
    // Cek apakah kita sedang di halaman login (baik /login atau /login.html)
    const isLoginPage = path.includes('login'); 
    const token = localStorage.getItem('gToken');

    if (!token && !isLoginPage) {
        // Jika tidak ada token dan bukan di halaman login -> Tendang ke login
        window.location.href = '/login'; 
    } else if (token && isLoginPage) {
        // Jika ada token tapi masih di halaman login -> Tendang ke home
        window.location.href = '/';
    }
}

// Global variable untuk Google Client
let tokenClient;

function initGoogle() {
    const script = document.createElement('script');
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
        // Inisialisasi Client Google setelah script load
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/drive.appdata',
            callback: (response) => {
                if (response.access_token) {
                    localStorage.setItem('gToken', response.access_token);
                    // Coba sync, lalu pindah halaman
                    syncCloud('pull').finally(() => {
                        window.location.href = '/';
                    });
                }
            },
        });
        
        // Aktifkan tombol setelah library siap
        const btn = document.getElementById('gLoginBtn');
        if(btn) {
            btn.onclick = () => tokenClient.requestAccessToken();
            btn.innerText = "Masuk dengan Google (Siap)";
        }
    };
    document.head.appendChild(script);
}

// Fungsi Sync (Tetap Sama)
async function syncCloud(action = 'push') {
    const token = localStorage.getItem('gToken');
    if (!token) return;

    const fileName = 'raystream_data.json';
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
        console.error("Sync Error:", e);
        if(e.status === 401) {
            localStorage.removeItem('gToken');
            window.location.href = '/login';
        }
    }
}

// Helper Functions
function formatEp(title) {
    if(!title) return '';
    const match = title.match(/\d+/);
    return match ? match[0] : title.substring(0, 3);
}

function setActiveNav(id) {
    // Tunggu DOM load
    if(document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => hlNav(id));
    } else {
        hlNav(id);
    }
}

function hlNav(id) {
    const els = document.querySelectorAll('.nav a');
    els.forEach(el => el.classList.remove('active'));
    const target = document.getElementById(id);
    if(target) target.classList.add('active');
}

// Jalankan cek auth langsung
checkAuth();
