// CONFIGURAÇÃO CENTRAL DO ECOSSISTEMA ELAYON
const RENDER_BASE_URL = 'https://presenca-1yuy.onrender.com';

// ESTADO GLOBAL DA SESSÃO
let estadoGlobal = {
    creditos: 100,
    provedor: 'gemini',
    apiKey: '',
    calibrado: false,
    tempoInicioDigitacao: null,
    totalTeclas: 0,
    pausasLongasEscrita: 0,
    ultimoTimestampTecla: null,
    
    // Métricas biométricas basais
    metricas: {
        silencio_voz_pct: 0,
        hesitacao_escrita_pct: 0,
        total_intervalos: 0
    }
};

// CONTROLE DE AUDIO (WEB AUDIO API)
let audioCtx = null;
let streamAudio = null;
let medidorIntervalo = null;

// MAPEAMENTO DOS ELEMENTOS DOM (IDs DO INDEX.HTML)
const el = {
    iaProvedor: document.getElementById('iaProvedor'),
    iaApiKey: document.getElementById('iaApiKey'),
    hudTokens: document.getElementById('hudTokens'),
    tokensGrande: document.getElementById('tokensGrande'),
    btnAbastecer: document.getElementById('btnAbastecer'),
    calibAba: document.getElementById('calibAba'),
    btnIniciarCalibracao: document.getElementById('btnIniciarCalibracao'),
    micCard: document.getElementById('micCard'),
    micEstado: document.getElementById('micEstado'),
    micTimer: document.getElementById('micTimer'),
    btnGravacaoStart: document.getElementById('btnGravacaoStart'),
    btnGravacaoStop: document.getElementById('btnGravacaoStop'),
    micBtnIniciar: document.getElementById('micBtnIniciar'),
    micBtnParar: document.getElementById('micBtnParar'),
    chatCard: document.getElementById('chatCard'),
    chatMensagens: document.getElementById('chatMensagens'),
    chatInput: document.getElementById('chatInput'),
    chatBtnEnviar: document.getElementById('chatBtnEnviar'),
    cardResultado: document.getElementById('cardResultado'),
    resCarga: document.getElementById('resCarga'),
    resTecnico: document.getElementById('resTecnico'),
    btnReiniciar: document.getElementById('btnReiniciar'),
    waveBars: document.querySelectorAll('.wave-bar')
};

// INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    carregarChaveLocal();
    configurarEventos();
});

function configurarEventos() {
    el.btnIniciarCalibracao.addEventListener('click', irCalibrar);
    el.btnGravacaoStart.addEventListener('click', micIniciar);
    el.btnGravacaoStop.addEventListener('click', micParar);
    el.chatBtnEnviar.addEventListener('click', chatEnviar);
    el.btnReiniciar.addEventListener('click', () => window.location.reload());
    el.btnAbastecer.addEventListener('click', abastecerTokensUso);
    
    // Listener dinâmico para capturar hesitação na escrita
    el.chatInput.addEventListener('keydown', capturarRitmoEscrita);
}

// PERSISTÊNCIA DA CHAVE
function carregarChaveLocal() {
    const chaveSalva = localStorage.getItem('elayon_crs_key');
    if (chaveSalva) {
        el.iaApiKey.value = chaveSalva;
        estadoGlobal.apiKey = chaveSalva;
    }
}

el.iaApiKey.addEventListener('input', () => {
    localStorage.setItem('elayon_crs_key', el.iaApiKey.value);
    estadoGlobal.apiKey = el.iaApiKey.value;
});

// FLUXO DE CRÉDITOS
function abastecerTokensUso() {
    estadoGlobal.creditos += 50;
    el.hudTokens.textContent = estadoGlobal.creditos;
    el.tokensGrande.textContent = estadoGlobal.creditos;
}

// FASE 1 & 2: TRANSIÇÃO PARA MICROFONE
function irCalibrar() {
    if (!el.iaApiKey.value.trim()) {
        alert('Por favor, insira sua chave de API externa para ligar o motor.');
        return;
    }
    el.calibAba.classList.add('hidden');
    el.micCard.classList.remove('hidden');
}

// FASE 3: DETECÇÃO BIOMÉTRICA DE VOZ (SILÊNCIO)
async function micIniciar() {
    try {
        streamAudio = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtx.createMediaStreamSource(streamAudio);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        el.micBtnIniciar.classList.add('hidden');
        el.micBtnParar.classList.remove('hidden');
        document.getElementById('waveBox').querySelectorAll('.wave-bar').forEach(b => b.classList.add('on'));
        el.micEstado.textContent = "Analisando cadência de voz em tempo real...";
        el.micEstado.classList.add('gravando');

        let totalLeituras = 0;
        let leiturasSilencio = 0;
        let segundos = 0;

        // Cronômetro visual e amostragem de silêncio
        medidorIntervalo = setInterval(() => {
            segundos++;
            el.micTimer.textContent = `00:${segundos < 10 ? '0' : ''}${segundos}`;
            
            analyser.getByteFrequencyData(dataArray);
            let somaVolume = 0;
            for (let i = 0; i < bufferLength; i++) {
                somaVolume += dataArray[i];
            }
            let mediaVolume = somaVolume / bufferLength;
            
            totalLeituras++;
            // Threshold adaptativo de silêncio Elayon
            if (mediaVolume < 12) {
                leiturasSilencio++;
            }

            // Força encerramento com 6 segundos de amostra padrão
            if (segundos >= 6) {
                estadoGlobal.metricas.silencio_voz_pct = Math.round((leiturasSilencio / totalLeituras) * 100);
                micParar();
            }
        }, 1000);

    } catch (err) {
        alert('Erro ao acessar o microfone: ' + err.message);
    }
}

