// ==========================================
// 1. CONFIGURAÇÃO SUPABASE
// ==========================================
const supabaseUrl = 'https://ujgeheiyoulouzcvztrp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqZ2VoZWl5b3Vsb3V6Y3Z6dHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NDI4MzAsImV4cCI6MjA5NTMxODgzMH0.g2tvHjJjww2ZqxpMxUUjmQD7yZ8hdQKjUHK-p06BSaI';

const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// ==========================================
// 2. VARIÁVEIS GLOBAIS
// ==========================================
let userName = "";
let userId = ""; 
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

let trackerChannel = null;
let otherMarkers = {}; 

const carIcon = L.icon({
    iconUrl: 'https://i.ibb.co/HD8N3Mgq/rangerprata-lateral.png',
    iconSize: [50, 50],
    iconAnchor: [25, 25]
});

// ==========================================
// 3. INICIALIZAÇÃO E EVENTOS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const splashScreen = document.getElementById('splashScreen');
    const loginOverlay = document.getElementById('loginOverlay');
    
    // Animação de Splash Screen
    setTimeout(() => {
        splashScreen.style.opacity = '0';
        setTimeout(() => {
            splashScreen.style.display = 'none';
            loginOverlay.classList.add('visible');
        }, 500); 
    }, 2000);

    // ==========================================
    // 3.1. LÓGICA DE ALTERNÂNCIA (LOGIN / CADASTRO)
    // ==========================================
    const loginSection = document.getElementById('loginSection');
    const registerSection = document.getElementById('registerSection');

    document.getElementById('showRegisterBtn').addEventListener('click', (e) => {
        e.preventDefault();
        loginSection.style.display = 'none';
        registerSection.style.display = 'block';
    });

    document.getElementById('showLoginBtn').addEventListener('click', (e) => {
        e.preventDefault();
        registerSection.style.display = 'none';
        loginSection.style.display = 'block';
    });

    // ==========================================
    // 3.2. LÓGICA DO "OLHINHO" DA SENHA
    // ==========================================
    function setupPasswordToggle(inputId, iconId) {
        const input = document.getElementById(inputId);
        const icon = document.getElementById(iconId);
        if(!input || !icon) return;

        icon.addEventListener('click', () => {
            if (input.type === 'password') {
                input.type = 'text';
                icon.innerText = '🙈';
            } else {
                input.type = 'password';
                icon.innerText = '👁️';
            }
        });
    }

    setupPasswordToggle('loginPass', 'toggleLoginPass');
    setupPasswordToggle('regPass', 'toggleRegPass');
    setupPasswordToggle('regPassConfirm', 'toggleRegPassConfirm');

    // ==========================================
    // 3.3. LÓGICA DA FORÇA DA SENHA
    // ==========================================
    const regPass = document.getElementById('regPass');
    const strengthLabel = document.getElementById('strengthLabel');
    const strengthProgress = document.getElementById('strengthProgress');

    regPass.addEventListener('input', () => {
        const val = regPass.value;
        let forceLevel = 0;

        if (val.length >= 4) forceLevel = 1; 
        if (val.length >= 8) forceLevel = 2; 
        if (val.length >= 8 && /[!@#$%^&*(),.?":{}|<>]/.test(val)) forceLevel = 3; 

        if (val.length < 4) {
            strengthLabel.innerText = 'Muito curta (Mín. 4)';
            strengthLabel.style.color = '#ff3333';
            strengthProgress.style.width = '20%';
            strengthProgress.style.backgroundColor = '#ff3333';
        } else if (forceLevel === 1) {
            strengthLabel.innerText = 'Fraca';
            strengthLabel.style.color = '#ff8800'; 
            strengthProgress.style.width = '40%';
            strengthProgress.style.backgroundColor = '#ff8800';
        } else if (forceLevel === 2) {
            strengthLabel.innerText = 'Média';
            strengthLabel.style.color = '#ffcc00'; 
            strengthProgress.style.width = '70%';
            strengthProgress.style.backgroundColor = '#ffcc00';
        } else if (forceLevel === 3) {
            strengthLabel.innerText = 'Forte';
            strengthLabel.style.color = '#33cc33'; 
            strengthProgress.style.width = '100%';
            strengthProgress.style.backgroundColor = '#33cc33';
        }
    });

    // ==========================================
    // 3.4. LÓGICA DE CADASTRO NO SUPABASE
    // ==========================================
    const registerForm = document.getElementById('registerForm');
    const registerBtn = document.getElementById('registerBtn');

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const nome = document.getElementById('regNome').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const telefone = document.getElementById('regTelefone').value.trim();
        const senha = document.getElementById('regPass').value;
        const senhaConfirma = document.getElementById('regPassConfirm').value;

        if (senha.length < 4) {
            alert("A senha deve ter no mínimo 4 caracteres.");
            return;
        }

        if (senha !== senhaConfirma) {
            alert("As senhas digitadas não coincidem!");
            return;
        }

        registerBtn.innerText = 'Aguarde...';
        registerBtn.disabled = true;

        try {
            const { data, error } = await supabaseClient.auth.signUp({
                email: email,
                password: senha,
                options: {
                    data: {
                        nome_completo: nome,
                        telefone: telefone
                    }
                }
            });

            if (error) throw error;

            alert("Cadastro realizado com sucesso! Faça login para continuar.");
            registerForm.reset();
            strengthProgress.style.width = '0%';
            document.getElementById('showLoginBtn').click();

        } catch (err) {
            console.error("Erro no cadastro:", err);
            alert("Erro ao criar conta: " + err.message);
        } finally {
            registerBtn.innerText = 'Finalizar Cadastro';
            registerBtn.disabled = false;
        }
    });

    // ==========================================
    // 3.5. LÓGICA DE LOGIN NO SUPABASE
    // ==========================================
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const loginError = document.getElementById('loginError');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if(loginError) loginError.style.display = 'none';
        loginBtn.innerText = 'Autenticando...';
        loginBtn.disabled = true;

        const email = document.getElementById('loginUser').value.trim();
        const pass = document.getElementById('loginPass').value.trim();

        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: pass,
            });

            if (error) throw error; 

            userName = data.user.email.split('@')[0];
            userId = data.user.id; 
            
            document.getElementById('loginOverlay').style.display = 'none';
            document.getElementById('map').style.display = 'block';
            document.getElementById('status').style.display = 'block';
            document.getElementById('routeControl').style.display = 'block';
            document.getElementById('onlineToggle').style.display = 'block';
            document.getElementById('openMenuBtn').style.display = 'block'; 
            
            document.getElementById('status').innerText = 'Offline 🔴';

            initMap();

        } catch (err) {
            console.error("Erro no Supabase:", err);
            if(loginError) {
                loginError.innerText = "Falha no login: " + err.message;
                loginError.style.display = 'block';
            } else {
                alert("Falha no login: " + err.message);
            }
        } finally {
            loginBtn.innerText = 'Entrar';
            loginBtn.disabled = false;
        }
    });

    // ==========================================
    // CONTROLES DO MAPA, ROTA E SIDEBAR
    // ==========================================
    document.getElementById('onlineToggle').addEventListener('click', toggleOnlineStatus);
    document.getElementById('mainButton').addEventListener('click', handleRouteControl);
    document.getElementById('endButton').addEventListener('click', endRoute);

    const sidebar = document.getElementById('sidebar');
    const openMenuBtn = document.getElementById('openMenuBtn');
    const closeSidebarBtn = document.getElementById('closeSidebarBtn');

    openMenuBtn.addEventListener('click', () => {
        sidebar.classList.add('open');
        carregarHistoricoReplays(); 
    });

    closeSidebarBtn.addEventListener('click', () => {
        sidebar.classList.remove('open');
    });
});

