/**
 * VoxCode email relay — sends verification/reset emails from the owner's
 * Gmail account, called by the backend over HTTPS (no SMTP needed, so it
 * works from hosts like Render that block outbound SMTP ports).
 *
 * SETUP (one time, ~3 minutes):
 *   1. Go to https://script.google.com → "New project".
 *   2. Delete any placeholder code and paste this entire file.
 *   3. Click "Project Settings" (gear icon) → "Script Properties" →
 *      "Add script property":
 *          Property: RELAY_SECRET
 *          Value:    <any random string you invent, e.g. a long password>
 *   4. Click "Deploy" → "New deployment" → gear icon → "Web app":
 *          Description:        voxcode-relay
 *          Execute as:         Me
 *          Who has access:     Anyone
 *      → "Deploy" → copy the Web app URL (ends with /exec).
 *   5. In Render (Environment tab) add:
 *          APPS_SCRIPT_URL=<the /exec URL>
 *          APPS_SCRIPT_SECRET=<the same RELAY_SECRET value>
 *
 * Free quota: 100 recipients/day (plenty for OTP emails).
 */

function getSecret_() {
  return PropertiesService.getScriptProperties().getProperty("RELAY_SECRET");
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return out_({ ok: false, error: "missing body" });
    }

    var body = JSON.parse(e.postData.contents);
    var secret = getSecret_();
    if (!secret || body.token !== secret) {
      return out_({ ok: false, error: "unauthorized" });
    }
    if (!body.to || !body.subject) {
      return out_({ ok: false, error: "to and subject are required" });
    }

    var options = { name: "VoxCode" };
    if (body.html) options.htmlBody = body.html;

    MailApp.sendEmail(body.to, body.subject, body.text || "", options);
    return out_({ ok: true });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
}

// Used by the backend diagnostics endpoint to confirm the app is deployed.
function doGet() {
  return out_({ ok: true });
}
