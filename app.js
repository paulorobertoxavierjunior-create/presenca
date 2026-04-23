// ==========================================
// ELAYON — Aplicativo Presença (App.js)
// Conexão: Frontend -> Render (Núcleo CRS) -> Supabase
// ==========================================

let audioCtx, analyser, stream;
let dataArray;
let running = false;

let volumes = [];
let pauses = []; 
let lastSound = 0;
let sessions = [];

// --- CONFIGURAÇÃO DO MOTOR ---
const URL_NUCLEO_CRS = "https://nucleo-crs-elayon.onrender.com/api/crs/analisar";

// ====================
// CONTROLE DE MIC
// ====================
async function toggleMic() {
  if (!running) await start();
  else await stop();
}

async function start() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);

    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    dataArray = new Uint8Array(analyser.fftSize);
    running = true;
    lastSound = performance.now();

    document.getElementById("status").innerText = "Ouvindo Presença...";
    loop();
  } catch (err) {
    console.error("Erro ao acessar mic:", err);
    alert("Microfone não encontrado ou negado.");
  }
}

async function stop() {
  running = false;
  
  // Para o hardware do mic
  if (stream) stream.getTracks().forEach(t => t.stop());

  // Mostra o modal de processamento que estava travando
  const modal = document.getElementById("modalProcessando"); // Ajuste o ID conforme seu HTML
  if(modal) modal.style.display = "flex";

  // Gera dados locais (Cálculo do Cozinheiro)
  const session = gerarSessao();
  sessions.unshift(session);
  if (sessions.length > 3) sessions.pop();

  atualizarUI();

  // ENVIA PARA A IA (O "Mágico" de 2026)
  await processarComIA(session);
}

// ====================
// MOTOR DE CÁLCULO (CRS)
// ====================
function loop() {
  if (!running) return;

  analyser.getByteTimeDomainData(dataArray);
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    let v = (dataArray[i] - 128) / 128;
    sum += v * v;
  }

  let rms = Math.sqrt(sum / dataArray.length);
  let volume = Math.round(rms * 140);
  volumes.push(volume);

  const now = performance.now();
  if (volume > 10) {
    const pausa = now - lastSound;
    if (pausa > 200) pauses.push(pausa); // Detecta micro-pausas
    lastSound = now;
  }

  atualizarBarras(volume);
  requestAnimationFrame(loop);
}

function gerarSessao() {
  const ritmo = calcRitmo(volumes);
  const silencio = calcSilencio(volumes);
  const hesitacao = pauses.filter(p => p > 1200).length;

  const estado = classificarEstado(ritmo, silencio, hesitacao);
  
  const s = { ritmo, silencio, hesitacao, estado, timestamp: new Date().toLocaleTimeString() };
  
  // Limpa para a próxima
  volumes = [];
  pauses = [];
  return s;
}

// ====================
// COMUNICAÇÃO COM O RENDER
// ====================
async function processarComIA(dadosLocais) {
  // Pegamos o token que o Supabase gerou no login
  // IMPORTANTE: Verifique se no seu login você salvou como 'sb-access-token' ou similar
  const token = localStorage.getItem("supabase_token"); 

  try {
    const response = await fetch(URL_NUCLEO_CRS, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        duration_sec: (volumes.length || 100) * 0.1, // tempo aproximado
        silence_pct: dadosLocais.silencio,
        pause_count: dadosLocais.hesitacao,
        oscillation_pct: dadosLocais.ritmo
      })
    });

    const data = await response.json();

    if (data.ok) {
      console.log("IA Respondeu:", data.analise_sugestiva);
      // Atualiza a tela com o veredito da IA
      document.getElementById("estado").innerText = "IA: " + data.analise_sugestiva;
      document.getElementById("sugestao_ia").innerText = data.sugestao_ia;
    } else {
      console.error("Erro no motor:", data.error);
    }
  } catch (err) {
    console.error("Erro de conexão:", err);
  } finally {
    // FECHA O MODAL: O sistema volta a responder
    const modal = document.getElementById("modalProcessando");
    if(modal) modal.style.display = "none";
    document.getElementById("status").innerText = "Análise Concluída";
  }
}

// ====================
// AUXILIARES E UI
// ====================
function calcRitmo(v) {
  if (v.length === 0) return 0;
  let osc = 0;
  for (let i = 1; i < v.length; i++) osc += Math.abs(v[i] - v[i - 1]);
  return Math.round(osc / v.length);
}

function calcSilencio(v) {
  if (v.length === 0) return 0;
  return Math.round((v.filter(x => x < 8).length / v.length) * 100);
}

function classificarEstado(r, s, h) {
  if (h > 2) return "Reflexão Profunda";
  if (r > 20) return "Fluxo Dinâmico";
  if (s > 50) return "Silêncio Operacional";
  return "Presença Neutra";
}

function atualizarBarras(volume) {
  const bar = document.getElementById("barVolume");
  if(bar) bar.style.width = volume + "%";
}

function atualizarUI() {
  // Atualiza os cards s0, s1, s2
  sessions.forEach((s, i) => {
    const el = document.getElementById("s" + i);
    if (el) el.innerText = `R:${s.ritmo} | S:${s.silencio}% | H:${s.hesitacao}\n${s.estado}`;
  });

  // Atualiza o JSON de depuração
  const debugJson = document.getElementById("json");
  if(debugJson) debugJson.innerText = JSON.stringify(sessions[0], null, 2);
}