async function carregarHistoricoReplays() {
    const listaRotas = document.getElementById('listaRotas');
    listaRotas.innerHTML = '<p style="color: #666; font-size: 13px;">Carregando histórico do servidor...</p>';

    try {
        const { data, error } = await supabaseClient
            .from('historico_rotas') 
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10); 

        if (error) throw error;

        if (data && data.length > 0) {
            listaRotas.innerHTML = ''; 
            
            data.forEach(rota => {
                const card = document.createElement('div');
                card.className = 'rota-card';
                let dataFormatada = new Date(rota.created_at).toLocaleDateString('pt-BR');
                
                card.innerHTML = `
                    <h4>Rota: ${dataFormatada}</h4>
                    <p>ID: ${rota.id}</p>
                `;
                
                card.addEventListener('click', () => {
                    alert(`Iniciando replay da rota ${rota.id} no mapa...`);
                    document.getElementById('sidebar').classList.remove('open');
                });
                
                listaRotas.appendChild(card);
            });
        } else {
            listaRotas.innerHTML = '<p style="color: #666; font-size: 13px;">Nenhum replay encontrado.</p>';
        }
    } catch (err) {
        console.error("Erro ao buscar replays:", err);
        listaRotas.innerHTML = '<p style="color: #ff3333; font-size: 13px;">Erro ao carregar o histórico.</p>';
    }
}

