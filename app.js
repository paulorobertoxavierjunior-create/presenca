/* ═══════════════════════════════════════════════════════════
   ELAYON · PRESENÇA V3.1 · NÚCLEO CRS + CHAT SILENCIOSO
═══════════════════════════════════════════════════════════ */

var SUPA_URL     = 'https://eudcjihffrfmhzmfwtlg.supabase.co';
var SUPA_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1ZGNqaWhmZnJmbWh6bWZ3dGxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NDE3MjUsImV4cCI6MjA5MDMxNzcyNX0.2tod6vvl_4SAXzSmW1wU8Mk9pLn8fvhF2xrAZOysUu0';
var CRS_ENDPOINT = 'https://nucleo-crs-elayon.onrender.com/api/crs/analisar';
var LOGIN_URL    = 'https://paulorobertoxavierjunior-create.github.io/elayon-cadastro/login.html';
var CALIB_URL    = 'https://paulorobertoxavierjunior-create.github.io/elayon-avaliacao/';

var supa = window.supabase.createClient(SUPA_URL, SUPA_KEY);

/* ── Estado global ── */
var userId           = null;
var accessToken      = null;
var tokens           = 0;
var MAX_TOKENS       = 50;
var tipoAnalise      = 'unica';
var calibRef         = null;
var micRec           = null;
var micStream        = null;
var micChunks        = [];
var micGravando      = false;
var micTimerInt      = null;
var micSegundos      = 0;
var MAX_SESSOES      = 3;
var sessoesFifo      = [];
var tokensConsumidos = 0;
var PERIODI_CADA     = 4;
var calibPeriodRod   = false;

/* ── Config IA ── */
var iaHabilitada  = false;
var apiEndpointIA = '';
var claudeApiKey  = '';
var analisesSalvas = [];
var MAX_ANALISES   = 3;

/* ── Chat ── */
var CHAT_HISTORICO = [];

/* ══════════════════════════════════════════════════════════
   CONFIG IA
══════════════════════════════════════════════════════════ */
function carregarConfigIA() {
  var cfg = localStorage.getItem('elayon_ia_config');
  if (cfg) {
    try {
      var parsed = JSON.parse(cfg);
      iaHabilitada  = parsed.enabled  || false;
      apiEndpointIA = parsed.endpoint || '';
    } catch(e) {}
  }
  claudeApiKey = localStorage.getItem('elayon_claude_key') || '';

  var analises = localStorage.getItem('elayon_analises');
  if (analises) { try { analisesSalvas = JSON.parse(analises); } catch(e) {} }

  atualizarUIAnalises();

  var toggleEl   = document.getElementById('toggleIA');
  var endpointEl = document.getElementById('apiEndpoint');
  var keyEl      = document.getElementById('claudeApiKey');
  if (toggleEl)   toggleEl.checked  = iaHabilitada;
  if (endpointEl) endpointEl.value  = apiEndpointIA;
  if (keyEl)      keyEl.value       = claudeApiKey;
}

function salvarConfiguracao() {
  var endpointEl = document.getElementById('apiEndpoint');
  var keyEl      = document.getElementById('claudeApiKey');
  var provEl     = document.getElementById('iaProvedor');

  if (endpointEl && endpointEl.value.trim()) apiEndpointIA = endpointEl.value.trim();
  if (keyEl      && keyEl.value.trim())      iaChave       = keyEl.value.trim();
  if (provEl)                                iaProvedor    = provEl.value;

  localStorage.setItem('elayon_claude_key', iaChave);
  localStorage.setItem('elayon_ia_config', JSON.stringify({
    enabled:  iaHabilitada,
    endpoint: apiEndpointIA,
    provedor: iaProvedor,
    chave:    iaChave
  }));
  alert('Configuração salva. Pode usar o chat.');
}

function toggleIA(checked) {
  iaHabilitada = checked;
  localStorage.setItem('elayon_ia_config', JSON.stringify({
    enabled:  iaHabilitada,
    endpoint: apiEndpointIA
  }));
}

/* ── Análises salvas ── */
function adicionarAnalise(dados, nomeCustomizado) {
  var timestamp = new Date().toLocaleString('pt-BR');
  var id = 'analise_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  analisesSalvas.unshift({ id: id, timestamp: timestamp, nome: nomeCustomizado || 'Análise ' + timestamp, dados: dados });
  if (analisesSalvas.length > MAX_ANALISES) analisesSalvas = analisesSalvas.slice(0, MAX_ANALISES);
  localStorage.setItem('elayon_analises', JSON.stringify(analisesSalvas));
  atualizarUIAnalises();
}

function atualizarUIAnalises() {
  var cont = document.getElementById('analisesList');
  if (!cont) return;
  if (analisesSalvas.length === 0) {
    cont.innerHTML = '<p style="font-size:12px;color:var(--muted);text-align:center;padding:20px 0;">Nenhuma análise salva ainda</p>';
    return;
  }
  var html = '';
  analisesSalvas.forEach(function(a) {
    html += '<div class="analise-item">'
          + '<span class="analise-nome">' + escHtml(a.nome) + '</span>'
          + '<span class="analise-data">' + a.timestamp + '</span>'
          + '<div class="analise-acoes">'
          + '<button class="analise-btn" onclick="renomearAnalise(\'' + a.id + '\')">✎</button>'
          + '<button class="analise-btn" onclick="baixarAnalise(\'' + a.id + '\')">⬇</button>'
          + '<button class="analise-btn" onclick="removerAnalise(\'' + a.id + '\')">✕</button>'
          + '</div></div>';
  });
  cont.innerHTML = html;
}

function renomearAnalise(id) {
  var a = analisesSalvas.find(function(x) { return x.id === id; });
  if (!a) return;
  var n = prompt('Novo nome:', a.nome);
  if (n && n.trim()) { a.nome = n.trim(); localStorage.setItem('elayon_analises', JSON.stringify(analisesSalvas)); atualizarUIAnalises(); }
}

function baixarAnalise(id) {
  var a = analisesSalvas.find(function(x) { return x.id === id; });
  if (!a) return;
  var blob = new Blob([JSON.stringify(a.dados, null, 2)], { type: 'application/json' });
  var url  = URL.createObjectURL(blob);
  var link = document.createElement('a');
  link.href = url; link.download = a.nome.replace(/\s+/g,'_') + '_' + Date.now() + '.json';
  link.click(); URL.revokeObjectURL(url);
}

