import { AppState } from '../state/app-state';
import { RelayClient } from '../services/relay-client';
import { QRService } from '../services/qr-service';
import { SERVER_URL } from '../services/config';

// UI Elements
const connectionIndicator = document.getElementById('connection-indicator')!;

const views = {
  [AppState.IDLE]: document.getElementById('view-idle')!,
  [AppState.CREATING]: document.getElementById('view-creating')!,
  [AppState.WAITING]: document.getElementById('view-waiting')!,
  [AppState.CONNECTED]: document.getElementById('view-connected')!,
  [AppState.SENDING]: document.getElementById('view-connected')!,
  [AppState.RECEIVED]: document.getElementById('view-connected')!,
  [AppState.ERROR]: document.getElementById('view-error')!,
  [AppState.INVALID_CODE]: document.getElementById('view-error')!,
  [AppState.ROOM_EXPIRED]: document.getElementById('view-error')!,
  [AppState.DISCONNECTED]: null // Handled via header indicator
};

// Controls
const btnCreateRoom = document.getElementById('btn-create-room') as HTMLButtonElement;
const btnJoinRoom = document.getElementById('btn-join-room') as HTMLButtonElement;
const inputJoinCode = document.getElementById('input-join-code') as HTMLInputElement;
const btnSendText = document.getElementById('btn-send-text') as HTMLButtonElement;
const inputSendText = document.getElementById('input-send-text') as HTMLTextAreaElement;
const btnCopyText = document.getElementById('btn-copy-text') as HTMLButtonElement;
const displayReceivedText = document.getElementById('display-received-text') as HTMLTextAreaElement;
const receivedTextContainer = document.getElementById('received-text-container') as HTMLDivElement;
const waitingForText = document.getElementById('waiting-for-text') as HTMLDivElement;
const btnResetError = document.getElementById('btn-reset-error') as HTMLButtonElement;

// Feedback animations
const sendFeedback = document.getElementById('send-feedback') as HTMLSpanElement;
const copyFeedback = document.getElementById('copy-feedback') as HTMLSpanElement;

// Waiting View displays
const displayRoomCode = document.getElementById('display-room-code')!;
const displayExpiry = document.getElementById('display-expiry')!;
const qrImage = document.getElementById('qrImage') as HTMLImageElement;

// Connected View sections
const senderControls = document.getElementById('sender-controls')!;
const receiverControls = document.getElementById('receiver-controls')!;
const errorTitle = document.getElementById('error-title')!;
const errorMessage = document.getElementById('error-message')!;

const qrService = new QRService();
const client = new RelayClient(SERVER_URL);

function switchView(state: AppState) {
  Object.values(views).forEach(v => {
    if (v) v.classList.remove('active');
  });
  const activeView = views[state];
  if (activeView) {
    // Add small delay to let transition apply
    setTimeout(() => activeView.classList.add('active'), 10);
  }
}

function showFeedback(el: HTMLElement) {
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2000);
}

client.onStateChange(async (state, data) => {
  // Update header connection indicator
  if (state === AppState.DISCONNECTED) {
    connectionIndicator.className = 'indicator disconnected';
    connectionIndicator.title = 'Disconnected';
  } else {
    connectionIndicator.className = 'indicator connected';
    connectionIndicator.title = 'Connected';
  }

  if (views[state]) switchView(state);

  switch (state) {
    case AppState.IDLE:
      inputJoinCode.value = '';
      inputSendText.value = '';
      displayReceivedText.value = '';
      receivedTextContainer.style.display = 'none';
      waitingForText.style.display = 'block';
      break;
      
    case AppState.WAITING:
      if (data?.code) {
        displayRoomCode.textContent = data.code;
        const minsLeft = Math.ceil((data.expiresAt - Date.now()) / 60000);
        displayExpiry.textContent = `Expires in ~${minsLeft} min`;
        try {
          qrImage.src = await qrService.generateQRCode(data.code);
        } catch (e) {}
      }
      break;

    case AppState.CONNECTED:
      if (data?.role === 'sender') {
        senderControls.style.display = 'block';
        receiverControls.style.display = 'none';
      } else {
        senderControls.style.display = 'none';
        receiverControls.style.display = 'block';
        waitingForText.style.display = 'block';
        receivedTextContainer.style.display = 'none';
      }
      break;

    case AppState.SENDING:
      btnSendText.disabled = true;
      btnSendText.textContent = 'Sending...';
      setTimeout(() => {
        btnSendText.disabled = false;
        btnSendText.textContent = 'Send Text';
        inputSendText.value = '';
        showFeedback(sendFeedback);
      }, 300);
      break;

    case AppState.RECEIVED:
      waitingForText.style.display = 'none';
      receivedTextContainer.style.display = 'block';
      if (data?.text) {
        displayReceivedText.value = data.text;
      }
      break;

    case AppState.INVALID_CODE:
      errorTitle.textContent = 'Invalid Code';
      errorMessage.textContent = "That code doesn't match an active room.";
      break;

    case AppState.ROOM_EXPIRED:
      errorTitle.textContent = 'Room Expired';
      errorMessage.textContent = "This room has expired and is no longer active.";
      break;

    case AppState.ERROR:
      errorTitle.textContent = 'Error';
      errorMessage.textContent = data || "An unknown error occurred.";
      break;
  }
});

// Interactions
btnCreateRoom.addEventListener('click', () => client.createRoom());

btnJoinRoom.addEventListener('click', () => {
  const code = inputJoinCode.value.trim();
  if (code.length === 6) client.joinRoom(code);
});

btnSendText.addEventListener('click', () => {
  const text = inputSendText.value.trim();
  if (text) client.sendText(text);
});

btnCopyText.addEventListener('click', () => {
  const text = displayReceivedText.value;
  if (text) {
    navigator.clipboard.writeText(text).then(() => {
      showFeedback(copyFeedback);
    });
  }
});

btnResetError.addEventListener('click', () => location.reload());

// Input formatting (only allow numbers)
inputJoinCode.addEventListener('input', (e) => {
  const target = e.target as HTMLInputElement;
  target.value = target.value.replace(/\D/g, '').slice(0, 6);
  btnJoinRoom.disabled = target.value.length !== 6;
});
// Disable join initially
btnJoinRoom.disabled = true;

// Boot
client.connect().catch(err => {
  console.error("Boot connect failed", err);
});
