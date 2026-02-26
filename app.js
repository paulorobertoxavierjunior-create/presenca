(() => {
  // ===== Config =====
  const TICK_MS = 200;               // você pediu 200ms
  const RISE_TAU_MS = 900;           // quanto menor, mais rápido sobe (exponencial)
  const FALL_PER_SEC = 0.18;         // descida linear por segundo (0..1)
  const SILENCE_GATE = 0.012;        // sensibilidade: menor = pega mais som; maior = ignora ruído
  const SMOOTH_ENERGY = 0.35;        // 0..1 (suaviza energia instantânea)

  // ===== UI =====
  const btnMic = document.getElementById("btnMic");
  const btnMicTxt = document.getElementById("btnMicTxt");
  const micStateEl = document.getElementById("micState");
  const barList = document.getElementById("barList");

  // ===== Barras (input / motivação) =====
  const METRICS = [
    { key:"energia",      label:"Energia"      },
    { key:"constancia",   label:"Constância"   },
    { key:"clareza",      label:"Clareza"      },
    { key:"ritmo",        label:"Ritmo"        },
    { key:"foco",         label:"Foco"         },
    { key:"expansao",     label:"Expansão"     },
    { key:"motivacao",    label:"Motivação"    },
    { key:"estabilidade", label:"Estabilidade" },
  ];

  const bars = {};     // valor exibido (0..1)
  const targets = {};  // alvo instantâneo (0..1)

  function clamp01(x){ return Math.max(0, Math.min(1, x)); }

  function mountBars(){
    barList.innerHTML = "";
    METRICS.forEach(m => {
      bars[m.key] = 0;
      targets[m.key] = 0;

      const row = document.createElement("div");
      row.className = "barRow";

      const lbl = document.createElement("div");
      lbl.className = "barLabel";
      lbl.textContent = m.label;

      const track = document.createElement("div");
      track.className = "track";

      const fill = document.createElement("div");
      fill.className = "fill";
      fill.id = `fill_${m.key}`;

      track.appendChild(fill);
      row.appendChild(lbl);
      row.appendChild(track);
      barList.appendChild(row);
    });
  }

  function setFill(key, v){
    const el = document.getElementById(`fill_${key}`);
    if(el) el.style.width = `${Math.round(clamp01(v)*100)}%`;
  }

  // ===== Áudio =====
  let audioCtx = null;
  let stream = null;
  let analyser = null;
  let data = null;

  // estado de medição
  let tickHandle = null;
  let lastTs = 0;

  // buffers curtinhos (para constância/estabilidade/ritmo)
  const energyHist = []; // últimos ~6s
  const peakHist = [];   // timestamps de picos (para ritmo)
  let energySmooth = 0;

  function nowMs(){ return performance.now(); }

  function rmsFromTimeDomain(arr){
    let sum = 0;
    for(let i=0;i<arr.length;i++){
      const x = (arr[i]-128)/128;
      sum += x*x;
    }
    return Math.sqrt(sum/arr.length);
  }

  function mean(arr){
    if(!arr.length) return 0;
    return arr.reduce((a,b)=>a+b,0)/arr.length;
  }

  function variance(arr){
    if(arr.length < 2) return 0;
    const m = mean(arr);
    let v = 0;
    for(const x of arr) v += (x-m)*(x-m);
    return v/(arr.length-1);
  }

  function startTick(){
    stopTick();
    lastTs = nowMs();
    tickHandle = setInterval(tick, TICK_MS);
  }

  function stopTick(){
    if(tickHandle){
      clearInterval(tickHandle);
      tickHandle = null;
    }
  }

  // subida exponencial: aproxima do alvo com tau
  function riseExp(current, target, dtSec){
    // alpha = 1 - exp(-dt/tau)
    const tau = RISE_TAU_MS/1000;
    const alpha = 1 - Math.exp(-dtSec / Math.max(0.05, tau));
    return current + (target - current) * alpha;
  }

  // descida linear
  function fallLin(current, dtSec){
    return Math.max(0, current - FALL_PER_SEC * dtSec);
  }

  function applyDynamics(key, target, dtSec){
    const cur = bars[key];
    const t = clamp01(target);

    if(t > cur){
      bars[key] = clamp01(riseExp(cur, t, dtSec));
    } else {
      // quando não tem estímulo, cai devagar
      bars[key] = clamp01(fallLin(cur, dtSec));
    }
    setFill(key, bars[key]);
  }

  function tick(){
    if(!analyser || !data) return;
    const ts = nowMs();
    const dtSec = (ts - lastTs)/1000;
    lastTs = ts;

    analyser.getByteTimeDomainData(data);
    const rms = rmsFromTimeDomain(data);

    // energia suavizada (pra parar de "piscar")
    energySmooth = (1 - SMOOTH_ENERGY) * energySmooth + SMOOTH_ENERGY * rms;

    // gate de silêncio (ruído não vira “fala”)
    const speaking = energySmooth > SILENCE_GATE;

    // guarda histórico ~6s
    energyHist.push(energySmooth);
    while(energyHist.length > Math.round(6000 / TICK_MS)) energyHist.shift();

    // detecta picos simples (para ritmo)
    // (pico = energia acima de uma linha móvel)
    const base = mean(energyHist);
    const isPeak = speaking && energySmooth > Math.max(base * 1.25, SILENCE_GATE * 1.6);
    if(isPeak){
      peakHist.push(ts);
      // limpa picos velhos (>6s)
      while(peakHist.length && (ts - peakHist[0]) > 6000) peakHist.shift();
    } else {
      while(peakHist.length && (ts - peakHist[0]) > 6000) peakHist.shift();
    }

    // ==== Targets (0..1) — todos são INPUT/MOTIVAÇÃO ====
    // energia: volume normalizado
    const energia = clamp01((energySmooth - SILENCE_GATE) / 0.10);

    // constância: quanto menos variação, mais sobe (e precisa estar falando)
    const varE = variance(energyHist);
    const constancia = speaking ? clamp01(1 - (varE / 0.0025)) : 0;

    // estabilidade: parecido com constância, mas mais “tolerante”
    const estabilidade = speaking ? clamp01(1 - (varE / 0.0045)) : 0;

    // foco: proporção de quadros com fala nos últimos ~6s
    const speakFrames = energyHist.filter(x => x > SILENCE_GATE).length;
    const foco = clamp01(speakFrames / Math.max(1, energyHist.length));

    // expansão: fala contínua “empilha” (incentiva continuar)
    // (quanto mais foco + energia sustentada, mais expande)
    const expansao = clamp01((foco * 0.7) + (energia * 0.3));

    // ritmo: picos por minuto (não é “palavra”, é cadência)
    const peaksPerMin = peakHist.length * (60_000 / 6000); // janela 6s
    const ritmo = clamp01(peaksPerMin / 160); // 160ppm como topo “animado”

    // clareza: aqui vira “fala limpa/regular”: energia acima do gate + var baixo
    const clareza = speaking ? clamp01((energia * 0.6) + (constancia * 0.4)) : 0;

    // motivação: sustentação (se mantém falando, sobe)
    const motivacao = clamp01((foco * 0.5) + (expansao * 0.3) + (energia * 0.2));

    // joga em targets
    targets.energia = energia;
    targets.constancia = constancia;
    targets.estabilidade = estabilidade;
    targets.foco = foco;
    targets.expansao = expansao;
    targets.ritmo = ritmo;
    targets.clareza = clareza;
    targets.motivacao = motivacao;

    // ==== Dinâmica final (sobe exp / desce linear) ====
    METRICS.forEach(m => applyDynamics(m.key, targets[m.key], dtSec));
  }

  async function micOn(){
    // iOS/Android/Chrome exigem gesto do usuário (clique)
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const src = audioCtx.createMediaStreamSource(stream);

    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.0;

    data = new Uint8Array(analyser.fftSize);
    src.connect(analyser);

    // reset hist
    energyHist.length = 0;
    peakHist.length = 0;
    energySmooth = 0;

    micStateEl.textContent = "ligado";
    btnMicTxt.textContent = "Desativar Microfone";
    startTick();
  }

  function micOff(){
    stopTick();

    if(stream){
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    if(audioCtx){
      audioCtx.close().catch(()=>{});
      audioCtx = null;
    }
    analyser = null;
    data = null;

    micStateEl.textContent = "desligado";
    btnMicTxt.textContent = "Ativar Microfone";
  }

  // ===== Boot =====
  mountBars();

  btnMic.addEventListener("click", async () => {
    try{
      if(stream) micOff();
      else await micOn();
    } catch (e){
      micOff();
      alert("Não consegui ativar o microfone. Verifique a permissão do navegador e tente de novo.");
      console.error(e);
    }
  });
})();