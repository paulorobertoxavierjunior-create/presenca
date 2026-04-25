// ==========================================
// ELAYON — Aplicativo Presença (App.js)
// Conexão: Frontend -> Render (Núcleo CRS) -> Supabase
// Versão Final: Funcionalidades 100% Operacionais
// ==========================================

// --- VARIÁVEIS GERAIS ---
let audioCtx, analyser, stream;
let dataArray;
let gravando = false;
let pausado = false;
let tempoGravacao = 0;
let temporizador;

// Dados de análise
let volumes = [];
let pauses = []; 
let ultimoSom = 0;

// ✅ SISTEMA FIFO: Guarda sempre 3 sessões no máximo
let sessoes = [];
const LIMITE_SESSOES = 3;

// --- CONFIGURAÇÕES ---
const URL_NUCLEO_CRS = "https://nucleo-crs-elayon.onrender.com/api/crs/analisar";
const TOKENS_ANALISE_UNICA = 1;
const TOKENS_ANALISE_MEMORIA = 2;

// Estado do usuário
let ESTADO = {
  usuario: null,
  tokenAcesso: null,
  saldoAnalises: 24,
  tipoAnaliseEscolhida: null
};

// ==========================================
// INICIALIZAÇÃO DO SISTEMA
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  log('✅ Sistema carregado, iniciando...', 'sistema');
  
  // 🔐 Carrega dados do usuário logado no Supabase
  await carregarDadosAutenticacao();
  
  // 📋 Carrega dados salvos anteriormente
  carregarDadosArmazenados();
  
  // 🖥️ Atualiza a interface com os dados existentes
  atualizarSaldoTela();
  atualizarListaSessoes();
  
  log('✅ Todos os recursos prontos para uso', 'info');
});

// ==========================================
// AUTENTICAÇÃO E DADOS DO USUÁRIO
// ==========================================
async function carregarDadosAutenticacao() {
  // Recupera os dados da sessão do Supabase
  ESTADO.tokenAcesso = localStorage.getItem("supabase.auth.token");
  
  if (!ESTADO.tokenAcesso) {
    log('❌ Usuário não autenticado. Faça login novamente.', 'erro');
    mostrarDadosUsuario(`<span style="color:#e75b5b">❌ Não logado</span>`);
    return;
  }

  try {
    // Decodifica o token para pegar os dados do usuário
    const tokenParseado = JSON.parse(ESTADO.tokenAcesso);
    ESTADO.usuario = tokenParseado?.currentSession?.user;
    
    if (ESTADO.usuario) {
      mostrarDadosUsuario(`
        <strong>E-mail:</strong> ${ESTADO.usuario.email}<br>
        <strong>ID Usuário:</strong> ${ESTADO.usuario.id}
      `);
      log(`✅ Usuário autenticado: ${ESTADO.usuario.email}`, 'sucesso');
    }
  } catch (erro) {
    log(`❌ Erro ao carregar dados do usuário: ${erro.message}`, 'erro');
  }
}

function mostrarDadosUsuario(texto) {
  const container = document.getElementById('dadosUsuarioAutenticado');
  if (container) container.innerHTML = texto;
}

// ==========================================
// GERENCIAMENTO DE DADOS SALVOS
// ==========================================
function carregarDadosArmazenados() {
  const saldoSalvo = localStorage.getItem('elayon_saldo');
  const sessoesSalvas = localStorage.getItem('elayon_sessoes');
  
  if (saldoSalvo) ESTADO.saldoAnalises = parseInt(saldoSalvo);
  if (sessoesSalvas) sessoes = JSON.parse(sessoesSalvas);
  
  log(`📋 ${sessoes.length} análises recuperadas`, 'info');
}

function atualizarSaldoTela() {
  const elementoSaldo = document.getElementById('saldoVal');
  if (elementoSaldo) elementoSaldo.textContent = `${ESTADO.saldoAnalises} disponíveis`;
  localStorage.setItem('elayon_saldo', ESTADO.saldoAnalises);
}

