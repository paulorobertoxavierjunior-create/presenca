/* ═══════════════════════════════════════════════════════════
   ELAYON · PRESENÇA V3.0 · NÚCLEO CRS + RELATÓRIO VISUAL

   Este módulo lê o padrão rítmico do emissor humano.
   Não avalia. Calibra a IA que vai responder.
   O relatório visual existe para o humano se ver —
   não como julgamento, mas como espelho de presença.
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

/* ══════════════════════════════════════════════════════════
   BOOT
══════════════════════════════════════════════════════════ */
(async function boot() {
  var params = new URLSearchParams(window.location.search);
  var at = params.get('at'), rt = params.get('rt');
  if (at && rt) {
    await supa.auth.setSession({
      access_token:  decodeURIComponent(at),
      refresh_token: decodeURIComponent(rt)
    });
    window.history.replaceState({}, '', window.location.pathname);
  }

  var sess    = await supa.auth.getSession();
  var session = sess && sess.data && sess.data.session ? sess.data.session : null;
  if (!session) { window.location.href = LOGIN_URL; return; }

  userId      = session.user.id;
  accessToken = session.access_token;

  var email = session.user.email || '';
  document.getElementById('hudId').textContent = email.split('@')[0].toUpperCase();

  await carregarTokens();

  var calibSalva = localStorage.getItem('elayon_calib_ref');
  var fifoSalvo  = localStorage.getItem('elayon_sessoes_fifo');
  var consSalvo  = localStorage.getItem('elayon_tokens_consumidos');

  if (calibSalva) try { calibRef = JSON.parse(calibSalva); } catch(e) {}
  if (fifoSalvo)  try { sessoesFifo = JSON.parse(fifoSalvo); } catch(e) {}
  if (consSalvo)  tokensConsumidos = parseInt(consSalvo) || 0;

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

  atualizarUI_tokens();
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
  var custo     = tipoAnalise === 'unica' ? 1 : 2;
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
   CALIBRAÇÃO PERIÓDICA SILENCIOSA
   A cada PERIODI_CADA tokens consumidos roda em background.
   +2 tokens antes, -2 após. Zero a zero pro usuário.
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
      calibRef = {
        timestamp: new Date().toISOString(),
        tipo:      'periodica',
        fases:     calibRef ? calibRef.fases : null,
        ref:       novoRef,
        crs:       data
      };
      localStorage.setItem('elayon_calib_ref', JSON.stringify(calibRef));
      atualizarHudCalib();
    }
  } catch(e) {
    await creditarTokens(2);
    calibPeriodRod = false;
    return;
  }

  // Debita sem re-acionar verificarCalibracaoPeriodica
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
    timestamp: new Date().toISOString(),
    tipo:      'inicial',
    fases: {
      f1: { vetor: v1, crs: r1 },
      f2: { vetor: v2, crs: r2 },
      f3: { vetor: v3, crs: r3 }
    },
    ref:    refVetor,
    refCrs: refCrs
  };

  localStorage.setItem('elayon_calib_ref', JSON.stringify(calibRef));
  sessionStorage.setItem('elayon_calibrado', '1');

  await creditarTokens(2);

  setStatus('');
  atualizarHudCalib();
  abrirMic();

  exibirRelatorioVisual({
    titulo:    'Calibração Inicial',
    subtitulo: 'Leitura de referência do emissor registrada. O sistema está calibrado.',
    sessao:    refVetor,
    crs:       refCrs,
    delta:     null,
    calibRef:  calibRef,
    ehCalib:   true
  });
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
      micTimerInt = setInterval(function() {
        micSegundos++;
        document.getElementById('micTimer').textContent = fmt(micSegundos);
      }, 1000);
      setWave(true);
      document.getElementById('micEstado').textContent = 'Gravando...';
      document.getElementById('micEstado').className   = 'mic-estado gravando';
      document.getElementById('micBtnIniciar').classList.add('hidden');
      document.getElementById('micBtnParar').classList.remove('hidden');
    })
    .catch(function() {
      document.getElementById('micEstado').textContent = 'Microfone indisponível';
    });
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

    exibirRelatorioVisual({
      titulo:    data.analise_sugestiva || 'Leitura CRS',
      subtitulo: data.sugestao_ia || '—',
      sessao:    sessaoAtual,
      crs:       data,
      delta:     delta,
      calibRef:  calibRef,
      ehCalib:   false
    });

    await debitarTokens(custo);

  } catch(e) {
    console.error('Erro CRS:', e);
    document.getElementById('cardResultado').classList.remove('hidden');
    document.getElementById('cardResultado').innerHTML =
      '<span class="card-label">Erro de comunicação</span>'
      + '<p class="resultado-texto">Não foi possível conectar ao núcleo. Verifique a conexão.</p>'
      + '<button class="btn btn-ghost" style="margin-top:16px;" onclick="document.getElementById(\'cardResultado\').classList.add(\'hidden\')">Fechar</button>';
    document.getElementById('btnAnalisar').disabled = false;
  }

  document.getElementById('spinnerAnalise').style.display = 'none';
}

