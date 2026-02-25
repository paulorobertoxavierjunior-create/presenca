let audioContext;
let analyser;
let microphone;
let dataArray;
let isActive = false;
let speakingTime = 0;
let totalTime = 0;
let wordsCount = 0;
let lastVolume = 0;
let stabilityScore = 100;
 
const micBtn = document.getElementById("micBtn");

micBtn.addEventListener("click", toggleMic);

async function toggleMic() {
  if (!isActive) {
    await startMic();
    micBtn.textContent = "⏹ Encerrar";
    micBtn.classList.add("active");
  } else {
    stopMic();
    micBtn.textContent = "🎤 Ativar Microfone";
    micBtn.classList.remove("active");
  }
  isActive = !isActive;
}

async function startMic() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  microphone = audioContext.createMediaStreamSource(stream);
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 512;
  dataArray = new Uint8Array(analyser.frequencyBinCount);

  microphone.connect(analyser);
  speakingTime = 0;
  totalTime = 0;
  wordsCount = 0;
  animate();
}

function stopMic() {
  if (audioContext) audioContext.close();
}

function animate() {
  if (!isActive) return;

  analyser.getByteFrequencyData(dataArray);

  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    sum += dataArray[i];
  }

  const volume = sum / dataArray.length;

  totalTime += 0.1;

  if (volume > 20) {
    speakingTime += 0.1;
    wordsCount += 0.5;
  }

  const energy = Math.min(volume * 1.5, 100);
  const constancia = Math.min((speakingTime / totalTime) * 100, 100);
  const clareza = Math.min(wordsCount, 100);
  const ritmo = Math.min(Math.abs(volume - lastVolume) * 2, 100);
  const foco = Math.min(speakingTime * 2, 100);
  const expansao = Math.min(totalTime * 2, 100);
  const motivacao = Math.min((energy + constancia) / 2, 100);

  stabilityScore -= Math.abs(volume - lastVolume) * 0.05;
  stabilityScore = Math.max(0, Math.min(100, stabilityScore));
  lastVolume = volume;

  updateBar("energia", energy);
  updateBar("constancia", constancia);
  updateBar("clareza", clareza);
  updateBar("ritmo", ritmo);
  updateBar("foco", foco);
  updateBar("expansao", expansao);
  updateBar("motivacao", motivacao);
  updateBar("estabilidade", stabilityScore);

  setTimeout(animate, 100);
}

function updateBar(id, value) {
  document.getElementById(id).style.width = value + "%";
}