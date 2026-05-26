// ==========================================
// 1. CONFIGURAÇÃO SUPABASE (COLE SUAS CHAVES AQUI)
// ==========================================
const supabaseUrl = 'https://ujgeheiyoulouzcvztrp.supabase.co/rest/v1/';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqZ2VoZWl5b3Vsb3V6Y3Z6dHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NDI4MzAsImV4cCI6MjA5NTMxODgzMH0.g2tvHjJjww2ZqxpMxUUjmQD7yZ8hdQKjUHK-p06BSaI';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// ==========================================
// 2. VARIÁVEIS GLOBAIS
// ==========================================
let userName = "";
let map, currentMarker, currentLat, currentLng;
let isRecording = false;
let isPaused = false;
let routePoints = []; 
let routeLine = null; 
let allRouteLines = []; 
let isOnline = false;
let watchId = null;
let timerInterval = null;
let totalSeconds = 0;

const carIcon = L.icon({
    iconUrl: 'https://i.ibb.co/HD8N3Mgq/rangerprata-lateral.png',
    iconSize: [50, 50],
    iconAnchor: [25, 25]
});

// ==========================================
// 3. INICIALIZAÇÃO E EVENTOS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // --- Lógica da Splash Screen ---
    const splashScreen = document.getElementById('splashScreen');
    const loginOverlay = document.getElementById('loginOverlay');
    
    setTimeout(() => {
        splashScreen.style.opacity = '0';
        setTimeout(() => {
            splashScreen.style.display = 'none';
            loginOverlay.classList.add('visible');
        }, 500); 
    }, 2000);

    // --- Lógica de Login ---
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const loginError = document.getElementById('loginError');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Evita que a página recarregue

        // Feedback visual
        loginError.style.display = 'none';
        loginBtn.innerText = 'Autenticando...';
        loginBtn.disabled = true;

        const email = document.getElementById('loginUser').value.trim();
        const pass = document.getElementById('loginPass').value.trim();

        try {
            // Tenta logar no Supabase
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: pass,
            });

            if (error) throw error; // Se der erro, joga para o 'catch' abaixo

            // Se o login for um sucesso:
            userName = data.user.email.split('@')[0];
            
            // Troca de telas
            document.getElementById('loginOverlay').style.display = 'none';
            document.getElementById('map').style.display = 'block';
            document.getElementById('status').style.display = 'block';
            document.getElementById('routeControl').style.display = 'block';
            document.getElementById('onlineToggle').style.display = 'block';
            
            document.getElementById('status').innerText = 'Offline 🔴';

            // Inicia o mapa
            initMap();

        } catch (err) {
            // Se falhar, exibe o erro na tela para o usuário ver
            console.error("Erro no Supabase:", err);
            loginError.innerText = "Falha no login: " + err.message;
            loginError.style.display = 'block';
        } finally {
            // Restaura o botão
            loginBtn.innerText = 'Entrar';
            loginBtn.disabled = false;
        }
    });

    // --- Vinculando os botões de controle de rota ---
    document.getElementById('onlineToggle').addEventListener('click', toggleOnlineStatus);
    document.getElementById('mainButton').addEventListener('click', handleRouteControl);
    document.getElementById('endButton').addEventListener('click', endRoute);
});

// ==========================================
// 4. LÓGICA DO MAPA E ROTAS
// ==========================================
function initMap() {
    map = L.map('map').setView([0, 0], 2);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    window.addEventListener('resize', () => { map.invalidateSize(); });

    const options = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                currentLat = position.coords.latitude;
                currentLng = position.coords.longitude;
                map.setView([currentLat, currentLng], 15);
                updateMarker();
                isOnline = true; 
                updateStatusDisplay();
            },
            handleLocationError,
            options
        );

        watchId = navigator.geolocation.watchPosition(updateLocation, handleLocationError, options);
    } else {
        document.getElementById('status').innerText = 'GPS não suportado.';
        isOnline = false;
        updateStatusDisplay();
    }
}

function updateLocation(position) {
    if (!isOnline) return;
    currentLat = position.coords.latitude;
    currentLng = position.coords.longitude;
    map.setView([currentLat, currentLng], map.getZoom());
    updateMarker();

    if (isRecording && !isPaused) {
        routePoints.push([currentLat, currentLng]);
        updateRouteLine();
    }
}

function updateMarker() {
    if (currentMarker) map.removeLayer(currentMarker);
    currentMarker = L.marker([currentLat, currentLng], { icon: carIcon })
        .addTo(map)
        .bindPopup(`<b>${userName}</b><small>Tx Produções</small>`);
}

function handleLocationError(error) {
    alert("Erro de GPS. Verifique suas permissões.");
    isOnline = false;
    updateStatusDisplay();
}

function updateStatusDisplay() {
    const statusDiv = document.getElementById('status');
    if (isRecording) {
        statusDiv.innerText = 'Em rota 🟡';
    } else if (isOnline) {
        statusDiv.innerText = 'Online 🟢';
    } else {
        statusDiv.innerText = 'Offline 🔴';
    }
}

function toggleOnlineStatus() {
    if (isRecording) {
        alert("Não é possível ficar offline durante uma rota.");
        return;
    }
    isOnline = !isOnline;
    updateStatusDisplay();
}

function handleRouteControl() {
    const button = document.getElementById('mainButton');
    
    if (!isRecording) {
        if (!isOnline) {
            alert("Fique 'Online 🟢' primeiro.");
            return;
        }
        isRecording = true;
        isPaused = false;
        routePoints = [[currentLat, currentLng]]; 
        updateRouteLine();
        button.innerText = 'Pausar';
        updateStatusDisplay();
        
        document.getElementById('timerDisplay').style.display = 'block';
        document.getElementById('timerDisplay').innerText = '0'; 
        startTimer();

    } else if (!isPaused) {
        isPaused = true;
        button.innerText = 'Continuar';
        document.getElementById('endButton').style.display = 'inline-block';
        pauseTimer();
        if (routeLine) allRouteLines.push(routeLine);
        routePoints = [];
        routeLine = null;
    } else {
        isPaused = false;
        button.innerText = 'Pausar';
        document.getElementById('endButton').style.display = 'none';
        startTimer();
        routePoints = [[currentLat, currentLng]];
    }
}

function endRoute() {
    isRecording = false;
    isPaused = false;
    routePoints = [];

    if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
    allRouteLines.forEach(line => map.removeLayer(line));
    allRouteLines = []; 

    document.getElementById('mainButton').innerText = 'Iniciar';
    document.getElementById('endButton').style.display = 'none';

    updateStatusDisplay();
    resetTimer();
    alert('🎉 Rota concluída com sucesso!');
}

function updateRouteLine() {
    if (routeLine) map.removeLayer(routeLine);
    if (routePoints.length > 1) {
        routeLine = L.polyline(routePoints, { color: 'orange', weight: 5 }).addTo(map);
    }
}

// ==========================================
// 5. CRONÔMETRO
// ==========================================
function startTimer() {
    if (timerInterval) return; 
    timerInterval = setInterval(() => {
        totalSeconds++;
        document.getElementById('timerDisplay').innerText = formatTime(totalSeconds);
    }, 1000);
}

function pauseTimer() {
    clearInterval(timerInterval);
    timerInterval = null; 
}

function resetTimer() {
    pauseTimer(); 
    totalSeconds = 0;
    document.getElementById('timerDisplay').style.display = 'none'; 
}

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    else if (m > 0) return `${m}:${s < 10 ? '0' : ''}${s}`;
    else return `${s}`;
}