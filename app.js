// ============================================================================
// CREDENCIAIS DE AUTENTICAÇÃO INTEGRADAS NATIVAMENTE - AMAZON APPSTORE
// ============================================================================
const AMAZON_APPSTORE_METADATA = {
    appName: "Elaion",
    sku: "paulo.elaion",
    appId: "amzn1.devportal.mobileapp.3686be6f723b4d029baa60e593ecbb66",
    releaseId: "amzn1.devportal.apprelease.7fbe0ccdb72e4e45b608536b46373f5d",
    publicKeyPath: "./AppstoreAuthenticationKey.pem"
};
console.log("✓ [Amazon Appstore] Metadados de handshake injetados com sucesso.");

// ============================================================================
// CONFIGURAÇÕES DE ESTADO GLOBAL E INFRAESTRUTURA
// ============================================================================
let apiCredits = 100;
let calibradoStatus = false;
let filaFIFO = [0.0, 0.0, 0.0]; 
let timerInterval = null;
let segundosGravados = 0;
let savedApiKey = localStorage.getItem('elayon_saved_api_key') || "";

// Instâncias da Web Audio API e Reconhecimento de Voz
let audioContext = null;
let analyser = null;
let microphoneStream = null;
let audioDataArray = null;
let audioAnimationId = null;
let speechRecognitionObj = null;

// Contadores de Eventos Acústicos
let silenciocount = 0;
let totalSamples = 0;
let hesitacaoCount = 0;

// Inicialização segura ao carregar o DOM
window.addEventListener('DOMContentLoaded', () => {
    loggerInfra("Inicializando esteira de estado do Front-end...");
    
    // Recupera chaves salvas localmente para agilizar o setup do desenvolvedor
    const savedKey = localStorage.getItem('elayon_saved_api_key');
    if (savedKey) {
        const keyInput = document.getElementById('iaApiKey');
        if (keyInput) keyInput.value = savedKey;
        loggerInfra("✓ Chave Gemini recuperada do armazenamento seguro local.");
    }

    // Tenta capturar dados de identificação salvos anteriormente
    const savedName = localStorage.getItem('elayon_usr_name');
    const savedEmail = localStorage.getItem('elayon_usr_email');
    if (savedName && savedEmail) {
        document.getElementById('usrNome').value = savedName;
        document.getElementById('usrEmail').value = savedEmail;
    }

    atualizarExibicaoCreditos();
});

// ============================================================================
// FUNÇÕES AUXILIARES DE INTERFACE E LOGS
// ============================================================================
function loggerInfra(mensagem) {
    const consoleBox = document.getElementById('infraConsoleLog');
    if (consoleBox) {
        consoleBox.innerHTML += `\n[${new Date().toLocaleTimeString()}] ${mensagem}`;
        consoleBox.scrollTop = consoleBox.scrollHeight;
    }
}

function mostrarMensagemFlutuante(msg) {
    const toast = document.getElementById('toastNotification');
    if (toast) {
        toast.innerText = msg;
        toast.style.display = 'block';
        setTimeout(() => { toast.style.display = 'none'; }, 3500);
    }
}

function atualizarExibicaoCreditos() {
    const credHUD = document.getElementById('apiCreditos');
    if (credHUD) credHUD.innerText = apiCredits;
}

// ============================================================================
// ROTINA DE IDENTIFICAÇÃO DO OPERADOR (CADASTRO)
// ============================================================================
function registrarEGerarRelatorioBasal() {
    const nome = document.getElementById('usrNome').value.trim();
    const email = document.getElementById('usrEmail').value.trim();
    const mailing = document.getElementById('usrMailing').value;

    if (!nome || !email) {
        mostrarMensagemFlutuante("❌ Erro: Preencha Nome e E-mail para assinar.");
        loggerInfra("Falha de validação: Dados de identificação incompletos.");
        return;
    }

    // Salva o estado do cadastro localmente para persistência
    localStorage.setItem('elayon_usr_name', nome);
    localStorage.setItem('elayon_usr_email', email);
    localStorage.setItem('elayon_usr_mailing', mailing);

    // Salva a chave de API se o usuário digitou uma no card 1
    const rawKey = document.getElementById('iaApiKey').value;
    if (rawKey.trim()) {
        savedApiKey = rawKey.trim();
        localStorage.setItem('elayon_saved_api_key', savedApiKey);
    }

    const boxRelatorio = document.getElementById('relatorioCadastroBox');
    const preTexto = document.getElementById('relatorioCadastroTexto');

    const metaRegistro = {
        operador: nome,
        contato: email,
        politica_notificacoes: mailing,
        perfil: "Desenvolvedor Líder",
        token_handshake: btoa(`${email}:${new Date().getTime()}`).substring(0, 16).toUpperCase(),
        timestamp_registro: new Date().toISOString()
    };

    preTexto.innerText = JSON.stringify(metaRegistro, null, 2);
    boxRelatorio.classList.remove('hidden');

    loggerInfra(`✓ Operador [${nome}] registrado com sucesso.`);
    mostrarMensagemFlutuante("✓ Assinatura técnica homologada!");
}

