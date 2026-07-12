// ── State ─────────────────────────────────────────────────
let ws = null;
let audioCtx = null, analyserNode = null, animId = null;
let canvasViz, ctx2d;
let nextPlayTime = 0, scheduledSources = [], scheduledChunks = [];
let currentPlayingIndex = -1, audioChunksData = [], currentMetadata = [];
let currentSampleRate = 44100, selectedVoice = 'F1';
let isGenerating = false, generationDone = false;
let generateStartTime = 0, firstPlayLatency = 0;
let chunkMetrics = {}, totalAudioDuration = 0, totalGenerationTime = 0;

// ── DOM ───────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const wsStatus    = $('ws-status');
const ttsText     = $('tts-text');
const charCount   = $('char-count');
const btnGenerate = $('btn-generate');
const btnStop     = $('btn-stop');
const btnDl       = $('btn-download');
const dlDesc      = $('download-desc');
const dlDescWrap  = $('download-desc-wrap');
const queueCont   = $('queue-container');
const queuePH     = $('queue-placeholder');
const queueProg   = $('queue-progress');
const vizLabel    = $('visualizer-overlay-text');
const vizDot      = $('viz-live-dot');
const paramLang   = $('param-lang');
const paramPrec   = $('param-precision');
const paramSteps  = $('param-steps');
const paramSpeed  = $('param-speed');
const paramSil    = $('param-silence');
const valSteps    = $('val-steps');
const valSpeed    = $('val-speed');
const valSil      = $('val-silence');
const voiceGrid   = $('voice-grid');
const btnClear    = $('btn-clear');

