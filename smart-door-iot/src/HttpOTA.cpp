#include "HttpOTA.h"
#include "config.h"
#include "GlobalState.h"
#include "DoorController.h"
#include <WebServer.h>
#include <Update.h>

// ============================================
// HTTP OTA — Fallback firmware upload via /ota
// ============================================

static WebServer otaServer(WEB_SERVER_PORT);
static bool httpOtaStarted = false;

// ── HTML page served at GET /ota ──

static const char OTA_PAGE[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ESP32 OTA Update</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,system-ui,sans-serif;background:#0a0a0a;color:#e5e5e5;
  display:flex;justify-content:center;align-items:center;min-height:100vh;padding:20px}
.card{background:#171717;border:1px solid #262626;border-radius:16px;padding:32px;
  max-width:420px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,.4)}
h1{font-size:18px;font-weight:600;margin-bottom:4px}
.sub{font-size:13px;color:#737373;margin-bottom:24px}
label{display:block;font-size:13px;font-weight:500;color:#a3a3a3;margin-bottom:8px}
input[type=file]{width:100%;padding:10px;background:#0a0a0a;border:1px solid #262626;
  border-radius:10px;color:#e5e5e5;font-size:13px;margin-bottom:16px}
input[type=file]::file-selector-button{background:#2563eb;color:#fff;border:none;
  padding:6px 14px;border-radius:6px;font-size:12px;cursor:pointer;margin-right:10px}
button{width:100%;padding:12px;background:#2563eb;color:#fff;border:none;border-radius:10px;
  font-size:14px;font-weight:600;cursor:pointer;transition:background .2s}
button:hover{background:#1d4ed8}
button:disabled{background:#1e3a6e;cursor:not-allowed;opacity:.6}
#progress{display:none;margin-top:16px}
.bar-bg{background:#262626;border-radius:8px;height:8px;overflow:hidden}
.bar{background:#2563eb;height:100%;width:0%;border-radius:8px;transition:width .3s}
#status{font-size:13px;color:#a3a3a3;margin-top:8px;text-align:center}
.warn{background:#1c1007;border:1px solid #854d0e;border-radius:10px;padding:12px;
  font-size:12px;color:#fbbf24;margin-bottom:20px;line-height:1.5}
</style>
</head>
<body>
<div class="card">
  <h1>&#128274; OTA Firmware Update</h1>
  <p class="sub">Upload firmware binary (.bin) directly to ESP32</p>
  <div class="warn">&#9888;&#65039; Device will restart after upload. Door will lock during update.</div>
  <form id="f">
    <label>Firmware File</label>
    <input type="file" id="file" accept=".bin" required>
    <button type="submit" id="btn">Upload Firmware</button>
  </form>
  <div id="progress">
    <div class="bar-bg"><div class="bar" id="bar"></div></div>
    <div id="status">Uploading...</div>
  </div>
</div>
<script>
document.getElementById('f').addEventListener('submit', async function(e) {
  e.preventDefault();
  const file = document.getElementById('file').files[0];
  if (!file) return;
  const btn = document.getElementById('btn');
  const prog = document.getElementById('progress');
  const bar = document.getElementById('bar');
  const status = document.getElementById('status');
  btn.disabled = true;
  btn.textContent = 'Uploading...';
  prog.style.display = 'block';
  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/ota', true);
  xhr.upload.onprogress = function(e) {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100);
      bar.style.width = pct + '%';
      status.textContent = 'Uploading... ' + pct + '%';
    }
  };
  xhr.onload = function() {
    if (xhr.status === 200) {
      bar.style.width = '100%';
      bar.style.background = '#16a34a';
      status.textContent = 'Update successful! Restarting...';
      setTimeout(function(){ location.reload(); }, 10000);
    } else {
      bar.style.background = '#dc2626';
      status.textContent = 'Error: ' + xhr.responseText;
      btn.disabled = false;
      btn.textContent = 'Upload Firmware';
    }
  };
  xhr.onerror = function() {
    status.textContent = 'Upload failed — connection error';
    btn.disabled = false;
    btn.textContent = 'Upload Firmware';
  };
  const formData = new FormData();
  formData.append('firmware', file);
  xhr.send(formData);
});
</script>
</body>
</html>
)rawliteral";

// ── Password check (simple cookie-based session) ──

static const char LOGIN_PAGE[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>OTA Login</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,system-ui,sans-serif;background:#0a0a0a;color:#e5e5e5;
  display:flex;justify-content:center;align-items:center;min-height:100vh;padding:20px}
.card{background:#171717;border:1px solid #262626;border-radius:16px;padding:32px;
  max-width:380px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,.4)}
h1{font-size:18px;font-weight:600;margin-bottom:4px}
.sub{font-size:13px;color:#737373;margin-bottom:24px}
label{display:block;font-size:13px;font-weight:500;color:#a3a3a3;margin-bottom:6px}
input[type=password]{width:100%;padding:10px 14px;background:#0a0a0a;border:1px solid #262626;
  border-radius:10px;color:#e5e5e5;font-size:14px;margin-bottom:16px;outline:none}
input[type=password]:focus{border-color:#2563eb}
button{width:100%;padding:12px;background:#2563eb;color:#fff;border:none;border-radius:10px;
  font-size:14px;font-weight:600;cursor:pointer}
button:hover{background:#1d4ed8}
.err{color:#ef4444;font-size:12px;margin-bottom:12px;display:none}
</style>
</head>
<body>
<div class="card">
  <h1>&#128274; OTA Access</h1>
  <p class="sub">Enter password to access firmware update</p>
  <form method="POST" action="/ota/login">
    <label>Password</label>
    <input type="password" name="password" autofocus required>
    <div class="err" id="err">Incorrect password</div>
    <button type="submit">Login</button>
  </form>
</div>
<script>
if(location.search.includes('err=1'))document.getElementById('err').style.display='block';
</script>
</body>
</html>
)rawliteral";

// Simple session token — regenerated each boot
static String sessionToken = "";

static void generateSession() {
    sessionToken = String(esp_random(), HEX) + String(esp_random(), HEX);
}

static bool isAuthenticated() {
    if (!otaServer.hasHeader("Cookie")) return false;
    String cookie = otaServer.header("Cookie");
    return cookie.indexOf("ota_session=" + sessionToken) >= 0;
}

// ── Handlers ──

static void handleOtaPage() {
    if (!isAuthenticated()) {
        otaServer.send(200, "text/html", LOGIN_PAGE);
        return;
    }
    otaServer.send(200, "text/html", OTA_PAGE);
}

static void handleLogin() {
    String password = otaServer.arg("password");
    if (password == OTA_WEB_PASSWORD) {
        generateSession();
        otaServer.sendHeader("Set-Cookie", "ota_session=" + sessionToken + "; Path=/ota; HttpOnly");
        otaServer.sendHeader("Location", "/ota");
        otaServer.send(302, "text/plain", "OK");
    } else {
        otaServer.sendHeader("Location", "/ota?err=1");
        otaServer.send(302, "text/plain", "Wrong password");
    }
}

static void handleOtaUpload() {
    if (!isAuthenticated()) {
        otaServer.send(401, "text/plain", "Unauthorized");
        return;
    }

    HTTPUpload& upload = otaServer.upload();

    if (upload.status == UPLOAD_FILE_START) {
        DEBUG_PRINTF("[HTTP-OTA] Firmware upload start: %s\n", upload.filename.c_str());

        // Lock door for safety
        lockDoor();

        if (!Update.begin(UPDATE_SIZE_UNKNOWN)) {
            DEBUG_PRINTF("[HTTP-OTA] Update.begin failed: %s\n", Update.errorString());
        }
    }
    else if (upload.status == UPLOAD_FILE_WRITE) {
        if (Update.write(upload.buf, upload.currentSize) != upload.currentSize) {
            DEBUG_PRINTF("[HTTP-OTA] Write failed: %s\n", Update.errorString());
        }
    }
    else if (upload.status == UPLOAD_FILE_END) {
        if (Update.end(true)) {
            DEBUG_PRINTF("[HTTP-OTA] Update success: %u bytes\n", upload.totalSize);
        } else {
            DEBUG_PRINTF("[HTTP-OTA] Update failed: %s\n", Update.errorString());
        }
    }
}

static void handleOtaUploadComplete() {
    if (!isAuthenticated()) {
        otaServer.send(401, "text/plain", "Unauthorized");
        return;
    }

    if (Update.hasError()) {
        otaServer.send(500, "text/plain", String("Update failed: ") + Update.errorString());
    } else {
        otaServer.send(200, "text/plain", "OK");
        delay(1000);
        ESP.restart();
    }
}

static void handleNotFound() {
    otaServer.sendHeader("Location", "/ota");
    otaServer.send(302, "text/plain", "Redirecting to /ota");
}

// ── Setup & Loop ──

void setupHttpOTA() {
    // Collect Cookie header
    const char* headerKeys[] = {"Cookie"};
    otaServer.collectHeaders(headerKeys, 1);

    // Only /ota and /ota/login are valid routes
    otaServer.on("/ota", HTTP_GET, handleOtaPage);
    otaServer.on("/ota/login", HTTP_POST, handleLogin);
    otaServer.on("/ota", HTTP_POST, handleOtaUploadComplete, handleOtaUpload);

    // Everything else → redirect to /ota
    otaServer.onNotFound(handleNotFound);

    otaServer.begin();
    httpOtaStarted = true;

    DEBUG_PRINTF("[HTTP-OTA] Fallback OTA server running on port %d at /ota\n", WEB_SERVER_PORT);
}

void handleHttpOTA() {
    if (httpOtaStarted) {
        otaServer.handleClient();
    }
}
