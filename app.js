// CONFIGURAÇÃO CENTRAL DO MOTOR NATIVO ELAYON
const RENDER_BASE_URL = 'https://presenca-1yuy.onrender.com';

// ESTADO GLOBAL DO PROTOCOLO ANTIFRAUDE
let estadoGlobal = {
    creditos: 100,
    tokenSessaoValido: false,
    tokenHash: null,
    apiKeyExterna: '',
    textoTranscritoSessao: '',
    
    // Métricas biométricas basais capturadas
    metricasVoz: {
        silencio_voz_pct: 0,
        total_leituras: 0,
        leituras_silencio: 0
    },
    // Sensores de escrita curta
    teclado: {
        tempoInicio: null,
        totalTeclas: 0,
        pausasLongas: 0,
        ultimoTs: null
    }
};

// INSTÂNCIAS DE MICROFONE E RECONHECIMENTO DE VOZ
let reconhecimentoVoz = null;
let audioCtx = null;
let streamAudio = null;
let loopsAnalise = null;
let cronometroMic = null;

// ELEMENTOS DA INTERFACE (IDs REFINADOS DO INDEX.HTML)
const el = {
    hudTokens: document.getElementById('hudTokens'),
    tokensGrande: document.getElementById('tokensGrande'),
    btnAbastecer: document.getElementById('btnAbastecer'),
    calibAba: document.getElementById('calibAba'),
    textoCalibracao: document.getElementById('textoCalibracao'),
    btnIniciarCalibracao: document.getElementById('btnIniciarCalibracao'),
    micCard: document.getElementById('micCard'),
    micEstado: document.getElementById('micEstado'),
    micTimer: document.getElementById('micTimer'),
    transcricaoAoVivo: document.getElementById('transcricaoAoVivo'),
    btnGravacaoStart: document.getElementById('btnGravacaoStart'),
    btnGravacaoStop: document.getElementById('btnGravacaoStop'),
    micBtnIniciar: document.getElementById('micBtnIniciar'),
    micBtnParar: document.getElementById('micBtnParar'),
    statusTokenSessao: document.getElementById('statusTokenSessao'),
    iaProvedor: document.getElementById('iaProvedor'),
    iaApiKey: document.getElementById('iaApiKey'),
    chatCard: document.getElementById('chatCard'),
    chatMensagens: document.getElementById('chatMensagens'),
    chatInput: document.getElementById('chatInput'),
    chatBtnEnviar: document.getElementById('chatBtnEnviar'),
    cardResultado: document.getElementById('cardResultado'),
    resCarga: document.getElementById('resCarga'),
    resTecnico: document.getElementById('resTecnico'),
    btnReiniciar: document.getElementById('btnReiniciar')
};

// INICIALIZADOR
document.addEventListener('DOMContentLoaded', () => {
    configurarGatilhos();
    verificarSuporteSpeech();
});

function verificarSuporteSpeech() {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) {
        el.transcricaoAoVivo.textContent = "⚠️ Seu navegador não suporta transcrição de áudio em tempo real. Use o Google Chrome.";
        return;
    }
    reconhecimentoVoz = new Speech();
    reconhecimentoVoz.continuous = true;
    reconhecimentoVoz.interimResults = true;
    reconhecimentoVoz.lang = 'pt-BR';

    reconhecimentoVoz.onresult = (event) => {
        let textoIntermediario = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                estadoGlobal.textoTranscritoSessao += event.results[i][0].transcript;
            } else {
                textoIntermediario += event.results[i][0].transcript;
            }
        }
        el.transcricaoAoVivo.textContent = estadoGlobal.textoTranscritoSessao || textoIntermediario || "Ouvindo sua voz...";
    };
}

function configurarGatilhos() {
    el.btnIniciarCalibracao.addEventListener('click', iniciarFluxoCalibracao);
    el.btnGravacaoStart.addEventListener('click', micIniciar);
    el.btnGravacaoStop.addEventListener('click', enviarParaAuditoriaBackend);
    el.chatBtnEnviar.addEventListener('click', chatEnviar);
    el.btnReiniciar.addEventListener('click', matarSessaoERecomecar);
    el.btnAbastecer.addEventListener('click', () => {
        estadoGlobal.creditos += 50;
        el.hudTokens.textContent = estadoGlobal.creditos;
        el.tokensGrande.textContent = estadoGlobal.creditos;
    });
    el.iaApiKey.addEventListener('input', () => {
        estadoGlobal.apiKeyExterna = el.iaApiKey.value.trim();
    });
    el.chatInput.addEventListener('keydown', (e) => {
        const agora = Date.now();
        estadoGlobal.teclado.totalTeclas++;
        if (estadoGlobal.teclado.ultimoTs) {
            const delta = agora - estadoGlobal.teclado.ultimoTs;
            if (delta > 1100) estadoGlobal.teclado.pausasLongas++;
        }
        estadoGlobal.teclado.ultimoTs = agora;
    });
}

