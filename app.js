// Presença — barras motivacionais com:
// - subida exponencial (rápida no começo, depois estabiliza)
// - queda linear (desce devagar e suave)
// - atualização em batidas (evita tremedeira)

const METRICS = [
  "Energia",
  "Constância",
  "Clareza",
  "Ritmo",
  "Foco",
  "Expansão",
  "Motivação",
  "Estabilidade",
];

// ====== Config “feel” (ajuste fino aqui) ======
// frequência de atualização das barras (ms)
const TICK_MS = 120;

// limite mínimo para considerar “tem voz”
const VOICE_GATE = 0.020; // RMS (0..1) — ajuste se necessário

// "subida exponencial": quanto maior, mais enche rápido
// (valores típicos 1.4 a 3.2)
const RISE_BASE = 2.2;

// "queda linear": quanto maior, mais cai por segundo
// (valores típicos 0.08 a 0.20)
const FALL_PER_SEC = 0.12;

// suavização de display (quanto maior, mais “peso” e menos tremedeira)
const DISPLAY_SMOOTH = 0.22;

// ====== Estado ======
let audioCtx = null;
let analyser = null;
let micStream = null;
let data = null;

let running = false;
let lastTick = 0;

// cada métrica tem valor real (raw) e valor mostrado (disp)
const state = METRICS.reduce((acc, k) => {
  acc[k] = { raw: 0, disp: 0 };
  return acc;
}, {});

// metas “derivadas” (pesos por característica)
function clamp01(x){ return Math.max(0, Math.min(1, x)); }
function lerp(a,b,t){ return a + (b-a)*t; }

// ====== UI ======
const barsEl = document.getElementById("bars");
const btnMic = document.getElementById("btnMic");
const btnMicTxt = document.getElementById("btnMicTxt");

const barEls = {}; // name -> fill div

function buildBars(){
  barsEl.innerHTML = "";
  for(const name of METRICS){
    const block = document.createElement("div");
    block.className = "barBlock";

    const label = document.createElement("div");
    label.className = "barName";
    label.textContent = name;

    const track = document.createElement("div");
    track.className = "track";

    const fill = document.createElement("div");
    fill.className = "fill";
    track.appendChild(fill);

    block.appendChild(label);
    block.appendChild(track);
    barsEl.appendChild(block);

    barEls[name] = fill;
  }
}

buildBars();

// ====== Audio features ======
function rmsFromTimeDomain(buf){
  let sum = 0;
  for(let i=0;i<buf.length;i++){
    const v = (buf[i] - 128) / 128;
    sum += v*v;
  }
  return Math.sqrt(sum / buf.length);
}

function zcrFromTimeDomain(buf){
  // Zero Crossing Rate aproximado (0..1)
  let crossings = 0;
  let prev = (buf[0] - 128);
  for(let i=1;i<buf.length;i++){
    const cur = (buf[i] - 128);
    if((prev >= 0 && cur < 0) || (prev < 0 && cur >= 0)) crossings++;
    prev = cur;
  }
  return crossings / (buf.length - 1);
}

// “fala” (0..1) — mistura de volume + variação
function speechiness(rms, zcr){
  // normaliza RMS (gate vira 0)
  const v = clamp01((rms - VOICE_GATE) / 0.10);  // 0.10 = faixa útil
  // zcr em fala costuma ficar em faixa média; aqui vira “energia de articulação”
  const a = clamp01((zcr - 0.05) / 0.25);
  // mistura
  return clamp01(0.75*v + 0.25*a);
}

// ====== Integrador pedido ======
function expoRise(current, input, dtSec){
  // subida exponencial: aproxima 1 mais rápido conforme input
  // fórmula: next = 1 - (1-current)*exp(-k*input*dt)
  const k = RISE_BASE;
  const next = 1 - (1 - current) * Math.exp(-k * input * dtSec);
  return clamp01(next);
}

