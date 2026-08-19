const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const API_PORT = 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

// =========================================================================
// SIMULATION ENGINE STATE
// =========================================================================
let clockMin = 7.75 * 60; // 07:45
let day = 1;

const SCHEDULE = [
  { id: 'ARRIVE', startMin: 450, endMin: 495, label: 'Morning Arrival & Gate Leisure', activity: 'ARRIVING_AT_SCHOOL', loc: 'courtyard' },
  { id: 'CLASS_1', startMin: 495, endMin: 600, label: 'Class 1-D Academic Lecture 1', activity: 'CLASS', loc: 'class1d' },
  { id: 'BREAK_1', startMin: 600, endMin: 615, label: '15-Minute Morning Recess', activity: 'BREAK', loc: 'class1d' },
  { id: 'CLASS_2', startMin: 615, endMin: 720, label: 'Class 1-D Academic Lecture 2', activity: 'CLASS', loc: 'class1d' },
  { id: 'LUNCH', startMin: 720, endMin: 780, label: 'School Cafeteria Dining', activity: 'LUNCH', loc: 'cafeteria' },
  { id: 'CLASS_3', startMin: 780, endMin: 900, label: 'Afternoon S-System Seminar', activity: 'AFTERNOON_CLASS', loc: 'class1d' },
  { id: 'AFTER_SCHOOL', startMin: 900, endMin: 1050, label: 'Club Activities & Study Sessions', activity: 'PERSONAL_ACTIVITY', loc: 'library' },
  { id: 'EVENING', startMin: 1050, endMin: 1200, label: 'Keyaki Mall & Seaside Leisure', activity: 'EVENING_LEISURE', loc: 'mall' },
  { id: 'DORM', startMin: 1200, endMin: 1350, label: 'Dormitory Private Study', activity: 'DORM_TIME', loc: 'dorm' },
  { id: 'NIGHT', startMin: 1350, endMin: 1890, label: 'Campus Curfew & Night Rest', activity: 'NIGHT_REST', loc: 'dorm' }
];

function getCurrentEvent(min) {
  const m = min % 1440;
  for (const e of SCHEDULE) {
    if (e.startMin <= e.endMin) {
      if (m >= e.startMin && m < e.endMin) return e;
    } else {
      if (m >= e.startMin || m < (e.endMin % 1440)) return e;
    }
  }
  return SCHEDULE[0];
}

const NPCS = [
  { id: 'horikita', name: 'Horikita', role: 'student', archetype: 'Academic / Nerdy', state: 'ARRIVING_AT_SCHOOL', currentActivity: 'MORNING_LEISURE', activityReason: 'Early morning review', seat: 'CLASS_1D_SEAT_13' },
  { id: 'kushida', name: 'Kushida', role: 'student', archetype: 'Social Butterfly', state: 'ARRIVING_AT_SCHOOL', currentActivity: 'MORNING_LEISURE', activityReason: 'Chatting with classmates', seat: 'CLASS_1D_SEAT_08' },
  { id: 'sudou', name: 'Sudou', role: 'student', archetype: 'Sports Athlete', state: 'ARRIVING_AT_SCHOOL', currentActivity: 'MORNING_LEISURE', activityReason: 'Morning athletic warmups', seat: 'CLASS_1D_SEAT_03' },
  { id: 'kouenji', name: 'Kouenji', role: 'student', archetype: 'Slacker / Casual', state: 'ARRIVING_AT_SCHOOL', currentActivity: 'MORNING_LEISURE', activityReason: 'Lounging at cafe', seat: 'CLASS_1D_SEAT_25' },
  { id: 'chabashira', name: 'Chabashira', role: 'teacher', archetype: 'Class Leader', state: 'ARRIVING_AT_SCHOOL', currentActivity: 'OFFICE_HOURS', activityReason: 'Preparing class materials', seat: 'CLASS_1D_TEACHER' },
  { id: 'hirata', name: 'Hirata', role: 'student', archetype: 'Class Leader', state: 'ARRIVING_AT_SCHOOL', currentActivity: 'MORNING_LEISURE', activityReason: 'Morning greeting', seat: 'CLASS_1D_SEAT_11' },
  { id: 'karuizawa', name: 'Karuizawa', role: 'student', archetype: 'Social Butterfly', state: 'ARRIVING_AT_SCHOOL', currentActivity: 'MORNING_LEISURE', activityReason: 'Browsing accessories', seat: 'CLASS_1D_SEAT_17' },
  { id: 'yukimura', name: 'Yukimura', role: 'student', archetype: 'Academic / Nerdy', state: 'ARRIVING_AT_SCHOOL', currentActivity: 'MORNING_LEISURE', activityReason: 'Reading textbook', seat: 'CLASS_1D_SEAT_06' },
  { id: 'sakura', name: 'Sakura', role: 'student', archetype: 'Academic / Nerdy', state: 'ARRIVING_AT_SCHOOL', currentActivity: 'MORNING_LEISURE', activityReason: 'Quiet observation', seat: 'CLASS_1D_SEAT_22' },
  { id: 'ike', name: 'Ike', role: 'student', archetype: 'Slacker / Casual', state: 'ARRIVING_AT_SCHOOL', currentActivity: 'MORNING_LEISURE', activityReason: 'Talking with Yamauchi', seat: 'CLASS_1D_SEAT_02' },
  { id: 'yamauchi', name: 'Yamauchi', role: 'student', archetype: 'Slacker / Casual', state: 'ARRIVING_AT_SCHOOL', currentActivity: 'MORNING_LEISURE', activityReason: 'Daydreaming plans', seat: 'CLASS_1D_SEAT_04' }
];

