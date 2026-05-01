ctx.beginPath();
for (var i = 0; i < n; i++) {
  var ang = (Math.PI * 2 * i / n) - Math.PI / 2;
  var rv  = r * vals[i];
  i === 0 ? ctx.moveTo(cx + rv * Math.cos(ang), cy + rv * Math.sin(ang))
          : ctx.lineTo(cx + rv * Math.cos(ang), cy + rv * Math.sin(ang));
}
ctx.closePath();
ctx.fillStyle   = 'rgba(62,207,207,0.18)';
ctx.fill();
ctx.strokeStyle = '#3ecfcf';
ctx.lineWidth   = 2;
ctx.stroke();

// Pontos
for (var i = 0; i < n; i++) {
  var ang = (Math.PI * 2 * i / n) - Math.PI / 2;
  var rv  = r * vals[i];
  ctx.beginPath();
  ctx.arc(cx + rv * Math.cos(ang), cy + rv * Math.sin(ang), 4, 0, Math.PI * 2);
  ctx.fillStyle = '#3ecfcf';
  ctx.fill();
}

/* ── Mapa de silêncio ── */
function desenharMapaSilencio(silPct) {
  var canvas = document.getElementById('silCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  var blocos  = 88;
  var bw      = w / blocos;

  for (var i = 0; i < blocos; i++) {
    var eSil = (i < 3 || i > blocos - 4) ? true : (Math.random() * 100 < silPct);
    if (eSil) {
      ctx.fillStyle = 'rgba(74,122,128,0.12)';
      ctx.fillRect(i * bw, 0, bw - 1, h);
      ctx.fillStyle = 'rgba(74,122,128,0.25)';
      ctx.fillRect(i * bw + bw/2 - 0.5, h * 0.35, 1, h * 0.3);
    } else {
      var alt  = (0.25 + Math.random() * 0.65) * h;
      var yOff = (h - alt) / 2;
      ctx.fillStyle = 'rgba(62,207,207,0.65)';
      ctx.fillRect(i * bw, yOff, bw - 1, alt);
    }
  }
}

/* ══════════════════════════════════════════════════════════
   TIPO DE ANÁLISE
══════════════════════════════════════════════════════════ */
function selecionarTipo(tipo) {
  tipoAnalise = tipo;
  document.getElementById('tipoUnica').className   = 'tipo-btn' + (tipo==='unica'   ? ' ativo' : '');
  document.getElementById('tipoMemoria').className = 'tipo-btn' + (tipo==='memoria' ? ' ativo' : '');
  document.getElementById('custoTexto').textContent = tipo === 'unica' ? '1 token' : '2 tokens';
  atualizarUI_tokens();
}

/* ══════════════════════════════════════════════════════════
   DELTA
══════════════════════════════════════════════════════════ */
function calcularDelta(sessao, ref) {
  if (!ref) return null;
  var campos = ['silence_pct','energy_pct','oscillation_pct','continuity_pct','pause_count','mean_pause_ms'];
  var delta  = {};
  campos.forEach(function(c) {
    delta[c] = parseFloat(((sessao[c]||0) - (ref[c]||0)).toFixed(2));
  });
  return delta;
}

/* ══════════════════════════════════════════════════════════
   EXTRAÇÃO — Web Audio API
══════════════════════════════════════════════════════════ */
function setStatus(msg) {
  var el = document.getElementById('extracaoStatus');
  if (el) el.textContent = msg;
}

function blobToDataUrl(blob) {
  return new Promise(function(res) {
    var r = new FileReader();
    r.onload = function(e) { res(e.target.result); };
    r.readAsDataURL(blob);
  });
}

async function base64ToArrayBuffer(dataUrl) {
  var b64  = dataUrl.split(',')[1];
  var bin  = atob(b64);
  var buf  = new ArrayBuffer(bin.length);
  var view = new Uint8Array(buf);
  for (var i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
  return buf;
}

async function extrairMetricasDeAudio(dataUrl, label) {
  setStatus('Lendo ' + label + '...');
  var buf = await base64ToArrayBuffer(dataUrl);
  var actx = new (window.AudioContext || window.webkitAudioContext)();
  var dec;
  try { dec = await actx.decodeAudioData(buf); }
  catch(e) { await actx.close(); return vetorNulo(); }

  var ch = dec.getChannelData(0), sr = dec.sampleRate, dur = dec.duration;
  var win = Math.floor(sr * 0.025), rms = [];
  for (var i = 0; i < ch.length; i += win) {
    var sum = 0, end = Math.min(i+win, ch.length);
    for (var j = i; j < end; j++) sum += ch[j]*ch[j];
    rms.push(Math.sqrt(sum/(end-i)));
  }

  var THR=0.015, MF=Math.floor(0.2/0.025);
  var silF=0, pC=0, pLens=[], inP=false, pLen=0;
  for (var k=0; k<rms.length; k++) {
    if (rms[k]<THR) { silF++; inP ? pLen++ : (inP=true, pLen=1); }
    else { if(inP && pLen>=MF){ pC++; pLens.push(pLen*25); } inP=false; pLen=0; }
  }

  var silP  = rms.length ? (silF/rms.length)*100 : 0;
  var meanP = pLens.length ? pLens.reduce(function(a,b){return a+b;},0)/pLens.length : 0;
  var rmM   = rms.reduce(function(a,b){return a+b;},0)/rms.length;
  var eng   = Math.min(100, rmM*800);
  var vari  = rms.reduce(function(a,v){return a+Math.pow(v-rmM,2);},0)/rms.length;
  var std   = Math.sqrt(vari);
  var osc   = Math.min(100, std*1200);
  var cont  = Math.max(0, 100-silP-osc*0.3);

  var mid=Math.floor(ch.length/2), seg=ch.slice(mid,mid+2048), gr=0, me=0, ag=0;
  for (var s=0; s<seg.length; s++) {
    var nv=Math.abs(seg[s]);
    if(s<170) gr+=nv; else if(s<1024) me+=nv; else ag+=nv;
  }
  var tot=gr+me+ag||1;
  gr=(gr/tot)*100; me=(me/tot)*100; ag=(ag/tot)*100;
  var noise=Math.min(40,std*600), stab=Math.max(0,100-osc*0.6-noise*0.4);

  await actx.close();
  return {
    duration_sec:    parseFloat(dur.toFixed(2)),
    silence_pct:     parseFloat(silP.toFixed(2)),
    pause_count:     pC,
    mean_pause_ms:   parseFloat(meanP.toFixed(2)),
    oscillation_pct: parseFloat(osc.toFixed(2)),
    continuity_pct:  parseFloat(cont.toFixed(2)),
    energy_pct:      parseFloat(eng.toFixed(2)),
    spectrum_snapshot: {
      graves:       parseFloat(gr.toFixed(2)),
      medios:       parseFloat(me.toFixed(2)),
      agudos:       parseFloat(ag.toFixed(2)),
      ruido:        parseFloat(noise.toFixed(2)),
      estabilidade: parseFloat(stab.toFixed(2))
    }
  };
}

function vetorNulo() {
  return { duration_sec:0, silence_pct:0, pause_count:0, mean_pause_ms:0,
           oscillation_pct:0, continuity_pct:0, energy_pct:0,
           spectrum_snapshot:{ graves:0, medios:0, agudos:0, ruido:0, estabilidade:0 } };
}

function consolidarVetores(ms, w) {
  function med(c)  { return ms.reduce(function(a,m,i){ return a+(m[c]||0)*w[i]; },0); }
  function medS(c) { return ms.reduce(function(a,m,i){ return a+((m.spectrum_snapshot||{})[c]||0)*w[i]; },0); }
  return {
    duration_sec:    parseFloat(ms.reduce(function(a,m){return a+(m.duration_sec||0);},0).toFixed(2)),
    silence_pct:     parseFloat(med('silence_pct').toFixed(2)),
    pause_count:     ms.reduce(function(a,m){return a+(m.pause_count||0);},0),
    mean_pause_ms:   parseFloat(med('mean_pause_ms').toFixed(2)),
    oscillation_pct: parseFloat(med('oscillation_pct').toFixed(2)),
    continuity_pct:  parseFloat(med('continuity_pct').toFixed(2)),
    energy_pct:      parseFloat(med('energy_pct').toFixed(2)),
    spectrum_snapshot: {
      graves:       parseFloat(medS('graves').toFixed(2)),
      medios:       parseFloat(medS('medios').toFixed(2)),
      agudos:       parseFloat(medS('agudos').toFixed(2)),
      ruido:        parseFloat(medS('ruido').toFixed(2)),
      estabilidade: parseFloat(medS('estabilidade').toFixed(2))
    }
  };
}

/* ══════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════ */
function fmt(s) {
  return String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0');
}

function setWave(on) {
  document.querySelectorAll('.wave-bar').forEach(function(b) {
    on ? b.classList.add('on') : b.classList.remove('on');
  });
}

/* ══════════════════════════════════════════════════════════
   LOGOUT
══════════════════════════════════════════════════════════ */
function confirmarLogout() {
  if (!confirm('Encerrar sessão e sair do Presença?')) return;
  supa.auth.signOut().then(function() {
    sessionStorage.removeItem('elayon_calibrado');
    window.location.href = LOGIN_URL;
  });
}

/* ── Radar (duplicado, mantido para compatibilidade) ── */
function desenharRadar(v) {
  var canvas = document.getElementById('radarCanvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var cx = 130, cy = 130, r = 95;
  var labels = ['Energia','Continuidade','Estabilidade','Voz\n(inv. silêncio)','Fluxo\n(inv. osc.)','Presença'];
  var vals = [
    v.engP  / 100,
    v.contP / 100,
    v.stab  / 100,
    1 - v.silP / 100,
    1 - v.oscP / 100,
    Math.min(1, v.dur / 30)
  ];
  var n = vals.length;
  ctx.clearRect(0, 0, 260, 260);

  // Anéis de grade
  for (var ring = 1; ring <= 4; ring++) {
    ctx.beginPath();
    for (var i = 0; i < n; i++) {
      var ang = (Math.PI * 2 * i / n) - Math.PI / 2;
      var rr  = r * ring / 4;
      i === 0 ? ctx.moveTo(cx + rr * Math.cos(ang), cy + rr * Math.sin(ang))
              : ctx.lineTo(cx + rr * Math.cos(ang), cy + rr * Math.sin(ang));
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(62,207,207,0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Eixos e labels
  for (var i = 0; i < n; i++) {
    var ang = (Math.PI * 2 * i / n) - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + r * Math.cos(ang), cy + r * Math.sin(ang));
    ctx.strokeStyle = 'rgba(62,207,207,0.12)';
    ctx.stroke();
    var lx = cx + (r + 20) * Math.cos(ang);
    var ly = cy + (r + 20) * Math.sin(ang);
    ctx.fillStyle = '#4a7a80';
    ctx.font = '8px Share Tech Mono, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var partes = labels[i].split('\n');
    partes.forEach(function(p, pi) {
      ctx.fillText(p, lx, ly + (pi - (partes.length-1)/2) * 11);
    });
  }

  // Polígono
  ctx.beginPath();
  for (var i = 0; i < n; i++) {
    var ang = (Math.PI * 2 * i / n) - Math.PI / 2;
    var rv  = r * vals[i];
    i === 0 ? ctx.moveTo(cx + rv * Math.cos(ang), cy + rv * Math.sin(ang))
            : ctx.lineTo(cx + rv * Math.cos(ang), cy + rv * Math.sin(ang));
  }
  ctx.closePath();
  ctx.fillStyle   = 'rgba(62,207,207,0.18)';
  ctx.fill();
  ctx.strokeStyle = '#3ecfcf';
  ctx.lineWidth   = 2;
  ctx.stroke();

  // Pontos
  for (var i = 0; i < n; i++) {
    var ang = (Math.PI * 2 * i / n) - Math.PI / 2;
    var rv  = r * vals[i];
    ctx.beginPath();
    ctx.arc(cx + rv * Math.cos(ang), cy + rv * Math.sin(ang), 4, 0, Math.PI * 2);
    ctx.fillStyle = '#3ecfcf';
    ctx.fill();
  }
}
