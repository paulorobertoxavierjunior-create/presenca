let audioCtx, analyser, stream;
let dataArray;

let running = false;

let volumes = [];
let pauses = [];
let lastSound = 0;

let sessions = [];

// ====================
function toggleMic() {
  if (!running) start();
  else stop();
}

// ====================
async function start() {
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(stream);

  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;

  source.connect(analyser);

  dataArray = new Uint8Array(analyser.fftSize);

  running = true;
  lastSound = performance.now();

  document.getElementById("status").innerText = "ouvindo";

  loop();
}

// ====================
function stop() {
  running = false;

  const session = gerarSessao();
  sessions.unshift(session);
  if (sessions.length > 3) sessions.pop();

  atualizarUI();

  document.getElementById("status").innerText = "parado";
}

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
    if (pausa > 200) pauses.push(pausa);
    lastSound = now;
  }

  atualizarBarras(volume);

  requestAnimationFrame(loop);
}

// ====================
function gerarSessao() {
  const ritmo = calcRitmo(volumes);
  const silencio = calcSilencio(volumes);
  const hesitacao = pauses.filter(p => p > 1200).length;

  const estado = classificarEstado(ritmo, silencio, hesitacao);

  volumes = [];
  pauses = [];

  return { ritmo, silencio, hesitacao, estado };
}

// ====================
function calcRitmo(v) {
  let osc = 0;
  for (let i = 1; i < v.length; i++) {
    osc += Math.abs(v[i] - v[i - 1]);
  }
  return Math.round(osc / v.length);
}

function calcSilencio(v) {
  return Math.round((v.filter(x => x < 8).length / v.length) * 100);
}

function classificarEstado(r, s, h) {
  if (h > 2) return "reflexão";
  if (r > 20) return "fluxo";
  if (s > 50) return "hesitação";
  return "neutro";
}

// ====================
function atualizarBarras(volume) {
  document.getElementById("barVolume").style.width = volume + "%";
}

// ====================
function atualizarUI() {

  for (let i = 0; i < 3; i++) {
    const s = sessions[i];
    const el = document.getElementById("s" + i);

    if (!s) {
      el.innerText = "vazio";
      continue;
    }

    el.innerText =
      `R:${s.ritmo}\nS:${s.silencio}%\nH:${s.hesitacao}\n${s.estado}`;
  }

  const json = {
    tipo: "CRS",
    sessoes: sessions
  };

  document.getElementById("json").innerText =
    JSON.stringify(json, null, 2);

  if (sessions[0]) {
    document.getElementById("estado").innerText =
      "estado: " + sessions[0].estado;
  }
}