// ==========================================
// 4. LÓGICA DO MAPA E ROTAS
// ==========================================
function initMap() {
    map = L.map('map', {
        zoomControl: false,
        attributionControl: false
    }).setView([0, 0], 2);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

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

                configurarModoMultijogador();
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

    enviarMinhaLocalizacao();
}

function updateMarker() {
    if (currentMarker) map.removeLayer(currentMarker);
    currentMarker = L.marker([currentLat, currentLng], { icon: carIcon })
        .addTo(map)
        .bindPopup(`<b>${userName} (Você)</b><small>Tx Produções</small>`);
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
    enviarMinhaLocalizacao();
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

function startTimer() {
    if (timerInterval) return; 
    timerInterval = setInterval(() => {
        totalSeconds++;
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        document.getElementById('timerDisplay').innerText = 
            (h > 0 ? h + ':' : '') + 
            (m < 10 && h > 0 ? '0' : '') + m + ':' + 
            (s < 10 ? '0' : '') + s;
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

// ==========================================
// 6. MOTOR DO GPS EM TEMPO REAL (FROTA)
// ==========================================
function configurarModoMultijogador() {
    if (!userId) return;

    trackerChannel = supabaseClient.channel('equipe-tx-gps', {
        config: { presence: { key: userId } }, 
    });

    trackerChannel.on('presence', { event: 'sync' }, () => {
        const estadoGeral = trackerChannel.presenceState();
        renderizarOutrosUsuarios(estadoGeral);
    }).subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
            enviarMinhaLocalizacao(); 
        }
    });
}

function enviarMinhaLocalizacao() {
    if (trackerChannel && isOnline && currentLat && currentLng) {
        trackerChannel.track({
            user_name: userName,
            lat: currentLat,
            lng: currentLng
        });
    } else if (trackerChannel && !isOnline) {
        trackerChannel.untrack(); 
    }
}

function renderizarOutrosUsuarios(estadoGeral) {
    const idsOnlineAgora = Object.keys(estadoGeral);

    for (let id in otherMarkers) {
        if (!idsOnlineAgora.includes(id) || id === userId) {
            map.removeLayer(otherMarkers[id]);
            delete otherMarkers[id];
        }
    }

    for (let id in estadoGeral) {
        if (id === userId) continue; 

        const dadosDoColega = estadoGeral[id][0]; 
        if (!dadosDoColega || !dadosDoColega.lat || !dadosDoColega.lng) continue;

        if (otherMarkers[id]) {
            otherMarkers[id].setLatLng([dadosDoColega.lat, dadosDoColega.lng]);
        } else {
            const colegaIcon = L.icon({
                iconUrl: 'https://i.ibb.co/HD8N3Mgq/rangerprata-lateral.png',
                iconSize: [50, 50],
                iconAnchor: [25, 25]
            });
            const marcador = L.marker([dadosDoColega.lat, dadosDoColega.lng], { icon: colegaIcon })
                .addTo(map)
                .bindPopup(`<b>${dadosDoColega.user_name}</b><small>Equipe TX (Online)</small>`);
            otherMarkers[id] = marcador;
        }
    }
}