/**
 * Live Session stage — renders metadata_notify events pushed by the
 * OneTechSupport flow in real time, over both channels, as full "screens"
 * in the main content area (replacing the hero copy), not a side popup:
 *
 *   Chat:  metadata_notify's "Send Metadata Chat" code node runs
 *          api.output("", context.notifyMeta) -> arrives client-side as
 *          the Webchat Analytics API's "webchat/incoming-message" event,
 *          with event.payload.data === context.notifyMeta (a JSON string).
 *
 *   Voice: metadata_notify's "Send Metadata WebRTC" node (a native
 *          @cognigy/voicegateway2 sendMetadata node) sends the same
 *          context.notifyMeta string over the call's SIP INFO channel.
 *          It arrives client-side via session.on("newInfo", data), with
 *          data.info.body === the same JSON string.
 *
 * In both cases the flow sets:
 *   context.notifyMeta = JSON.stringify({ action: "<name>", metaJson: JSON.stringify({...fields}) })
 * i.e. a JSON string whose "metaJson" field is ITSELF a JSON string that
 * needs a second parse. This file mirrors that exactly against the 8
 * action types the flow actually emits (verified from the flow's own
 * exported node code, not guessed):
 *
 *   employee_verify  -> masked phone, OTP being sent
 *   employee_found   -> identity confirmed (name, email, MFA status)
 *   device_health    -> Intune device compliance + VPN config check
 *   vpn_diagnostic   -> VPN issue detected + remediation outcome
 *   password_reset   -> temp password/reset confirmation
 *   live_agent       -> handoff to a human
 *   call_ended       -> closing message
 *   home             -> conversation reset to the main menu (back to hero)
 */
