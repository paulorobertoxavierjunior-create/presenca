// ==========================================
// ELAYON PRESENÇA V3.0 - CONFIGURAÇÃO DE NÚCLEO
// ==========================================
const RENDER_BASE_URL = 'https://crs-full3.onrender.com';

// Estado global da sessão de presença
let estadoSistema = {
    pilotoId: 'PILOTO-01',
    tokensSaldo: 42, // Mock inicial que será substituído ou validado pela carteira local
    tipoAnalise: 'unica', // 'unica' ou 'memoria'
    ultimoTecladoTimestamp: 0,
    intervalosTeclado: [],
    contagemHesitacoes: 0
};

// ==========================================
// 1. INICIALIZAÇÃO DO HUD E RECURSOS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    inicializarHUD();
    configurarSensoresFront();
});

function inicializarHUD() {
    document.getElementById('hudId').textContent = estadoSistema.pilotoId;
    atualizarDisplayTokens(estadoSistema.tokensSaldo);
    document.getElementById('hudCalibTs').textContent = new Date().toLocaleTimeString();
}

function atualizarDisplayTokens(saldo) {
    estadoSistema.tokensSaldo = saldo;
    document.getElementById('hudTokens').textContent = saldo;
    document.getElementById('tokensGrande').textContent = saldo;
    
    // Atualiza a barra visual de tokens (limite de 100 para proporção gráfica)
    const pctBarra = Math.min(100, Math.floor((saldo / 100) * 100));
    document.getElementById('tokensBar').style.width = pctBarra + '%';
    
    // Trava de segurança local na interface
    const btnAnalisar = document.getElementById('btnAnalisar');
    const tokenAviso = document.getElementById('tokenSemAviso');
    const custoNecessario = estadoSistema.tipoAnalise === 'memoria' ? 2 : 1;

    if (saldo < custoNecessario) {
        if(btnAnalisar) btnAnalisar.disabled = true;
        if(tokenAviso) tokenAviso.style.display = 'block';
    } else {
        if(tokenAviso) tokenAviso.style.display = 'none';
    }
}

function selecionarTipo(tipo) {
    estadoSistema.tipoAnalise = tipo;
    document.getElementById('tipoUnica').classList.toggle('ativo', tipo === 'unica');
    document.getElementById('tipoMemoria').classList.toggle('ativo', tipo === 'memoria');
    
    const custoTexto = document.getElementById('custoTexto');
    if (custoTexto) {
        custoTexto.textContent = tipo === 'memoria' ? '2 tokens' : '1 token';
    }
    
    // Revalida a trava com base no novo custo selecionado
    atualizarDisplayTokens(estadoSistema.tokensSaldo);
}

// ==========================================
// 2. CAPTURA DOS SINAIS TEMPORAIS DO TECLADO
// ==========================================
function configurarSensoresFront() {
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keyup', (event) => {
            const agora = Date.now();
            if (estadoSistema.ultimoTecladoTimestamp > 0) {
                const delta = agora - estadoSistema.ultimoTecladoTimestamp;
                estadoSistema.intervalosTeclado.push(delta);
                
                // Pausas acima de 700ms indicam suspensão ou hesitação rítmica consciente
                if (delta > 700) {
                    estadoSistema.contagemHesitacoes++;
                }
            }
            estadoSistema.ultimoTecladoTimestamp = agora;
        });
    }
}

// Auxiliar para limpar buffers temporais após o envio do sinal
function resetarSensoresTeclado() {
    estadoSistema.intervalosTeclado = [];
    estadoSistema.contagemHesitacoes = 0;
    estadoSistema.ultimoTecladoTimestamp = 0;
}

// ==========================================
// 3. PROCESSAMENTO DO CHAT CRS & CONEXÃO BACKEND
// ==========================================
async function chatEnviar() {
    const chatInput = document.getElementById('chatInput');
    const texto = chatInput.value.trim();
    if (!texto) return;

    // Bloqueia interface e debita o custo estimado localmente
    const custo = estadoSistema.tipoAnalise === 'memoria' ? 2 : 1;
    if (estadoSistema.tokensSaldo < custo) {
        alert("Saldo insuficiente para processar a presença.");
        return;
    }

    exibirMensagemChat(texto, 'user');
    chatInput.value = '';

    // Consolidação matemática dos sensores de digitação
    const intervalos = estadoSistema.intervalosTeclado;
    const totalSilencios = intervalos.filter(t => t > 600).reduce((a, b) => a + b, 0);
    const somaTempos = intervalos.reduce((a, b) => a + b, 0) || 1;
    
    const calculoSilencioPct = Math.min(100, Math.floor((totalSilencios / somaTempos) * 100));
    const calculoHesitacaoPct = intervalos.length ? Math.min(100, Math.floor((estadoSistema.contagemHesitacoes / intervalos.length) * 100)) : 0;

    alterarStatusDotCRS('lendo', 'LENDO SINAL...');

    try {
        const response = await fetch(`${RENDER_BASE_URL}/api/crs/processar`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'CRS_LIVE_MODO_DIRETO' // Substituído pela assinatura fixa do admin em produção
            },
            body: JSON.stringify({
                mensagem: texto,
                ritmo: {
                    silencio_pct: calculoSilencioPct,
                    hesitacao_pct: calculoHesitacaoPct,
                    eventos: intervalos.length
                }
            })
        });

        if (response.ok) {
            const dados = await response.json();
            
            // Exibe o retorno inteligente do motor
            exibirMensagemChat(dados.resposta, 'ai');
            alterarStatusDotCRS('ativo', 'CRS CONFIGURADO');
            
            // Atualiza os tokens baseado na resposta real e exibe no painel de saída se existir
            atualizarDisplayTokens(estadoSistema.tokensSaldo - custo);
            exibirPainelSaida(dados);
        } else {
            exibirMensagemChat("⚠️ Erro de resposta do motor. Chave ROM ativa?", 'ai');
            alterarStatusDotCRS('ativo', 'CRS CONFIGURADO');
        }
    } catch (error) {
        console.error(error);
        exibirMensagemChat("❌ Falha crítica de conexão de rede com o Render.", 'ai');
        alterarStatusDotCRS('ativo', 'CRS INATIVO');
    }

    resetarSensoresTeclado();
}

// ==========================================
// 4. COMPONENTE DE ESCUTA (MOCK DE SINAIS DO MIC)
// ==========================================
function irCalibrar() {
    // Transiciona as abas visuais conforme a lógica nativa do Elayon
    const badgeF1 = document.getElementById('badgeF1');
    const badgeF2 = document.getElementById('badgeF2');
    const badgeF3 = document.getElementById('badgeF3');
    
    badgeF1.textContent = "OK"; badgeF1.className = "calib-badge ok";
    setTimeout(() => { badgeF2.textContent = "OK";
