/**
 * Live Session panel — renders metadata_notify events pushed by the
 * OneTechSupport flow in real time, over both channels:
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
 *   home             -> conversation reset to the main menu (clears the log)
 */
(function () {
  var panel = document.getElementById("livePanel");
  var log = document.getElementById("liveLog");
  var closeBtn = document.getElementById("livePanelClose");

  closeBtn.addEventListener("click", function () {
    panel.hidden = true;
  });

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function timeNow() {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function addEntry(title, detailLines, tone) {
    panel.hidden = false;
    var el = document.createElement("div");
    el.className = "live-entry" + (tone ? " tone-" + tone : "");
    var detailHtml = (detailLines || [])
      .filter(Boolean)
      .map(function (l) { return "<div>" + l + "</div>"; })
      .join("");
    el.innerHTML =
      '<div class="live-entry-title"><span>' + esc(title) + '</span>' +
      '<span class="live-entry-time">' + timeNow() + "</span></div>" +
      (detailHtml ? '<div class="live-entry-detail">' + detailHtml + "</div>" : "");
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }

  function addDivider(text) {
    panel.hidden = false;
    var el = document.createElement("div");
    el.className = "live-entry-divider";
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }

  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  var RENDERERS = {
    employee_verify: function (m) {
      addEntry(
        "Verifying employee identity",
        [m.maskedPhone ? "Sending a code to " + esc(m.maskedPhone) : "Checking employee record…"],
        "info"
      );
    },

    employee_found: function (m) {
      var name = [m.firstName, m.lastName].filter(Boolean).join(" ") || "Employee";
      addEntry(
        "Identity confirmed — " + esc(name),
        [
          m.email ? esc(m.email) : "",
          m.phoneNumber ? esc(m.phoneNumber) : "",
          "MFA: " + esc(m.mfaStatus || "Unknown")
        ],
        "success"
      );
    },

    device_health: function (m) {
      var issues = Number(m.issuesFound) || 0;
      var devices = Array.isArray(m.devices) ? m.devices : [];
      var lines = devices.map(function (d) {
        var flag = d.compliance && d.compliance !== "compliant";
        var extra = (d.issues && d.issues.length) ? " — " + esc(d.issues.join(", ")) : "";
        return (flag ? "⚠️ " : "✅ ") + esc(d.name || "Device") +
          " (" + esc(d.os || "") + (d.osVersion ? " " + esc(d.osVersion) : "") + ") · " +
          esc(d.compliance || "unknown") + extra;
      });
      if (m.scanInterval) {
        lines.push(
          "Next scan: " + esc(m.scanInterval) +
          (m.scanDayOfWeek ? " on " + esc(m.scanDayOfWeek) : "") +
          (m.scanTime ? " at " + esc(m.scanTime) : "") +
          (m.scanTimezone ? " (" + esc(m.scanTimezone) + ")" : "")
        );
      }
      addEntry(
        "Device health check — " + (issues > 0 ? issues + " issue" + (issues > 1 ? "s" : "") + " found" : "all clear"),
        lines,
        issues > 0 ? "warn" : "success"
      );
    },

    vpn_diagnostic: function (m) {
      var resolved = m.resolved === "true" || m.resolved === true;
      var attempted = m.remediationAttempted === "true" || m.remediationAttempted === true;
      var lines = [];
      if (m.title || m.details) lines.push(esc(m.title || "VPN issue") + (m.details ? ": " + esc(m.details) : ""));
      if (m.code) lines.push("Code: " + esc(m.code));
      if (attempted) {
        lines.push(
          "Remediation: " + esc(m.remediationMethod || "automated fix") +
          (m.remediationStatus ? " — " + esc(m.remediationStatus) : "")
        );
      }
      addEntry(
        "VPN diagnostic — " + (resolved ? "Resolved" : "Needs escalation"),
        lines,
        resolved ? "success" : "danger"
      );
    },

    password_reset: function (m) {
      var toManager = m.deliveryMethod === "manager";
      var destination = toManager
        ? "sent to your manager, " + esc(m.managerName || "your manager") + (m.managerEmail ? " (" + esc(m.managerEmail) + ")" : "")
        : "sent to " + esc(m.email || "your email");
      addEntry(
        "Password reset sent",
        [
          (m.software ? esc(m.software) + " · " : "") + destination,
          m.expiresInMinutes ? "Expires in " + esc(m.expiresInMinutes) + " minutes" : ""
        ],
        "success"
      );
    },

    live_agent: function () {
      addEntry("Transferring to a live agent", ["Connecting you with a specialist…"], "warn");
    },

    call_ended: function (m) {
      addEntry("Session ended", [esc(m.message || "Thanks for contacting the service desk.")], "info");
    },

    home: function () {
      addDivider("New session");
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
      addEntry(parsed.action, [], "info");
    }
  }

  window.LiveSession = { handleRaw: handleRaw, parseNotify: parseNotify };
})();
