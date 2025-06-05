const socket = io();
let localStream;
let peerConnection;
let partnerId = null;

const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startButton = document.getElementById('startButton');
const endButton = document.getElementById('endButton');
const nextButton = document.getElementById('nextButton');

// Bandera para controlar inicio automático de llamada al emparejar
let autoStartCall = false;

async function startMedia() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;
}
startMedia();

startButton.onclick = () => {
  if (partnerId) createPeerConnection(true);
  startButton.disabled = true;
  endButton.disabled = false;
  nextButton.disabled = false;
  autoStartCall = false; // Ya iniciamos manualmente la llamada
};

endButton.onclick = () => {
  endCall();
  autoStartCall = false;
};

nextButton.onclick = () => {
  endCall();
  autoStartCall = true;   // Queremos que la siguiente llamada inicie automáticamente
  socket.emit('next-call');
};

socket.on('paired', async ({ partnerId: id }) => {
  partnerId = id;
  console.log('Emparejado con:', partnerId);
  if (autoStartCall) {
    createPeerConnection(true);
  }
  // Si no autoStartCall, queda esperando que el usuario inicie llamada manualmente
});

socket.on('offer', async (offer, from) => {
  partnerId = from;
  await createPeerConnection(false);
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit('answer', answer, partnerId);
});

socket.on('answer', async (answer) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('ice-candidate', async (candidate) => {
  try {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (e) {
    console.error('Error al agregar ICE:', e);
  }
});

socket.on('partner-disconnected', () => {
  cleanupCall();
  partnerId = null;
  startButton.disabled = false;
  endButton.disabled = true;
  nextButton.disabled = true;
  autoStartCall = false; // Reiniciar bandera
});

function createPeerConnection(isInitiator) {
  peerConnection = new RTCPeerConnection(configuration);

  peerConnection.onicecandidate = ({ candidate }) => {
    if (candidate) socket.emit('ice-candidate', candidate, partnerId);
  };

  peerConnection.ontrack = ({ streams }) => {
    remoteVideo.srcObject = streams[0];
  };

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  if (isInitiator) {
    peerConnection.createOffer()
      .then(offer => peerConnection.setLocalDescription(offer))
      .then(() => {
        socket.emit('offer', peerConnection.localDescription, partnerId);
      });
  }
}

function endCall() {
  if (peerConnection) {
    peerConnection.getSenders().forEach(sender => {
      if (sender.track) sender.track.stop();
    });
    peerConnection.close();
    peerConnection = null;
  }

  if (remoteVideo.srcObject) {
    remoteVideo.srcObject.getTracks().forEach(track => track.stop());
  }

  remoteVideo.pause();
  remoteVideo.srcObject = null;
  remoteVideo.removeAttribute('src');
  remoteVideo.load();

  if (partnerId) {
    socket.emit('end-call', partnerId);
  }

  partnerId = null;

  startButton.disabled = false;
  endButton.disabled = true;
  nextButton.disabled = true;

  startMedia();
}

function cleanupCall() {
  if (peerConnection) {
    peerConnection.getSenders().forEach(sender => {
      if (sender.track) sender.track.stop();
    });
    peerConnection.close();
    peerConnection = null;
  }

  if (remoteVideo.srcObject) {
    remoteVideo.srcObject.getTracks().forEach(track => track.stop());
  }

  remoteVideo.pause();
  remoteVideo.srcObject = null;
  remoteVideo.removeAttribute('src');
  remoteVideo.load();

  partnerId = null;

  startButton.disabled = false;
  endButton.disabled = true;
  nextButton.disabled = true;

  autoStartCall = false;
}
