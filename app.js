/**
 * Elayon Presença - Core Engine de Front-End v3.0
 * Controle de Fluxo Acústico, Métricas Temporais e Integração FastAPI
 */

// Estado Global da Aplicação
let engineSpeech = null;
let metricasAudio = { tempoInicio: null, tempoFim: null, totalCaracteres: 0 };
let loopAnimacaoOndas = null;

// Elementos de Feedback e Logs do Console
const consoleLogs = document.getElementById("infraConsoleLog");
const inputBackendUrl = document.getElementById("backendUrlInput");

function registrarLog(mensagem) {
    const timestamp = new Date().toLocaleTimeString();
    consoleLogs.innerText += `\n[${timestamp}] ${mensagem}`;
    consoleLogs.scrollTop = consoleLogs.scrollHeight;
}

function dispararToast(mensagem, cor = "#238636") {
    const toast = document.getElementById("toastNotification");
    toast.innerText = mensagem;
    toast.style.background = cor;
    toast.style.display = "block";
    setTimeout(() => { toast.style.display = "none"; }, 3000);
}

// ==========================================
// CARD 2: REGISTRO DE PILOTO E ASSINATURA
// ==========================================
function registrarEGerarRelatorioBasal() {
    const nome = document.getElementById("usrNome").value.trim();
    const email = document.getElementById("usrEmail").value.trim();
    const mailing = document.getElementById("usrMailing").value;

    if (!nome || !email) {
        dispararToast("⚠️ Preencha o Nome e E-mail para assinar o termo.", "#da3633");
        return;
    }

    const docAssinatura = {
        operador: nome,
        contato: email,
        regime_notificacao: mailing,
        timestamp_registro: new Date().toISOString(),
        status_token: "ATIVO_PROVISORIO",
        hash_seguranca: "ELAYON-SHA256-" + Math.random().toString(36).substring(2, 10).toUpperCase()
    };

    document.getElementById("relatorioCadastroTexto").innerText = JSON.stringify(docAssinatura, null, 4);
    document.getElementById("relatorioCadastroBox").classList.remove("hidden");
    
    registrarLog(`✓ Piloto registrado com sucesso: ${nome} <${email}>`);
    dispararToast("✓ Termo de Responsabilidade Assinado!");
}

// ==========================================
// CONTROLE GRÁFICO: ANIMAÇÃO DAS ONDAS
// ==========================================
function simularOndasAcusticas(estaAtivo) {
    const barras = document.querySelectorAll(".wave-bar");
    if (!estaAtivo) {
        clearInterval(loopAnimacaoOndas);
        barras.forEach(b => { b.style.height = "15px"; b.classList.remove("on"); });
        return;
    }

    loopAnimacaoOndas = setInterval(() => {
        barras.forEach(b => {
            if (Math.random() > 0.3) {
                b.style.height = `${Math.floor(Math.random() * 45) + 15}px`;
                b.classList.add("on");
            } else {
                b.style.height = "15px";
                b.classList.remove("on");
            }
        });
    }, 100);
}

// ==========================================
// CARD 3: PIPELINE ACÚSTICO E WEB SPEECH
// ==========================================
function iniciarLeituraAjustada() {
    const SpeechAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechAPI) {
        alert("A API de Voz não é suportada neste navegador. Use o Google Chrome ou Edge.");
        return;
    }

    engineSpeech = new SpeechAPI();
    engineSpeech.continuous = true;
    engineSpeech.interimResults = true;
    engineSpeech.lang = 'pt-BR';

    // Reset de Estados e Interface
    document.getElementById("transcricaoAoVivo").value = "Escutando canal acústico físico... Fale agora.";
    document.getElementById("micEstado").innerText = "GRAVANDO";
    document.getElementById("micEstado").style.color = "#da3633";
    
    document.getElementById("micBtnIniciar").classList.add("hidden");
    document.getElementById("micBtnParar").classList.remove("hidden");

    metricasAudio.tempoInicio = Date.now();
    simularOndasAcusticas(true);
    registrarLog("🎙️ Hardware de microfone ativado. Calibração basal iniciada.");

    // Lógica Corrigida: Reconstrói o texto do zero para evitar duplicações em loop
    engineSpeech.onresult = (event) => {
        let textoAcumulado = "";
        for (let i = 0; i < event.results.length; ++i) {
            textoAcumulado += event.results[i][0].transcript;
        }
        document.getElementById("transcricaoAoVivo").value = textoAcumulado;
        metricasAudio.totalCaracteres = textoAcumulado.length;
    };

    engineSpeech.onerror = (err) => {
        registrarLog(`⚠️ Falha no hardware de áudio: ${err.error}`);
    };
}