function removerAnalise(id) {
  if (!confirm('Remover esta análise?')) return;
  analisesSalvas = analisesSalvas.filter(function(x) { return x.id !== id; });
  localStorage.setItem('elayon_analises', JSON.stringify(analisesSalvas));
  atualizarUIAnalises();
}

async function enviarParaIA(payload) {
  if (!iaHabilitada || !apiEndpointIA) return;
  try {
    var res = await fetch(apiEndpointIA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      adicionarAnalise(payload, 'Análise IA - ' + new Date().toLocaleTimeString('pt-BR'));
      return await res.json();
    }
  } catch(e) { console.error('Erro enviarParaIA:', e); }
}

/* ══════════════════════════════════════════════════════════
   BOOT
══════════════════════════════════════════════════════════ */
(async function boot() {
  var params = new URLSearchParams(window.location.search);
  var at = params.get('at'), rt = params.get('rt');
  if (at && rt) {
    await supa.auth.setSession({ access_token: decodeURIComponent(at), refresh_token: decodeURIComponent(rt) });
    window.history.replaceState({}, '', window.location.pathname);
  }

  var sess    = await supa.auth.getSession();
  var session = sess && sess.data && sess.data.session ? sess.data.session : null;
  if (!session) { window.location.href = LOGIN_URL; return; }

  userId      = session.user.id;
  accessToken = session.access_token;
  document.getElementById('hudId').textContent = (session.user.email || '').split('@')[0].toUpperCase();

  await carregarTokens();

  var calibSalva = localStorage.getItem('elayon_calib_ref');
  var fifoSalvo  = localStorage.getItem('elayon_sessoes_fifo');
  var consSalvo  = localStorage.getItem('elayon_tokens_consumidos');
  if (calibSalva) try { calibRef     = JSON.parse(calibSalva); } catch(e) {}
  if (fifoSalvo)  try { sessoesFifo  = JSON.parse(fifoSalvo);  } catch(e) {}
  if (consSalvo)  tokensConsumidos   = parseInt(consSalvo) || 0;

  var calibNestaSessao = sessionStorage.getItem('elayon_calibrado');
  var f1 = localStorage.getItem('audio_fase_1');
  var f2 = localStorage.getItem('audio_fase_2');
  var f3 = localStorage.getItem('audio_fase_3');

  if (f1 && f2 && f3 && !calibNestaSessao) {
    mostrarCalibracao();
    await processarCalibracaoInicial();
    localStorage.removeItem('audio_fase_1');
    localStorage.removeItem('audio_fase_2');
    localStorage.removeItem('audio_fase_3');
  } else if (calibRef && calibNestaSessao) {
    abrirMic();
    atualizarHudCalib();
  } else {
    mostrarCalibracao();
  }

  carregarConfigIA();
  atualizarUI_tokens();
  chatBoot();
})();

/* ══════════════════════════════════════════════════════════
   TOKENS
══════════════════════════════════════════════════════════ */
async function carregarTokens() {
  var r = await supa.from('profiles').select('tokens').eq('id', userId).single();
  tokens = r.data ? r.data.tokens : 0;
  atualizarUI_tokens();
}

function atualizarUI_tokens() {
  document.getElementById('hudTokens').textContent    = tokens;
  document.getElementById('tokensGrande').textContent = tokens;
  var pct = Math.min(100, (tokens / MAX_TOKENS) * 100);
  document.getElementById('tokensBar').style.width = pct + '%';
  var custo = tipoAnalise === 'unica' ? 1 : 2;
  var temSessao = sessoesFifo.length > 0;
  var temToken  = tokens >= custo;
  var btn = document.getElementById('btnAnalisar');
  if (btn) btn.disabled = !(temSessao && temToken);
  var aviso = document.getElementById('tokenSemAviso');
  if (aviso) aviso.style.display = (temSessao && !temToken) ? 'block' : 'none';
}

async function creditarTokens(qtd) {
  var r = await supa.rpc('adicionar_tokens', { p_user_id: userId, p_quantidade: qtd });
  if (!r.error) { tokens += qtd; atualizarUI_tokens(); }
  return !r.error;
}

async function debitarTokens(qtd) {
  var r = await supa.rpc('adicionar_tokens', { p_user_id: userId, p_quantidade: -qtd });
  if (!r.error) {
    tokens -= qtd;
    tokensConsumidos += qtd;
    localStorage.setItem('elayon_tokens_consumidos', tokensConsumidos);
    atualizarUI_tokens();
    verificarCalibracaoPeriodica();
  }
  return !r.error;
}

/* ══════════════════════════════════════════════════════════
   CALIBRAÇÃO PERIÓDICA
══════════════════════════════════════════════════════════ */
async function verificarCalibracaoPeriodica() {
  if (calibPeriodRod || tokensConsumidos < PERIODI_CADA || sessoesFifo.length === 0) return;
  tokensConsumidos = 0;
  localStorage.setItem('elayon_tokens_consumidos', 0);
  calibPeriodRod = true;
  await creditarTokens(2);
  var vetores = sessoesFifo.slice(0, 3);
  var novoRef = consolidarVetores(vetores, vetores.map(function() { return 1 / vetores.length; }));
  novoRef.context = 'calibracao_periodica';
  try {
    var data = await enviarAoRender(novoRef);
    if (data.ok) {
      calibRef = { timestamp: new Date().toISOString(), tipo: 'periodica', fases: calibRef ? calibRef.fases : null, ref: novoRef, crs: data };
      localStorage.setItem('elayon_calib_ref', JSON.stringify(calibRef));
      atualizarHudCalib();
    }
  } catch(e) {
    await creditarTokens(2); calibPeriodRod = false; return;
  }
  var rd = await supa.rpc('adicionar_tokens', { p_user_id: userId, p_quantidade: -2 });
  if (!rd.error) { tokens -= 2; atualizarUI_tokens(); }
  calibPeriodRod = false;
}

/* ══════════════════════════════════════════════════════════
   CALIBRAÇÃO INICIAL
══════════════════════════════════════════════════════════ */
function mostrarCalibracao() {
  document.getElementById('calibAba').classList.remove('fechada');
  document.getElementById('micCard').classList.add('hidden');
}

