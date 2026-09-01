# Browser Text Relay

A minimal browser extension that lets one browser send text to another browser using a temporary room.

## Development

This project is divided into two parts: the `server/` (Node.js WebSocket relay) and the `extension/` (Manifest V3 Chrome extension).

### Running the Server

1. Navigate to the `server/` directory:
   ```bash
   cd server
   ```
2. Start the server (runs on port 8080):
   ```bash
   npx tsx src/index.ts
   ```

### Building and Loading the Extension

1. Navigate to the `extension/` directory:
   ```bash
   cd extension
   ```
2. Build the extension bundle:
   ```bash
   node build.js
   ```
3. Load in Chrome:
   - Go to `chrome://extensions/`
   - Enable "Developer mode" in the top right.
   - Click "Load unpacked".
   - Select the `extension/` folder in this repository.
   - Click the extension icon to open the popup. Right-click anywhere in the popup and select "Inspect" to open DevTools. You should see connection logs and the server's test response in the Console.