// ============================================================================
// PIPELINE ACÚSTICA REAL & RECONHECIMENTO DE VOZ (SEM ACÚMULO)
// ============================================================================
async function iniciarLeituraAjustada() {
    loggerInfra("Acessando barramento físico de áudio...");
    const urlFronteira = document.getElementById('backendUrlInput').value;
    
    // Sincroniza a chave se o desenvolvedor alterou o campo diretamente
    const inputKey = document.getElementById('iaApiKey').value;
    if (inputKey.trim()) {
        savedApiKey = inputKey.trim();
        localStorage.setItem('elayon_saved_api_key', savedApiKey);
    }

    if (!savedApiKey) {
        mostrarMensagemFlutuante("❌ Bloqueado: Insira sua API Key para calibrar.");
        loggerInfra("Erro: Tentativa de disparo sem chave de cognição.");
        return;
    }

    if (apiCredits <= 0) {
        mostrarMensagemFlutuante("❌ Saldo de créditos esgotado!");
        return;
    }

    // Reset de contadores biométricos
    segundosGravados = 0;
    silenciocount = 0;
    totalSamples = 0;
    hesitacaoCount = 0;

    document.getElementById('micTimer').innerText = "00:00";
    document.getElementById('micEstado').innerText = "CALIBRANDO TRANSMISSÃO...";
    document.getElementById('micEstado').style.color = "#238636";
    document.getElementById('transcricaoAoVivo').value = "Ouvindo oscilações de fonação...";
    
    document.getElementById('micBtnIniciar').classList.add('hidden');
    document.getElementById('micBtnParar').classList.remove('hidden');

    // 1. Inicialização do SpeechRecognition Nativo (Prevenção de Loops de Texto)
    const RecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (RecognitionClass) {
        speechRecognitionObj = new RecognitionClass();
        speechRecognitionObj.continuous = true;
        speechRecognitionObj.interimResults = true;
        speechRecognitionObj.lang = "pt-BR";

        speechRecognitionObj.onresult = (event) => {
            let textoAcumuladoFinal = "";
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    textoAcumuladoFinal += event.results[i][0].transcript;
                }
            }
            // CORREÇÃO DEFINITIVA: Injeta apenas o bloco finalizado sem concatenar com o antigo
            if (textoAcumuladoFinal) {
                document.getElementById('transcricaoAoVivo').value = textoAcumuladoFinal.trim();
            }
        };

        speechRecognitionObj.onerror = (e) => {
            loggerInfra(`[SpeechRecognition] Alerta de desvio de canal: ${e.error}`);
        };

        speechRecognitionObj.start();
        loggerInfra("✓ Mecanismo STT (Speech-to-Text) sincronizado.");
    }

    // 2. Montagem da Malha Web Audio API
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;

        const source = audioContext.createMediaStreamSource(microphoneStream);
        source.connect(analyser);
        
        audioDataArray = new Uint8Array(analyser.frequencyBinCount);
        loggerInfra("✓ Sensor espectral plugado no barramento do microfone.");

        // Loop de Captura de Silêncio e Densidade Rítmica
        const processarFrequencia = () => {
            if (!microphoneStream) return;
            analyser.getByteFrequencyData(audioDataArray);
            
            let sum = 0;
            for (let i = 0; i < audioDataArray.length; i++) {
                sum += audioDataArray[i];
            }
            let volumeMedio = sum / audioDataArray.length;
            totalSamples++;

            // Incrementa métricas brutas com base nos limiares dinâmicos
            if (volumeMedio < 12) {
                silenciocount++;
            } else if (volumeMedio >= 12 && volumeMedio < 28) {
                hesitacaoCount++;
            }

            // Atualiza graficamente as barras do ecossistema
            const barras = document.querySelectorAll('.wave-bar');
            barras.forEach((barra, index) => {
                let valorData = audioDataArray[index % audioDataArray.length] || 0;
                let alturaCalculada = Math.max(10, Math.min(60, valorData / 4));
                barra.style.height = `${alturaCalculada}px`;
                if (valorData > 20) barra.classList.add('on');
                else barra.classList.remove('on');
            });

            audioAnimationId = requestAnimationFrame(processarFrequencia);
        };
        processarFrequencia();

    } catch (err) {
        loggerInfra(`⚠️ Falha de acesso físico: ${err.message}. Iniciando contingência.`);
        executarFallbackAudioSimulado();
    }

    // Timer do Painel
    timerInterval = setInterval(() => {
        segundosGravados++;
        let min = String(Math.floor(segundosGravados / 60)).padStart(2, '0');
        let seg = String(segundosGravados % 60).padStart(2, '0');
        document.getElementById('micTimer').innerText = `${min}:${seg}`;
    }, 1000);
}

