let audioContext;
let analyser;
let microphone;
let dataArray;
let isActive = false;
let animationId;

const micBtn = document.getElementById("micBtn");

micBtn.addEventListener("click", toggleMic);

async function toggleMic() {
  if (!isActive) {
    try {
      await startMic();
      micBtn.textContent = "⏹ Encerrar";
      micBtn.classList.add("active");
      isActive = true;
    } catch (err) {
      alert("Erro ao acessar microfone: " + err.message);
    }
  } else {
    stopMic();
    micBtn.textContent = "🎤 Ativar Microfone";
    micBtn.classList.remove("active");
    isActive = false;
  }
}

async function startMic() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("Microfone não suportado neste navegador.");
  }

  audioContext = new (window.AudioContext || window.webkitAudioContext)();

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  microphone = audioContext.createMediaStreamSource(stream);
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;

  dataArray = new Uint8Array(analyser.frequencyBinCount);

  microphone.connect(analyser);

  animate();
}

function stopMic() {
  cancelAnimationFrame(animationId);
  if (audioContext) {
    audioContext.close();
  }
}

function animate() {
  analyser.getByteFrequencyData(dataArray);

  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    sum += dataArray[i];
  }

  let volume = sum / dataArray.length;

  let energia = Math.min(volume * 2, 100);
  let constancia = Math.min(volume * 1.5, 100);
  let clareza = Math.min(volume * 1.2, 100);
  let ritmo = Math.min(Math.abs(volume - 30) * 2, 100);
  let foco = Math.min(volume * 1.3, 100);
  let expansao = Math.min(volume * 1.1, 100);
  let motivacao = Math.min((energia + constancia) / 2, 100);
  let estabilidade = Math.max(0, 100 - Math.abs(volume - 30) * 3);

  updateBar("energia", energia);
  updateBar("constancia", constancia);
  updateBar("clareza", clareza);
  updateBar("ritmo", ritmo);
  updateBar("foco", foco);
  updateBar("expansao", expansao);
  updateBar("motivacao", motivacao);
  updateBar("estabilidade", estabilidade);

  animationId = requestAnimationFrame(animate);
}

function updateBar(id, value) {
  document.getElementById(id).style.width = value + "%";
}