function abrirMic() {
  document.getElementById('calibAba').classList.add('fechada');
  document.getElementById('micCard').classList.remove('hidden');
  renderizarSessoes();
}

async function processarCalibracaoInicial() {
  setStatus('Processando calibração — aguarde...');
  var f1 = localStorage.getItem('audio_fase_1');
  var f2 = localStorage.getItem('audio_fase_2');
  var f3 = localStorage.getItem('audio_fase_3');
  if (!f1 || !f2 || !f3) return;

  var v1 = await extrairMetricasDeAudio(f1, 'Fase 01');
  var v2 = await extrairMetricasDeAudio(f2, 'Fase 02');
  var v3 = await extrairMetricasDeAudio(f3, 'Fase 03');
  v1.context = 'calibracao_fase_01_estado_emissor';
  v2.context = 'calibracao_fase_02_intencao';
  v3.context = 'calibracao_fase_03_comprometimento';

  var r1 = await enviarAoRender(v1);
  var r2 = await enviarAoRender(v2);
  var r3 = await enviarAoRender(v3);

  var refVetor = consolidarVetores([v1, v2, v3], [0.3, 0.3, 0.4]);
  refVetor.context = 'calibracao_ref_consolidado';
  var refCrs = await enviarAoRender(refVetor);

  calibRef = {
    timestamp: new Date().toISOString(), tipo: 'inicial',
    fases: { f1: { vetor: v1, crs: r1 }, f2: { vetor: v2, crs: r2 }, f3: { vetor: v3, crs: r3 } },
    ref: refVetor, refCrs: refCrs
  };

  localStorage.setItem('elayon_calib_ref', JSON.stringify(calibRef));
  sessionStorage.setItem('elayon_calibrado', '1');
  await creditarTokens(2);
  setStatus('');
  atualizarHudCalib();
  abrirMic();
  exibirRelatorioVisual({ titulo: 'Calibração Inicial', subtitulo: 'Leitura de referência registrada. O sistema está calibrado.', sessao: refVetor, crs: refCrs, delta: null, calibRef: calibRef, ehCalib: true });
}

function atualizarHudCalib() {
  var el = document.getElementById('hudCalibTs');
  if (!calibRef || !el) return;
  var d  = new Date(calibRef.timestamp);
  var hr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  el.textContent = 'CAL ' + (calibRef.tipo === 'periodica' ? '↺' : '✓') + ' ' + hr;
}

function irCalibrar() {
  localStorage.removeItem('audio_fase_1');
  localStorage.removeItem('audio_fase_2');
  localStorage.removeItem('audio_fase_3');
  sessionStorage.removeItem('elayon_calibrado');
  window.location.href = CALIB_URL;
}

/* ══════════════════════════════════════════════════════════
   MIC DE ESCUTA
══════════════════════════════════════════════════════════ */
function micIniciar() {
  if (micGravando) return;
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(function(s) {
      micStream = s; micChunks = [];
      micRec = new MediaRecorder(s);
      micRec.ondataavailable = function(ev) { if (ev.data.size > 0) micChunks.push(ev.data); };
      micRec.start(100);
      micGravando = true; micSegundos = 0;
      micTimerInt = setInterval(function() { micSegundos++; document.getElementById('micTimer').textContent = fmt(micSegundos); }, 1000);
      setWave(true);
      document.getElementById('micEstado').textContent = 'Gravando...';
      document.getElementById('micEstado').className   = 'mic-estado gravando';
      document.getElementById('micBtnIniciar').classList.add('hidden');
      document.getElementById('micBtnParar').classList.remove('hidden');
    })
    .catch(function() { document.getElementById('micEstado').textContent = 'Microfone indisponível'; });
}

function micParar() {
  if (!micGravando || !micRec) return;
  clearInterval(micTimerInt);
  micGravando = false;
  micRec.onstop = async function() {
    var blob    = new Blob(micChunks, { type: 'audio/webm' });
    var dataUrl = await blobToDataUrl(blob);
    var vetor   = await extrairMetricasDeAudio(dataUrl, 'Sessão');
    vetor.context = 'leitura_mic_' + new Date().toISOString();
    sessoesFifo.unshift(vetor);
    if (sessoesFifo.length > MAX_SESSOES) sessoesFifo = sessoesFifo.slice(0, MAX_SESSOES);
    localStorage.setItem('elayon_sessoes_fifo', JSON.stringify(sessoesFifo));
    renderizarSessoes();
    atualizarUI_tokens();
    document.getElementById('micEstado').textContent = 'Sessão registrada.';
    document.getElementById('micEstado').className   = 'mic-estado pronto';
  };
  micRec.stop();
  micStream.getTracks().forEach(function(t) { t.stop(); });
  setWave(false);
  document.getElementById('micBtnParar').classList.add('hidden');
  document.getElementById('micBtnIniciar').classList.remove('hidden');
  document.getElementById('micTimer').textContent = '00:00';
}

function renderizarSessoes() {
  var cont = document.getElementById('sessoesFifo');
  if (!cont) return;
  if (sessoesFifo.length === 0) { cont.innerHTML = ''; return; }
  var html = '<span class="sessoes-label">Sessões — FIFO</span>';
  sessoesFifo.forEach(function(s, i) {
    var ts = (s.context || '').replace('leitura_mic_', '');
    var d  = new Date(ts);
    var hr = isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    html += '<div class="sessao-item' + (i === 0 ? ' sessao-atual' : '') + '">'
          + '<span class="sessao-idx">S' + (i+1) + (i === 0 ? ' ←' : '') + '</span>'
          + '<span class="sessao-info">' + hr + ' · ' + (s.duration_sec || 0) + 's</span>'
          + '</div>';
  });
  cont.innerHTML = html;
}