function linearFall(current, dtSec){
  const next = current - (FALL_PER_SEC * dtSec);
  return clamp01(next);
}

// ====== Métricas “motivacionais” (input -> barras) ======
function computeTargets(rms, zcr, sp){
  // base (0..1)
  const energy = clamp01((rms - VOICE_GATE) / 0.12);
  const articulation = clamp01((zcr - 0.05) / 0.25);

  // “ritmo”: estabilidade de fala (evita tremedeira) — aqui usamos sp mais estável
  const ritmo = clamp01(0.6*sp + 0.4*articulation);

  // “clareza”: articulação + energia moderada
  const clareza = clamp01(0.55*articulation + 0.45*energy);

  // “foco”: fala contínua (sp)
  const foco = sp;

  // “constância”: estabilidade (quanto menos picos, mais constante) — derivamos do disp
  // (aqui só cria tendência, o integrador faz o resto)
  const constancia = clamp01(0.75*sp + 0.25*(1 - Math.abs(energy - 0.45)));

  // “expansão”: energia + continuidade
  const expansao = clamp01(0.55*energy + 0.45*sp);

  // “motivação”: energia crescente + continuidade
  const motivacao = clamp01(0.60*energy + 0.40*sp);

  // “estabilidade”: energia moderada + constância
  const estabilidade = clamp01(0.60*constancia + 0.40*(1 - Math.abs(energy - 0.40)));

  return {
    "Energia": energy,
    "Constância": constancia,
    "Clareza": clareza,
    "Ritmo": ritmo,
    "Foco": foco,
    "Expansão": expansao,
    "Motivação": motivacao,
    "Estabilidade": estabilidade,
  };
}

// ====== Loop ======
function tick(ts){
  if(!running) return;

  if(!lastTick) lastTick = ts;
  const dt = (ts - lastTick) / 1000;
  if((ts - lastTick) < (TICK_MS - 5)){
    requestAnimationFrame(tick);
    return;
  }
  lastTick = ts;

  analyser.getByteTimeDomainData(data);

  const rms = rmsFromTimeDomain(data);
  const zcr = zcrFromTimeDomain(data);
  const sp = speechiness(rms, zcr);

  const targets = computeTargets(rms, zcr, sp);

  // aplica: se tem voz -> sobe exponencial; se não -> cai linear
  const hasVoice = rms > VOICE_GATE;

  for(const name of METRICS){
    const cur = state[name].raw;
    let next = cur;

    if(hasVoice){
      // input dá direção (0..1)
      const input = targets[name] ?? sp;
      next = expoRise(cur, input, dt);
    }else{
      next = linearFall(cur, dt);
    }

    // display smoothing (evita tremedeira)
    state[name].raw = next;
    state[name].disp = lerp(state[name].disp, next, DISPLAY_SMOOTH);

    // render
    const pct = Math.round(state[name].disp * 100);
    barEls[name].style.width = `${pct}%`;
  }

  requestAnimationFrame(tick);
}

// ====== Microfone toggle ======
async function startMic(){
  if(running) return;

  try{
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const src = audioCtx.createMediaStreamSource(micStream);

    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.85; // suaviza o sinal

    src.connect(analyser);

    data = new Uint8Array(analyser.fftSize);

    running = true;
    btnMicTxt.textContent = "Desativar Microfone";
    requestAnimationFrame(tick);
  }catch(err){
    console.error(err);
    alert("Não foi possível acessar o microfone. Verifique permissão no navegador.");
  }
}

function stopMic(){
  running = false;
  lastTick = 0;

  if(micStream){
    micStream.getTracks().forEach(t => t.stop());
    micStream = null;
  }
  if(audioCtx){
    audioCtx.close().catch(()=>{});
    audioCtx = null;
  }
  analyser = null;
  data = null;

  btnMicTxt.textContent = "Ativar Microfone";
}

btnMic.addEventListener("click", async () => {
  if(!running) await startMic();
  else stopMic();
});