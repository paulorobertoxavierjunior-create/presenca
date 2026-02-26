(() => {
  // ===== Config =====
  const TICK_MS = 200;

  // Sobe rápido (exponencial) / desce devagar (linear)
  const RISE_ALPHA = 0.35;   // 0..1 (maior = sobe mais rápido)
  const FALL_PER_TICK = 0.035; // 0..1 por tick (menor = desce mais devagar)

  // Detectar "fala" vs "silêncio" (ajuste fino)
  const VOICE_THRESHOLD = 0.012; // RMS (energia) mínima para considerar fala
  const ZCR_SMOOTH = 0.25;

  // ===== UI =====
  const btnMic = document.getElementById("btnMic");
  const micStatus = document.getElementById("micStatus");
  const tickInfo = document.getElementById("tickInfo");
  const barsEl = document.getElementById("bars");

  tickInfo.textContent = `${TICK_MS}ms`;

  const METRICS = [
    { id: "energia",     label: "Energia" },
    { id: "constancia",  label: "Constância" },
    { id: "clareza",     label: "Clareza" },
    { id: "ritmo",       label: "Ritmo" },
    { id: "foco",        label: "Foco" },
    { id: "expansao",    label: "Expansão" },
    { id: "motivacao",   label: "Motivação" },
    { id: "estabilidade",label: "Estabilidade" },
  ];

  const ui = {};
  function buildBars() {
    barsEl.innerHTML = "";
    METRICS.forEach(m => {
      const row = document.createElement("div");
      row.className = "barRow";
      row.innerHTML = `
        <div class="barLabel">${m.label}</div>
        <div class="track"><div class="fill" id="fill_${m.id}"></div></div>
        <div class="barVal" id="val_${m.id}">0.00</div>
      `;
      barsEl.appendChild(row);
      ui[m.id] = {
        fill: row.querySelector(`#fill_${m.id}`),
        val: row.querySelector(`#val_${m.id}`),
        x: 0, // estado 0..1
      };
    });
  }
  buildBars();

  // ===== Áudio =====
  let audioCtx = null;
  let analyser = null;
  let stream = null;
  let srcNode = null;
  let timer = null;

  let lastVoice = false;
  let voiceHold = 0;          // "tempo falando"
  let silenceHold = 0;        // "tempo em silêncio"
  let zcrAvg = 0;             // zero crossing rate suavizado (proxy de "clareza/definição")
  let energyAvg = 0;

  function clamp01(v){ return Math.max(0, Math.min(1, v)); }

  function integrate(metricId, target01) {
    const s = ui[metricId];
    // sobe exponencial para o alvo
    if (target01 > s.x) {
      s.x = s.x + (target01 - s.x) * RISE_ALPHA;
    } else {
      // desce linearmente
      s.x = Math.max(0, s.x - FALL_PER_TICK);
    }
    s.fill.style.width = `${Math.round(s.x * 100)}%`;
    s.val.textContent = s.x.toFixed(2);
  }

  function stopAll() {
    if (timer) { clearInterval(timer); timer = null; }

    if (srcNode) { try { srcNode.disconnect(); } catch {} srcNode = null; }
    if (analyser) { try { analyser.disconnect(); } catch {} analyser = null; }

    if (stream) {
      try { stream.getTracks().forEach(t => t.stop()); } catch {}
      stream = null;
    }

    if (audioCtx) {
      try { audioCtx.close(); } catch {}
      audioCtx = null;
    }

    btnMic.classList.remove("on");
    btnMic.textContent = "🎤 Ativar Microfone";
    micStatus.textContent = "desligado";
  }

  async function startMic() {
    // iOS/Android exigem gesto do usuário -> este start é chamado no click
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.0;

    srcNode = audioCtx.createMediaStreamSource(stream);
    srcNode.connect(analyser);

    btnMic.classList.add("on");
    btnMic.textContent = "🔇 Desativar Microfone";
    micStatus.textContent = "ligado";

    // zera estados de fala/silêncio
    lastVoice = false;
    voiceHold = 0;
    silenceHold = 0;
    zcrAvg = 0;
    energyAvg = 0;

    const buf = new Float32Array(analyser.fftSize);

    timer = setInterval(() => {
      analyser.getFloatTimeDomainData(buf);

      // RMS (energia)
      let sum = 0;
      let zc = 0;
      let prev = buf[0];
      for (let i = 0; i < buf.length; i++) {
        const v = buf[i];
        sum += v * v;
        if ((v >= 0 && prev < 0) || (v < 0 && prev >= 0)) zc++;
        prev = v;
      }
      const rms = Math.sqrt(sum / buf.length); // 0..~0.1
      const zcr = zc / buf.length;             // ~0..0.5

      // suavização
      energyAvg = energyAvg + (rms - energyAvg) * 0.25;
      zcrAvg = zcrAvg + (zcr - zcrAvg) * ZCR_SMOOTH;

      const voice = energyAvg > VOICE_THRESHOLD;

      if (voice) {
        voiceHold += 1;
        silenceHold = Math.max(0, silenceHold - 1);
      } else {
        silenceHold += 1;
        voiceHold = Math.max(0, voiceHold - 1);
      }

      // Normalizações simples (0..1)
      // (essas fórmulas são "motivacionais": sobem com fala contínua e estabilidade)
      const voice01 = clamp01((energyAvg - VOICE_THRESHOLD) / 0.04); // energia útil
      const talkContinuity = clamp01(voiceHold / 18);                // ~3.6s para 1.0 (18 ticks * 200ms)
      const calmSilence = clamp01(1 - (silenceHold / 25));           // cai com silêncio prolongado
      const zcr01 = clamp01((zcrAvg - 0.02) / 0.10);                 // proxy de articulação (bem rough)

      // "Ritmo": quer fala contínua, sem picos loucos
      const ritmoTarget = clamp01(0.35 + 0.65 * talkContinuity);

      // "Constância": fala contínua + pouco liga/desliga
      const constTarget = clamp01(0.25 + 0.75 * talkContinuity);

      // "Energia": energia útil + continuidade
      const energiaTarget = clamp01(0.15 + 0.55 * voice01 + 0.30 * talkContinuity);

      // "Clareza": usa zcr suavizado + continuidade (não é transcrição; é proxy)
      const clarezaTarget = clamp01(0.20 + 0.55 * zcr01 + 0.25 * talkContinuity);

      // "Foco": continuidade + “calma” (não ficar sumindo)
      const focoTarget = clamp01(0.25 + 0.55 * talkContinuity + 0.20 * calmSilence);

      // "Expansão": quando fala contínuo, sobe junto (pra incentivar alongar a fala)
      const expansaoTarget = clamp01(0.10 + 0.90 * talkContinuity);

      // "Motivação": mistura energia + expansão (UP)
      const motivacaoTarget = clamp01(0.15 + 0.45 * energiaTarget + 0.40 * expansaoTarget);

      // "Estabilidade": fica alto quando o áudio está “constante” (sem ligar/desligar)
      const stabilityBase = clamp01(0.30 + 0.70 * talkContinuity);
      const estabilidadeTarget = stabilityBase;

      // Integra com subida rápida / descida lenta
      integrate("energia", energiaTarget);
      integrate("constancia", constTarget);
      integrate("clareza", clarezaTarget);
      integrate("ritmo", ritmoTarget);
      integrate("foco", focoTarget);
      integrate("expansao", expansaoTarget);
      integrate("motivacao", motivacaoTarget);
      integrate("estabilidade", estabilidadeTarget);

      lastVoice = voice;
    }, TICK_MS);
  }

  // ===== Botão Mic toggle =====
  btnMic.addEventListener("click", async () => {
    try {
      if (stream) {
        stopAll();
      } else {
        await startMic();
      }
    } catch (err) {
      stopAll();
      alert("Não foi possível ativar o microfone. Verifique permissões do navegador (Chrome) e tente novamente.");
      console.error(err);
    }
  });

  // Segurança: se o usuário sai da aba, desliga
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && stream) stopAll();
  });

  // Compatibilidade
  if (!navigator.mediaDevices?.getUserMedia) {
    alert("Este navegador não suporta captura de microfone.");
    btnMic.disabled = true;
  }
})();