/* ══════════════════════════════════════════════════════════
   ANÁLISE CRS
══════════════════════════════════════════════════════════ */
async function iniciarAnalise() {
  var custo = tipoAnalise === 'unica' ? 1 : 2;
  if (tokens < custo || sessoesFifo.length === 0) return;
  document.getElementById('btnAnalisar').disabled         = true;
  document.getElementById('spinnerAnalise').style.display = 'block';
  document.getElementById('cardResultado').classList.add('hidden');
  setStatus('');
  try {
    var sessaoAtual;
    if (tipoAnalise === 'unica') {
      sessaoAtual = sessoesFifo[0];
    } else {
      var n = sessoesFifo.length;
      sessaoAtual = consolidarVetores(sessoesFifo, sessoesFifo.map(function() { return 1/n; }));
      sessaoAtual.context = 'leitura_memoria_' + n + '_sessoes';
    }
    var delta   = calcularDelta(sessaoAtual, calibRef ? calibRef.ref : null);
    var payload = montarPayload(sessaoAtual, delta);
    document.getElementById('spinnerMsg').innerHTML = 'Transmitindo ao núcleo CRS.<br>Aguarde.';
    var data = await enviarAoRender(payload);
    exibirRelatorioVisual({ titulo: data.analise_sugestiva || 'Leitura CRS', subtitulo: data.sugestao_ia || '—', sessao: sessaoAtual, crs: data, delta: delta, calibRef: calibRef, ehCalib: false });
    if (iaHabilitada && apiEndpointIA) await enviarParaIA(payload);
    await debitarTokens(custo);
  } catch(e) {
    console.error('Erro CRS:', e);
    document.getElementById('cardResultado').classList.remove('hidden');
    document.getElementById('cardResultado').innerHTML =
      '<span class="card-label">Erro de comunicação</span>'
      + '<p class="resultado-texto">Não foi possível conectar ao núcleo.</p>'
      + '<button class="btn btn-ghost" style="margin-top:16px;" onclick="document.getElementById(\'cardResultado\').classList.add(\'hidden\')">Fechar</button>';
    document.getElementById('btnAnalisar').disabled = false;
  }
  document.getElementById('spinnerAnalise').style.display = 'none';
}

function montarPayload(sessao, delta) {
  return {
    duration_sec: sessao.duration_sec, silence_pct: sessao.silence_pct,
    pause_count: sessao.pause_count, mean_pause_ms: sessao.mean_pause_ms,
    oscillation_pct: sessao.oscillation_pct, continuity_pct: sessao.continuity_pct,
    energy_pct: sessao.energy_pct, spectrum_snapshot: sessao.spectrum_snapshot,
    context: sessao.context || 'leitura', transcript_raw: '',
    calibracao_ref: calibRef ? {
      timestamp: calibRef.timestamp, tipo: calibRef.tipo, ref: calibRef.ref,
      fases: calibRef.fases ? {
        f1: { estado: calibRef.fases.f1 && calibRef.fases.f1.crs ? calibRef.fases.f1.crs.analise_sugestiva : '—' },
        f2: { estado: calibRef.fases.f2 && calibRef.fases.f2.crs ? calibRef.fases.f2.crs.analise_sugestiva : '—' },
        f3: { estado: calibRef.fases.f3 && calibRef.fases.f3.crs ? calibRef.fases.f3.crs.analise_sugestiva : '—' }
      } : null
    } : null,
    delta: delta
  };
}

async function enviarAoRender(payload) {
  var res = await fetch(CRS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken },
    body: JSON.stringify(payload)
  });
  return res.json();
}

/* ══════════════════════════════════════════════════════════
   CHAT CRS SILENCIOSO
══════════════════════════════════════════════════════════ */
function chatBoot() {
  chatAdicionarMensagem('ai', 'Sistema iniciado. Calibração carregada.\n\nPode falar o que precisar.');
  var input = document.getElementById('chatInput');
  if (!input) return;
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); chatEnviar(); }
  });
  input.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 100) + 'px';
  });
}

async function chatEnviar() {
  var input = document.getElementById('chatInput');
  var btn   = document.getElementById('chatBtnEnviar');
  if (!input) return;
  var texto = input.value.trim();
  if (!texto) return;
  input.value = ''; input.style.height = 'auto';
  if (btn) btn.disabled = true;

  chatAdicionarMensagem('user', texto);
  CHAT_HISTORICO.push({ role: 'user', content: texto });
  chatMostrarTyping(true);
  chatSetCrsStatus('lendo');

  try {
    var vetor     = chatMontarVetorAtual();
    var relatorio = await chatChamarNucleo(vetor);
    chatSetCrsStatus('ativo');
    var system    = chatMontarSystem(relatorio);
    var resposta  = await chatChamarClaude(system, CHAT_HISTORICO);
    chatMostrarTyping(false);
    chatAdicionarMensagem('ai', resposta);
    CHAT_HISTORICO.push({ role: 'assistant', content: resposta });
    if (CHAT_HISTORICO.length > 20) CHAT_HISTORICO = CHAT_HISTORICO.slice(-20);
  } catch(e) {
    chatMostrarTyping(false);
    chatSetCrsStatus('inativo');
    var msg = e.message && e.message.indexOf('Chave') >= 0
      ? 'Configure a chave Claude API no card de configuração e salve.'
      : 'Não foi possível processar. Verifique a conexão.';
    chatAdicionarMensagem('ai', msg);
  }

  if (btn) btn.disabled = false;
  if (input) input.focus();
}

function chatMontarVetorAtual() {
  if (sessoesFifo && sessoesFifo.length > 0) return sessoesFifo[0];
  if (calibRef && calibRef.ref) return calibRef.ref;
  return { duration_sec: 30, silence_pct: 20, pause_count: 3, mean_pause_ms: 300,
           oscillation_pct: 25, continuity_pct: 75, energy_pct: 60, stability_pct: 70,
           spectrum_snapshot: { graves: 50, medios: 60, agudos: 40, ruido: 20, estabilidade: 75 } };
}

async function chatChamarNucleo(vetor) {
  if (!accessToken) return null;
  try {
    var payload = montarPayload(vetor, calcularDelta(vetor, calibRef ? calibRef.ref : null));
    payload.context = 'chat_' + new Date().toISOString();
    var res = await fetch(CRS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken },
      body: JSON.stringify(payload)
    });
    return res.ok ? await res.json() : null;
  } catch(e) { return null; }
}

