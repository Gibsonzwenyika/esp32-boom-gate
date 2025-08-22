import express from "express";
import mongoose from "mongoose";

const app = express();
app.use(express.json());
app.use(express.static("public"));

const pendingCommands = new Map();

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/esp32boomgate";
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(()=> console.log("✅ MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

// Schema
const logSchema = new mongoose.Schema({
  time: { type: Date, default: Date.now },
  method: String,
  deviceId: String,
  event: String
});
const Log = mongoose.model("Log", logSchema);

// Functions
async function addLog({ method = "unknown", deviceId = "gate-1", event = "info" }) {
  const entry = new Log({ method, deviceId, event });
  await entry.save();
  return entry;
}

function enqueueCommand(deviceId, command) {
  if (!pendingCommands.has(deviceId)) pendingCommands.set(deviceId, []);
  pendingCommands.get(deviceId).push({ command, issuedAt: Date.now() });
}

// Routes
app.get("/api/health", (req,res) => res.json({ ok:true, uptime: process.uptime() }));

app.post("/api/gate/open", async (req,res)=>{
  const { deviceId = "gate-1", method = "dashboard" } = req.body || {};
  enqueueCommand(deviceId, "open");
  const log = await addLog({ method, deviceId, event:"open_command" });
  res.json({ ok:true, queued:true, log });
});

app.get("/api/gate/next", (req,res)=>{
  const deviceId = req.query.deviceId || "gate-1";
  const queue = pendingCommands.get(deviceId) || [];
  const next = queue.shift();
  res.json({ command: next ? next.command : null });
});

app.post("/api/gate/log", async (req,res)=>{
  try {
    const { deviceId = "gate-1", method = "esp32", event = "opened" } = req.body || {};
    const log = await addLog({ method, deviceId, event });
    res.json({ ok:true, log });
  } catch(err) {
    console.error(err);
    res.status(500).json({ ok:false, error:"DB error" });
  }
});

app.get("/api/gate/logs", async (req,res)=>{
  const limit = Math.min(parseInt(req.query.limit || "100",10),1000);
  const logs = await Log.find().sort({ time:-1 }).limit(limit).lean();
  res.json(logs);
});

// Fallback → dashboard
app.get("*", (req,res)=> res.sendFile(process.cwd()+"/public/index.html"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log(`Server running on port ${PORT}`));