// Clock tick: 20 real minutes = 24 in-game hours
setInterval(() => {
  const prev = clockMin;
  clockMin = (clockMin + 0.05 * (1440 / (20 * 60))) % 1440;
  if (clockMin < prev) day++;
}, 50);

function handleApi(req, res, url) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (url.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'OK', server: 'COTE Simulation Server', mode: 'hybrid-bridge' }));
    return;
  }

  if (url.pathname === '/api/simulation') {
    const h = Math.floor(clockMin / 60) % 24;
    const m = Math.floor(clockMin % 60);
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const evt = getCurrentEvent(clockMin);

    const payload = {
      time: timeStr,
      clockMin: Number(clockMin.toFixed(2)),
      day,
      event: evt,
      npcs: NPCS
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
    return;
  }

  if (url.pathname === '/api/time' && req.method === 'POST') {
    const hour = parseFloat(url.searchParams.get('hour') || '8');
    clockMin = (hour * 60) % 1440;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, clockMin }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
}

// 1. Primary Static & Simulation Web Server (Port 3000)
const webServer = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  if (parsedUrl.pathname.startsWith('/api/')) {
    handleApi(req, res, parsedUrl);
    return;
  }

  let filePath = path.join(__dirname, parsedUrl.pathname === '/' ? 'index.html' : decodeURIComponent(parsedUrl.pathname));
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
    return;
  }

  if (fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('500 Internal Server Error');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' });
    res.end(content);
  });
});

webServer.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🌐 COTE Web Game Server running at: http://localhost:${PORT}`);
  console.log(`   3D Campus Game: http://localhost:${PORT}/game3d-campus.html`);
  console.log(`   Master Portal:  http://localhost:${PORT}/index.html`);
  console.log('====================================================');
});

// 2. Dedicated Simulation API Server (Port 8080 for Java Bridge compatibility)
const apiServer = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${API_PORT}`);
  handleApi(req, res, parsedUrl);
});

apiServer.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log(`[NOTE] Port ${API_PORT} already in use (possibly native Java server running).`);
  }
});

apiServer.listen(API_PORT, () => {
  console.log(`⚡ Simulation API Server active at: http://localhost:${API_PORT}`);
  console.log(`   Health Check: http://localhost:${API_PORT}/api/health`);
  console.log(`   Simulation API: http://localhost:${API_PORT}/api/simulation`);
  console.log('====================================================');
});