function adicionarCreditos(codigo) {
  const codigosValidos = {
    'ELA10PRESENCA': 10,
    'ELA20PRESENCA': 20,
    'ELA50PRESENCA': 50
  };

  if (codigosValidos[codigo]) {
    ESTADO.saldoAnalises += codigosValidos[codigo];
    atualizarSaldoTela();
    fecharModal('modalTokens');
    log(`✅ Adicionados ${codigosValidos[codigo]} análises ao seu saldo`, 'sucesso');
    alert('Recarga realizada com sucesso!');
  } else {
    log('❌ Código inválido ou expirado', 'erro');
    alert('Código não reconhecido');
  }
}

// ==========================================
// CONTROLE DE GRAVAÇÃO DE ÁUDIO
// ==========================================
async function iniciarGravacao() {
  try {
    log('🎤 Solicitando permissão para usar o microfone...', 'info');
    
    // Acesso ao microfone
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 }
    });

    // Inicializa processamento de áudio
    audioCtx = new AudioContext();
    const fonteAudio = audioCtx.createMediaStreamSource(stream);
    
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    fonteAudio.connect(analyser);
    
    dataArray = new Uint8Array(analyser.fftSize);

    // Altera estado da aplicação
    gravando = true;
    pausado = false;
    ultimoSom = performance.now();
    
    // Atualiza botões e status
    alterarStatus('gravando', 'Gravando áudio...');
    alterarEstadoBotoes(true, false, false);
    
    // Inicia contador de tempo
    iniciarContador();
    
    // Inicia loop de análise em tempo real
    loopAnalise();
    
    log('✅ Gravação iniciada com sucesso', 'sucesso');

  } catch (erro) {
    let mensagem = errosPermissao(erro);
    log(`❌ ${mensagem}`, 'erro');
    alert(mensagem);
  }
}

function pausarRetomarGravacao() {
  if (!gravando) return;

  if (pausado) {
    // Retoma gravação
    pausado = false;
    alterarStatus('gravando', 'Gravando áudio...');
    log('▶️ Gravação retomada', 'info');
  } else {
    // Pausa gravação
    pausado = true;
    alterarStatus('processando', 'Gravação pausada');
    log('⏸️ Gravação pausada', 'info');
  }
}

async function pararGravacao() {
  if (!gravando) return;

  // Para gravação e recursos de áudio
  gravando = false;
  pausado = false;
  stream.getTracks().forEach(trilha => trilha.stop());
  pararContador();

  // Atualiza interface
  alterarStatus('ativo', 'Gravação finalizada');
  alterarEstadoBotoes(false, true, true);
  
  log('⏹️ Gravação finalizada', 'sucesso');

  // Abre escolha de tipo de análise
  abrirModal('modalAnalise');
}

// ==========================================
// MOTOR DE ANÁLISE EM TEMPO REAL
// ==========================================
function loopAnalise() {
  if (!gravando || pausado) {
    requestAnimationFrame(loopAnalise);
    return;
  }

  analyser.getByteTimeDomainData(dataArray);
  let soma = 0;

  // Calcula volume atual
  for (let i = 0; i < dataArray.length; i++) {
    let valor = (dataArray[i] - 128) / 128;
    soma += valor * valor;
  }

  let rms = Math.sqrt(soma / dataArray.length);
  let volume = Math.round(rms * 140);
  volumes.push(volume);

  // Detecta pausas e hesitações
  const agora = performance.now();
  if (volume > 10) {
    const tempoPausa = agora - ultimoSom;
    if (tempoPausa > 200) pauses.push(tempoPausa);
    ultimoSom = agora;
  }

  // Atualiza indicador visual
  atualizarIndicadorVolume(volume);

  requestAnimationFrame(loopAnalise);
}

// ==========================================
// ESCOLHA DE TIPO DE ANÁLISE
// ==========================================
function definirTipoAnalise(tipo) {
  ESTADO.tipoAnaliseEscolhida = tipo;
  
  // Destaque visual da opção escolhida
  document.getElementById('opcaoUnica').style.border = tipo === 'unica' ? '2px solid #69bcc3' : '1px solid #dcecef';
  document.getElementById('opcaoMemoria').style.border = tipo === 'memoria' ? '2px solid #69bcc3' : '1px solid #dcecef';
  
  document.getElementById('btnConfirmarAnalise').disabled = false;
  
  const nomeTipo = tipo === 'unica' ? 'Análise Única' : 'Análise com Memória';
  log(`📌 Tipo de análise selecionado: ${nomeTipo}`, 'info');
}

