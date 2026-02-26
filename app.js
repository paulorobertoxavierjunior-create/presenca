// ====== AJUSTES RÁPIDOS (você calibra aqui) ======
const UPDATE_MS = 200;     // você pediu 200ms
const RISE = 0.14;         // subida (menor = sobe mais constante)
const FALL = 0.10;         // queda imediata (começa a cair no silêncio)
const NOISE_FLOOR = 0.015; // sensibilidade base (se precisar, aumente p/ não pegar ruído)

// Modo "aula"
const AULA_MIN = 50;

// ====== Estado ======
let mode = "livre";
let audio = null;
let analyser = null;
let data = null;
let stream = null;
let timer = null;

const bars = {
  energia: 0,
  constancia: 0,
  clareza: 0,
  ritmo: 0,
  foco: 0,
  expansao: 0,
  motivacao: 0,
  estabilidade: 0
};

let lastEnergy = 0;
let talkFrames = 0;
let totalFrames = 0;

const els = {
  btnMic: document.getElementById("btnMic"),
  btnReset: document.getElementById("btnReset"),
  micState: document.getElementById("micState"),
  tickMs: document.getElementById("tickMs"),
  talkPct: document.getElementById("talkPct"),
  modeBtns: Array.from(document.querySelectorAll(".modeBtn"))
};

els.tickMs.textContent = `${UPDATE_MS}ms`;

// ====== Helpers ======
function clamp01(x){ return Math.max(0, Math.min(1, x)); }
function lerp(a,b,t){ return a + (b-a)*t; }

function setMode(next){
  mode = next;
  els.modeBtns.forEach(b => b.classList.toggle("isOn", b.dataset.mode === next));
}

els.modeBtns.forEach(b => b.addEventListener("click", () => {
  setMode(b.dataset.mode);
  if (mode === "exercicio") location.href = "./pages/exercicios.html";
}));

function setMicUI(on){
  els.micState.textContent = on ? "ligado" : "desligado";
  els.btnMic.textContent = on ? "🛑 Desativar Microfone" : "🎙️ Ativar Microfone";
}

function paintBar(key, v){
  const pct = Math.round(v * 100);
  const fill = document.getElementById(`b_${key}`);
  const val = document.getElementById(`v_${key}`);
  if (fill) fill.style.width = `${pct}%`;
  if (val) val.textContent = `${pct}`;
}

function paintAll(){
  Object.keys(bars).forEach(k => paintBar(k, bars[k]));
}

function resetSession(){
  Object.keys(bars).forEach(k => bars[k] = 0);
  lastEnergy = 0;
  talkFrames = 0;
  totalFrames = 0;
  els.talkPct.textContent = `0%`;
  paintAll();
}

els.btnReset.addEventListener("click", resetSession);

// ====== Audio ======
async function startMic(){
  stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  });

  audio = new (window.AudioContext || window.webkitAudioContext)();
  const src = audio.createMediaStreamSource(stream);
  analyser = audio.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.0; // a suavização a gente controla na “física” das barras
  src.connect(analyser);

  data = new Uint8Array(analyser.fftSize);

  setMicUI(true);

  if (timer) clearInterval(timer);
  timer = setInterval(tick, UPDATE_MS);
}

