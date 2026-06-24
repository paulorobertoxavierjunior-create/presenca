// ==========================================
// ELAYON PRESENÇA V3.0 - MOTOR DE FLUXO EXCLUSIVO
// ==========================================
const RENDER_BASE_URL = 'https://crs-full3.onrender.com';

// Estado operacional local
let crsEstado = {
    tokens: 100,
    apiKeyExterna: '',
    provedorIa: 'gemini',
    // Métricas de calibração / áudio
    audioInicio: 0,
    audioSilencioEstimadoPct: 24, // Métrica base calculada na leitura
    // Sensores de escrita (Teclado)
    ultimoDigitoTs: 0,
    intervalosEscrita: [],
    pausasLongas: 0
};

// Carrega dados salvos ao abrir a página
document.addEventListener('DOMContentLoaded', () => {
    const chaveSalva = localStorage.getItem('elayon_api_key');
    if (chaveSalva) {
        document.getElementById('iaApiKey').value = chaveSalva;
        crsEstado.apiKeyExterna = chaveSalva;
    }
    const provedorSalvo = localStorage.getItem('elayon_provedor');
    if (provedorSalvo) {
        document.getElementById('iaProvedor').value = provedorSalvo;
        crsEstado.provedorIa = provedorSalvo;
    }
    atualizarPainelRecursos();
});

function salvarChaveLocal() {
    const chave = document.getElementById('iaApiKey').value.trim();
    const provedor = document.getElementById('iaProvedor').value;
    crsEstado.apiKeyExterna = chave;
    crsEstado.provedorIa = provedor;
    localStorage.setItem('elayon_api_key', chave);
    localStorage.setItem('elayon_provedor', provedor);
}

function abastecerTokensUso() {
    crsEstado.tokens += 50;
    atualizarPainelRecursos();
}

function atualizarPainelRecursos() {
    document.getElementById('hudTokens').textContent = crsEstado.tokens;
    document.getElementById('tokensGrande').textContent = crsEstado.tokens;
}

// ORIENTAÇÃO DA CALIBRAÇÃO (FASE 1 e 2)
function irCalibrar() {
    // Transiciona para a Fase 3 abrindo o Microfone de Responsabilidade
    document.getElementById('calibAba').classList.add('hidden');
    document.getElementById('micCard').classList.remove('hidden');
    document.getElementById('micEstado').textContent = "Pronto para ler a responsabilidade assumida.";
}

// CONTROLADORES DO MICROFONE (FASE 3)
function micIniciar() {
    crsEstado.audioInicio = Date.now();
    document.getElementById('micEstado').textContent = "GRAVANDO SINAL DE VOZ...";
    document.getElementById('micEstado').className = "mic-estado gravando";
    document.getElementById('micBtnIniciar').classList.add('hidden');
    document.getElementById('micBtnParar').classList.remove('hidden');
    
    // Ativa animação visual das barras
    document.querySelectorAll('.wave-bar').forEach(b => b.classList.add('on'));
    document.getElementById('micTimer').textContent = "00:05"; // Simulação curta para teste prático
}

function micParar() {
    const duracaoSessao = Date.now() - crsEstado.audioInicio;
    
    // Gera variação rítmica simulada baseada no tempo de fala (métrica simulada para o teste)
    crsEstado.audioSilencioEstimadoPct = duracaoSessao > 6000 ? 32 : 18;

    document.getElementById('micEstado').textContent = "Responsabilidade Assumida e Gravada.";
    document.getElementById('micEstado').className = "mic-estado";
    document.getElementById('micBtnParar').classList.add('hidden');
    document.getElementById('micBtnIniciar').classList.remove('hidden');
    document.querySelectorAll('.wave-bar').forEach(b => b.classList.remove('on'));
    document.getElementById('micTimer').textContent = "00:00";

    // Libera a próxima etapa imediatamente: A escrita curta no Chat
    document.getElementById('chatCard').classList.remove('hidden');
    exibirMensagemSistemaChat("🎙️ Presença de voz validada. Agora, digite um texto curto de resposta no campo abaixo para cruzar os dados rítmicos.");
    
    // Ativa o monitoramento do teclado para pegar a segunda métrica
    ativarSensoresTeclado();
}

