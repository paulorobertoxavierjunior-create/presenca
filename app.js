const canvas = document.getElementById("heatmapCanvas");
const ctx = canvas.getContext("2d");
const recordBtn = document.getElementById("recordBtn");
const statusLabel = document.getElementById("statusLabel");
const rmsVal = document.getElementById("rms-val");

let stream = null;
let audioContext = null;
let analyser = null;
let dataArray = null;
let freqArray = null;
let running = false;
let animId = null;

function fitCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * devicePixelRatio);
  canvas.height = Math.floor(rect.height * devicePixelRatio);
}
fitCanvas();
window.addEventListener("resize", fitCanvas);

function clearCanvas() {
  ctx.fillStyle = "#050c12";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}
clearCanvas();

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function rmsFromTimeDomain(arr) {
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    const v = (arr[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / arr.length);
}

function averageBand(arr, start, end) {
  let sum = 0;
  let count = 0;
  for (let i = start; i < end; i++) {
    sum += arr[i];
    count++;
  }
  return count ? sum / count : 0;
}

function colorForValue(v) {
  const n = clamp(v, 0, 100) / 100;
  const r = Math.floor(255 * n);
  const g = Math.floor(80 + (170 * n));
  const b = Math.floor(255 - (160 * n));
  return `rgb(${r},${g},${b})`;
}

function drawColumn(graves, medios, agudos, ruido) {
  const image = ctx.getImageData(1, 0, canvas.width - 1, canvas.height);
  ctx.putImageData(image, 0, 0);

  const bands = [
    { value: agudos, yStart: 0.00, yEnd: 0.25 },
    { value: medios, yStart: 0.25, yEnd: 0.55 },
    { value: graves, yStart: 0.55, yEnd: 0.82 },
    { value: ruido,  yStart: 0.82, yEnd: 1.00 }
  ];

  bands.forEach(band => {
    const y1 = Math.floor(canvas.height * band.yStart);
    const y2 = Math.floor(canvas.height * band.yEnd);
    ctx.fillStyle = colorForValue(band.value);
    ctx.fillRect(canvas.width - 1, y1, 1, y2 - y1);
  });
}

async function ligarMic() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.75;
    source.connect(analyser);
    dataArray = new Uint8Array(analyser.fftSize);
    freqArray = new Uint8Array(analyser.frequencyBinCount);
    statusLabel.textContent = "MICROFONE LIGADO";
  } catch (err) {
    statusLabel.textContent = "ERRO NO MICROFONE";
  }
}

function loop() {
  if (!running || !analyser) return;

  analyser.getByteTimeDomainData(dataArray);
  analyser.getByteFrequencyData(freqArray);

  const rms = rmsFromTimeDomain(dataArray);
  const volume = Math.round(clamp(rms * 140, 0, 100));

  const graves = Math.round(clamp(averageBand(freqArray, 2, 12) / 2.55, 0, 100));
  const medios = Math.round(clamp(averageBand(freqArray, 12, 40) / 2.55, 0, 100));
  const agudos = Math.round(clamp(averageBand(freqArray, 40, 90) / 2.55, 0, 100));
  const ruido = Math.round(clamp(averageBand(freqArray, 90, freqArray.length) / 2.55, 0, 100));

  rmsVal.textContent = volume;
  drawColumn(graves, medios, agudos, ruido);
  animId = requestAnimationFrame(loop);
}

recordBtn.addEventListener("click", async () => {
  if (!running) {
    if (!analyser) await ligarMic();
    running = true;
    recordBtn.classList.add("recording");
    statusLabel.textContent = "CAPTURANDO...";
    loop();
  } else {
    running = false;
    if (animId) cancelAnimationFrame(animId);
    recordBtn.classList.remove("recording");
    statusLabel.textContent = "PRONTO PARA CAPTURA";
  }
});