function montarPayload(sessao, delta) {
  return {
    duration_sec:    sessao.duration_sec,
    silence_pct:     sessao.silence_pct,
    pause_count:     sessao.pause_count,
    mean_pause_ms:   sessao.mean_pause_ms,
    oscillation_pct: sessao.oscillation_pct,
    continuity_pct:  sessao.continuity_pct,
    energy_pct:      sessao.energy_pct,
    spectrum_snapshot: sessao.spectrum_snapshot,
    context:         sessao.context || 'leitura',
    transcript_raw:  '',
    calibracao_ref: calibRef ? {
      timestamp: calibRef.timestamp,
      tipo:      calibRef.tipo,
      ref:       calibRef.ref,
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
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accessToken },
    body:    JSON.stringify(payload)
  });
  return res.json();
}


/* ══════════════════════════════════════════════════════════
   RELATÓRIO VISUAL
   Cards de métricas + espectro vertical + radar canvas
   + mapa de silêncio canvas. Sem dependência externa.
══════════════════════════════════════════════════════════ */
function exibirRelatorioVisual(opts) {
  var card = document.getElementById('cardResultado');
  card.classList.remove('hidden');

  var s    = opts.sessao || {};
  var rel  = (opts.crs && opts.crs.relatorio) ? opts.crs.relatorio : {};
  var snap = rel.snapshot_sonoro || s.spectrum_snapshot || {};

  var silP  = rel.porcentagem_silencio || s.silence_pct     || 0;
  var engP  = rel.energia_pct          || s.energy_pct       || 0;
  var oscP  = rel.oscilacao_pct        || s.oscillation_pct  || 0;
  var contP = rel.continuidade_pct     || s.continuity_pct   || 0;
  var dur   = rel.tempo_total          || s.duration_sec      || 0;
  var pausas= rel.total_pausas         || s.pause_count       || 0;
  var mpause= rel.media_pausa_ms       || s.mean_pause_ms     || 0;

  var html = '';

  // Estado
  html += '<div class="estado-tag">' + escHtml(opts.titulo || '—') + '</div>';

  // Instrução IA
  html += '<div class="resultado-bloco">';
  html += '<h4>' + (opts.ehCalib ? 'Referência registrada' : 'Instrução à IA receptora') + '</h4>';
  html += '<p class="resultado-texto">' + escHtml(opts.subtitulo || '—') + '</p>';
  html += '</div><div class="sep"></div>';

  // Cards de métricas
  html += '<div class="resultado-bloco"><h4>Sinais extraídos</h4>';
  html += '<div class="metricas-grid">';
  var mets = [
    { l:'Silêncio',     v:silP,  max:100, u:'%', c:'#3ecfcf' },
    { l:'Energia',      v:engP,  max:100, u:'%', c:'#2a9d8f' },
    { l:'Oscilação',    v:oscP,  max:100, u:'%', c:'#e9c46a' },
    { l:'Continuidade', v:contP, max:100, u:'%', c:'#2a9d8f' },
    { l:'Pausas',       v:pausas,max:20,  u:'',  c:'#3ecfcf' },
    { l:'Duração',      v:dur,   max:60,  u:'s', c:'#4a7a80' }
  ];
  mets.forEach(function(m) {
    var pct = Math.min(100, (m.v / m.max) * 100);
    html += '<div class="metrica-card">'
          + '<div class="metrica-label">' + m.l + '</div>'
          + '<div class="metrica-val">' + m.v + '<span>' + m.u + '</span></div>'
          + '<div class="metrica-bar-wrap"><div class="metrica-bar" style="width:' + pct + '%;background:' + m.c + '"></div></div>'
          + '</div>';
  });
  html += '</div></div><div class="sep"></div>';

  // Espectro sonoro — barras verticais
  html += '<div class="resultado-bloco"><h4>Espectro sonoro</h4>';
  html += '<div class="espectro-wrap">';
  var bandas = [
    { l:'Graves', v:snap.graves||0, c:'#2a9d8f' },
    { l:'Médios', v:snap.medios||0, c:'#3ecfcf' },
    { l:'Agudos', v:snap.agudos||0, c:'#e9c46a' },
    { l:'Ruído',  v:snap.ruido ||0, c:'#ef4444' },
    { l:'Estab.', v:snap.estabilidade||0, c:'#2a9d8f' }
  ];
  bandas.forEach(function(b) {
    html += '<div class="espectro-col">'
          + '<div class="espectro-bar-wrap">'
          + '<div class="espectro-bar" style="height:' + b.v + '%;background:' + b.c + '"></div>'
          + '</div>'
          + '<div class="espectro-label">' + b.l + '</div>'
          + '<div class="espectro-val">' + b.v + '%</div>'
          + '</div>';
  });
  html += '</div></div><div class="sep"></div>';

  // Radar canvas
  html += '<div class="resultado-bloco"><h4>Perfil rítmico — radar CRS</h4>';
  html += '<canvas id="radarCanvas" width="260" height="260" style="display:block;margin:10px auto 0;"></canvas>';
  html += '</div><div class="sep"></div>';

  // Mapa de presença canvas
  html += '<div class="resultado-bloco"><h4>Mapa de presença — voz e silêncio</h4>';
  html += '<canvas id="silCanvas" width="440" height="56" style="width:100%;border-radius:8px;margin-top:8px;"></canvas>';
  html += '<div style="display:flex;justify-content:space-between;margin-top:6px;">'
        + '<span style="font-family:var(--mono);font-size:8px;color:var(--teal)">■ Voz</span>'
        + '<span style="font-family:var(--mono);font-size:8px;color:var(--muted)">■ Silêncio · ' + silP + '%</span>'
        + '</div>';
  html += '</div>';


  // Delta vs calibração
  if (opts.delta) {
    html += '<div class="sep"></div>';
    html += '<div class="resultado-bloco"><h4>Delta vs referência de calibração</h4>';
    html += '<div class="delta-grid">';
    var dItems = [
      { l:'Silêncio',     v: opts.delta.silence_pct },
      { l:'Energia',      v: opts.delta.energy_pct },
      { l:'Oscilação',    v: opts.delta.oscillation_pct },
      { l:'Continuidade', v: opts.delta.continuity_pct }
    ];
    dItems.forEach(function(d) {
      var pos = d.v >= 0;
      html += '<div class="delta-item">'
            + '<span class="delta-label">' + d.l + '</span>'
            + '<span class="delta-val ' + (pos ? 'pos' : 'neg') + '">' + (pos ? '+' : '') + d.v + '</span>'
            + '</div>';
    });
    html += '</div>';
    html += '<p style="font-family:var(--mono);font-size:8px;color:var(--muted);margin-top:8px;line-height:1.7;">'
          + '+ acima do padrão · - abaixo do padrão de referência</p>';
    html += '</div>';
  }

  // Fases da calibração
  if (opts.calibRef && opts.calibRef.fases) {
    html += '<div class="sep"></div>';
    html += '<div class="resultado-bloco"><h4>Referência de calibração — fases</h4>';
    html += '<div class="fases-grid">';
    var fnomes = { f1:'Estado do emissor', f2:'Direcionamento', f3:'Comprometimento' };
    ['f1','f2','f3'].forEach(function(fn) {
      var f = opts.calibRef.fases[fn];
      if (!f) return;
      var est = f.crs && f.crs.analise_sugestiva ? f.crs.analise_sugestiva : '—';
      html += '<div class="fase-card">'
            + '<span class="fase-num">' + fn.toUpperCase() + '</span>'
            + '<span class="fase-nome">' + fnomes[fn] + '</span>'
            + '<span class="fase-estado">' + escHtml(est) + '</span>'
            + '</div>';
    });
    html += '</div>';
    var dc = new Date(opts.calibRef.timestamp);
    html += '<p style="font-family:var(--mono);font-size:8px;color:var(--muted);margin-top:10px;">'
          + opts.calibRef.tipo + ' · '
          + dc.toLocaleDateString('pt-BR') + ' '
          + dc.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })
          + '</p>';
    html += '</div>';
  }

  html += '<button class="btn btn-ghost" style="margin-top:18px;" '
        + 'onclick="document.getElementById(\'cardResultado\').classList.add(\'hidden\')">'
        + 'Encerrar visualização</button>';

  card.innerHTML = html;
  card.scrollIntoView({ behavior: 'smooth' });

  // Renderiza canvas após DOM atualizar
  setTimeout(function() {
    desenharRadar({ silP:silP, engP:engP, oscP:oscP, contP:contP, dur:dur, stab:snap.estabilidade||0 });
    desenharMapaSilencio(silP);
  }, 100);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}