(function () {
  var CUSTOMER = (window.DEMO_CONFIG && window.DEMO_CONFIG.customerName) || "Support";

  var heroEl = document.getElementById("heroContent");
  var stageWrap = document.getElementById("stageWrap");
  var stageCard = document.getElementById("stageCard");
  var stageHome = document.getElementById("stageHome");

  stageHome.addEventListener("click", showHero);

  function showHero() {
    stageWrap.hidden = true;
    heroEl.hidden = false;
  }

  function showStage(html) {
    stageCard.innerHTML = html;
    heroEl.hidden = true;
    stageWrap.hidden = false;
    flushPendingTerminals();
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  var ICONS = {
    lock: '<svg viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none"><path d="M20 6 9 17l-5-5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    key: '<svg viewBox="0 0 24 24" fill="none"><circle cx="8" cy="15" r="4" stroke="currentColor" stroke-width="1.8"/><path d="M11 12l9-9m-4 4 2 2m-6 1 2 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    person: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.8"/><path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    wave: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 12c1.5-3 3-3 4.5 0s3 3 4.5 0 3-3 4.5 0 3 3 4.5 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="m4 7 8 6 8-6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 4h3l1.5 4-2 1.5a10 10 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4 6.2 2 2 0 0 1 6 4z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.6"/><path d="M12 8v4l3 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    code: '<svg viewBox="0 0 24 24" fill="none"><path d="m8 8-4 4 4 4m8-8 4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3 2 20h20L12 3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 10v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="17" r="0.8" fill="currentColor"/></svg>'
  };

  function iconHtml(name) {
    return '<span class="stage-icon-svg">' + (ICONS[name] || ICONS.check) + "</span>";
  }

  function renderBanner(tone, icon, eyebrow, titleHtml) {
    return (
      '<div class="stage-banner tone-' + tone + '">' +
        '<div class="stage-icon-badge">' + iconHtml(icon) + "</div>" +
        '<div class="stage-eyebrow">' + esc(CUSTOMER.toUpperCase()) + " &middot; " + esc(eyebrow) + "</div>" +
        '<div class="stage-title">' + titleHtml + "</div>" +
      "</div>"
    );
  }

  function renderPlainHead(eyebrow, title, subtitle) {
    return (
      '<div class="stage-plainhead">' +
        '<div class="stage-eyebrow stage-eyebrow-dark">' + esc(CUSTOMER.toUpperCase()) + " &middot; " + esc(eyebrow) + "</div>" +
        '<div class="stage-title stage-title-dark">' + esc(title) + "</div>" +
        (subtitle ? '<div class="stage-subtitle">' + esc(subtitle) + "</div>" : "") +
      "</div>"
    );
  }

  function renderRow(icon, label, value) {
    if (!value) return "";
    return (
      '<div class="stage-row">' +
        '<div class="stage-row-icon">' + iconHtml(icon) + "</div>" +
        "<div><div class=\"stage-row-label\">" + esc(label) + "</div>" +
        '<div class="stage-row-value">' + esc(value) + "</div></div>" +
      "</div>"
    );
  }

  function renderNote(tone, icon, html) {
    if (!html) return "";
    return (
      '<div class="stage-note tone-' + tone + '">' +
        '<div class="stage-note-icon">' + iconHtml(icon) + "</div>" +
        "<div>" + html + "</div>" +
      "</div>"
    );
  }

  function renderStatus(tone, title, text) {
    return (
      '<div class="stage-status tone-' + tone + '">' +
        '<div class="stage-status-icon">' + iconHtml(tone === "success" ? "check" : "warn") + "</div>" +
        "<div><div class=\"stage-status-title\">" + esc(title) + "</div>" +
        (text ? '<div class="stage-status-text">' + esc(text) + "</div>" : "") + "</div>" +
      "</div>"
    );
  }

  var termCounter = 0;
  var pendingTerminals = [];

  function renderTerminal(title, lines) {
    var id = "stage-term-" + (++termCounter);
    pendingTerminals.push({ id: id, lines: lines || [] });
    return (
      '<div class="stage-terminal">' +
        '<div class="stage-terminal-title"><span class="term-dot d1"></span><span class="term-dot d2"></span><span class="term-dot d3"></span><span>' + esc(title) + "</span></div>" +
        '<div class="stage-terminal-body" id="' + id + '"></div>' +
      "</div>"
    );
  }

  // Reveals terminal lines one at a time (instead of dumping them in all at
  // once) so a diagnostic card reads like a live/real-time update, matching
  // the vendor tool's own streamed CLI output.
  function animateTerminalLines(el, lines, i) {
    var oldCursor = el.querySelector(".term-cursor");
    if (oldCursor) oldCursor.remove();
    if (i >= lines.length) return;
    var l = lines[i];
    var div = document.createElement("div");
    div.className = "term-line term-" + (l.cls || "muted");
    div.textContent = l.text;
    el.appendChild(div);
    requestAnimationFrame(function () { div.classList.add("term-line-show"); });
    if (i + 1 < lines.length) {
      var cursor = document.createElement("div");
      cursor.className = "term-cursor";
      el.appendChild(cursor);
    }
    setTimeout(function () { animateTerminalLines(el, lines, i + 1); }, 420);
  }

  function flushPendingTerminals() {
    var jobs = pendingTerminals;
    pendingTerminals = [];
    jobs.forEach(function (job) {
      var el = document.getElementById(job.id);
      if (el) animateTerminalLines(el, job.lines, 0);
    });
  }

  function renderOtp() {
    var boxes = "";
    for (var i = 0; i < 6; i++) boxes += '<div class="otp-box"></div>';
    return '<div class="stage-otp">' + boxes + "</div>";
  }

  function renderPrompt(text) {
    if (!text) return "";
    return '<div class="stage-divider"></div><div class="stage-prompt">' + esc(text) + "</div>";
  }

  var RENDERERS = {
    employee_verify: function (m) {
      showStage(
        renderBanner("info", "lock", "VERIFICATION", "Check your phone") +
        '<div class="stage-body">' +
          '<p class="stage-lead">' +
            (m.maskedPhone
              ? "I've sent a six-digit code by text to <b>" + esc(m.maskedPhone) + "</b>."
              : "Sending a verification code&hellip;") +
          "</p>" +
          renderOtp() +
          renderNote("info", "shield", "Nothing sensitive gets touched until you're verified. The code expires in five minutes, and I'll never read it out to you.") +
          renderPrompt("Read the code back to me and we'll keep going.") +
        "</div>"
      );
    },

    employee_found: function (m) {
      var name = [m.firstName, m.lastName].filter(Boolean).join(" ") || "there";
      var mfaOk = /^configured$/i.test(m.mfaStatus || "");
      showStage(
        renderBanner("success", "check", "VERIFIED", "Welcome back, " + esc(name)) +
        '<div class="stage-body">' +
          renderRow("mail", "Work email", m.email) +
          renderRow("phone", "Mobile", m.phoneNumber) +
          (mfaOk ? "" : renderNote("warn", "warn",
            "<b>Multi-factor authentication</b><br>Not configured &mdash; worth setting up while we're here, it takes about two minutes in Microsoft Entra ID.")) +
          renderPrompt("What can I help you with — device check, VPN, or a password reset?") +
        "</div>"
      );
    },

    device_health: function (m) {
      var issues = Number(m.issuesFound) || 0;
      var devices = Array.isArray(m.devices) ? m.devices : [];
      var lines = devices.map(function (d) {
        var flag = d.compliance && d.compliance !== "compliant";
        var extra = (d.issues && d.issues.length) ? " — " + d.issues.join(", ") : "";
        return {
          text: (flag ? "⚠ " : "✓ ") + (d.name || "Device") + " (" + (d.os || "") + (d.osVersion ? " " + d.osVersion : "") + ") · " + (d.compliance || "unknown") + extra,
          cls: flag ? "warn" : "ok"
        };
      });
      if (m.scanInterval) {
        lines.push({ text: "Next scan: " + m.scanInterval + (m.scanDayOfWeek ? " on " + m.scanDayOfWeek : "") + (m.scanTime ? " at " + m.scanTime : ""), cls: "muted" });
      }
      var resolved = issues === 0;
      showStage(
        renderPlainHead(
          "DEVICE HEALTH",
          resolved ? "All devices healthy" : issues + " issue" + (issues > 1 ? "s" : "") + " found",
          "Scanned " + devices.length + " device" + (devices.length === 1 ? "" : "s") + " across your account."
        ) +
        '<div class="stage-body">' +
          renderStatus(resolved ? "success" : "warn", resolved ? "All clear" : "Attention needed",
            resolved ? "Every managed device is compliant and up to date." : "One or more devices need a fix — details below.") +
          renderTerminal("intune · device-health", lines) +
          renderPrompt(resolved ? "Anything else I can check for you?" : "Want me to walk you through fixing the flagged device?") +
        "</div>"
      );
    },

    vpn_diagnostic: function (m) {
      var resolved = m.resolved === "true" || m.resolved === true;
      var attempted = m.remediationAttempted === "true" || m.remediationAttempted === true;
      var lines = [
        { text: "$ vpn --diagnose --source intune", cls: "muted" },
        { text: "Connecting to Intune management interface...", cls: "muted" },
        { text: "Policy sync initialized", cls: "muted" }
      ];
      lines.push({ text: "Status: " + (resolved ? "OK" : "ConfigurationError"), cls: resolved ? "ok" : "err" });
      if (m.code) lines.push({ text: "Code: " + m.code, cls: resolved ? "muted" : "err" });
      if (m.title || m.details) lines.push({ text: (m.title || "VPN issue") + (m.details ? ": " + m.details : ""), cls: resolved ? "muted" : "err" });
      if (attempted) {
        lines.push({ text: "Starting remediation via " + (m.remediationMethod || "automated fix") + "...", cls: "muted" });
        lines.push({ text: "Remediation: " + (m.remediationStatus || "Completed"), cls: "ok" });
        lines.push({ text: "VPN configuration successfully restored", cls: "ok" });
      }
      showStage(
        renderPlainHead(
          "NETWORK DIAGNOSTICS",
          m.title || (resolved ? "VPN issue resolved" : "VPN configuration failed"),
          resolved ? "Detected and fixed while we were talking." : "Detected while we were talking — this needs a follow-up."
        ) +
        '<div class="stage-body">' +
          renderStatus(resolved ? "success" : "danger", resolved ? "Resolved" : "Needs escalation",
            resolved ? "Your VPN profile was re-pushed and applied successfully." : (m.details || "Automated remediation didn't resolve this.")) +
          renderTerminal("intune · vpn-diagnostic", lines) +
          renderPrompt(resolved ? "Give it a try — is your connection working now?" : "I'll flag this for the network team — anything else in the meantime?") +
        "</div>"
      );
    },

    password_reset: function (m) {
      var toManager = m.deliveryMethod === "manager";
      showStage(
        renderBanner("success", "key", "PASSWORD RESET", esc(m.software || "Account") + " password reset") +
        '<div class="stage-body">' +
          renderRow("code", "Application", m.software) +
          (toManager
            ? renderRow("mail", "Temp password sent to", (m.managerName || "your manager") + (m.managerEmail ? " (" + m.managerEmail + ")" : ""))
            : renderRow("mail", "Temp password sent to", m.email)) +
          renderRow("clock", "Reset at", fmtDate(m.resetAt)) +
          renderNote("info", "mail", toManager
            ? "Since you don't have access to your own email or Teams right now, your manager will pass the temporary password along."
            : ("A temporary password is on its way to your inbox" + (m.expiresInMinutes ? " and expires in " + esc(m.expiresInMinutes) + " minutes" : "") + ". You'll be asked to set a new one the first time you sign in.")) +
          renderPrompt("Try signing in and let me know if it works — anything else I can unlock?") +
        "</div>"
      );
    },

    live_agent: function () {
      showStage(
        renderBanner("warn", "person", "LIVE AGENT", "Transferring you now") +
        '<div class="stage-body">' +
          '<p class="stage-lead">Connecting you with a specialist&hellip; hang tight.</p>' +
        "</div>"
      );
    },

    call_ended: function (m) {
      showStage(
        renderBanner("info", "wave", "SESSION", "Thanks for reaching out") +
        '<div class="stage-body">' +
          '<p class="stage-lead">' + esc(m.message || "Thanks for contacting the service desk.") + "</p>" +
        "</div>"
      );
    },

    home: function () {
      showHero();
    }
  };

  function parseNotify(raw) {
    var outer;
    try {
      outer = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch (e) {
      return null;
    }
    if (!outer || !outer.action) return null;
    var meta = {};
    if (outer.metaJson) {
      try {
        meta = JSON.parse(outer.metaJson);
      } catch (e) {
        meta = {};
      }
    }
    return { action: outer.action, meta: meta };
  }

  function handleRaw(raw) {
    var parsed = parseNotify(raw);
    if (!parsed) return;
    var renderer = RENDERERS[parsed.action];
    if (renderer) {
      renderer(parsed.meta);
    } else {
      showStage(renderPlainHead("UPDATE", parsed.action.replace(/_/g, " "), "") + '<div class="stage-body"></div>');
    }
  }

  window.LiveSession = { handleRaw: handleRaw, parseNotify: parseNotify };
})();
