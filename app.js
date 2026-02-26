(() => {
  "use strict";

  // ===== Config =====
  const TICK_MS = 200;           // update 200ms
  const TICK_S = TICK_MS / 1000;

  // Sobe rápido (exponencial) / desce devagar (linear)
  const RISE_TAU = 0.55;         // quanto menor, mais rápido sobe
  const FALL_PER_SEC = 0.10;     // quanto menor, mais devagar desce

  // Gate de voz (não confundir ruído com fala)
  const VOICE_THRESHOLD = 0.018; // RMS mínimo (ajusta se precisar)
  const HOLD_SEC = 0.45;         // mantém "falando" um pouco após cair

  const METRICS = [
    { key: "energia",     label: "Energia" },
    { key: "constancia",  label: "Constância" },
    { key: "clareza",     label: "Clareza" },
    { key: "ritmo",       label: "Ritmo" },
    { key: "foco",        label: "Foco" },
    { key: "expansao",    label: "Expansão" },
    { key: "motivacao",   label: "Motivação" },
    { key: "estabilidade",label: "Estabilidade" },
  ];

  // ===== DOM =====
  const barsEl = document.getElementById("bars");
  const btnMic = document.getElementById("btnMic");
  const micStatus = document.getElementById("micStatus");
  document.getElementById("tickMs").textContent = `${TICK_MS}ms`;

  // build bars
  const barRefs = {};
  METRICS.forEach(m => {
    const row = document.createElement("div");
    row.className = "barRow";
    row.innerHTML = `
      <div class="label">${m.label}</div>
      <div class="track"><div class="fill" id="fill_${m.key}"></div></div>
      <div class="val" id="val_${m.key}">0%</div>
    `;
    barsEl.appendChild(row);
    barRefs[m.key] = {
      fill: row.querySelector(`#fill_${m.key}`),
      val: row.querySelector(`#val_${m.key}`)
    };
  });

  // ===== Audio state =====
  let audioCtx = null;
  let stream = null;
  let analyser = null;
  let data = null;
  let tickId = null;

  // scores 0..1
  const score = {
    talk: 0,          // “fala contínua” acumulativa
    stability: 0.5,   // estabilidade do volume
    rhythm: 0.4,      // regularidade dos pulsos
    clarity: 0.4,     // proxy simples: fala > ruído
    focus: 0.4,
    expansion: 0.4,
    motivation: 0.4
  };

  let lastRms = 0;
  let hold = 0;
  let pulseTimer = 0;
  let pulseRate = 0; // 0..1
  let silenceStreak = 0;

  function clamp01(x){ return Math.max(0, Math.min(1, x)); }
  function lerp(a,b,t){ return a + (b-a)*t; }

  function riseExp(current, target, dt, tau){
    // aproxima target com curva exponencial
    const k = 1 - Math.exp(-dt / Math.max(0.001, tau));
    return current + (target - current) * k;
  }

  function fallLin(current, dt, perSec){
    return Math.max(0, current - perSec * dt);
  }

  function setBar(key, v01){
    const v = clamp01(v01);
    const pct = Math.round(v * 100);
    barRefs[key].fill.style.width = `${pct}%`;
    barRefs[key].val.textContent = `${pct}%`;
  }

  function computeRmsFromTimeDomain(buf){
    let sum = 0;
    for (let i=0;i<buf.length;i++){
      const x = (buf[i] - 128) / 128; // -1..1
      sum += x*x;
    }
    return Math.sqrt(sum / buf.length);
  }

  function startTick(){
    if (tickId) return;
    tickId = setInterval(onTick, TICK_MS);
  }

  function stopTick(){
    if (!tickId) return;
    clearInterval(tickId);
    tickId = null;
  }

  function onTick(){
    if (!analyser || !data) return;

    analyser.getByteTimeDomainData(data);
    const rms = computeRmsFromTimeDomain(data);

    // Gate: fala vs ruído
    const voicedNow = rms >= VOICE_THRESHOLD;
    if (voicedNow){
      hold = HOLD_SEC;
      silenceStreak = 0;
    } else {
      hold = Math.max(0, hold - TICK_S);
      silenceStreak += 1;
    }
    const speaking = voicedNow || hold > 0;

    // Pulsos (ritmo): conta "subidas" de energia (bem simples e estável)
    const rising = rms - lastRms > 0.004;
    if (speaking && rising){
      pulseTimer += TICK_S;
      if (pulseTimer >= 0.35){
        pulseTimer = 0;
        pulseRate = clamp01(pulseRate + 0.08);
      }
    } else {
      pulseTimer = 0;
      pulseRate = fallLin(pulseRate, TICK_S, 0.25);
    }

    // ===== Núcleo: acumulador =====
    // talkScore sobe rápido quando fala, cai devagar quando cala
    if (speaking){
      // target sobe com a força do volume (rms) mas sem explodir
      const volumeBoost = clamp01((rms - VOICE_THRESHOLD) / 0.06);
      const target = clamp01(0.35 + 0.65 * volumeBoost);
      score.talk = riseExp(score.talk, target, TICK_S, RISE_TAU);
    } else {
      score.talk = fallLin(score.talk, TICK_S, FALL_PER_SEC);
    }

    // Estabilidade: quanto menos variação brusca de volume, mais estável
    const delta = Math.abs(rms - lastRms);
    const stableNow = clamp01(1 - (delta / 0.03));
    score.stability = riseExp(score.stability, stableNow, TICK_S, 0.9);
    if (!speaking) score.stability = fallLin(score.stability, TICK_S, 0.04);

    // Clareza (proxy): fala acima do limiar e “sem tremedeira” de volume
    const clarityNow = speaking ? clamp01((rms - VOICE_THRESHOLD)/0.06) * stableNow : 0;
    score.clarity = riseExp(score.clarity, clarityNow, TICK_S, 0.75);
    if (!speaking) score.clarity = fallLin(score.clarity, TICK_S, 0.06);

    // Ritmo: pulseRate + estabilidade
    const rhythmNow = speaking ? clamp01(0.55*pulseRate + 0.45*stableNow) : 0;
    score.rhythm = riseExp(score.rhythm, rhythmNow, TICK_S, 0.7);
    if (!speaking) score.rhythm = fallLin(score.rhythm, TICK_S, 0.07);

    // Foco: continuidade sem “apagões” (silêncio longo derruba)
    const continuity = clamp01(1 - Math.min(1, (silenceStreak * TICK_S) / 2.0));
    const focusNow = speaking ? clamp01(0.65*continuity + 0.35*score.talk) : clamp01(0.35*continuity);
    score.focus = riseExp(score.focus, focusNow, TICK_S, 0.9);
    score.focus = fallLin(score.focus, TICK_S, 0.02);

    // Expansão: fala sustentada (talk) + ritmo
    const expNow = speaking ? clamp01(0.6*score.talk + 0.4*score.rhythm) : 0;
    score.expansion = riseExp(score.expansion, expNow, TICK_S, 0.85);
    if (!speaking) score.expansion = fallLin(score.expansion, TICK_S, 0.05);

    // Motivação: sobe com consistência (foco + estabilidade) e “fala”
    const motivNow = speaking ? clamp01(0.4*score.focus + 0.35*score.stability + 0.25*score.talk) : 0;
    score.motivation = riseExp(score.motivation, motivNow, TICK_S, 1.0);
    if (!speaking) score.motivation = fallLin(score.motivation, TICK_S, 0.04);

    // Energia final: base no talk + volume
    const energyNow = speaking ? clamp01(0.55*score.talk + 0.45*clamp01((rms - VOICE_THRESHOLD)/0.06)) : 0;
    // Constância final: foco + estabilidade
    const constNow = clamp01(0.55*score.focus + 0.45*score.stability);

    // ===== Render =====
    setBar("energia", energyNow);
    setBar("constancia", constNow);
    setBar("clareza", score.clarity);
    setBar("ritmo", score.rhythm);
    setBar("foco", score.focus);
    setBar("expansao", score.expansion);
    setBar("motivacao", score.motivation);
    setBar("estabilidade", score.stability);

    lastRms = rms;
  }

  async function enableMic(){
    try{
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);

      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.6;

      source.connect(analyser);

      data = new Uint8Array(analyser.fftSize);

      micStatus.textContent = "ligado";
      btnMic.textContent = "🎤 Desativar Microfone";
      btnMic.classList.remove("primary");
      btnMic.classList.add("ghost");

      startTick();
    } catch (e){
      micStatus.textContent = "bloqueado";
      alert("Não foi possível ativar o microfone. Verifique a permissão do navegador.");
    }
  }

  function disableMic(){
    stopTick();

    try{
      if (stream){
        stream.getTracks().forEach(t => t.stop());
      }
    } catch {}

    try{
      if (audioCtx){
        audioCtx.close();
      }
    } catch {}

    stream = null;
    audioCtx = null;
    analyser = null;
    data = null;

    micStatus.textContent = "desligado";
    btnMic.textContent = "🎤 Ativar Microfone";
    btnMic.classList.add("primary");
    btnMic.classList.remove("ghost");
  }

  btnMic.addEventListener("click", async () => {
    if (!stream) await enableMic();
    else disableMic();
  });

  // start with zeros
  METRICS.forEach(m => setBar(m.key, 0));
})();