function chatMontarSystem(rel) {
  var estado    = rel && rel.analise_sugestiva ? rel.analise_sugestiva : null;
  var instrucao = rel && rel.sugestao_ia       ? rel.sugestao_ia       : null;
  var s = 'Você é um assistente do sistema Elayon. Responda em português brasileiro. '
    + 'Seja direto, acolhedor e objetivo. Conduza a conversa para a melhor interação possível. '
    + 'Nunca mencione análise de voz, CRS, calibração ou qualquer processo técnico — '
    + 'a menos que o usuário pergunte explicitamente sobre o CRS. '
    + 'Se perguntado sobre CRS, explique: é um sistema que lê padrões rítmicos da fala '
    + 'para calibrar silenciosamente como a IA se comunica.';
  if (estado && instrucao)
    s += '\n\n[ESTADO DO EMISSOR — NÃO MENCIONAR]: ' + estado + '. [INSTRUÇÃO DE CALIBRAÇÃO]: ' + instrucao;
  return s;
}

async function chatChamarClaude(system, historico) {
  if (!claudeApiKey) throw new Error('Chave Claude não configurada');
  var res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': claudeApiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: system,
      messages: historico
    })
  });
  if (!res.ok) throw new Error('Claude API: ' + res.status);
  var data = await res.json();
  return data.content && data.content[0] ? data.content[0].text : '—';
}

function chatAdicionarMensagem(role, texto) {
  var wrap = document.getElementById('chatMensagens');
  if (!wrap) return;
  var div    = document.createElement('div');
  div.className = 'chat-msg chat-' + role;
  var bubble = document.createElement('div');
  bubble.className  = 'chat-bubble';
  bubble.textContent = texto;
  var meta = document.createElement('div');
  meta.className  = 'chat-meta';
  meta.textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  div.appendChild(bubble);
  div.appendChild(meta);
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
}

function chatMostrarTyping(mostrar) {
  var wrap = document.getElementById('chatMensagens');
  if (!wrap) return;
  var ex = document.getElementById('chatTyping');
  if (ex) ex.remove();
  if (!mostrar) return;
  var div = document.createElement('div');
  div.id = 'chatTyping'; div.className = 'chat-msg chat-ai';
  div.innerHTML = '<div class="chat-bubble chat-typing">'
    + '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>'
    + '</div>';
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
}

function chatSetCrsStatus(estado) {
  var dot   = document.getElementById('chatCrsDot');
  var label = document.getElementById('chatCrsLabel');
  if (!dot || !label) return;
  dot.className    = 'crs-dot' + (estado === 'lendo' ? ' lendo' : estado === 'ativo' ? ' ativo' : '');
  label.textContent = estado === 'lendo' ? 'CRS LENDO' : estado === 'ativo' ? 'CRS ATIVO' : 'CRS INATIVO';
}


/* ══════════════════════════════════════════════════════════
   CHAT CRS SILENCIOSO
══════════════════════════════════════════════════════════ */
function chatBoot() {
  chatAdicionarMensagem('ai', 'Sistema iniciado. Calibração carregada.\n\nPode falar o que precisar.');
  var input = document.getElementById('chatInput');
  if (!input) return;
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); chatEnviar(); }
  });
  input.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 100) + 'px';
  });
}

async function chatEnviar() {
  var input = document.getElementById('chatInput');
  var btn   = document.getElementById('chatBtnEnviar');
  if (!input) return;
  var texto = input.value.trim();
  if (!texto) return;
  input.value = ''; input.style.height = 'auto';
  if (btn) btn.disabled = true;

  chatAdicionarMensagem('user', texto);
  CHAT_HISTORICO.push({ role: 'user', content: texto });
  chatMostrarTyping(true);
  chatSetCrsStatus('lendo');

  try {
    var vetor     = chatMontarVetorAtual();
    var relatorio = await chatChamarNucleo(vetor);
    chatSetCrsStatus('ativo');
    var system    = chatMontarSystem(relatorio);
    var resposta  = await chatChamarClaude(system, CHAT_HISTORICO);
    chatMostrarTyping(false);
    chatAdicionarMensagem('ai', resposta);
    CHAT_HISTORICO.push({ role: 'assistant', content: resposta });
    if (CHAT_HISTORICO.length > 20) CHAT_HISTORICO = CHAT_HISTORICO.slice(-20);
  } catch(e) {
    chatMostrarTyping(false);
    chatSetCrsStatus('inativo');
    var msg = e.message && e.message.indexOf('Chave') >= 0
      ? 'Configure a chave Claude API no card de configuração e salve.'
      : 'Não foi possível processar. Verifique a conexão.';
    chatAdicionarMensagem('ai', msg);
  }

  if (btn) btn.disabled = false;
  if (input) input.focus();
}

function chatMontarVetorAtual() {
  if (sessoesFifo && sessoesFifo.length > 0) return sessoesFifo[0];
  if (calibRef && calibRef.ref) return calibRef.ref;
  return { duration_sec: 30, silence_pct: 20, pause_count: 3, mean_pause_ms: 300,
           oscillation_pct: 25, continuity_pct: 75, energy_pct: 60, stability_pct: 70,
           spectrum_snapshot: { graves: 50, medios: 60, agudos: 40, ruido: 20, estabilidade: 75 } };
}

async function chatChamarNucleo(vetor) {
  if (!accessToken) return null;
  try {
    var payload = montarPayload(vetor, calcularDelta(vetor, calibRef ? calibRef.ref : null));
    payload.context = 'chat_' + new Date().toISOString();
    var res = await fetch(CRS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken },
      body: JSON.stringify(payload)
    });
    return res.ok ? await res.json() : null;
  } catch(e) { return null; }
}

function chatMontarSystem(rel) {
  var estado    = rel && rel.analise_sugestiva ? rel.analise_sugestiva : null;
  var instrucao = rel && rel.sugestao_ia       ? rel.sugestao_ia       : null;
  var s = 'Você é um assistente do sistema Elayon. Responda em português brasileiro. '
    + 'Seja direto, acolhedor e objetivo. Conduza a conversa para a melhor interação possível. '
    + 'Nunca mencione análise de voz, CRS, calibração ou qualquer processo técnico — '
    + 'a menos que o usuário pergunte explicitamente sobre o CRS. '
    + 'Se perguntado sobre CRS, explique: é um sistema que lê padrões rítmicos da fala '
    + 'para calibrar silenciosamente como a IA se comunica.';
  if (estado && instrucao)
    s += '\n\n[ESTADO DO EMISSOR — NÃO MENCIONAR]: ' + estado + '. [INSTRUÇÃO DE CALIBRAÇÃO]: ' + instrucao;
  return s;
}