/* ── Radar ── */
function desenharRadar(v) {
  var canvas = document.getElementById('radarCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var cx = 130, cy = 130, r = 95;
  var labels = ['Energia','Continuidade','Estabilidade','Voz\n(inv. silêncio)','Fluxo\n(inv. osc.)','Presença'];
  var vals = [
    v.engP  / 100,
    v.contP / 100,
    v.stab  / 100,
    1 - v.silP / 100,
    1 - v.oscP / 100,
    Math.min(1, v.dur / 30)
  ];
  var n = vals.length;
  ctx.clearRect(0, 0, 260, 260);


// Anéis de grade
  for (var ring = 1; ring <= 4; ring++) {
    ctx.beginPath();
    for (var i = 0; i < n; i++) {
      var ang = (Math.PI * 2 * i / n) - Math.PI / 2;
      var rr  = r * ring / 4;
      i === 0 ? ctx.moveTo(cx + rr * Math.cos(ang), cy + rr * Math.sin(ang))
              : ctx.lineTo(cx + rr * Math.cos(ang), cy + rr * Math.sin(ang));
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(62,207,207,0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Eixos e labels
  for (var i = 0; i < n; i++) {
    var ang = (Math.PI * 2 * i / n) - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + r * Math.cos(ang), cy + r * Math.sin(ang));
    ctx.strokeStyle = 'rgba(62,207,207,0.12)';
    ctx.stroke();
    var lx = cx + (r + 20) * Math.cos(ang);
    var ly = cy + (r + 20) * Math.sin(ang);
    ctx.fillStyle = '#4a7a80';
    ctx.font = '8px Share Tech Mono, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var partes = labels[i].split('\n');
    partes.forEach(function(p, pi) {
      ctx.fillText(p, lx, ly + (pi - (partes.length-1)/2) * 11);
    });
  }

  // Polígono
  ctx.beginPath();
  for (var i = 0; i < n; i++) {
    var ang = (Math.PI * 2 * i / n) - Math.PI / 2;
    var rv  = r * vals[i];
    i === 0 ? ctx.moveTo(cx + rv * Math.cos(ang), cy + rv * Math.sin(ang))
            : ctx.lineTo(cx + rv * Math.cos(ang), cy + rv * Math.sin(ang));
  }
  ctx.closePath();
  ctx.fillStyle   = 'rgba(62,207,207,0.18)';
  ctx.fill();
  ctx.strokeStyle = '#3ecfcf';
  ctx.lineWidth   = 2;
  ctx.stroke();

  // Pontos
  for (var i = 0; i < n; i++) {
    var ang = (Math.PI * 2 * i / n) - Math.PI / 2;
    var rv  = r * vals[i];
    ctx.beginPath();
    ctx.arc(cx + rv * Math.cos(ang), cy + rv * Math.sin(ang), 4, 0, Math.PI * 2);
    ctx.fillStyle = '#3ecfcf';
    ctx.fill();
  }
}

/* ── Mapa de silêncio ── */
function desenharMapaSilencio(silPct) {
  var canvas = document.getElementById('silCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  var blocos  = 88;
  var bw      = w / blocos;

  for (var i = 0; i < blocos; i++) {
    var eSil = (i < 3 || i > blocos - 4) ? true : (Math.random() * 100 < silPct);
    if (eSil) {
      ctx.fillStyle = 'rgba(74,122,128,0.12)';
      ctx.fillRect(i * bw, 0, bw - 1, h);
      ctx.fillStyle = 'rgba(74,122,128,0.25)';
      ctx.fillRect(i * bw + bw/2 - 0.5, h * 0.35, 1, h * 0.3);
    } else {
      var alt  = (0.25 + Math.random() * 0.65) * h;
      var yOff = (h - alt) / 2;
      ctx.fillStyle = 'rgba(62,207,207,0.65)';
      ctx.fillRect(i * bw, yOff, bw - 1, alt);
    }
  }
}

/* ══════════════════════════════════════════════════════════
   TIPO DE ANÁLISE
══════════════════════════════════════════════════════════ */
function selecionarTipo(tipo) {
  tipoAnalise = tipo;
  document.getElementById('tipoUnica').className   = 'tipo-btn' + (tipo==='unica'   ? ' ativo' : '');
  document.getElementById('tipoMemoria').className = 'tipo-btn' + (tipo==='memoria' ? ' ativo' : '');
  document.getElementById('custoTexto').textContent = tipo === 'unica' ? '1 token' : '2 tokens';
  atualizarUI_tokens();
}

/* ══════════════════════════════════════════════════════════
   DELTA
══════════════════════════════════════════════════════════ */
function calcularDelta(sessao, ref) {
  if (!ref) return null;
  var campos = ['silence_pct','energy_pct','oscillation_pct','continuity_pct','pause_count','mean_pause_ms'];
  var delta  = {};
  campos.forEach(function(c) {
    delta[c] = parseFloat(((sessao[c]||0) - (ref[c]||0)).toFixed(2));
  });
  return delta;
}

/* ══════════════════════════════════════════════════════════
   EXTRAÇÃO — Web Audio API
══════════════════════════════════════════════════════════ */
function setStatus(msg) {
  var el = document.getElementById('extracaoStatus');
  if (el) el.textContent = msg;
}

function blobToDataUrl(blob) {
  return new Promise(function(res) {
    var r = new FileReader();
    r.onload = function(e) { res(e.target.result); };
    r.readAsDataURL(blob);
  });
}

async function base64ToArrayBuffer(dataUrl) {
  var b64  = dataUrl.split(',')[1];
  var bin  = atob(b64);
  var buf  = new ArrayBuffer(bin.length);
  var view = new Uint8Array(buf);
  for (var i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
  return buf;
}

async function extrairMetricasDeAudio(dataUrl, label) {
  setStatus('Lendo ' + label + '...');
  var buf = await base64ToArrayBuffer(dataUrl);
  var actx = new (window.AudioContext || window.webkitAudioContext)();
  var dec;
  try { dec = await actx.decodeAudioData(buf); }
  catch(e) { await actx.close(); return vetorNulo(); }

  var ch = dec.getChannelData(0), sr = dec.sampleRate, dur = dec.duration;
  var win = Math.floor(sr * 0.025), rms = [];
  for (var i = 0; i < ch.length; i += win) {
    var sum = 0, end = Math.min(i+win, ch.length);
    for (var j = i; j < end; j++) sum += ch[j]*ch[j];
    rms.push(Math.sqrt(sum/(end-i)));
  }

  var THR=0.015, MF=Math.floor(0.2/0.025);
  var silF=0, pC=0, pLens=[], inP=false, pLen=0;
  for (var k=0; k<rms.length; k++) {
    if (rms[k]<THR) { silF++; inP ? pLen++ : (inP=true, pLen=1); }
    else { if(inP && pLen>=MF){ pC++; pLens.push(pLen*25); } inP=false; pLen=0; }
  }

  var silP  = rms.length ? (silF/rms.length)*100 : 0;
  var meanP = pLens.length ? pLens.reduce(function(a,b){return a+b;},0)/pLens.length : 0;
  var rmM   = rms.reduce(function(a,b){return a+b;},0)/rms.length;
  var eng   = Math.min(100, rmM*800);
  var vari  = rms.reduce(function(a,v){return a+Math.pow(v-rmM,2);},0)/rms.length;
  var std   = Math.sqrt(vari);
  var osc   = Math.min(100, std*1200);
  var cont  = Math.max(0, 100-silP-osc*0.3);

  var mid=Math.floor(ch.length/2), seg=ch.slice(mid,mid+2048), gr=0, me=0, ag=0;
  for (var s=0; s<seg.length; s++) {
    var nv=Math.abs(seg[s]);
    if(s<170) gr+=nv; else if(s<1024) me+=nv; else ag+=nv;
  }
  var tot=gr+me+ag||1;
  gr=(gr/tot)*100; me=(me/tot)*100; ag=(ag/tot)*100;
  var noise=Math.min(40,std*600), stab=Math.max(0,100-osc*0.6-noise*0.4);

  await actx.close();
  return {
    duration_sec:    parseFloat(dur.toFixed(2)),
    silence_pct:     parseFloat(silP.toFixed(2)),
    pause_count:     pC,
    mean_pause_ms:   parseFloat(meanP.toFixed(2)),
    oscillation_pct: parseFloat(osc.toFixed(2)),
    continuity_pct:  parseFloat(cont.toFixed(2)),
    energy_pct:      parseFloat(eng.toFixed(2)),
    spectrum_snapshot: {
      graves:       parseFloat(gr.toFixed(2)),
      medios:       parseFloat(me.toFixed(2)),
      agudos:       parseFloat(ag.toFixed(2)),
      ruido:        parseFloat(noise.toFixed(2)),
      estabilidade: parseFloat(stab.toFixed(2))
    }
  };
}

function vetorNulo() {
  return { duration_sec:0, silence_pct:0, pause_count:0, mean_pause_ms:0,
           oscillation_pct:0, continuity_pct:0, energy_pct:0,
           spectrum_snapshot:{ graves:0, medios:0, agudos:0, ruido:0, estabilidade:0 } };
}

function consolidarVetores(ms, w) {
  function med(c)  { return ms.reduce(function(a,m,i){ return a+(m[c]||0)*w[i]; },0); }
  function medS(c) { return ms.reduce(function(a,m,i){ return a+((m.spectrum_snapshot||{})[c]||0)*w[i]; },0); }
  return {
    duration_sec:    parseFloat(ms.reduce(function(a,m){return a+(m.duration_sec||0);},0).toFixed(2)),
    silence_pct:     parseFloat(med('silence_pct').toFixed(2)),
    pause_count:     ms.reduce(function(a,m){return a+(m.pause_count||0);},0),
    mean_pause_ms:   parseFloat(med('mean_pause_ms').toFixed(2)),
    oscillation_pct: parseFloat(med('oscillation_pct').toFixed(2)),
    continuity_pct:  parseFloat(med('continuity_pct').toFixed(2)),
    energy_pct:      parseFloat(med('energy_pct').toFixed(2)),
    spectrum_snapshot: {
      graves:       parseFloat(medS('graves').toFixed(2)),
      medios:       parseFloat(medS('medios').toFixed(2)),
      agudos:       parseFloat(medS('agudos').toFixed(2)),
      ruido:        parseFloat(medS('ruido').toFixed(2)),
      estabilidade: parseFloat(medS('estabilidade').toFixed(2))
    }
  };
}

/* ══════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════ */
function fmt(s) {
  return String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0');
}

function setWave(on) {
  document.querySelectorAll('.wave-bar').forEach(function(b) {
    on ? b.classList.add('on') : b.classList.remove('on');
  });
}

/* ══════════════════════════════════════════════════════════
   LOGOUT
══════════════════════════════════════════════════════════ */
function confirmarLogout() {
  if (!confirm('Encerrar sessão e sair do Presença?')) return;
  supa.auth.signOut().then(function() {
    sessionStorage.removeItem('elayon_calibrado');
    window.location.href = LOGIN_URL;
  });
}