// ==========================================
// ELAYON PRESENÇA V3.0 - MOTOR DE FLUXO EXCLUSIVO
// ==========================================
const RENDER_BASE_URL = 'https://crs-full3.onrender.com';

// Estado operacional local
let crsEstado = {
    tokens: 100,
    apiKeyExterna: '',
    provedorIa: 'gemini',
    // Métricas de calibração / áudio
    audioInicio: 0,
    audioSilencioEstimadoPct: 24, // Métrica base calculada na leitura
    // Sensores de escrita (Teclado)
    ultimoDigitoTs: 0,
    intervalosEscrita: [],
    pausasLongas: 0
};

// Carrega dados salvos ao abrir a página
document.addEventListener('DOMContentLoaded', () => {
    const chaveSalva = localStorage.getItem('elayon_api_key');
    if (chaveSalva) {
        document.getElementById('iaApiKey').value = chaveSalva;
        crsEstado.apiKeyExterna = chaveSalva;
    }
    const provedorSalvo = localStorage.getItem('elayon_provedor');
    if (provedorSalvo) {
        document.getElementById('iaProvedor').value = provedorSalvo;
        crsEstado.provedorIa = provedorSalvo;
    }
    atualizarPainelRecursos();
});

function salvarChaveLocal() {
    const chave = document.getElementById('iaApiKey').value.trim();
    const provedor = document.getElementById('iaProvedor').value;
    crsEstado.apiKeyExterna = chave;
    crsEstado.provedorIa = provedor;
    localStorage.setItem('elayon_api_key', chave);
    localStorage.setItem('elayon_provedor', provedor);
}

function abastecerTokensUso() {
    crsEstado.tokens += 50;
    atualizarPainelRecursos();
}

function atualizarPainelRecursos() {
    document.getElementById('hudTokens').textContent = crsEstado.tokens;
    document.getElementById('tokensGrande').textContent = crsEstado.tokens;
}

// ORIENTAÇÃO DA CALIBRAÇÃO (FASE 1 e 2)
function irCalibrar() {
    // Transiciona para a Fase 3 abrindo o Microfone de Responsabilidade
    document.getElementById('calibAba').classList.add('hidden');
    document.getElementById('micCard').classList.remove('hidden');
    document.getElementById('micEstado').textContent = "Pronto para ler a responsabilidade assumida.";
}

// CONTROLADORES DO MICROFONE (FASE 3)
function micIniciar() {
    crsEstado.audioInicio = Date.now();
    document.getElementById('micEstado').textContent = "GRAVANDO SINAL DE VOZ...";
    document.getElementById('micEstado').className = "mic-estado gravando";
    document.getElementById('micBtnIniciar').classList.add('hidden');
    document.getElementById('micBtnParar').classList.remove('hidden');
    
    // Ativa animação visual das barras
    document.querySelectorAll('.wave-bar').forEach(b => b.classList.add('on'));
    document.getElementById('micTimer').textContent = "00:05"; // Simulação curta para teste prático
}

function micParar() {
    const duracaoSessao = Date.now() - crsEstado.audioInicio;
    
    // Gera variação rítmica simulada baseada no tempo de fala (métrica simulada para o teste)
    crsEstado.audioSilencioEstimadoPct = duracaoSessao > 6000 ? 32 : 18;

    document.getElementById('micEstado').textContent = "Responsabilidade Assumida e Gravada.";
    document.getElementById('micEstado').className = "mic-estado";
    document.getElementById('micBtnParar').classList.add('hidden');
    document.getElementById('micBtnIniciar').classList.remove('hidden');
    document.querySelectorAll('.wave-bar').forEach(b => b.classList.remove('on'));
    document.getElementById('micTimer').textContent = "00:00";

    // Libera a próxima etapa imediatamente: A escrita curta no Chat
    document.getElementById('chatCard').classList.remove('hidden');
    exibirMensagemSistemaChat("🎙️ Presença de voz validada. Agora, digite um texto curto de resposta no campo abaixo para cruzar os dados rítmicos.");
    
    // Ativa o monitoramento do teclado para pegar a segunda métrica
    ativarSensoresTeclado();
}