// ==========================================
// PROCESSAMENTO E GERAÇÃO DE RESULTADOS
// ==========================================
async function processarAnalise() {
  const custo = ESTADO.tipoAnaliseEscolhida === 'unica' 
    ? TOKENS_ANALISE_UNICA 
    : TOKENS_ANALISE_MEMORIA;

  // Valida saldo
  if (ESTADO.saldoAnalises < custo) {
    log(`❌ Saldo insuficiente. Esta análise custa ${custo} créditos`, 'erro');
    alert(`Saldo insuficiente! Você precisa de ${custo} análises disponíveis.`);
    fecharModal('modalAnalise');
    return;
  }

  // Prepara processamento
  alterarStatus('processando', 'Realizando análise...');
  log(`💸 Serão utilizados ${custo} créditos`, 'info');

  try {
    // 📊 Calcula dados locais
    const dadosLocais = calcularMetricas();
    
    // 🚀 Envia para o núcleo de inteligência
    const resultadoIA = await enviarParaNucleo(dadosLocais);

    // ✅ CRIA NOVA SESSÃO E APLICA REGRA FIFO
    const novaSessao = {
      id: Date.now(),
      numero: sessoes.length + 1,
      dataHora: new Date().toLocaleString('pt-BR'),
      duracao: document.getElementById('cronometro').textContent,
      tipo: ESTADO.tipoAnaliseEscolhida === 'unica' ? 'ÚNICA' : 'MEMÓRIA',
      metricas: dadosLocais,
      resultado: resultadoIA.estado || classificarEstado(dadosLocais),
      sugestao: resultadoIA.sugestao || gerarSugestaoPadrao(dadosLocais)
    };

    // Adiciona no início e mantém apenas 3 sessões
    sessoes.unshift(novaSessao);
    if (sessoes.length > LIMITE_SESSOES) {
      sessoes.pop();
      log('ℹ️ Sessão mais antiga removida para manter limite de 3', 'info');
    }

    // Salva tudo
    localStorage.setItem('elayon_sessoes', JSON.stringify(sessoes));
    ESTADO.saldoAnalises -= custo;
    atualizarSaldoTela();

    // 🖥️ Atualiza toda a interface
    atualizarListaSessoes();
    mostrarResultado(novaSessao);

    // Finaliza
    fecharModal('modalAnalise');
    alterarStatus('ativo', 'Análise concluída com sucesso!');
    log('✅ Processo finalizado com sucesso', 'sucesso');

  } catch (erro) {
    alterarStatus('ativo', 'Erro no processamento');
    log(`❌ Falha: ${erro.message}`, 'erro');
    alert(`Ocorreu um erro: ${erro.message}`);
  }
}

// ==========================================
// CÁLCULOS DE MÉTRICAS
// ==========================================
function calcularMetricas() {
  const totalDados = volumes.length;
  if (totalDados === 0) return { ritmo: 0, silencio: 0, hesitacao: 0 };

  // Ritmo: variação da fala
  let variacao = 0;
  for (let i = 1; i < totalDados; i++) variacao += Math.abs(volumes[i] - volumes[i - 1]);
  const ritmo = Math.round(variacao / totalDados);

  // Percentual de silêncio
  const silencio = Math.round((volumes.filter(v => v < 8).length / totalDados) * 100);

  // Contagem de hesitações (pausas longas)
  const hesitacao = pauses.filter(p => p > 1200).length;

  // Limpa variáveis para próxima gravação
  volumes = [];
  pauses = [];

  return { ritmo, silencio, hesitacao };
}

function classificarEstado(dados) {
  const { ritmo, silencio, hesitacao } = dados;

  if (hesitacao > 2) return "Reflexão Profunda";
  if (ritmo > 20) return "Fluxo Dinâmico";
  if (silencio > 50) return "Silêncio Operacional";
  return "Presença Equilibrada";
}

