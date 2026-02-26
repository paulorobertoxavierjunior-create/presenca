// app.js — Presença (memória nas barras)
// Requisitos no HTML:
// - botão: <button id="btnMic">...</button>
// - cada barra: <div class="fill" data-key="energia"></div> etc.
// Keys esperadas: energia, constancia, clareza, ritmo, foco, expansao, motivacao, estabilidade

const KEYS = ["energia","constancia","clareza","ritmo","foco","expansao","motivacao","estabilidade"];

let audioStream = null;
let audioCtx = null;
let analyser = null;
let data = null;

let micOn = false;
let rafId = null;
let lastT = performance.now();

// Estado “com memória”
const S = Object.fromEntries(KEYS.map(k => [k, 0])); // 0..1

// Falando / silêncio
let speaking = false;
let speakHold = 0;          // histerese: mantém "falando" um pouco
let speechSeconds = 0;      // tempo de fala acumulado (janela)
let silenceSeconds = 0;

// Ritmo (turnos)
let lastSpeakFlip = 0;
let speakFlips = 0;

// Janela (para constância/estabilidade)
const WINDOW = 6.0;         // segundos
let windowTimer = 0;

// Parâmetros ajustáveis (sensação “boa”)
const CFG = {
  fps: 12,                  // atualiza 12x/s
  threshold: 0.018,         // sensibilidade (ajuste fino)
  holdSec: 0.25,            // evita piscada fala/silêncio
  attack: 0.55,             // sobe rápido (0..1)
  decayPerSec: 0.10,        // desce devagar (linear por segundo)
  maxRisePerSec: 0.75,      // limite de subida por segundo
};

function $(id){ return document.getElementById(id); }

function setBtnLabel() {
  const b = $("btnMic");
  if (!b) return;
  b.textContent = micOn ? "🎙️ Desativar Microfone" : "🎤 Ativar Microfone";
}

function clamp01(x){ return Math.max(0, Math.min(1, x)); }

function getRMS() {
  analyser.getFloatTimeDomainData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++){
    const v = data[i];
    sum += v*v;
  }
  return Math.sqrt(sum / data.length);
}

function updateBarsUI(){
  for (const k of KEYS){
    const el = document.querySelector(`.fill[data-key="${k}"]`);
    if (el) el.style.width = `${Math.round(S[k]*100)}%`;
  }
}

function tick(now){
  const dt = (now - lastT) / 1000;
  lastT = now;

  // limita dt (evita salto se a aba congelar)
  const d = Math.min(dt, 0.2);

  // Fala detectada por energia (RMS)
  const rms = getRMS();
  const isVoice = rms > CFG.threshold;

  // histerese: segura "falando" um pouco
  if (isVoice) {
    speakHold = CFG.holdSec;
    if (!speaking) {
      speaking = true;
      speakFlips++;
      lastSpeakFlip = now;
    }
  } else {
    speakHold = Math.max(0, speakHold - d);
    if (speakHold === 0 && speaking) {
      speaking = false;
      speakFlips++;
      lastSpeakFlip = now;
    }
  }

  // Acúmulos
  if (speaking) {
    speechSeconds += d;
    silenceSeconds = Math.max(0, silenceSeconds - d * 0.6); // “apaga” silêncio devagar
  } else {
    silenceSeconds += d;
    speechSeconds = Math.max(0, speechSeconds - d * 0.35); // “apaga” fala bem devagar
  }

  // Janela para métricas mais estáveis
  windowTimer += d;
  if (windowTimer >= WINDOW) {
    windowTimer = 0;
    speakFlips = 0; // reseta a cada janela
  }

  // ======= Targets (0..1) baseados em INPUT (fala) com memória =======
  // Energia: cresce com fala contínua + rms
  const energyTarget = clamp01((rms / (CFG.threshold*3)) * (speaking ? 1 : 0.35));

  // Constância: mais fala contínua dentro da janela → maior
  const constTarget = clamp01(speechSeconds / (WINDOW * 0.75));

  // Ritmo: menos “piscadas” (trocas fala/silêncio) → melhor
  // Quanto mais flips, mais “quebrado”. Aqui: 0 flips = ótimo.
  const flipPenalty = clamp01(speakFlips / 10);
  const rhythmTarget = clamp01(1 - flipPenalty) * (speaking ? 1 : 0.55);

  // Clareza (aqui como “estabilidade do volume”): se rms não está espirrando, sobe.
  // Simples: clareza cresce com fala + energia moderada
  const clarityTarget = clamp01((energyTarget * 0.8 + constTarget * 0.2));

  // Foco: fala contínua sem muita oscilação
  const focusTarget = clamp01(constTarget * 0.8 + rhythmTarget * 0.2);

  // Expansão: quanto mais tempo falando (até um teto), mais sobe
  const expansionTarget = clamp01(speechSeconds / (WINDOW * 0.9));

  // Motivação: sobe com progresso (foco+expansão), cai devagar no silêncio
  const motivationTarget = clamp01((focusTarget + expansionTarget) / 2);

  // Estabilidade: inverso do silêncio acumulado (se ficou muito tempo parado, desce)
  const stabilityTarget = clamp01(1 - (silenceSeconds / (WINDOW * 0.9)));

  const TARGET = {
    energia: energyTarget,
    constancia: constTarget,
    clareza: clarityTarget,
    ritmo: rhythmTarget,
    foco: focusTarget,
    expansao: expansionTarget,
    motivacao: motivationTarget,
    estabilidade: stabilityTarget
  };

  // ======= Dinâmica: sobe rápido (exponencial) / desce devagar (linear) =======
  for (const k of KEYS) {
    const cur = S[k];
    const tar = TARGET[k];

    if (tar > cur) {
      // “Attack” exponencial + limite de subida por segundo
      const step = (tar - cur) * CFG.attack;
      const maxStep = CFG.maxRisePerSec * d;
      S[k] = clamp01(cur + Math.min(step, maxStep));
    } else {
      // “Decay” linear por segundo
      S[k] = clamp01(cur - CFG.decayPerSec * d);
    }
  }

  updateBarsUI();

  // manter FPS estável
  rafId = setTimeout(() => requestAnimationFrame(tick), 1000 / CFG.fps);
}

async function micStart(){
  audioStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  });

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const src = audioCtx.createMediaStreamSource(audioStream);

  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  data = new Float32Array(analyser.fftSize);

  src.connect(analyser);

  micOn = true;
  setBtnLabel();

  lastT = performance.now();
  requestAnimationFrame(tick);
}

function micStop(){
  micOn = false;
  setBtnLabel();

  if (rafId) {
    clearTimeout(rafId);
    rafId = null;
  }

  if (audioStream) {
    audioStream.getTracks().forEach(t => t.stop());
    audioStream = null;
  }
  if (audioCtx) {
    audioCtx.close().catch(()=>{});
    audioCtx = null;
  }
  analyser = null;
  data = null;

  // mantém as barras e deixa caírem devagar “sozinhas”
  // (se quiser zerar ao desligar, descomenta:)
  // for (const k of KEYS) S[k]=0; updateBarsUI();
}

async function toggleMic(){
  try{
    if (!micOn) await micStart();
    else micStop();
  } catch (e){
    console.error(e);
    alert("Não consegui acessar o microfone. Verifique permissões do navegador.");
  }
}

window.addEventListener("load", () => {
  const b = $("btnMic");
  if (b) b.addEventListener("click", toggleMic);
  setBtnLabel();
  updateBarsUI();
});