async function chatChamarClaude(system, historico) {
  if (!claudeApiKey) throw new Error('Chave Claude não configurada');
  var res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': claudeApiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: system,
      messages: historico
    })
  });
  if (!res.ok) throw new Error('Claude API: ' + res.status);
  var data = await res.json();
  return data.content && data.content[0] ? data.content[0].text : '—';
}

function chatAdicionarMensagem(role, texto) {
  var wrap = document.getElementById('chatMensagens');
  if (!wrap) return;
  var div    = document.createElement('div');
  div.className = 'chat-msg chat-' + role;
  var bubble = document.createElement('div');
  bubble.className  = 'chat-bubble';
  bubble.textContent = texto;
  var meta = document.createElement('div');
  meta.className  = 'chat-meta';
  meta.textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  div.appendChild(bubble);
  div.appendChild(meta);
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
}

function chatMostrarTyping(mostrar) {
  var wrap = document.getElementById('chatMensagens');
  if (!wrap) return;
  var ex = document.getElementById('chatTyping');
  if (ex) ex.remove();
  if (!mostrar) return;
  var div = document.createElement('div');
  div.id = 'chatTyping'; div.className = 'chat-msg chat-ai';
  div.innerHTML = '<div class="chat-bubble chat-typing">'
    + '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>'
    + '</div>';
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
}

function chatSetCrsStatus(estado) {
  var dot   = document.getElementById('chatCrsDot');
  var label = document.getElementById('chatCrsLabel');
  if (!dot || !label) return;
  dot.className    = 'crs-dot' + (estado === 'lendo' ? ' lendo' : estado === 'ativo' ? ' ativo' : '');
  label.textContent = estado === 'lendo' ? 'CRS LENDO' : estado === 'ativo' ? 'CRS ATIVO' : 'CRS INATIVO';
}


/* ══════════════════════════════════════════════════════════
   RELATÓRIO VISUAL
══════════════════════════════════════════════════════════ */
function exibirRelatorioVisual(opts) {
  var card = document.getElementById('cardResultado');
  card.classList.remove('hidden');
  var s    = opts.sessao || {};
  var rel  = (opts.crs && opts.crs.relatorio) ? opts.crs.relatorio : {};
  var snap = rel.snapshot_sonoro || s.spectrum_snapshot || {};
  var silP  = rel.porcentagem_silencio || s.silence_pct    || 0;
  var engP  = rel.energia_pct          || s.energy_pct      || 0;
  var oscP  = rel.oscilacao_pct        || s.oscillation_pct || 0;
  var contP = rel.continuidade_pct     || s.continuity_pct  || 0;
  var dur   = rel.tempo_total          || s.duration_sec     || 0;
  var pausas= rel.total_pausas         || s.pause_count      || 0;
  var html  = '';

  html += '<div class="estado-tag">' + escHtml(opts.titulo || '—') + '</div>';
  html += '<div class="resultado-bloco"><h4>' + (opts.ehCalib ? 'Referência registrada' : 'Instrução à IA receptora') + '</h4>';
  html += '<p class="resultado-texto">' + escHtml(opts.subtitulo || '—') + '</p></div><div class="sep"></div>';

  html += '<div class="resultado-bloco"><h4>Sinais extraídos</h4><div class="metricas-grid">';
  [{ l:'Silêncio', v:silP, max:100, u:'%', c:'#3ecfcf' }, { l:'Energia', v:engP, max:100, u:'%', c:'#2a9d8f' },
   { l:'Oscilação', v:oscP, max:100, u:'%', c:'#e9c46a' }, { l:'Continuidade', v:contP, max:100, u:'%', c:'#2a9d8f' },
   { l:'Pausas', v:pausas, max:20, u:'', c:'#3ecfcf' }, { l:'Duração', v:dur, max:60, u:'s', c:'#4a7a80' }
  ].forEach(function(m) {
    var pct = Math.min(100, (m.v / m.max) * 100);
    html += '<div class="metrica-card"><div class="metrica-label">' + m.l + '</div>'
          + '<div class="metrica-val">' + m.v + '<span>' + m.u + '</span></div>'
          + '<div class="metrica-bar-wrap"><div class="metrica-bar" style="width:' + pct + '%;background:' + m.c + '"></div></div></div>';
  });
  html += '</div></div><div class="sep"></div>';

  html += '<div class="resultado-bloco"><h4>Espectro sonoro</h4><div class="espectro-wrap">';
  [{ l:'Graves', v:snap.graves||0, c:'#2a9d8f' }, { l:'Médios', v:snap.medios||0, c:'#3ecfcf' },
   { l:'Agudos', v:snap.agudos||0, c:'#e9c46a' }, { l:'Ruído',  v:snap.ruido||0,  c:'#ef4444' },
   { l:'Estab.', v:snap.estabilidade||0, c:'#2a9d8f' }
  ].forEach(function(b) {
    html += '<div class="espectro-col"><div class="espectro-bar-wrap">'
          + '<div class="espectro-bar" style="height:' + b.v + '%;background:' + b.c + '"></div></div>'
          + '<div class="espectro-label">' + b.l + '</div><div class="espectro-val">' + b.v + '%</div></div>';
  });
  html += '</div></div><div class="sep"></div>';

  html += '<div class="resultado-bloco"><h4>Perfil rítmico — radar CRS</h4>';
  html += '<canvas id="radarCanvas" width="260" height="260" style="display:block;margin:10px auto 0;"></canvas></div><div class="sep"></div>';

  html += '<div class="resultado-bloco"><h4>Mapa de presença</h4>';
  html += '<canvas id="silCanvas" width="440" height="56" style="width:100%;border-radius:8px;margin-top:8px;"></canvas>';
  html += '<div style="display:flex;justify-content:space-between;margin-top:6px;">'
        + '<span style="font-family:var(--mono);font-size:8px;color:var(--teal)">■ Voz</span>'
        + '<span style="font-family:var(--mono);font-size:8px;color:var(--muted)">■ Silêncio · ' + silP + '%</span></div></div>';

  if (opts.delta) {
    html += '<div class="sep"></div><div class="resultado-bloco"><h4>Delta vs calibração</h4><div class="delta-grid">';
    [{ l:'Silêncio', v:opts.delta.silence_pct }, { l:'Energia', v:opts.delta.energy_pct },
     { l:'Oscilação', v:opts.delta.oscillation_pct }, { l:'Continuidade', v:opts.delta.continuity_pct }
    ].forEach(function(d) {
      var pos = d.v >= 0;
      html += '<div class="delta-item"><span class="delta-label">' + d.l + '</span>'
            + '<span class="delta-val ' + (pos ? 'pos' : 'neg') + '">' + (pos ? '+' : '') + d.v + '</span></div>';
    });
    html += '</div></div>';
  }

  if (opts.calibRef && opts.calibRef.fases) {
    html += '<div class="sep"></div><div class="resultado-bloco"><h4>Referência — fases</h4><div class="fases-grid">';
    var fnomes = { f1:'Estado do emissor', f2:'Direcionamento', f3:'Comprometimento' };
    ['f1','f2','f3'].forEach(function(fn) {
      var f = opts.calibRef.fases[fn]; if (!f) return;
      var est = f.crs && f.crs.analise_sugestiva ? f.crs.analise_sugestiva : '—';
      html += '<div class="fase-card"><span class="fase-num">' + fn.toUpperCase() + '</span>'
            + '<span class="fase-nome">' + fnomes[fn] + '</span>'
            + '<span class="fase-estado">' + escHtml(est) + '</span></div>';
    });
    html += '</div></div>';
  }

  html += '<button class="btn btn-ghost" style="margin-top:18px;" '
        + 'onclick="document.getElementById(\'cardResultado\').classList.add(\'hidden\')">Encerrar visualização</button>';

  card.innerHTML = html;
  card.scrollIntoView({ behavior: 'smooth' });
  setTimeout(function() {
    desenharRadar({ silP:silP, engP:engP, oscP:oscP, contP:contP, dur:dur, stab:snap.estabilidade||0 });
    desenharMapaSilencio(silP);
  }, 100);
}