function stopMic(){
  if (timer) clearInterval(timer);
  timer = null;

  if (stream){
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  if (audio){
    audio.close().catch(()=>{});
    audio = null;
  }
  analyser = null;
  data = null;
  setMicUI(false);
}

els.btnMic.addEventListener("click", async () => {
  try{
    if (!stream) await startMic();
    else stopMic();
  }catch(e){
    alert("Não consegui acessar o microfone. Verifique permissão do navegador.");
  }
});

// ====== Métricas simples (sem “palavras por reconhecimento”)
// A ideia aqui é: presença = fala contínua com energia estável.
// Isso estimula fala contínua e constância, sem depender de transcrição.
function computeEnergy(){
  analyser.getByteTimeDomainData(data);

  // RMS
  let sum = 0;
  for (let i=0;i<data.length;i++){
    const x = (data[i] - 128) / 128;
    sum += x*x;
  }
  const rms = Math.sqrt(sum / data.length);

  // Normaliza energia
  const e = clamp01((rms - NOISE_FLOOR) / 0.12);
  return e;
}

function tick(){
  totalFrames++;

  const e = computeEnergy();
  const speaking = e > 0.02;

  if (speaking) talkFrames++;

  const talk = totalFrames ? (talkFrames/totalFrames) : 0;
  els.talkPct.textContent = `${Math.round(talk*100)}%`;

  // Estabilidade do som (variação baixa = mais “estável”)
  const deltaE = Math.abs(e - lastEnergy);
  lastEnergy = e;
  const stabilityNow = clamp01(1 - (deltaE / 0.15)); // 0..1

  // Ritmo: fala presente + menos “quebra”
  // (aqui é uma heurística simples: energia + estabilidade)
  const rhythmNow = clamp01(0.55*e + 0.45*stabilityNow);

  // Targets (0..1) – tudo nasce do INPUT
  const targetEnergia = speaking ? clamp01(e) : 0;
  const targetConstancia = speaking ? clamp01(0.65*bars.constancia + 0.35*stabilityNow) : 0;
  const targetClareza = speaking ? clamp01(0.55*stabilityNow + 0.45*e) : 0;
  const targetRitmo = speaking ? rhythmNow : 0;

  // Foco: fala contínua com menos variação (cresce mais lento)
  const targetFoco = speaking ? clamp01(0.7*bars.foco + 0.3*stabilityNow) : 0;

  // Expansão: energia sustentada ao longo do tempo
  const targetExpansao = speaking ? clamp01(0.75*bars.expansao + 0.25*e) : 0;

  // Motivação: energia + continuidade (fala presente)
  const targetMotivacao = speaking ? clamp01(0.6*e + 0.4*talk) : 0;

  // Estabilidade: quanto menos oscila, mais sobe
  const targetEstabilidade = speaking ? clamp01(0.8*stabilityNow + 0.2*(1-deltaE)) : 0;

  // Atualização das barras com a “física” pedida:
  // - falando: sobe “exponencial” (aproxima do target)
  // - silêncio: desce imediatamente (linear-ish), mas suave
  function updateBar(key, target){
    const v = bars[key];
    if (speaking){
      // sobe mais constante (sem espirrar)
      bars[key] = clamp01( v + RISE * (target - v) );
    } else {
      // desce imediatamente ao entrar silêncio
      bars[key] = clamp01( v - FALL * (0.12 + v) ); // cai sempre um pouco + proporcional
    }
  }

  updateBar("energia", targetEnergia);
  updateBar("constancia", targetConstancia);
  updateBar("clareza", targetClareza);
  updateBar("ritmo", targetRitmo);
  updateBar("foco", targetFoco);
  updateBar("expansao", targetExpansao);
  updateBar("motivacao", targetMotivacao);
  updateBar("estabilidade", targetEstabilidade);

  paintAll();

  // Modo aula: acumular média (pra relatório)
  if (mode === "aula"){
    const s = loadState();
    s.aula = s.aula || { startedAt: Date.now(), samples: 0, sum: {} };
    s.aula.samples += 1;
    Object.keys(bars).forEach(k => {
      s.aula.sum[k] = (s.aula.sum[k] || 0) + bars[k];
    });
    saveState(s);
  }
}

// ====== Persistência local p/ relatório ======
function loadState(){
  try{ return JSON.parse(localStorage.getItem("presenca_state") || "{}"); }
  catch{ return {}; }
}
function saveState(s){
  localStorage.setItem("presenca_state", JSON.stringify(s));
}

// default
setMode("livre");
paintAll();
setMicUI(false);