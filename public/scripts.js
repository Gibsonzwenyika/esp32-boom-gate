const logContainer = document.getElementById("logContainer");
const openBtn = document.getElementById("openBtn");
const closeBtn = document.getElementById("closeBtn");
const voiceBtn = document.getElementById("voiceBtn");
const statusIndicator = document.getElementById("statusIndicator");

const ctx = document.getElementById("logChart").getContext("2d");

let logChart = new Chart(ctx, {
  type: "line",
  data: {
    labels: [],
    datasets: [{
      label: "Gate Events",
      data: [],
      borderColor: "#3b82f6", // Open: blue
      backgroundColor: "rgba(59,130,246,0.2)",
      tension: 0.4
    }]
  },
  options: {
    scales: {
      x: { title: { display: true, text: "Time" } },
      y: {
        title: { display: true, text: "Event" },
        ticks: {
          stepSize: 1,
          callback: v => v === 1 ? "Open" : "Close"
        }
      }
    }
  }
});

// Fetch logs and update dashboard
async function fetchLogs() {
  try {
    const res = await fetch("/api/gate/logs?limit=20");
    const logs = await res.json();

    // Update log list with color-coded entries
    logContainer.innerHTML = logs.map(l => {
      let colorClass = l.event === "opened" ? "bg-green-50 border-l-4 border-green-400" :
                       l.event === "closed" ? "bg-red-50 border-l-4 border-red-400" :
                       "bg-gray-50 border-l-4 border-gray-300";
      return `<div class="${colorClass} py-2 px-2 mb-1 rounded">
                <strong>${new Date(l.time).toLocaleTimeString()}</strong>: ${l.deviceId} - ${l.event} (${l.method})
              </div>`;
    }).join("");

    // Update status indicator
    const latest = logs[0];
    if (latest && latest.event === "opened") {
      statusIndicator.className = "w-6 h-6 rounded-full bg-green-500";
    } else if (latest && latest.event === "closed") {
      statusIndicator.className = "w-6 h-6 rounded-full bg-red-500";
    } else {
      statusIndicator.className = "w-6 h-6 rounded-full bg-gray-400";
    }

    // Update chart
    const chartLabels = logs.map(l => new Date(l.time).toLocaleTimeString()).reverse();
    const chartData = logs.map(l => l.event === "opened" ? 1 : 0).reverse();
    logChart.data.labels = chartLabels;
    logChart.data.datasets[0].data = chartData;

    // Optional: dynamically change line color for open/close events
    logChart.data.datasets[0].borderColor = chartData.map(v => v === 1 ? "#3b82f6" : "#ef4444");
    logChart.data.datasets[0].backgroundColor = chartData.map(v => v === 1 ? "rgba(59,130,246,0.2)" : "rgba(239,68,68,0.2)");

    logChart.update();

  } catch (err) {
    console.error(err);
  }
}

setInterval(fetchLogs, 2000);
fetchLogs();

// Button actions
openBtn.addEventListener("click", async () => {
  await fetch("/api/gate/open", { method: "POST" });
});
closeBtn.addEventListener("click", async () => {
  await fetch("/api/gate/close", { method: "POST" });
});

// Voice command using Web Speech API
let recognition;
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.lang = 'en-US';
  recognition.interimResults = false;

  recognition.onstart = () => {
    voiceBtn.innerText = "🎙️ Listening...";
    voiceBtn.classList.add("bg-blue-700");
  };

  recognition.onresult = async (event) => {
    const transcript = event.results[0][0].transcript.toLowerCase();
    console.log("Voice command:", transcript);

    if (transcript.includes("open")) {
      await fetch("/api/gate/open", { method: "POST" });
    } else if (transcript.includes("close")) {
      await fetch("/api/gate/close", { method: "POST" });
    } else {
      alert("Command not recognized. Say 'open' or 'close'.");
    }
  };

  recognition.onend = () => {
    voiceBtn.innerText = "🎤 Voice Command";
    voiceBtn.classList.remove("bg-blue-700");
  };
} else {
  voiceBtn.disabled = true;
  voiceBtn.innerText = "Voice Not Supported";
}

// Start voice recognition on button click
voiceBtn.addEventListener("click", () => {
  if (recognition) recognition.start();
});
