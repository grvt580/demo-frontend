# Demo Frontend — OneTechSupport (Sora)

A standalone, branded frontend for the **OneTechSupport** Cognigy flow (agent **Sora**). Employees can chat or start a WebRTC voice call with Sora directly from the page; both channels connect to the live Cognigy flow, so the transcript renders in real time as the conversation happens.

Live agent capabilities demoed here: password reset, VPN troubleshooting, device health checks, and general IT/HR questions — see the `OneTechSupport - Agentic Service Desk Briefing.pptx` deck for the business narrative this page supports.

## Structure

```
index.html          hero page + widget mount/init scripts + live session panel markup
config.js           per-vertical settings (customer name, avatar, endpoint URLs, brand color)
live-session.js      parses metadata_notify events and renders the live session panel
css/theme.css        page theme tokens + hero styling + live session panel styling
css/webchat.css       Cognigy Webchat v3 branding overrides
css/webrtc.css        Cognigy Click-to-Call (WebRTC) branding overrides
assets/sora-avatar.png  Sora's agent avatar, pulled from the live Cognigy project
```

## Live session panel (metadata_notify)

The OneTechSupport flow pushes structured progress updates mid-conversation via a shared `metadata_notify` sub-flow — e.g. "verifying identity", "device health check", "VPN diagnostic result", "password reset sent". `live-session.js` listens for these on both channels and renders them as a real-time timeline, bottom-left on the page:

- **Chat** — `metadata_notify`'s "Send Metadata Chat" code node runs `api.output("", context.notifyMeta)`. Client-side this arrives via the [Webchat Analytics API](https://github.com/Cognigy/Webchat/blob/main/docs/analytics-api.md): `webchat.registerAnalyticsService(event => ...)`, with `event.type === "webchat/incoming-message"` and the payload in `event.payload.data`.
- **Voice** — `metadata_notify`'s "Send Metadata WebRTC" node is a native `sendMetadata` (Voice Gateway) node, delivered over the call's SIP INFO channel. Client-side this arrives via `session.on("newInfo", data => ...)` (from `widget.on("newRTCSession", ...)`), with the payload in `data.info.body`.

Both deliver the same string: `context.notifyMeta`, which is `JSON.stringify({ action, metaJson })` where `metaJson` is *itself* a JSON string — `live-session.js` parses both layers. The 8 `action` values the flow currently emits (verified directly from the flow's exported node code, not guessed): `employee_verify`, `employee_found`, `device_health`, `vpn_diagnostic`, `password_reset`, `live_agent`, `call_ended`, `home` (the last one clears the timeline — it marks a return to the main menu). Each has its own renderer in `live-session.js`; unrecognized actions still render generically rather than being dropped silently, so a new `action` the flow starts sending shows up immediately instead of disappearing.

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

## Live

Published at **https://github.com/grvt580/demo-frontend** and served via GitHub Pages at **https://grvt580.github.io/demo-frontend/** (branch `main`, root).

## Reusing this for another vertical

1. Copy this folder to a new sibling folder, e.g. `oneairline-demo`.
2. Replace `assets/sora-avatar.png` with the new agent's avatar.
3. Edit `config.js`: `customerName`, `agentName`, `agentTagline`, `avatarUrl`, `webchatConfigUrl`, `webrtcConfigUrl`, `primaryColor`.
4. Find-and-replace the hardcoded `OneTechSupport` / `Sora` / `#0369a1` / `./assets/sora-avatar.png` strings in `index.html` and `css/webchat.css` / `css/webrtc.css` (these are baked in per-vertical rather than templated at runtime).