// ── Translation Engine ─────────────────────────────────────
const TRANSLATIONS = {
  tr: {
    heroTitle: 'Lyra ile metni <span class="gradient-text">sese dönüştür</span>,<br>anında, doğal.',
    heroSub: 'Türkçe için optimize MNN motoru — 10 farklı ses karakteri, gerçek zamanlı akış.',
    sectionLabel: 'Ses Karakteri',
    labelLang: 'Dil',
    labelPrecision: 'Kalite',
    labelSteps: 'Adım',
    labelSpeed: 'Hız',
    labelSilence: 'Boşluk',
    btnGen: '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Sentezle ve Çal',
    btnStop: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg> Durdur',
    btnDl: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 15V3M12 15L8 11M12 15L16 11M19 17v2a2 2 0 01-2 2H7a2 2 0 01-2-2v-2"/></svg> WAV İndir',
    placeholder: 'Seslendirmek istediğiniz metni buraya yazın...',
    clearTitle: 'Metni Temizle',
    queuePH: 'Sentez başladığında cümleler burada görünür',
    queuePHStart: 'Sentez başlıyor...',
    statusReady: 'Hazır',
    statusGen: 'Sentezleniyor...',
    statusPlaying: 'Seslendiriliyor',
    statusStopped: 'Durduruldu',
    wsOnline: 'Çevrimiçi',
    wsOffline: 'Bağlantı Yok',
    wsConnecting: 'Bağlanıyor',
    waiting: 'Bekliyor',
    synthesized: 'Sentezleniyor',
    playing: 'Çalınıyor',
    canceled: 'İptal',
    charSuffix: 'karakter',
    audioSuffix: 'ses',
    firstAudio: 'İlk ses',
    femaleTitle: 'Kadın',
    maleTitle: 'Erkek'
  },
  en: {
    heroTitle: 'Turn text into <span class="gradient-text">natural speech</span> with Lyra,<br>instantly.',
    heroSub: 'Optimized MNN engine — 10 distinct voice characters, real-time streaming.',
    sectionLabel: 'Voice Character',
    labelLang: 'Language',
    labelPrecision: 'Quality',
    labelSteps: 'Steps',
    labelSpeed: 'Speed',
    labelSilence: 'Silence',
    btnGen: '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Synthesize & Play',
    btnStop: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg> Stop',
    btnDl: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 15V3M12 15L8 11M12 15L16 11M19 17v2a2 2 0 01-2 2H7a2 2 0 01-2-2v-2"/></svg> Download WAV',
    placeholder: 'Enter the text you want to synthesize...',
    clearTitle: 'Clear Text',
    queuePH: 'Sentences will appear here when synthesis starts',
    queuePHStart: 'Synthesis starting...',
    statusReady: 'Ready',
    statusGen: 'Synthesizing...',
    statusPlaying: 'Playing',
    statusStopped: 'Stopped',
    wsOnline: 'Online',
    wsOffline: 'Offline',
    wsConnecting: 'Connecting',
    waiting: 'Waiting',
    synthesized: 'Synthesizing',
    playing: 'Playing',
    canceled: 'Canceled',
    charSuffix: 'characters',
    audioSuffix: 'audio',
    firstAudio: 'First audio',
    femaleTitle: 'Female',
    maleTitle: 'Male'
  },
  de: {
    heroTitle: 'Verwandeln Sie Text in <span class="gradient-text">natürliche Sprache</span>,<br>sofort.',
    heroSub: 'Optimierte MNN-Engine — 10 verschiedene Sprachcharaktere, Echtzeit-Streaming.',
    sectionLabel: 'Sprachcharakter',
    labelLang: 'Sprache',
    labelPrecision: 'Qualität',
    labelSteps: 'Schritte',
    labelSpeed: 'Tempo',
    labelSilence: 'Stille',
    btnGen: '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Spleißen & Abspielen',
    btnStop: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg> Stoppen',
    btnDl: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 15V3M12 15L8 11M12 15L16 11M19 17v2a2 2 0 01-2 2H7a2 2 0 01-2-2v-2"/></svg> WAV Herunterladen',
    placeholder: 'Geben Sie den Text ein, den Sie synthetisieren möchten...',
    clearTitle: 'Text löschen',
    queuePH: 'Sätze erscheinen hier, wenn die Synthese beginnt',
    queuePHStart: 'Synthese startet...',
    statusReady: 'Bereit',
    statusGen: 'Synthese läuft...',
    statusPlaying: 'Wiedergabe',
    statusStopped: 'Angehalten',
    wsOnline: 'Online',
    wsOffline: 'Keine Verbindung',
    wsConnecting: 'Verbinden',
    waiting: 'Warten',
    synthesized: 'Synthetisieren',
    playing: 'Wiedergabe',
    canceled: 'Abgebrochen',
    charSuffix: 'Zeichen',
    audioSuffix: 'Audio',
    firstAudio: 'Erster Ton',
    femaleTitle: 'Weiblich',
    maleTitle: 'Männlich'
  },
  fr: {
    heroTitle: 'Convertissez du texte en <span class="gradient-text">voix naturelle</span>,<br>instantanément.',
    heroSub: 'Moteur MNN optimisé — 10 voix différentes, flux en temps réel.',
    sectionLabel: 'Personnage Vocal',
    labelLang: 'Langue',
    labelPrecision: 'Qualité',
    labelSteps: 'Étapes',
    labelSpeed: 'Vitesse',
    labelSilence: 'Silence',
    btnGen: '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Synthétiser & Jouer',
    btnStop: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg> Arrêter',
    btnDl: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 15V3M12 15L8 11M12 15L16 11M19 17v2a2 2 0 01-2 2H7a2 2 0 01-2-2v-2"/></svg> Télécharger WAV',
    placeholder: 'Saisissez le texte que vous souhaitez synthétiser...',
    clearTitle: 'Effacer le texte',
    queuePH: 'Les phrases apparaîtront ici au début de la synthèse',
    queuePHStart: 'Démarrage de la synthèse...',
    statusReady: 'Prêt',
    statusGen: 'Synthèse en cours...',
    statusPlaying: 'Lecture en cours',
    statusStopped: 'Arrêté',
    wsOnline: 'En ligne',
    wsOffline: 'Hors ligne',
    wsConnecting: 'Connexion...',
    waiting: 'En attente',
    synthesized: 'Synthèse',
    playing: 'Lecture',
    canceled: 'Annulé',
    charSuffix: 'caractères',
    audioSuffix: 'audio',
    firstAudio: 'Premier son',
    femaleTitle: 'Femme',
    maleTitle: 'Homme'
  },
  ko: {
    heroTitle: '텍스트를 <span class="gradient-text">자연스러운 목소리</span>로 변환하세요,<br>즉시 작동합니다.',
    heroSub: '최적화된 MNN 엔진 — 10가지 다양한 목소리 캐릭터, 실시간 스트리밍 제공.',
    sectionLabel: '음성 캐릭터',
    labelLang: '언어 설정',
    labelPrecision: '오디오 음질',
    labelSteps: '스텝 수',
    labelSpeed: '속도 조절',
    labelSilence: '무음 설정',
    btnGen: '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> 음성 합성 및 재생',
    btnStop: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg> 중지',
    btnDl: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 15V3M12 15L8 11M12 15L16 11M19 17v2a2 2 0 01-2 2H7a2 2 0 01-2-2v-2"/></svg> WAV 다운로드',
    placeholder: '합성할 텍스트를 여기에 입력하세요...',
    clearTitle: '텍스트 지우기',
    queuePH: '합성이 시작되면 여기에 문장이 나타납니다',
    queuePHStart: '음성 합성 시작 중...',
    statusReady: '준비 완료',
    statusGen: '합성하는 중...',
    statusPlaying: '재생 중',
    statusStopped: '중지됨',
    wsOnline: '연결됨',
    wsOffline: '연결 끊김',
    wsConnecting: '연결 중...',
    waiting: '대기 중',
    synthesized: '합성 중',
    playing: '재생 중',
    canceled: '취소됨',
    charSuffix: '자',
    audioSuffix: '오디오',
    firstAudio: '첫 오디오 수신',
    femaleTitle: '여성',
    maleTitle: '남성'
  },
  ja: {
    heroTitle: 'テキストを瞬時に<span class="gradient-text">自然な音声</span>に,<br>リアルタイム変換。',
    heroSub: '最適化されたMNN engine — 10種類の音声キャラクター、リアルタイムストリーミング。',
    sectionLabel: '音声キャラクター',
    labelLang: '言語設定',
    labelPrecision: '音声品質',
    labelSteps: 'ステップ数',
    labelSpeed: '読み上げ速度',
    labelSilence: '無音時間',
    btnGen: '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> 音声合成と再生',
    btnStop: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg> 停止',
    btnDl: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 15V3M12 15L8 11M12 15L16 11M19 17v2a2 2 0 01-2 2H7a2 2 0 01-2-2v-2"/></svg> WAVダウンロード',
    placeholder: 'ここに合成したいテキストを入力してください...',
    clearTitle: 'テキストをクリア',
    queuePH: '合成が開始されると、ここに文が表示されます',
    queuePHStart: '合成を開始しています...',
    statusReady: '準備完了',
    statusGen: '合成中...',
    statusPlaying: '再生中',
    statusStopped: '停止中',
    wsOnline: 'オンライン',
    wsOffline: 'オフライン',
    wsConnecting: '接続中...',
    waiting: '待機中',
    synthesized: '合成中',
    playing: '再生中',
    canceled: 'キャンセル',
    charSuffix: '文字',
    audioSuffix: '音声',
    firstAudio: '初動レイテンシ',
    femaleTitle: '女性',
    maleTitle: '男性'
  }
};

