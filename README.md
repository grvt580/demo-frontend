# OneTechSupport Demo — Sora

A standalone, branded frontend for the **OneTechSupport** Cognigy flow (agent **Sora**). Employees can chat or start a WebRTC voice call with Sora directly from the page; both channels connect to the live Cognigy flow, so the transcript renders in real time as the conversation happens.

Live agent capabilities demoed here: password reset, VPN troubleshooting, device health checks, and general IT/HR questions — see the `OneTechSupport - Agentic Service Desk Briefing.pptx` deck for the business narrative this page supports.

## Structure

```
index.html          hero page + widget mount/init scripts
config.js           per-vertical settings (customer name, avatar, endpoint URLs, brand color)
css/theme.css        page theme tokens + hero styling
css/webchat.css       Cognigy Webchat v3 branding overrides
css/webrtc.css        Cognigy Click-to-Call (WebRTC) branding overrides
assets/sora-avatar.png  Sora's agent avatar, pulled from the live Cognigy project
```

## How it's wired

- **Chat** — [Webchat v3](https://docs.cognigy.com/webchat/v3/embedding/hosted-script), loaded from `https://github.com/Cognigy/Webchat/releases/latest/download/webchat.js`, initialized against the **Webchat Main** endpoint on the OneTechSupport flow.
- **Voice** — [Click-to-Call widget](https://docs.cognigy.com/click-to-call/embed) (WebRTC), loaded from `https://github.com/Cognigy/click-to-call-widget/releases/latest/download/webRTCWidget.js`, initialized against the **Voice Gateway** endpoint on the same flow. The widget's own live-transcript panel is what renders the conversation in real time during a call.
- The hero's "Ask me things like..." bar isn't a real input — clicking it just opens the real webchat widget.

Both endpoint tokens live in `config.js` — swap them there (not in the CSS files) if the endpoints are recreated.

> **If the call button doesn't connect:** the Voice Gateway endpoint needs its Click-to-Call integration set up once in Cognigy — open the endpoint in **Deploy > Endpoints**, click **Set Up Click To Call Integration** in the *Click To Call Embedding HTML* field, and save. This is a one-time manual step in the Cognigy UI; it can't be done via the API.

## Running locally

No build step — it's static HTML/CSS/JS. Serve the folder with any static server, e.g.:

```bash
python -m http.server 8080
```

then open `http://localhost:8080`.

## Publishing

This folder is its own git repo (sibling to `airline-irop-demo` and `oneretail-demo`). To publish via GitHub Pages:

```bash
git remote add origin <your-repo-url>
git push -u origin main
```

Then enable GitHub Pages for the repo (Settings → Pages → Deploy from branch → `main` / root).

## Reusing this for another vertical

1. Copy this folder to a new sibling folder, e.g. `oneairline-demo`.
2. Replace `assets/sora-avatar.png` with the new agent's avatar.
3. Edit `config.js`: `customerName`, `agentName`, `agentTagline`, `avatarUrl`, `webchatConfigUrl`, `webrtcConfigUrl`, `primaryColor`.
4. Find-and-replace the hardcoded `OneTechSupport` / `Sora` / `#0369a1` / `./assets/sora-avatar.png` strings in `index.html` and `css/webchat.css` / `css/webrtc.css` (these are baked in per-vertical rather than templated at runtime).
