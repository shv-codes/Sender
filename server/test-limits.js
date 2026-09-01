const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8080');

ws.on('open', () => {
  console.log('Connected for test');
  // Attempt to create 12 rooms (limit is 10)
  for (let i = 0; i < 12; i++) {
    ws.send(JSON.stringify({ version: 1, type: 'create_room' }));
  }
  
  // Attempt to join invalid rooms rapidly (limit is 5)
  for (let i = 0; i < 7; i++) {
    ws.send(JSON.stringify({ version: 1, type: 'join_room', payload: { code: '111111' } }));
  }
});

ws.on('message', (data) => {
  console.log('Received:', data.toString());
});

setTimeout(() => ws.close(), 2000);