function currentTrans() {
  const lang = paramLang.value || 'tr';
  return TRANSLATIONS[lang] || TRANSLATIONS.tr;
}

function updateLanguage() {
  const t = currentTrans();
  
  $('hero-title').innerHTML = t.heroTitle;
  $('hero-sub').textContent = t.heroSub;
  $('section-label').textContent = t.sectionLabel;
  $('label-lang').textContent = t.labelLang;
  $('label-precision').textContent = t.labelPrecision;
  
  const stepsNode = valSteps;
  $('label-steps').innerHTML = `${t.labelSteps} `;
  $('label-steps').appendChild(stepsNode);
  
  const speedNode = valSpeed;
  $('label-speed').innerHTML = `${t.labelSpeed} `;
  $('label-speed').appendChild(speedNode);
  
  const silenceNode = valSil;
  $('label-silence').innerHTML = `${t.labelSilence} `;
  $('label-silence').appendChild(silenceNode);

  if (!isGenerating) {
    btnGenerate.innerHTML = t.btnGen;
  }
  btnStop.innerHTML = t.btnStop;
  btnDl.innerHTML = t.btnDl;
  
  ttsText.placeholder = t.placeholder;
  btnClear.title = t.clearTitle;
  
  const len = ttsText.value.length;
  charCount.textContent = `${len} ${t.charSuffix}`;
  
  if (queuePH.style.display !== 'none') {
    const pNode = $('queue-placeholder-text');
    if (pNode) {
      pNode.textContent = isGenerating ? t.queuePHStart : t.queuePH;
    }
  }

  if (!isGenerating) {
    vizLabel.textContent = t.statusReady;
  }

  voiceGrid.querySelectorAll('.vc').forEach(btn => {
    const name = btn.querySelector('.vc-nm').textContent;
    const gender = btn.dataset.gender;
    const genderStr = gender === 'female' ? t.femaleTitle : t.maleTitle;
    btn.title = `${name} — ${genderStr}`;
  });

  const wsLabel = wsStatus.querySelector('.ws-label');
  if (wsLabel) {
    const state = wsStatus.className.replace('ws-pill ', '');
    wsLabel.textContent = state === 'online' ? t.wsOnline : state === 'offline' ? t.wsOffline : t.wsConnecting;
  }
}