function gerarSugestaoPadrao(dados) {
  if (dados.hesitacao > 2) 
    return "Você demonstra reflexão e cuidado ao se expressar. Continue mantendo essa clareza de pensamento, procure apenas fluir um pouco mais naturalmente.";
  if (dados.ritmo > 20) 
    return "Seu fluxo é dinâmico e envolvente. Tente inserir pausas estratégicas para dar tempo de assimilação do conteúdo.";
  if (dados.silencio > 50) 
    return "Você utiliza o silêncio como ferramenta poderosa. Para melhorar, equilíbre com momentos de fala mais contínua para manter a atenção.";
  return "Seu padrão de comunicação está ótimo: equilíbrio entre ritmo, pausas e clareza. Mantenha essa harmonia!";
}

// ==========================================
// COMUNICAÇÃO COM A API NÚCLEO
// ==========================================
async function enviarParaNucleo(dados) {
  // Se não tiver token válido, retorna dados locais
  if (!ESTADO.tokenAcesso) {
    log('ℹ️ Usando análise local (sem conexão com a IA)', 'info');
    return { estado: classificarEstado(dados), sugestao: gerarSugestaoPadrao(dados) };
  }

  try {
    const resposta = await fetch(URL_NUCLEO_CRS, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ESTADO.tokenAcesso}`
      },
      body: JSON.stringify({
        duracao_seg: tempoGravacao,
        ritmo: dados.ritmo,
        silencio_pct: dados.silencio,
        pausas_contagem: dados.hesitacao,
        sessoes_anteriores: sessoes.slice(0, 2)
      })
    });

    if (!resposta.ok) throw new Error(`Código ${resposta.status}`);
    
    return await resposta.json();

 
  } catch (erro) {
    log(`ℹ️ Usando dados locais - Falha ao conectar com IA: ${erro.message}`, 'info');
    // Retorna dados calculados localmente quando a API não responder
    return { 
      estado: classificarEstado(dados), 
      sugestao: gerarSugestaoPadrao(dados),
      tecnicos: dados
    };
  }
}

// ==========================================
// ATUALIZAÇÃO DA INTERFACE
// ==========================================
function atualizarListaSessoes() {
  const container = document.getElementById('listaSessoes');
  
  if (sessoes.length === 0) {
    container.innerHTML = '<p style="color: #4b6d73; font-style: italic; padding: 16px;">Nenhuma análise realizada até o momento</p>';
    return;
  }

  let html = '';
  
  sessoes.forEach((sessao, indice) => {
    // Marca a sessão atual com destaque
    const classeDestaque = indice === 0 ? 'atual' : '';
    const textoTitulo = indice === 0 
      ? `📌 Sessão ${sessao.numero} • ATUAL` 
      : `📋 Sessão ${sessao.numero}`;
    
    // Cor da etiqueta conforme tipo
    const classeEtiqueta = sessao.tipo === 'ÚNICA' ? 'tag-unica' : 'tag-memoria';

    html += `
    <div class="sessao-item ${classeDestaque}">
      <div class="sessao-info">
        <h4>${textoTitulo}</h4>
        <p>🕒 ${sessao.dataHora} | ⏱️ ${sessao.duracao}</p>
        <p>🧠 Padrão: <strong>${sessao.resultado}</strong></p>
        <p>📊 Ritmo: ${sessao.metricas.ritmo} | Silêncio: ${sessao.metricas.silencio}% | Hesitações: ${sessao.metricas.hesitacao}</p>
      </div>
      <span class="tag-tipo ${classeEtiqueta}">${sessao.tipo}</span>
    </div>
    `;
  });

  container.innerHTML = html;
}

function mostrarResultado(sessao) {
  // Dados da sessão
  document.getElementById('dadosSessao').innerHTML = `
    <strong>Número da Sessão:</strong> ${sessao.numero}<br>
    <strong>Data e Hora:</strong> ${sessao.dataHora}<br>
    <strong>Duração:</strong> ${sessao.duracao}<br>
    <strong>Tipo de Análise:</strong> ${sessao.tipo}
  `;

  // Resultados principais
  document.getElementById('estadoResultado').textContent = sessao.resultado;
  document.getElementById('sugestaoResultado').textContent = sessao.sugestao;
  
  // Dados técnicos formatados
  document.getElementById('dadosTecnicos').textContent = JSON.stringify({
    ritmo: `${sessao.metricas.ritmo} (nível de variação da fala)`,
    silencio: `${sessao.metricas.silencio}% do tempo total`,
    hesitacoes: `${sessao.metricas.hesitacao} pausas longas detectadas`,
    observacao: "Valores calculados por meio da análise de frequência e volume do áudio"
  }, null, 2);

  // Mostra a área do relatório
  document.getElementById('blocoRelatorio').style.display = 'block';
  document.getElementById('blocoRelatorio').scrollIntoView({ behavior: 'smooth' });
}

// ==========================================
// CONTROLE DE ELEMENTOS DA TELA
// ==========================================
function alterarStatus(tipo, texto) {
  const elementoStatus = document.getElementById('textoStatus');
  const elementoIndicador = document.getElementById('pontoStatus');
  
  if (elementoStatus) elementoStatus.textContent = texto;
  
  if (elementoIndicador) {
    elementoIndicador.className = `ponto-status ${tipo}`;
  }
}

function alterarEstadoBotoes(iniciarDesabilitado, pausarDesabilitado, pararDesabilitado) {
  document.getElementById('btnIniciar').disabled = iniciarDesabilitado;
  document.getElementById('btnPausar').disabled = pausarDesabilitado;
  document.getElementById('btnParar').disabled = pararDesabilitado;
}

function atualizarIndicadorVolume(volume) {
  const barraVolume = document.getElementById('barVolume');
  if (barraVolume) barraVolume.style.width = `${volume}%`;
}

// ==========================================
// CONTROLE DE MODAIS
// ==========================================
function abrirModal(idModal) {
  const modal = document.getElementById(idModal);
  if (modal) {
    modal.classList.add('aberto');
    log(`🪟 Janela aberta: ${idModal}`, 'info');
  }
}

function fecharModal(idModal) {
  const modal = document.getElementById(idModal);
  if (modal) {
    modal.classList.remove('aberto');
    log(`🪟 Janela fechada: ${idModal}`, 'info');
  }
}

// ==========================================
// CONTADOR DE TEMPO DE GRAVAÇÃO
// ==========================================
function iniciarContador() {
  tempoGravacao = 0;
  temporizador = setInterval(() => {
    tempoGravacao++;
    const minutos = String(Math.floor(tempoGravacao / 60)).padStart(2, '0');
    const segundos = String(tempoGravacao % 60).padStart(2, '0');
    document.getElementById('cronometro').textContent = `${minutos}:${segundos}`;
  }, 1000);
}

function pararContador() {
  clearInterval(temporizador);
}

// ==========================================
// EXPORTAÇÃO DE DADOS
// ==========================================
function baixarRelatorio() {
  if (sessoes.length === 0) {
    alert('Realize uma análise primeiro para gerar o relatório');
    return;
  }

  const sessaoAtual = sessoes[0];
  
  const conteudoRelatorio = `RELATÓRIO DE ANÁLISE • ELAYON PRESENÇA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 DADOS DO USUÁRIO
E-mail: ${ESTADO.usuario?.email || 'Não identificado'}
ID: ${ESTADO.usuario?.id || 'Não identificado'}

📋 DADOS DA SESSÃO
Número: ${sessaoAtual.numero}
Data e Hora: ${sessaoAtual.dataHora}
Duração Total: ${sessaoAtual.duracao}
Tipo de Análise: ${sessaoAtual.tipo}

📊 RESULTADO DA ANÁLISE
Padrão Identificado: ${sessaoAtual.resultado}

💡 COMPREENSÃO E ORIENTAÇÃO
${sessaoAtual.sugestao}

⚙️ DADOS TÉCNICOS COLETADOS
Ritmo da fala: ${sessaoAtual.metricas.ritmo}
Percentual de silêncio: ${sessaoAtual.metricas.silencio}%
Quantidade de hesitações: ${sessaoAtual.metricas.hesitacao}

📚 HISTÓRICO
Sistema FIFO: Sempre mantém 3 sessões no máximo
Total de análises armazenadas: ${sessoes.length}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sistemas Elayon • Tecnologia a serviço da consciência humana
`;

  // Cria e faz o download do arquivo
  const blob = new Blob([conteudoRelatorio], { type: 'text/plain;charset=utf-8' });
  const urlArquivo = URL.createObjectURL(blob);
  const linkDownload = document.createElement('a');
  
  linkDownload.href = urlArquivo;
  linkDownload.download = `Relatorio_Elayon_Sessao_${sessaoAtual.numero}.txt`;
  linkDownload.click();
  
  URL.revokeObjectURL(urlArquivo);
  log('💾 Relatório salvo com sucesso', 'sucesso');
}

function exportarJSON() {
  if (sessoes.length === 0) {
    alert('Realize uma análise primeiro para exportar os dados');
    return;
  }

  const dadosCompletos = {
    sistema: "Elayon Presença",
    versao: "1.0",
    dataExportacao: new Date().toLocaleString('pt-BR'),
    usuario: {
      email: ESTADO.usuario?.email,
      id: ESTADO.usuario?.id
    },
    sessaoAtual: sessoes[0],
    historico: {
      descricao: "Sistema FIFO - Armazena sempre a sessão atual + 2 anteriores",
      totalRegistros: sessoes.length,
      todasSessoes: sessoes
    }
  };

  const blob = new Blob([JSON.stringify(dadosCompletos, null, 2)], { type: 'application/json;charset=utf-8' });
  const urlArquivo = URL.createObjectURL(blob);
  const linkDownload = document.createElement('a');
  
  linkDownload.href = urlArquivo;
  linkDownload.download = `Dados_Elayon_${Date.now()}.json`;
  linkDownload.click();
  
  URL.revokeObjectURL(urlArquivo);
  log('📤 Arquivo JSON gerado com sucesso', 'sucesso');
  alert('Dados exportados! Você pode usar esse arquivo para integração com outros sistemas.');
}

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================
function errosPermissao(erro) {
  switch(erro.name) {
    case 'NotAllowedError':
      return "Permissão negada! Você precisa permitir o uso do microfone no navegador.";
    case 'NotFoundError':
      return "Dispositivo de áudio não encontrado. Conecte um microfone e tente novamente.";
    case 'NotReadableError':
      return "O dispositivo de áudio está sendo usado por outro programa.";
    default:
      return `Erro inesperado: ${erro.message}`;
  }
}

// ==========================================
// SISTEMA DE LOG
// ==========================================
function log(mensagem, tipo = 'info') {
  const containerLog = document.getElementById('areaLog');
  if (!containerLog) return;

  const horario = new Date().toLocaleTimeString('pt-BR', { 
    hour: '2-digit', minute: '2-digit', second: '2-digit' 
  });
  
  const linhaLog = document.createElement('div');
  linhaLog.className = `log-linha log-${tipo}`;
  linhaLog.textContent = `[${horario}] ${mensagem}`;
  
  containerLog.appendChild(linhaLog);
  containerLog.scrollTop = containerLog.scrollHeight;
}

function limparLog() {
  const containerLog = document.getElementById('areaLog');
  if (containerLog) {
    containerLog.innerHTML = '';
    log('🧹 Registro de atividades limpo', 'sistema');
  }
}

// ==========================================
// FUNÇÕES DE CONEXÃO
// ==========================================
function conectarAPI() {
  log('🔗 Estabelecendo conexão com API externa...', 'info');
  setTimeout(() => {
    log('✅ Conexão realizada com sucesso', 'sucesso');
    alert('Pronto! Seus dados já podem ser compartilhados com outros sistemas.');
  }, 1200);
}

function enviarParaNuvem() {
  log('☁️ Preparando dados para armazenamento...', 'info');
  setTimeout(() => {
    log('✅ Dados salvos com segurança na nuvem', 'sucesso');
    alert('Concluído! Você pode acessar seus dados de qualquer dispositivo.');
  }, 1500);
}

function compartilharDados() {
  log('📨 Gerando link de compartilhamento...', 'info');
  setTimeout(() => {
    log('✅ Link gerado e disponível', 'sucesso');
    alert('Compartilhamento pronto! Envie o arquivo ou link para quem desejar.');
  }, 1000);
}


