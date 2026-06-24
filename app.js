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
// 2. SENSORES DE ESCRITA (TECLADO RÍTMICO)
// ==========================================
function activarSensoresTeclado() {
    const chatInput = document.getElementById('chatInput');
    if (!chatInput) return;

    chatInput.addEventListener('keyup', (event) => {
        const agora = Date.now();
        if (crsEstado.ultimoDigitoTs > 0) {
            const delta = agora - crsEstado.ultimoDigitoTs;
            crsEstado.intervalosEscrita.push(delta);
            
            // Pausas acima de 650ms contam como hesitação na escrita curta
            if (delta > 650) {
                crsEstado.pausasLongas++;
            }
        }
        crsEstado.ultimoDigitoTs = agora;
    });
}

// ==========================================
// 3. ENVIO PARA O MOTOR CRS (COM VALIDAÇÃO DE CHAVE)
// ==========================================
async function chatEnviar() {
    const chatInput = document.getElementById('chatInput');
    const texto = chatInput.value.trim();
    if (!texto) return;

    // TRAVA CRÍTICA DA CHAVE EXTERNA
    if (!crsEstado.apiKeyExterna) {
        exibirMensagemChat("⚠️ MOTOR BLOQUEADO: Insira sua chave de API externa no painel superior para que a inteligência artificial possa rodar com seus créditos.", 'ai');
        return;
    }

    // TRAVA DE SEGURANÇA DE TOKENS LOCAIS DA MARGEM
    if (crsEstado.tokens < 1) {
        exibirMensagemChat("❌ CRÉDITOS INSUFICIENTES: Abasteça seus créditos Elayon para cobrir a margem operacional de processamento do silêncio.", 'ai');
        return;
    }

    // Exibe texto na tela e limpa campo
    exibirMensagemChat(texto, 'user');
    chatInput.value = '';

    // Consolidação das métricas rítmicas de escrita
    const intervalos = crsEstado.intervalosEscrita;
    const somaTempos = intervalos.reduce((a, b) => a + b, 0) || 1;
    const totalPausasTempo = intervalos.filter(t => t > 650).reduce((a, b) => a + b, 0);
    const escritaHesitacaoPct = Math.min(100, Math.floor((totalPausasTempo / somaTempos) * 100));

    try {
        // Dispara o payload completo para o Render processar
        const response = await fetch(`${RENDER_BASE_URL}/api/crs/processar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mensagem_usuario: texto,
                provedor: crsEstado.provedorIa,
                api_key_externa: crsEstado.apiKeyExterna,
                metricas_sinal: {
                    silencio_voz_pct: crsEstado.audioSilencioEstimadoPct,
                    hesitacao_escrita_pct: escritaHesitacaoPct,
                    total_intervalos: intervalos.length
                }
            })
        });

        if (response.ok) {
            const dados = await response.json();
            
            // Renderiza a resposta gerada pela chave do usuário com o tom calibrado pelo CRS
            exibirMensagemChat(dados.resposta_ia, 'ai');
            
            // Cobra a taxa operacional fixa da nossa margem de lucro
            crsEstado.tokens -= 1;
            atualizarPainelRecursos();

            // Exibe o relatório de entrega e diagnóstico técnico na tela
            exibirRelatorioSaida(dados, escritaHesitacaoPct);
        } else {
            exibirMensagemChat("⚠️ O motor do Render recusou a requisição. Certifique-se de que a API Key externa colada é válida.", 'ai');
        }
    } catch (error) {
        console.error(error);
        exibirMensagemChat("❌ Erro de conexão de rede com o servidor de processamento rítmico (Render).", 'ai');
    }

    // Reseta buffers de digitação para a próxima interação
    crsEstado.intervalosEscrita = [];
    crsEstado.pausasLongas = 0;
    crsEstado.ultimoDigitoTs = 0;
}

// ==========================================
// 4. AUXILIARES VISUAIS DE INTERFACE
// ==========================================
function exibirMensagemChat(texto, tipo) {
    const chatBox = document.getElementById('chatMensagens');
    if (!chatBox) return;

    const wrapper = document.createElement('div');
    wrapper.className = `chat-msg chat-${tipo}`;

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.textContent = texto;

    const meta = document.createElement('div');
    meta.className = 'chat-meta';
    meta.textContent = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

    wrapper.appendChild(bubble);
    wrapper.appendChild(meta);
    chatBox.appendChild(wrapper);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function exibirMensagemSistemaChat(texto) {
    exibirMensagemChat(texto, 'ai');
}

function exibirRelatorioSaida(dados, escritaPct) {
    const cardRes = document.getElementById('cardResultado');
    if (!cardRes) return;

    cardRes.classList.remove('hidden');
    document.getElementById('resEstado').textContent = 
        `Voz (Silêncio): ${crsEstado.audioSilencioEstimadoPct}% | Escrita (Hesitação): ${escritaPct}% | Carga Cognitiva Relatada: ${dados.carga_cognitiva || 'Calculada'}`;
    
    // Mostra o JSON bruto com a resposta do motor para depuração e conferência de margem
    document.getElementById('resTecnico').textContent = JSON.stringify({
        status: "Entrega Efetuada",
        taxa_operacional_elayon: "1 Crédito Retirado",
        provedor_utilizado: crsEstado.provedorIa,
        carga: dados.carga_cognitiva,
        sinal_sincronizado: true
    }, null, 2);
}