// ── Boot ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initBgCanvas();
  connectWS();
  updateLanguage();

  // Language change trigger
  paramLang.addEventListener('change', updateLanguage);

  // Sliders
  paramSteps.addEventListener('input', () => { valSteps.textContent = paramSteps.value; });
  paramSpeed.addEventListener('input', () => { valSpeed.textContent = `${parseFloat(paramSpeed.value).toFixed(2)}×`; });
  paramSil.addEventListener('input',   () => { valSil.textContent   = `${parseFloat(paramSil.value).toFixed(2)}s`; });

  // Char counter
  ttsText.addEventListener('input', () => {
    const t = currentTrans();
    charCount.textContent = `${ttsText.value.length} ${t.charSuffix}`;
  });

  // Clear
  btnClear.addEventListener('click', () => {
    const t = currentTrans();
    ttsText.value = '';
    charCount.textContent = `0 ${t.charSuffix}`;
    ttsText.focus();
  });

  // Voice grid
  voiceGrid.addEventListener('click', e => {
    const btn = e.target.closest('.vc');
    if (!btn) return;
    voiceGrid.querySelectorAll('.vc').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedVoice = btn.dataset.voice;
  });

  // Actions
  btnGenerate.addEventListener('click', startGeneration);
  btnStop.addEventListener('click', stopAll);
});

// ── Canvas Background (animated mesh) ────────────────────
function initBgCanvas() {
  const c = document.getElementById('bg-canvas');
  const cx = c.getContext('2d');
  let W, H, t = 0;
  const resize = () => { W = c.width = window.innerWidth; H = c.height = window.innerHeight; };
  resize();
  window.addEventListener('resize', resize);

  // Particles
  const pts = Array.from({length: 60}, () => ({
    x: Math.random(), y: Math.random(),
    vx: (Math.random()-.5)*0.0003, vy: (Math.random()-.5)*0.0003
  }));

  function frame() {
    requestAnimationFrame(frame);
    t += 0.005;
    cx.clearRect(0, 0, W, H);

    // Deep gradient bg
    const g = cx.createRadialGradient(W*.5, H*.35, 0, W*.5, H*.35, W*.7);
    g.addColorStop(0,   'rgba(60,10,100,0.45)');
    g.addColorStop(0.5, 'rgba(20,4,40,0.3)');
    g.addColorStop(1,   'rgba(3,0,7,0)');
    cx.fillStyle = g;
    cx.fillRect(0, 0, W, H);

    // Pulsing orb
    const pulse = 0.8 + Math.sin(t) * 0.2;
    const og = cx.createRadialGradient(W*.5, H*.3, 0, W*.5, H*.3, W*.4 * pulse);
    og.addColorStop(0,   'rgba(147,51,234,0.12)');
    og.addColorStop(0.5, 'rgba(147,51,234,0.04)');
    og.addColorStop(1,   'rgba(147,51,234,0)');
    cx.fillStyle = og;
    cx.fillRect(0, 0, W, H);

    // Move particles
    pts.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = 1; if (p.x > 1) p.x = 0;
      if (p.y < 0) p.y = 1; if (p.y > 1) p.y = 0;
    });

    // Draw connections
    cx.lineWidth = 0.4;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i+1; j < pts.length; j++) {
        const dx = (pts[i].x - pts[j].x)*W, dy = (pts[i].y - pts[j].y)*H;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 140) {
          const alpha = (1 - dist/140) * 0.18;
          cx.strokeStyle = `rgba(147,51,234,${alpha})`;
          cx.beginPath();
          cx.moveTo(pts[i].x*W, pts[i].y*H);
          cx.lineTo(pts[j].x*W, pts[j].y*H);
          cx.stroke();
        }
      }
    }

    // Dots
    pts.forEach(p => {
      cx.fillStyle = 'rgba(192,132,252,0.35)';
      cx.beginPath();
      cx.arc(p.x*W, p.y*H, 1.5, 0, Math.PI*2);
      cx.fill();
    });
  }
  frame();
}