function micParar() {
    clearInterval(medidorIntervalo);
    if (streamAudio) {
        streamAudio.getTracks().forEach(track => track.stop());
    }
    if (audioCtx) {
        audioCtx.close();
    }
    
    document.getElementById('waveBox').querySelectorAll('.wave-bar').forEach(b => b.classList.remove('on'));
    el.micCard.classList.add('hidden');
    el.chatCard.classList.remove('hidden');
    
    estadoGlobal.calibrado = true;
    estadoGlobal.tempoInicioDigitacao = Date.now();
}

// CAPTURA DE HESITAÇÃO DE ESCRITA (CADÊNCIA COGNITIVA)
function capturarRitmoEscrita(e) {
    const agora = Date.now();
    estadoGlobal.totalTeclas++;
    
    if (estadoGlobal.ultimoTimestampTecla) {
        const intervalo = agora - estadoGlobal.ultimoTimestampTecla;
        // Se o usuário demorar mais de 1.2 segundos entre uma tecla e outra, registra hesitação
        if (intervalo > 1200) {
            estadoGlobal.pausasLongasEscrita++;
        }
    }
    estadoGlobal.ultimoTimestampTecla = agora;
}

// ENVIO COMPLETO PARA O MOTOR NO RENDER
async function chatEnviar() {
    const mensagem = el.chatInput.value.trim();
    if (!mensagem) return;

    if (estadoGlobal.creditos < 1) {
        alert('Créditos operacionais insuficientes.');
        return;
    }

    // Renderiza mensagem do usuário na UI
    renderizarMensagem(mensagem, 'user');
    el.chatInput.value = '';

    // Consolida métricas de hesitação de escrita
    const tempoTotalEscrita = (Date.now() - estadoGlobal.tempoInicioDigitacao) / 1000;
    estadoGlobal.metricas.hesitacao_escrita_pct = Math.min(
        Math.round((estadoGlobal.pausasLongasEscrita / (estadoGlobal.totalTeclas || 1)) * 100), 100
    );
    estadoGlobal.metricas.total_intervalos = estadoGlobal.totalTeclas;

    // Payload estruturado idêntico ao esperado pelo FastAPI em Pydantic
    const payload = {
        mensagem_usuario: mensagem,
        provedor: el.iaProvedor.value,
        api_key_externa: estadoGlobal.apiKey,
        metricas_sinal: {
            silencio_voz_pct: estadoGlobal.metricas.silencio_voz_pct,
            hesitacao_escrita_pct: estadoGlobal.metricas.hesitacao_escrita_pct,
            total_intervalos: estadoGlobal.metricas.total_intervalos
        }
    };

    try {
        renderizarMensagem('Processando métricas e consultando núcleo...', 'ai', true);

        const response = await fetch(`${RENDER_BASE_URL}/api/crs/processar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const erroData = await response.json();
            throw new Error(erroData.detail || 'Falha na resposta do motor.');
        }

        const data = await response.json();
        
        // Remove balão de "carregando" e coloca a resposta real
        removerLoading();
        renderizarMensagem(data.resposta_ia, 'ai');

        // Atualiza HUD de Créditos Margem
        estadoGlobal.creditos -= 1;
        el.hudTokens.textContent = estadoGlobal.creditos;
        el.tokensGrande.textContent = estadoGlobal.creditos;

        // Exibe Relatório de Entrega
        el.cardResultado.classList.remove('hidden');
        el.resCarga.textContent = data.carga_cognitiva;
        el.resTecnico.textContent = JSON.stringify({
            "Silêncio Basal": `${payload.metricas_sinal.silencio_voz_pct}%`,
            "Hesitação Cognitiva": `${payload.metricas_sinal.hesitacao_escrita_pct}%`,
            "Teclas Detectadas": payload.metricas_sinal.total_intervalos,
            "Custo Margem Fixo": "1 Crédito Elayon",
            "Status da Transação": "Sucesso"
        }, null, 2);

    } catch (err) {
        removerLoading();
        renderizarMensagem(`Erro no Motor CRS: ${err.message}`, 'ai');
    }
}

// AUXILIARES DE RENDERIZAÇÃO DO CHAT
function renderizarMensagem(texto, autor, isLoading = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg chat-${autor}`;
    if (isLoading) msgDiv.id = 'loadingBubble';

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.textContent = texto;

    const meta = document.createElement('div');
    meta.className = 'chat-meta';
    meta.textContent = autor === 'user' ? 'Você (Sinal Ativo)' : 'Elayon CRS';

    msgDiv.appendChild(bubble);
    msgDiv.appendChild(meta);
    el.chatMensagens.appendChild(msgDiv);
    el.chatMensagens.scrollTop = el.chatMensagens.scrollHeight;
}

function removerLoading() {
    const loading = document.getElementById('loadingBubble');
    if (loading) loading.remove();
}
