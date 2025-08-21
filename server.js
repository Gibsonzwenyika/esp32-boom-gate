import express from "express";
logs.push(entry);
// keep last 1000 logs max
if (logs.length > 1000) logs.shift();
return entry;
}


function enqueueCommand(deviceId, command) {
if (!pendingCommands.has(deviceId)) pendingCommands.set(deviceId, []);
pendingCommands.get(deviceId).push({ command, issuedAt: Date.now() });
}


// Health
app.get("/api/health", (req, res) => {
res.json({ ok: true, uptime: process.uptime() });
});


// Dashboard triggers an open command
app.post("/api/gate/open", (req, res) => {
const { deviceId = "gate-1", method = "dashboard" } = req.body || {};
enqueueCommand(deviceId, "open");
const log = addLog({ method, deviceId, event: "open_command" });
return res.json({ ok: true, queued: true, log });
});


// ESP32 polls for next command (HTTP long-poll optional later)
app.get("/api/gate/next", (req, res) => {
const deviceId = req.query.deviceId || "gate-1";
const queue = pendingCommands.get(deviceId) || [];
const next = queue.shift();
if (!next) return res.json({ command: null });
return res.json({ command: next.command });
});


// ESP32 (or anything) posts a log when the gate actually opens
app.post("/api/gate/log", (req, res) => {
const { deviceId = "gate-1", method = "esp32", event = "opened" } = req.body || {};
const log = addLog({ method, deviceId, event });
return res.json({ ok: true, log });
});


// Dashboard fetches logs
app.get("/api/gate/logs", (req, res) => {
const limit = Math.min(parseInt(req.query.limit || "100", 10), 1000);
const recent = logs.slice(-limit).reverse(); // newest first
res.json(recent);
});


// Serve dashboard
app.use(express.static("public"));


// Fallback → dashboard
app.get("*", (req, res) => {
res.sendFile(process.cwd() + "/public/index.html");
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));