// ── WebSocket ─────────────────────────────────────────────
function connectWS() {
  setWS('connecting');
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}/ws/tts`);
  ws.onopen    = () => setWS('online');
  ws.onclose   = () => { setWS('offline'); setTimeout(connectWS, 3000); };
  ws.onerror   = () => setWS('offline');
  ws.onmessage = e => handleMsg(JSON.parse(e.data));
}
function setWS(state) {
  const t = currentTrans();
  wsStatus.className = `ws-pill ${state}`;
  wsStatus.querySelector('.ws-label').textContent =
    state === 'online' ? t.wsOnline : state === 'offline' ? t.wsOffline : t.wsConnecting;
}

// ── Message Handler ───────────────────────────────────────
function handleMsg(msg) {
  const t = currentTrans();
  switch (msg.type) {
    case 'metadata':
      currentMetadata = msg.chunks;
      audioChunksData = new Array(msg.chunks.length).fill(null);
      renderQueue(msg.chunks);
      queueProg.textContent = `0 / ${msg.chunks.length}`;
      break;

    case 'status':
      chunkMetrics[msg.chunk_index] = { d: msg.duration, g: msg.generation_time, r: msg.rtf };
      setItemState(msg.chunk_index, msg.status === 'completed' ? 'synthesized' : msg.status, msg.duration, msg.generation_time, msg.rtf);
      break;

    case 'audio': {
      const bytes = atob(msg.audio);
      const buf = new Uint8Array(bytes.length);
      for (let i=0;i<bytes.length;i++) buf[i] = bytes.charCodeAt(i);
      const int16 = new Int16Array(buf.buffer);
      currentSampleRate = msg.sample_rate;
      audioChunksData[msg.chunk_index] = int16;
      playChunk(int16, msg.sample_rate, msg.chunk_index);
      break;
    }

    case 'done':
      generationDone = true;
      buildDownload();
      break;

    case 'error':
      alert(`${msg.message}`);
      stopAll();
      break;
  }
}

// ── Audio ─────────────────────────────────────────────────
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
    analyserNode = audioCtx.createAnalyser();
    analyserNode.fftSize = 512;
    analyserNode.connect(audioCtx.destination);
    startViz();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playChunk(int16, sr, index) {
  initAudio();
  const f32 = new Float32Array(int16.length);
  for (let i=0;i<int16.length;i++) f32[i] = int16[i]/32768;
  const ab = audioCtx.createBuffer(1, f32.length, sr);
  ab.copyToChannel(f32, 0);
  const src = audioCtx.createBufferSource();
  src.buffer = ab; src.connect(analyserNode);
  const now = audioCtx.currentTime;
  if (nextPlayTime < now) nextPlayTime = now;
  const start = nextPlayTime, end = start + ab.duration;
  src.start(start);
  scheduledSources.push(src);
  scheduledChunks.push({ index, startTime: start, endTime: end });
  nextPlayTime += ab.duration;
  const gap = parseFloat(paramSil.value);
  if (gap > 0) nextPlayTime += gap;
}

// ── Queue Render ──────────────────────────────────────────
function renderQueue(chunks) {
  const t = currentTrans();
  queuePH.style.display = 'none';
  queueCont.innerHTML = '';
  chunks.forEach((txt, i) => {
    const el = document.createElement('div');
    el.className = 'qi'; el.id = `qi-${i}`;
    el.innerHTML = `
      <span class="qi-num">${i+1}</span>
      <span class="qi-text">${esc(txt)}</span>
      <span class="qi-badge" id="qb-${i}">
        <svg class="wait-ic" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        ${t.waiting}
      </span>`;
    queueCont.appendChild(el);
  });
}

function setItemState(i, state, d, g, r) {
  const t = currentTrans();
  const el = $(`qi-${i}`), badge = $(`qb-${i}`);
  if (!el || !badge) return;
  if (i === 0 && state === 'generating') { totalAudioDuration = 0; totalGenerationTime = 0; }
  el.className = `qi st-${state}`;
  const dm = d ?? chunkMetrics[i]?.d;
  const rm = r ?? chunkMetrics[i]?.r;
  const gm = g ?? chunkMetrics[i]?.g;
  if (state === 'generating') {
    badge.innerHTML = `<svg class="spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>${t.synthesized}`;
  } else if (state === 'synthesized') {
    const lbl = dm != null ? `${dm.toFixed(1)}s · RTF ${rm?.toFixed(2)}` : t.statusReady;
    badge.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20 6L9 17L4 12"/></svg>${lbl}`;
    if (dm && gm) { totalAudioDuration += dm; totalGenerationTime += gm; }
  } else if (state === 'playing') {
    badge.innerHTML = `<span class="sbars"><span></span><span></span><span></span></span>${t.playing}`;
  } else if (state === 'completed') {
    const lbl = dm != null ? `${dm.toFixed(1)}s · RTF ${rm?.toFixed(2)}` : 'Ok';
    badge.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20 6L9 17L4 12"/></svg>${lbl}`;
  }
}

