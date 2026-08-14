# Metasploit Web GUI

Browser UI for Metasploit Framework. A Node/TypeScript API bridge talks to `msfrpcd` (MessagePack RPC); a React app provides the interface.

## Prerequisites

1. Metasploit Framework installed/runnable from `../metasploit-framework-master`
2. Node.js 18+ and npm
3. (Optional) `msfdb init` if you want Database pages populated

## Start Metasploit RPC

From the Metasploit tree (Linux/macOS or WSL):

```bash
./msfrpcd -U msf -P yourpassword -a 127.0.0.1 -p 55553
```

On Windows with Ruby available, use the same `msfrpcd` script with equivalent flags.

`-S` disables SSL if you prefer plain HTTP RPC. Default msfrpcd uses SSL; the GUI Connect form has an SSL checkbox.

## Start the GUI

```bash
cd msf-gui
npm install
npm run dev
```

- UI: http://127.0.0.1:5173
- API: http://127.0.0.1:3001

Open the UI, go to **Connect**, enter RPC host/port/user/pass, and connect.

## Production build

```bash
npm run build
npm start
```

Serves the built client from the API server on port 3001.

## Features

**Phase 1**

- Connect / version check
- Module search, options, check, execute
- Jobs list/stop
- Sessions list + interactive terminal (WebSocket)

**Phase 2**

- Database: workspaces, hosts, services, vulns, creds, loot
- Payload generator
- Listener helper (`multi/handler`)
- Plugins load/unload
- Embedded msfconsole via RPC console API

**Settings + AI Assistant**

- Settings page (`~/.msf-gui/settings.json`): MSF defaults, LHOST/LPORT, OpenAI-compatible AI key/model
- AI Assistant can search modules, recommend modules, and **upgrade a payload plan** to match OS/arch/transport/format
- Assistant actions deep-link into Payloads / Listeners / Module runner

### Configure AI

1. Open **Settings**
2. Set Base URL (default `https://api.openai.com/v1`), model, and API key
3. Save, then open **AI Assistant**

API keys are stored only on your machine in `~/.msf-gui/settings.json` (not in this repo). Never commit that file or any `.env` with secrets.

The assistant uses tool-calls against your live `msfrpcd` connection when available.

## Security note

This tool is for local/authorized lab use. The bridge holds the MSF RPC token server-side; do not expose port 3001 to untrusted networks without additional hardening.