/* ══════════════════════════════════════════════════════════
   TIPO / DELTA / EXTRAÇÃO / HELPERS
══════════════════════════════════════════════════════════ */
function selecionarTipo(tipo) {
  tipoAnalise = tipo;
  document.getElementById('tipoUnica').className   = 'tipo-btn' + (tipo==='unica'   ? ' ativo' : '');
  document.getElementById('tipoMemoria').className = 'tipo-btn' + (tipo==='memoria' ? ' ativo' : '');
  document.getElementById('custoTexto').textContent = tipo === 'unica' ? '1 token' : '2 tokens';
  atualizarUI_tokens();
}

function calcularDelta(sessao, ref) {
  if (!ref) return null;
  var campos = ['silence_pct','energy_pct','oscillation_pct','continuity_pct','pause_count','mean_pause_ms'];
  var delta = {};
  campos.forEach(function(c) { delta[c] = parseFloat(((sessao[c]||0) - (ref[c]||0)).toFixed(2)); });
  return delta;
}

function setStatus(msg) { var el = document.getElementById('extracaoStatus'); if (el) el.textContent = msg; }

function blobToDataUrl(blob) {
  return new Promise(function(res) { var r = new FileReader(); r.onload = function(e) { res(e.target.result); }; r.readAsDataURL(blob); });
}