function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── Sync ──────────────────────────────────────────────────
function syncUI() {
  if (!audioCtx || !isGenerating) return;
  const t = audioCtx.currentTime;
  const trans = currentTrans();
  if (generationDone && scheduledChunks.length) {
    const last = scheduledChunks[scheduledChunks.length-1];
    if (t >= last.endTime) { endPlayback(); return; }
  }
  scheduledChunks.forEach(ch => {
    const el = $(`qi-${ch.index}`);
    if (!el) return;
    if (t >= ch.startTime && t < ch.endTime) {
      if (!el.classList.contains('st-playing')) {
        for (let p=0; p<ch.index; p++) {
          const pe = $(`qi-${p}`);
          if (pe && !pe.classList.contains('st-completed')) setItemState(p, 'completed');
        }
        if (ch.index === 0 && !firstPlayLatency) firstPlayLatency = (Date.now()-generateStartTime)/1000;
        setItemState(ch.index, 'playing');
        currentPlayingIndex = ch.index;
        vizLabel.textContent = `${trans.statusPlaying}  ${ch.index+1} / ${currentMetadata.length}`;
        vizDot.classList.add('active');
        queueProg.textContent = `${ch.index+1} / ${currentMetadata.length}`;
      }
    } else if (t >= ch.endTime) {
      if (!el.classList.contains('st-completed')) {
        setItemState(ch.index, 'completed');
        if (currentPlayingIndex === ch.index) currentPlayingIndex = -1;
        const done = queueCont.querySelectorAll('.st-completed').length;
        queueProg.textContent = `${done} / ${currentMetadata.length}`;
      }
    }
  });
}

// ── Visualizer ────────────────────────────────────────────
function startViz() {
  canvasViz = $('wave-canvas');
  ctx2d = canvasViz.getContext('2d');
  const resize = () => { canvasViz.width = canvasViz.parentElement.clientWidth; canvasViz.height = canvasViz.parentElement.clientHeight; };
  resize(); window.addEventListener('resize', resize);
  const bufLen = analyserNode.frequencyBinCount;
  const data = new Uint8Array(bufLen);
  function draw() {
    animId = requestAnimationFrame(draw);
    syncUI();
    analyserNode.getByteTimeDomainData(data);
    const W = canvasViz.width, H = canvasViz.height;
    ctx2d.clearRect(0,0,W,H);
    const playing = currentPlayingIndex !== -1;
    const grad = ctx2d.createLinearGradient(0,0,W,0);
    if (playing) {
      grad.addColorStop(0,'#9333ea'); grad.addColorStop(.5,'#a855f7'); grad.addColorStop(1,'#c084fc');
    } else {
      grad.addColorStop(0,'rgba(147,51,234,0.2)'); grad.addColorStop(1,'rgba(192,132,252,0.15)');
    }
    ctx2d.strokeStyle = grad;
    ctx2d.lineWidth = playing ? 2 : 1.5;
    ctx2d.shadowBlur = playing ? 14 : 0;
    ctx2d.shadowColor = 'rgba(147,51,234,0.7)';
    ctx2d.beginPath();
    const step = W/bufLen; let x=0;
    for (let i=0;i<bufLen;i++) {
      const v = playing ? data[i]/128 : 1;
      const y = v*H/2;
      i===0 ? ctx2d.moveTo(x,y) : ctx2d.lineTo(x,y);
      x += step;
    }
    ctx2d.lineTo(W,H/2); ctx2d.stroke();
  }
  draw();
}