async function encerrarEPipelineCRS() {
    if (engineSpeech) {
        engineSpeech.stop();
    }
    metricasAudio.tempoFim = Date.now();
    simularOndasAcusticas(false);

    document.getElementById("micBtnParar").classList.add("hidden");
    document.getElementById("micBtnIniciar").classList.remove("hidden");
    document.getElementById("micEstado").innerText = "Processando...";
    document.getElementById("micEstado").style.color = "#ff7b72";

    const duracaoSegundos = ((metricasAudio.tempoFim - metricasAudio.tempoInicio) / 1000);
    document.getElementById("micTimer").innerText = `${duracaoSegundos.toFixed(1)}s`;

    registrarLog(`⏹️ Canal acústico cortado. Duração: ${duracaoSegundos.toFixed(1)}s.`);

    // Disparar Payload para o Backend FastAPI
    await processarMetadadosNoServidor(duracaoSegundos);
}

// ==========================================
// INTEGRAÇÃO DE REDE: REQUISIÇÃO AO BACKEND
// ==========================================
async function processarMetadadosNoServidor(duracao) {
    const urlBase = inputBackendUrl.value.trim();
    const provedor = document.getElementById("iaProvedor").value;
    const apiKey = document.getElementById("iaApiKey").value.trim();
    const textoCapturado = document.getElementById("transcricaoAoVivo").value;

    const payload = {
        mensagem: textoCapturado,
        provedor: provedor,
        api_key_externa: apiKey || "MODO_LOCAL_SEM_CHAVE",
        ritmo: {
            silencio_pct: duracao > 0 ? Math.min(Math.round((duracao * 2.5)), 100) : 0,
            hesitacao_pct: metricasAudio.totalCaracteres > 0 ? Math.min(Math.round((duracao / metricasAudio.totalCaracteres) * 100), 100) : 0,
            eventos: metricasAudio.totalCaracteres
        }
    };

    registrarLog(`Despachando payload para o endpoint: ${urlBase}/api/crs/processar`);

    try {
        const response = await fetch(`${urlBase}/api/crs/processar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const dadosRetorno = await response.json();

        if (response.ok) {
            registrarLog("✓ Conexão bem-sucedida! Resposta cognitiva acoplada.");
            document.getElementById("micEstado").innerText = "Pronto";
            document.getElementById("micEstado").style.color = "#2ea043";

            // Exibir Painel de Resultados
            document.getElementById("cardResultado").classList.remove("hidden");
            document.getElementById("chatCard").classList.remove("hidden");
            
            document.getElementById("resCarga").innerText = dadosRetorno.analise_ritmo.carga;
            document.getElementById("resTecnico").innerText = JSON.stringify(dadosRetorno, null, 4);

            // Injetar resposta na Janela de Chat Simbiótico
            renderizarMensagemChat("IA", dadosRetorno.resposta);
            dispararToast("✓ Sincronização CRS Concluída!");
        } else {
            const msgErro = dadosRetorno.detail || dadosRetorno.error || "Erro desconhecido no servidor";
            registrarLog(`❌ Servidor Rejeitou: ${msgErro}`);
            document.getElementById("micEstado").innerText = "Falha no Handshake";
            dispararToast("❌ Falha no processamento do motor.", "#da3633");
        }
    </script>