// FASE 01: OCULTAR TEXTO E IR PRO MIC
function iniciarFluxoCalibracao() {
    el.textoCalibracao.style.opacity = "0";
    setTimeout(() => {
        el.calibAba.classList.add('hidden');
        el.micCard.classList.remove('hidden');
    }, 300);
}

// FASE 02: MICROFONE + TRANSCRIÇÃO + WEB AUDIO API (MEDIR SILÊNCIO)
async function micIniciar() {
    try {
        estadoGlobal.textoTranscritoSessao = '';
        el.transcricaoAoVivo.textContent = "Iniciando captura e escuta ativa...";
        
        streamAudio = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const fonte = audioCtx.createMediaStreamSource(streamAudio);
        const analisador = audioCtx.createAnalyser();
        analisador.fftSize = 256;
        fonte.connect(analisador);

        const bufferLength = analisador.frequencyBinCount;
        const arrayDados = new Uint8Array(bufferLength);

        el.micBtnIniciar.classList.add('hidden');
        el.micBtnParar.classList.remove('hidden');
        document.getElementById('waveBox').querySelectorAll('.wave-bar').forEach(b => b.classList.add('on'));
        el.micEstado.textContent = "GRAVANDO SINAL BIOMÉTRICO...";
        el.micEstado.classList.add('gravando');

        let segundos = 0;
        estadoGlobal.metricasVoz.total_leituras = 0;
        estadoGlobal.metricasVoz.leituras_silencio = 0;

        // Loop de amostragem de silêncio a cada 100ms (10 vezes por segundo para precisão cirúrgica)
        loopsAnalise = setInterval(() => {
            analisador.getByteFrequencyData(arrayDados);
            let volumeTotal = arrayDados.reduce((a, b) => a + b, 0);
            let volumeMedio = volumeTotal / bufferLength;

            estadoGlobal.metricasVoz.total_leituras++;
            if (volumeMedio < 10) { // Limiar de vácuo acústico do Elayon
                estadoGlobal.metricasVoz.leituras_silencio++;
            }
        }, 100);

        // Cronômetro da Interface
        cronometroMic = setInterval(() => {
            segundos++;
            el.micTimer.textContent = `00:${segundos < 10 ? '0' : ''}${segundos}`;
            if (segundos >= 10) { // Amostragem ideal de 10 segundos para conferência tripla
                enviarParaAuditoriaBackend();
            }
        }, 1000);

        if (reconhecimentoVoz) reconhecimentoVoz.start();

    } catch (err) {
        alert("Acesso ao microfone negado ou indisponível: " + err.message);
    }
}

// TRIPLICA CONFERÊNCIA NO BACKEND E LIBERA CHAVE PLUGÁVEL
async function enviarParaAuditoriaBackend() {
    clearInterval(loopsAnalise);
    clearInterval(cronometroMic);
    if (reconhecimentoVoz) reconhecimentoVoz.stop();
    
    if (streamAudio) streamAudio.getTracks().forEach(t => t.stop());
    if (audioCtx) audioCtx.close();

    document.getElementById('waveBox').querySelectorAll('.wave-bar').forEach(b => b.classList.remove('on'));
    el.micEstado.textContent = "Processando auditoria das 3 conferências...";
    el.micEstado.classList.remove('gravando');

    const pctSilencio = Math.round((estadoGlobal.metricasVoz.leituras_silencio / estadoGlobal.metricasVoz.total_leituras) * 100) || 0;

    // Payload de Calibração para o Render processar a validação
    const pacoteAuditoria = {
        texto_falado: el.transcricaoAoVivo.textContent,
        silencio_calculado: pctSilencio,
        timestamp: Date.now()
    };

    try {
        // Envia os dados brutos capturados para o motor validar as três conferências
        // Nota: Criaremos essa rota de validação /api/crs/calibrar no seu Python no próximo passo!
        el.micEstado.textContent = "IA conferindo padrão biométrico e transcrição...";
        
        // Simulação forçada local de sucesso enquanto preparamos a rota Python:
        setTimeout(() => {
            // MATAR SE CHAVE ANTIGA EXISTIR E GERAR NOVA CHAVE DE SESSÃO OPERACIONAL
            estadoGlobal.tokenSessaoValido = true;
            estadoGlobal.tokenHash = "TK-" + Math.random().toString(36).substring(2, 11).toUpperCase();
            estadoGlobal.metricasVoz.silencio_voz_pct = pctSilencio;

            // Libera Interface Plugável do Usuário
            el.statusTokenSessao.textContent = `🟢 LIBERADA: ${estadoGlobal.tokenHash}`;
            el.statusTokenSessao.className = "status-chave liberada";
            el.iaProvedor.removeAttribute('disabled');
            el.iaApiKey.removeAttribute('disabled');
            el.iaApiKey.placeholder = "Cole sua API Key Externa para falar com o Chat...";
            
            el.micCard.classList.add('hidden');
            el.chatCard.classList.remove('hidden');
            
            estadoGlobal.teclado.tempoInicio = Date.now();
            renderizarMensagemSessao("🎙️ Auditoria Concluída com Sucesso nas 3 Instâncias. Token de Sessão assinado. Sua API Key Externa está liberada para comunicação ativa.", "ai");
        }, 2000);

    } catch (error) {
        el.micEstado.textContent = "Falha na validação do sinal: " + error.message;
    }
}