// ── Start / Stop ──────────────────────────────────────────
function startGeneration() {
  const text = ttsText.value.trim();
  if (!text) { ttsText.focus(); return; }
  initAudio();
  const t = currentTrans();
  isGenerating = true; generationDone = false;
  generateStartTime = Date.now(); firstPlayLatency = 0;
  scheduledSources.forEach(s => { try{s.stop()}catch(_){} });
  scheduledSources=[]; scheduledChunks=[]; chunkMetrics={};
  nextPlayTime = audioCtx.currentTime;
  audioChunksData=[]; currentPlayingIndex=-1;
  totalAudioDuration=0; totalGenerationTime=0;
  queueCont.innerHTML=''; queuePH.style.display='flex';
  queuePH.querySelector('p').textContent = t.queuePHStart;
  queueProg.textContent='—';
  btnDl.disabled=true; dlDescWrap.style.display='none';
  btnStop.disabled=false;
  vizLabel.textContent = t.statusGen;
  ws.send(JSON.stringify({
    type:'generate', text,
    voice: selectedVoice,
    lang: paramLang.value,
    precision: paramPrec.value,
    steps: parseInt(paramSteps.value),
    speed: parseFloat(paramSpeed.value)
  }));
}

function stopAll() {
  const t = currentTrans();
  isGenerating=false; generationDone=false;
  scheduledChunks=[]; chunkMetrics={};
  if (ws?.readyState===WebSocket.OPEN) ws.send(JSON.stringify({type:'stop'}));
  scheduledSources.forEach(s=>{try{s.stop()}catch(_){}});
  scheduledSources=[]; currentPlayingIndex=-1;
  btnStop.disabled=true; vizDot.classList.remove('active');
  vizLabel.textContent = t.statusStopped; queueProg.textContent='—';
  currentMetadata.forEach((_,i)=>{
    const el=$(`qi-${i}`), b=$(`qb-${i}`);
    if(el && !el.classList.contains('st-completed')){
      el.className='qi';
      b.innerHTML=`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>${t.canceled}`;
      b.style.color='#f43f5e';
    }
  });
}

function endPlayback() {
  const t = currentTrans();
  isGenerating=false; btnStop.disabled=true;
  vizDot.classList.remove('active'); vizLabel.textContent = t.statusReady;
}

// ── Download ──────────────────────────────────────────────
function buildDownload() {
  const t = currentTrans();
  const valid = audioChunksData.filter(c=>c!==null);
  if (!valid.length) return;
  let total=0; valid.forEach(c=>total+=c.length);
  const merged = new Int16Array(total);
  let off=0; valid.forEach(c=>{merged.set(c,off);off+=c.length;});
  const blob = makeWav(merged, currentSampleRate);
  const url = URL.createObjectURL(blob);
  btnDl.disabled=false;
  const avgRtf = totalAudioDuration>0 ? totalGenerationTime/totalAudioDuration : 0;
  dlDesc.textContent = `${totalAudioDuration.toFixed(1)}s ${t.audioSuffix}  ·  RTF ${avgRtf.toFixed(2)}  ·  ${t.firstAudio} ${firstPlayLatency.toFixed(2)}s  ·  ${(blob.size/1048576).toFixed(2)} MB`;
  dlDescWrap.style.display='flex';
  btnDl.onclick = () => {
    const a=document.createElement('a'); a.href=url;
    a.download=`lyra_${new Date().toISOString().slice(0,10)}.wav`; a.click();
  };
}

function makeWav(samples, sr) {
  const buf=new ArrayBuffer(44+samples.length*2), v=new DataView(buf);
  const ws=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i));};
  ws(0,'RIFF'); v.setUint32(4,36+samples.length*2,true);
  ws(8,'WAVE'); ws(12,'fmt '); v.setUint32(16,16,true);
  v.setUint16(20,1,true); v.setUint16(22,1,true);
  v.setUint32(24,sr,true); v.setUint32(28,sr*2,true);
  v.setUint16(32,2,true); v.setUint16(34,16,true);
  ws(36,'data'); v.setUint32(40,samples.length*2,true);
  let off=44; for(let i=0;i<samples.length;i++,off+=2) v.setInt16(off,samples[i],true);
  return new Blob([v],{type:'audio/wav'});
}
