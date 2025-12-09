const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');
const intervalInput = document.getElementById('interval');
const logEl = document.getElementById('log');

let stream = null;
let timer = null;

function log(msg){
  const p = document.createElement('div');
  p.textContent = `${new Date().toLocaleTimeString()} - ${msg}`;
  logEl.prepend(p);
}

// inicia a câmera
async function startCamera(){
  try{
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    video.srcObject = stream;
    await video.play();
    log("Câmera iniciada");
  }catch(err){
    log("Erro ao acessar a câmera: " + err.message);
  }
}

function stopCamera(){
  if(stream){
    stream.getTracks().forEach(t => t.stop());
    stream = null;
    video.srcObject = null;
    log("Câmera parada");
  }
}

// captura frame, converte para base64 e envia ao backend
async function captureAndSend(){
  if(!stream) return;
  try{
    const w = video.videoWidth;
    const h = video.videoHeight;
    if(w === 0 || h === 0){
      log("Vídeo ainda não pronto");
      return;
    }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

    // envia para /detect
    const resp = await fetch('/detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: dataUrl })
    });

    if(!resp.ok){
      const err = await resp.text();
      log("Erro do servidor: " + err);
      return;
    }

    const json = await resp.json();
    if(json.error){
      log("Erro: " + json.error);
    } else {
      log("Resultado: " + json.label + (json.saved_path ? " (salvo)" : ""));
    }

  }catch(err){
    log("Erro ao enviar frame: " + err.message);
  }
}

startBtn.addEventListener("click", async () => {
  await startCamera();
  // inicia o intervalo com o valor atual do input
  timer = setInterval(captureAndSend, Number(intervalInput.value));
});

stopBtn.addEventListener("click", () => {
  clearInterval(timer);
  timer = null;
  stopCamera();
});

// atualiza timer quando o usuário muda o intervalo
intervalInput.addEventListener('change', () => {
  if(timer){
    clearInterval(timer);
    timer = setInterval(captureAndSend, Number(intervalInput.value));
  }
});