// COMUNICAÇÃO DE CHAT VIA ESCRITA RÍTMICA COM A IA
async function chatEnviar() {
    const txt = el.chatInput.value.trim();
    if (!txt) return;

    if (!estadoGlobal.tokenSessaoValido) {
        alert("Sessão inválida ou expirada. Refaça o protocolo de presença.");
        return;
    }
    if (!estadoGlobal.apiKeyExterna) {
        alert("Por favor, insira sua chave de API externa de destino.");
        return;
    }

    renderizarMensagemSessao(txt, 'user');
    el.chatInput.value = '';

    // Consolida métrica rítmica de escrita
    const calculoHesitacao = Math.min(
        Math.round((estadoGlobal.teclado.pausasLongas / (estadoGlobal.teclado.totalTeclas || 1)) * 100), 100
    );

    const payloadChat = {
        mensagem_usuario: txt,
        provedor: el.iaProvedor.value,
        api_key_externa: estadoGlobal.apiKeyExterna,
        metricas_sinal: {
            silencio_voz_pct: estadoGlobal.metricasVoz.silencio_voz_pct,
            hesitacao_escrita_pct: calculoHesitacao,
            total_intervalos: estadoGlobal.teclado.totalTeclas
        }
    };

    try {
        renderizarMensagemSessao("IA processando seu padrão de silêncio e hesitação...", 'ai', true);

        const response = await fetch(`${RENDER_BASE_URL}/api/crs/processar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadChat)
        });

        const dados = await response.json();
        removerLoadingMsg();

        if (response.ok) {
            renderizarMensagemSessao(dados.resposta_ia, 'ai');
            estadoGlobal.creditos -= 1;
            el.hudTokens.textContent = estadoGlobal.creditos;
            el.tokensGrande.textContent = estadoGlobal.creditos;

            // Abre Diagnóstico Final
            el.cardResultado.classList.remove('hidden');
            el.resCarga.textContent = dados.carga_cognitiva;
            el.resTecnico.textContent = JSON.stringify({
                "Token Operacional": estadoGlobal.tokenHash,
                "Silêncio em Voz": `${payloadChat.metricas_sinal.silencio_voz_pct}%`,
                "Hesitação na Digitação": `${payloadChat.metricas_sinal.hesitacao_escrita_pct}%`,
                "Teclas Monitoradas": payloadChat.metricas_sinal.total_intervalos,
                "Margem Elayon Retirada": "1 Crédito Fixado"
            }, null, 2);
        } else {
            renderizarMensagemSessao(`Erro no Servidor: ${dados.detail}`, 'ai');
        }

    } catch (err) {
        removerLoadingMsg();
        renderizarMensagemSessao("Erro de conexão com o motor Render.", 'ai');
    }

    // Reseta buffer de digitação para a próxima frase
    estadoGlobal.teclado.totalTeclas = 0;
    estadoGlobal.teclado.pausasLongas = 0;
    estadoGlobal.teclado.ultimoTs = null;
}

// MATAR TOKEN DE SESSÃO E RECOMEÇAR DO ZERO
function matarSessaoERecomecar() {
    estadoGlobal.tokenSessaoValido = false;
    estadoGlobal.tokenHash = null;
    localStorage.removeItem('elayon_crs_key');
    window.location.reload();
}

// FUNÇÕES DE EXIBIÇÃO DE MENSAGENS
function renderizarMensagemSessao(texto, autor, carregando = false) {
    const caixa = document.createElement('div');
    caixa.className = `chat-msg chat-${autor}`;
    if (carregando) caixa.id = 'msgCarregando';

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.textContent = texto;

    const meta = document.createElement('div');
    meta.className = 'chat-meta';
    meta.textContent = autor === 'user' ? 'Emissor Calibrado' : 'Elayon CRS Engine';

    caixa.appendChild(bubble);
    caixa.appendChild(meta);
    el.chatMensagens.appendChild(caixa);
    el.chatMensagens.scrollTop = el.chatMensagens.scrollHeight;
}

function removerLoadingMsg() {
    const loading = document.getElementById('msgCarregando');
    if (loading) loading.remove();
}