async function base64ToArrayBuffer(dataUrl) {
  var b64 = dataUrl.split(',')[1], bin = atob(b64), buf = new ArrayBuffer(bin.length), view = new Uint8Array(buf);
  for (var i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
  return buf;
}

async function extrairMetricasDeAudio(dataUrl, label) {
  setStatus('Lendo ' + label + '...');
  var buf = await base64ToArrayBuffer(dataUrl);
  var actx = new (window.AudioContext || window.webkitAudioContext)();
  var dec; try { dec = await actx.decodeAudioData(buf); } catch(e) { await actx.close(); return vetorNulo(); }
  var ch = dec.getChannelData(0), dur = dec.duration;
  var win = Math.floor(dec.sampleRate * 0.025), rms = [];
  for (var i = 0; i < ch.length; i += win) {
    var sum = 0, end = Math.min(i+win, ch.length);
    for (var j = i; j < end; j++) sum += ch[j]*ch[j];
    rms.push(Math.sqrt(sum/(end-i)));
  }
  var THR=0.015, MF=Math.floor(0.2/0.025), silF=0, pC=0, pLens=[], inP=false, pLen=0;
  for (var k=0; k<rms.length; k++) {
    if (rms[k]<THR) { silF++; inP ? pLen++ : (inP=true, pLen=1); }
    else { if(inP && pLen>=MF){ pC++; pLens.push(pLen*25); } inP=false; pLen=0; }
  }
  var silP = rms.length ? (silF/rms.length)*100 : 0;
  var meanP = pLens.length ? pLens.reduce(function(a,b){return a+b;},0)/pLens.length : 0;
  var rmM  = rms.reduce(function(a,b){return a+b;},0)/rms.length;
  var eng  = Math.min(100, rmM*800);
  var vari = rms.reduce(function(a,v){return a+Math.pow(v-rmM,2);},0)/rms.length;
  var std  = Math.sqrt(vari), osc = Math.min(100, std*1200), cont = Math.max(0, 100-silP-osc*0.3);
  var mid=Math.floor(ch.length/2), seg=ch.slice(mid,mid+2048), gr=0, me=0, ag=0;
  for (var s=0; s<seg.length; s++) { var nv=Math.abs(seg[s]); if(s<170) gr+=nv; else if(s<1024) me+=nv; else ag+=nv; }
  var tot=gr+me+ag||1; gr=(gr/tot)*100; me=(me/tot)*100; ag=(ag/tot)*100;
  var noise=Math.min(40,std*600), stab=Math.max(0,100-osc*0.6-noise*0.4);
  await actx.close();
  return { duration_sec:parseFloat(dur.toFixed(2)), silence_pct:parseFloat(silP.toFixed(2)), pause_count:pC, mean_pause_ms:parseFloat(meanP.toFixed(2)), oscillation_pct:parseFloat(osc.toFixed(2)), continuity_pct:parseFloat(cont.toFixed(2)), energy_pct:parseFloat(eng.toFixed(2)), spectrum_snapshot:{ graves:parseFloat(gr.toFixed(2)), medios:parseFloat(me.toFixed(2)), agudos:parseFloat(ag.toFixed(2)), ruido:parseFloat(noise.toFixed(2)), estabilidade:parseFloat(stab.toFixed(2)) } };
}

function vetorNulo() { return { duration_sec:0, silence_pct:0, pause_count:0, mean_pause_ms:0, oscillation_pct:0, continuity_pct:0, energy_pct:0, spectrum_snapshot:{ graves:0, medios:0, agudos:0, ruido:0, estabilidade:0 } }; }

function consolidarVetores(ms, w) {
  function med(c)  { return ms.reduce(function(a,m,i){ return a+(m[c]||0)*w[i]; },0); }
  function medS(c) { return ms.reduce(function(a,m,i){ return a+((m.spectrum_snapshot||{})[c]||0)*w[i]; },0); }
  return { duration_sec:parseFloat(ms.reduce(function(a,m){return a+(m.duration_sec||0);},0).toFixed(2)), silence_pct:parseFloat(med('silence_pct').toFixed(2)), pause_count:ms.reduce(function(a,m){return a+(m.pause_count||0);},0), mean_pause_ms:parseFloat(med('mean_pause_ms').toFixed(2)), oscillation_pct:parseFloat(med('oscillation_pct').toFixed(2)), continuity_pct:parseFloat(med('continuity_pct').toFixed(2)), energy_pct:parseFloat(med('energy_pct').toFixed(2)), spectrum_snapshot:{ graves:parseFloat(medS('graves').toFixed(2)), medios:parseFloat(medS('medios').toFixed(2)), agudos:parseFloat(medS('agudos').toFixed(2)), ruido:parseFloat(medS('ruido').toFixed(2)), estabilidade:parseFloat(medS('estabilidade').toFixed(2)) } };
}

function escHtml(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmt(s) { return String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0'); }
function setWave(on) { document.querySelectorAll('.wave-bar').forEach(function(b) { on ? b.classList.add('on') : b.classList.remove('on'); }); }

function confirmarLogout() {
  if (!confirm('Encerrar sessão e sair do Presença?')) return;
  supa.auth.signOut().then(function() { sessionStorage.removeItem('elayon_calibrado'); window.location.href = LOGIN_URL; });
}


/* ══════════════════════════════════════════════════════════
   CANVAS — RADAR + MAPA SILÊNCIO
══════════════════════════════════════════════════════════ */
function desenharRadar(v) {
  var canvas = document.getElementById('radarCanvas'); if (!canvas) return;
  var ctx = canvas.getContext('2d'), cx=130, cy=130, r=95, n=6;
  var labels = ['Energia','Continuidade','Estabilidade','Voz\n(inv. silêncio)','Fluxo\n(inv. osc.)','Presença'];
  var vals   = [v.engP/100, v.contP/100, v.stab/100, 1-v.silP/100, 1-v.oscP/100, Math.min(1,v.dur/30)];
  ctx.clearRect(0,0,260,260);
  for (var ring=1; ring<=4; ring++) {
    ctx.beginPath();
    for (var i=0; i<n; i++) { var ang=(Math.PI*2*i/n)-Math.PI/2, rr=r*ring/4; i===0?ctx.moveTo(cx+rr*Math.cos(ang),cy+rr*Math.sin(ang)):ctx.lineTo(cx+rr*Math.cos(ang),cy+rr*Math.sin(ang)); }
    ctx.closePath(); ctx.strokeStyle='rgba(62,207,207,0.1)'; ctx.lineWidth=1; ctx.stroke();
  }
  for (var i=0; i<n; i++) {
    var ang=(Math.PI*2*i/n)-Math.PI/2;
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+r*Math.cos(ang),cy+r*Math.sin(ang)); ctx.strokeStyle='rgba(62,207,207,0.12)'; ctx.stroke();
    var lx=cx+(r+20)*Math.cos(ang), ly=cy+(r+20)*Math.sin(ang);
    ctx.fillStyle='#4a7a80'; ctx.font='8px Share Tech Mono,monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
    labels[i].split('\n').forEach(function(p,pi,arr){ ctx.fillText(p,lx,ly+(pi-(arr.length-1)/2)*11); });
  }
  ctx.beginPath();
  for (var i=0; i<n; i++) { var ang=(Math.PI*2*i/n)-Math.PI/2, rv=r*vals[i]; i===0?ctx.moveTo(cx+rv*Math.cos(ang),cy+rv*Math.sin(ang)):ctx.lineTo(cx+rv*Math.cos(ang),cy+rv*Math.sin(ang)); }
  ctx.closePath(); ctx.fillStyle='rgba(62,207,207,0.18)'; ctx.fill(); ctx.strokeStyle='#3ecfcf'; ctx.lineWidth=2; ctx.stroke();
  for (var i=0; i<n; i++) { var ang=(Math.PI*2*i/n)-Math.PI/2, rv=r*vals[i]; ctx.beginPath(); ctx.arc(cx+rv*Math.cos(ang),cy+rv*Math.sin(ang),4,0,Math.PI*2); ctx.fillStyle='#3ecfcf'; ctx.fill(); }
}

function desenharMapaSilencio(silPct) {
  var canvas = document.getElementById('silCanvas'); if (!canvas) return;
  var ctx=canvas.getContext('2d'), w=canvas.width, h=canvas.height, blocos=88, bw=w/blocos;
  ctx.clearRect(0,0,w,h);
  for (var i=0; i<blocos; i++) {
    var eSil=(i<3||i>blocos-4)?true:(Math.random()*100<silPct);
    if (eSil) { ctx.fillStyle='rgba(74,122,128,0.12)'; ctx.fillRect(i*bw,0,bw-1,h); ctx.fillStyle='rgba(74,122,128,0.25)'; ctx.fillRect(i*bw+bw/2-0.5,h*0.35,1,h*0.3); }
    else { var alt=(0.25+Math.random()*0.65)*h, yOff=(h-alt)/2; ctx.fillStyle='rgba(62,207,207,0.65)'; ctx.fillRect(i*bw,yOff,bw-1,alt); }
  }
}