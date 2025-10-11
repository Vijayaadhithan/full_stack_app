# Remote Access Guide

When you leave the local network you need an externally reachable URL for the
frontend and API. There are two common approaches:

## 1. Router Port Forwarding (free, manual)

1. Build the production bundle so Express serves the client:
   ```bash
   npm run build
   npm run start
   ```
   This runs the whole app on port `5000`, so you only need to expose one port.

2. Log into your router and forward an external port (e.g. `80` or `5000`) to
   your machine’s LAN IP on port `5000`.

3. Update `config/network-config.json`:
   ```jsonc
   {
     "frontendUrl": "http://your-public-ip:5000",
     "appBaseUrl": "http://your-public-ip:5000",
     "allowedOrigins": ["http://your-public-ip:5000"]
   }
   ```

4. Restart `npm run start`. Test the URL from a phone on mobile data.

> ⚠️ Be sure to secure the exposed port (firewall, HTTPS proxy) before sharing
> it broadly.

## 2. Cloudflare Tunnel (free, easy registration)

Cloudflare Tunnel keeps ports closed and proxies requests through Cloudflare’s
edge. Detailed steps:

1. **Create a Cloudflare account (free)**
   - Visit <https://dash.cloudflare.com/sign-up>.
   - Add a site (domain). If you do not own a domain you can still use the
     auto-generated `*.cfargotunnel.com` hostname that Cloudflare gives each
     tunnel.

2. **Enable Zero Trust / Access**
   - From the dashboard go to **Zero Trust** → **Networks** → **Tunnels**.
   - Click **Create a tunnel**, choose **Cloudflared**, and name the tunnel
     (e.g. `doorstep-dev`). You will be shown a command that downloads and runs
     `cloudflared`. Keep that page open for later.

3. **Install `cloudflared` locally**
   - macOS (Homebrew): `brew install cloudflared`
   - Windows: download the MSI from Cloudflare’s docs.
   - Linux: `wget https://github.com/cloudflare/cloudflared/releases/...`.

4. **Log in with your Cloudflare account**
   ```bash
   cloudflared login
   ```
   A browser window opens asking you to authorise the machine—select your
   domain and approve.

5. **Configure your network config file**
   - Copy `config/network-config.example.json` → `config/network-config.json`
     (if you have not already).
   - Leave the `frontendUrl`/`appBaseUrl` blank for the moment; you will paste
     the tunnel URL after the next step.

6. **Run the helper script**
   ```bash
   chmod +x scripts/start_cloudflare_tunnel.sh   # first time only
   ./scripts/start_cloudflare_tunnel.sh
   ```
   The script builds the production bundle, starts the API on port 5000, and
   launches `cloudflared tunnel --url http://localhost:5000`. When the tunnel
   connects, it prints a public URL such as
   `https://<random-string>.cfargotunnel.com`.

   > If you created a named tunnel in the dashboard, replace the last line of
   > `start_cloudflare_tunnel.sh` with the command Cloudflare provided (usually
   > `cloudflared tunnel run <name>`). The rest of the workflow stays the same.

7. **Update your network config with the public URL**
   ```jsonc
   {
     "frontendUrl": "https://<random-string>.cfargotunnel.com",
     "appBaseUrl": "https://<random-string>.cfargotunnel.com",
     "allowedOrigins": [
       "https://<random-string>.cfargotunnel.com"
     ]
   }
   ```

8. **Restart the server**
   - Stop the script (Ctrl+C) and relaunch it so the backend reads the updated
     config, or start the server manually with
     `NETWORK_CONFIG_PATH=... npm run start`.

9. **Share the tunnel URL**
   - Anyone with the URL can now reach your app while the tunnel is running.
   - When you stop the script, the tunnel closes automatically.

### Exposing both ports?

- Development mode (`npm run dev:server` + `npm run dev:client`) uses **two**
  ports (`5000` API, `5173` Vite). You must forward/tunnel both if you want hot
  reload remotely.
- Production mode (`npm run build` + `npm run start`) bundles the UI into the
  Express app; only port `5000` needs to be reachable.

Choose the method that fits your resources: port forwarding is fully free but
manual, while Cloudflare Tunnel is also free but requires a Cloudflare account
and keeps your home router closed to the internet. QPush to production? Use a
real server or managed hosts, point DNS to it, and keep this repo’s network
config in sync with the deployed URLs.