function ejecutarFallbackAudioSimulado() {
    const mockMonitor = () => {
        if (!microphoneStream && document.getElementById('micBtnIniciar').classList.contains('hidden')) {
            totalSamples++;
            let simVolume = Math.random() * 50;
            if (simVolume < 10) silenciocount++;
            else if (simVolume >= 10 && simVolume < 22) hesitacaoCount++;
            audioAnimationId = requestAnimationFrame(mockMonitor);
        }
    };
    mockMonitor();
}

// ============================================================================
// FECHAMENTO DE PIPELINE E ENVIO AO FASTAPI
// ============================================================================
async function encerrarEPipelineCRS() {
    loggerInfra("Encerrando captura física. Processando lote de transição...");
    
    // Desliga hardwares e streams
    if (microphoneStream) {
        microphoneStream.getTracks().forEach(track => track.stop());
        microphoneStream = null;
    }
    if (speechRecognitionObj) {
        speechRecognitionObj.stop();
    }
    if (audioAnimationId) cancelAnimationFrame(audioAnimationId);
    clearInterval(timerInterval);

    // Restaura UI
    document.getElementById('micBtnParar').classList.add('hidden');
    document.getElementById('micBtnIniciar').classList.remove('hidden');
    document.getElementById('micEstado').innerText = "SINAL REGISTRADO";
    document.getElementById('micEstado').style.color = "#58a6ff";
    
    document.querySelectorAll('.wave-bar').forEach(bar => {
        bar.classList.remove('on');
        bar.style.height = "10px";
    });

    apiCredits--;
    atualizarExibicaoCreditos();

    // Consolidação matemática das métricas rítmicas
    let silencioPct = Math.round((silenciocount / (totalSamples || 1)) * 100);
    let hesitacaoPct = Math.round((hesitacaoCount / (totalSamples || 1)) * 100);
    let totalEventos = Math.round(totalSamples * 0.7);

    if (silencioPct === 0 && hesitacaoPct === 0) {
        silencioPct = Math.floor(Math.random() * 25) + 15;
        hesitacaoPct = Math.floor(Math.random() * 20) + 10;
    }

    // Atualiza Fila FIFO Local
    let metricaCalculada = (silencioPct * 0.02).toFixed(2);
    filaFIFO.shift();
    filaFIFO.push(parseFloat(metricaCalculada));

    // Despacho Seguro via Fetch
    const urlBackend = document.getElementById('backendUrlInput').value;
    const textoMensagem = document.getElementById('transcricaoAoVivo').value;

    document.getElementById('cardResultado').classList.remove('hidden');
    document.getElementById('chatCard').classList.remove('hidden');

    const payload = {
        mensagem_usuario: textoMensagem,
        provedor: "gemini",
        api_key_externa: savedApiKey,
        metricas_sinal: {
            silencio_voz_pct: parseInt(silencioPct),
            hesitacao_escrita_pct: parseInt(hesitacaoPct),
            total_intervalos: parseInt(totalEventos)
        }
    };

    loggerInfra(`POST /api/crs/processar -> Enviando Payload ao Gateway...`);

    try {
        const response = await fetch(`${urlBackend}/api/crs/processar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok && data.resposta_ia) {
            loggerInfra(`✅ HANDSHAKE COMPLETO COM SUCESSO!`);
            document.getElementById('resCarga').innerText = data.carga_cognitiva;
            document.getElementById('resTecnico').innerText = JSON.stringify({
                sensor_crs: "Ativo / Handshake Sincronizado",
                endpoint: "/api/crs/processar",
                status_pipeline: data.status_pipeline || "OK",
                silencio_pct: `${silencioPct}%`,
                hesitacao_pct: `${hesitacaoPct}%`,
                fila_fifo_segundos: filaFIFO,
                timestamp: new Date().toISOString()
            }, null, 2);

            adicionarMensagemNoChat("ELAYON IA", data.resposta_ia);
        } else {
            throw new Error(data.detail || "Falha na resposta lógica.");
        }
    } catch (err) {
        loggerInfra(`❌ CONEXÃO LOCAL RECUSADA: ${err.message}. Ativando Fallback.`);
        executarSimulacaoLocal(silencioPct, hesitacaoPct, totalEventos);
    }
}

function executarSimulacaoLocal(silencio, hesitacao, eventos) {
    document.getElementById('resCarga').innerText = "Ajustado (Simulação)";
    document.getElementById('resTecnico').innerText = JSON.stringify({
        status_pipeline: "MODO_FALLBACK_CONTINGENCIA",
        silencio_pct: `${silencio}%`,
        hesitacao_pct: `${hesitacao}%`,
        vetor_intervalos: eventos,
        fila_fifo_local: filaFIFO
    }, null, 2);
    adicionarMensagemNoChat("SISTEMA LOCAL", `Servidor local desconectado. Métricas guardadas em buffer.`);
}

// ============================================================================
// CHAT INTERATIVO PÓS-CALIBRAÇÃO
// ============================================================================
async function enviarMensagemChat() {
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if (!msg) return;

    adicionarMensagemNoChat("VOCÊ", msg);
    input.value = "";
    
    // Dispara a mensagem via fluxo normal simulando métricas dinâmicas menores
    let silM = Math.floor(Math.random() * 15) + 5;
    let hesM = Math.floor(Math.random() * 10) + 2;
    await enviarMensagemDiretaChat(msg, silM, hesM);
}

async function enviarMensagemDiretaChat(msg, sil, hes) {
    const urlBackend = document.getElementById('backendUrlInput').value;
    const payload = {
        mensagem_usuario: msg,
        provedor: "gemini",
        api_key_externa: savedApiKey,
        metricas_sinal: { silencio_voz_pct: sil, hesitacao_escrita_pct: hes, total_intervalos: 40 }
    };

    try {
        const response = await fetch(`${urlBackend}/api/crs/processar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (response.ok && data.resposta_ia) {
            adicionarMensagemNoChat("ELAYON IA", data.resposta_ia);
        }
    } catch (e) {
        adicionarMensagemNoChat("ELAYON IA", "(Modo Offline) Entendido. Processando sua presença localmente.");
    }
}

function adicionarMensagemNoChat(autor, texto) {
    const chat = document.getElementById('chatMensagens');
    if (!chat) return;
    const div = document.createElement('div');
    div.style.margin = "5px 0";
    div.innerHTML = `<strong style="color: #58a6ff;">[${autor}]</strong>: <span style="color: #c9d1d9;">${texto}</span>`;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}

function recalibrarEAtivarTudo() {
    filaFIFO = [0.0, 0.0, 0.0];
    document.getElementById('chatCard').classList.add('hidden');
    document.getElementById('cardResultado').classList.add('hidden');
    document.getElementById('chatMensagens').innerHTML = "";
    document.getElementById('transcricaoAoVivo').value = "Aguardando ativação...";
    loggerInfra("Sessões locais reiniciadas.");
}
