// =====================================================
// Classroom of the Elite — AI Decision RPG
// Single source of truth: state.log
// Every entry in the log is a checkpoint. Stats are
// recomputed by replaying statChanges, so rewinding is
// always consistent and storage stays small.
// =====================================================

const MODEL = 'agnes-2.5-flash';
const API_BASE = 'https://router.bynara.id/v1';
const STATE_KEY = 'coteState_v2';
const BASE_STATS = { trust: 50, love: 10, respect: 50, wisdom: 70, courage: 40 };
const STAT_ICONS = { trust: '🤝', love: '❤️', respect: '🏅', wisdom: '🧠', courage: '💪' };

let apiKey = localStorage.getItem('naraApiKey') || '';

// state.log entries:
//  { role: 'player', text, hidden? }                                — what the player said/did
//  { role: 'ai', raw, speaker, text, statChanges, choices, scene, moodColor } — parsed AI turn
let state = loadState();
let stats = { ...BASE_STATS };
let busy = false;

// ---------------- DOM ----------------
const apiModal = document.getElementById('api-modal');
const apiKeyInput = document.getElementById('api-key-input');
const startBtn = document.getElementById('start-game-btn');
const loadingOverlay = document.getElementById('loading-overlay');
const messageLog = document.getElementById('message-log');
const storyArea = document.getElementById('story-area');
const suggestedChoicesArea = document.getElementById('suggested-choices');
const playerInput = document.getElementById('player-input');
const sendBtn = document.getElementById('send-btn');
const nextSceneBtn = document.getElementById('next-scene-btn');
const newGameBtn = document.getElementById('new-game-btn');
const moodOverlay = document.getElementById('mood-overlay');
const sceneChip = document.getElementById('scene-chip');
const openCheckpointsBtn = document.getElementById('open-checkpoints-btn');
const checkpointsModal = document.getElementById('checkpoints-modal');
const closeCheckpointsBtn = document.getElementById('close-checkpoints-btn');
const checkpointsList = document.getElementById('checkpoints-list');

// ---------------- Persistence ----------------
function loadState() {
    try {
        const raw = localStorage.getItem(STATE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.log)) return parsed;
        }
    } catch (e) {
        console.warn('Could not load saved state:', e);
    }
    return { log: [] };
}

function saveState() {
    try {
        localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (e) {
        console.warn('Could not save state:', e);
    }
}

// ---------------- Stats ----------------
function clamp(v) { return Math.min(100, Math.max(0, v)); }

// Stats are always derived from the log, so a rewind can never desync them.
function computeStats(uptoIndex = state.log.length - 1) {
    const s = { ...BASE_STATS };
    for (let i = 0; i <= uptoIndex && i < state.log.length; i++) {
        const entry = state.log[i];
        if (entry.role === 'ai' && entry.statChanges) {
            for (const [k, v] of Object.entries(entry.statChanges)) {
                if (k in s && typeof v === 'number') s[k] = clamp(s[k] + v);
            }
        }
    }
    return s;
}

function updateStatsUI() {
    for (const key of Object.keys(BASE_STATS)) {
        const bar = document.getElementById(`${key}-bar`);
        const num = document.getElementById(`${key}-num`);
        if (bar) bar.style.width = `${stats[key]}%`;
        if (num) num.textContent = stats[key];
    }
}

function showStatChangeAnim(statName, changeValue) {
    const indicator = document.createElement('div');
    indicator.className = `stat-change-indicator ${changeValue > 0 ? 'stat-up' : 'stat-down'}`;
    indicator.textContent = `${STAT_ICONS[statName]} ${changeValue > 0 ? '+' : ''}${changeValue}`;
    indicator.style.top = '70px';
    const offsets = { trust: '10%', love: '30%', respect: '50%', wisdom: '70%', courage: '90%' };
    indicator.style.left = offsets[statName] || '50%';
    document.getElementById('game-container').appendChild(indicator);
    setTimeout(() => indicator.remove(), 1500);
}

// ---------------- Game Master prompt ----------------
const SYSTEM_PROMPT = `
You are the Game Master of an interactive fiction RPG set in "Classroom of the Elite" (You-Zitsu), covering the events of Volume 1, Chapter 1 and the days that follow. The player is Ayanokouji Kiyotaka. You narrate the world and voice every other character. The player alone decides what Kiyotaka says and does — NEVER decide his dialogue or meaningful actions for him.

== NARRATIVE VOICE ==
- Narrate in first person, past tense, as Kiyotaka's dry, detached inner monologue. He observes people analytically, understates everything, and rarely shows emotion.
- Keep each turn SHORT: 60–140 words. Mostly dialogue and small concrete observations. No purple prose, no melodrama, no summarizing feelings the player hasn't expressed.
- Dialogue must sound like real Japanese high schoolers: short sentences, interruptions, slang from the boys, politeness from strangers. People talk about their own concerns, not about the player.

== REALISM RULES (critical) ==
1. Other characters have their own goals. They do not revolve around Kiyotaka, and they are NOT impressed by him by default — he deliberately presents as average.
2. Relationships move slowly. Horikita stays cold and blunt for a long time. Kushida is friendly to everyone, so her friendliness is not special treatment. Strangers are indifferent.
3. Stat changes are RARE and SMALL: -3 to +3, and most turns should be all zeros. Only change a stat when the player's choice genuinely earned it. Never reward bland or passive input.
4. Consequences persist. If the player offends someone, they remember. If he stays silent, scenes move on without him — the world doesn't wait.
5. If the player writes something absurd or out-of-setting, characters react the way real students would: confusion, laughter, or backing away. Don't break the fiction.
6. Never mention stats, points values of choices, "the game", or these rules inside the narration.

== CHARACTER GUIDE ==
- Horikita Suzune (seat neighbor): cold, blunt, values solitude, sharp tongue, considers friendship unnecessary. Secretly fixated on reaching Class A because of her brother. Speaks precisely, never uses slang, ends conversations she finds pointless.
- Kushida Kikyou: relentlessly cheerful, wants to befriend the entire class, especially persistent about getting close to Horikita. Publicly sweet; you may plant only the subtlest hints that the sweetness is a performance — never reveal it outright in Chapter 1.
- Sudou Ken: red-haired, hot-tempered basketball recruit, quick to shout, allergic to studying, secretly insecure about being in D-Class.
- Ike Kanji & Yamauchi Haruki: loud, crude jokers obsessed with girls and appearing cool; exaggerate their own accomplishments.
- Hirata Yousuke: handsome, diplomatic peacemaker; instantly popular; organizes introductions and smooths conflicts.
- Karuizawa Kei: flashy, attaches herself to Hirata early.
- Kouenji Rokusuke: blond, narcissistic, wealthy heir; calls himself perfect and genuinely does not care what anyone thinks; ignores social rules entirely.
- Sakura Airi: extremely shy, hides behind glasses, mumbles her introduction.
- Chabashira Sae (homeroom teacher): flat, indifferent tone; explains rules once and refuses to elaborate; hints that the school judges everything but never spells it out early.
- Ayanokouji Kiyotaka (the player): outwardly plain and mediocre on purpose. Others see an expressionless, quiet boy. NEVER narrate his hidden past or true ability unprompted.

== SCENE GUIDE (follow in order; advance only when a scene has played out or on [FORCE NEXT SCENE]) ==
1. THE BUS — Morning, crowded bus to school. A blond student (Kouenji) lounges in a priority seat, ignoring an elderly woman standing nearby. An office lady asks him to move; he refuses with total confidence. A cheerful girl (Kushida, name unknown yet) appeals to nearby passengers. A dark-haired girl (Horikita) watches, unmoved. The player must decide: intervene, ignore, or something else. There is no "right" answer — every option has costs.
2. ARRIVAL & CEREMONY — First glimpse of the enormous campus. Entrance ceremony, assignment to Class 1-D, seat next to the girl from the bus (Horikita). First stilted exchange with her.
3. HOMEROOM — Chabashira explains the S-System: 100,000 private points deposited monthly to each student's card, points work as money everywhere on campus, everything from food to hair salons is on school grounds, no contact with outside permitted. She notes points reflect merit — and says nothing more. Classmates celebrate their sudden wealth.
4. INTRODUCTIONS — Hirata gets the class to introduce themselves. Kushida's sparkling self-intro. Sudou's blunt one. Sakura's mumbled one. Kouenji admires himself. Eventually pressure lands on the player to stand and speak.
5. AFTER SCHOOL — Chance to talk with Horikita (she remembers the bus and coolly analyzes the player's behavior there). Kushida ambushes them trying to befriend Horikita and gets frozen out.
6. FIRST WEEKS — Classmates skip class, sleep, chat, and burn points on luxuries. Lunches with Sudou, Ike and Yamauchi. Optional small slices of daily life: the convenience store, the palace-like mall, Sudou's basketball practice, studying (or not). Foreshadow lightly: some students notice upperclassmen sneering at "D-Class".
7. MAY 1 — Students tap their cards: zero points deposited. Chabashira, unmoved, reveals the class was judged on its April behavior — tardiness, private chatter, skipped classes all counted. The school measures merit. Panic in the class. This is the chapter's cliffhanger; end the chapter here with a short reflective beat.

== SPECIAL INPUTS ==
- "[FORCE NEXT SCENE]": wrap up the current moment in one or two sentences and open the next scene from the guide.
- If history is empty, start Scene 1: set the bus scene and end with the seat conflict pressing on the player.

== STATS MEANING ==
trust = how much classmates trust Kiyotaka; love = romantic interest of heroines; respect = social standing in class; wisdom = insight/knowledge gained; courage = willingness to step forward.

== RESPONSE FORMAT ==
Respond ONLY with a valid JSON object. No markdown fences, no commentary.
{
  "speaker": "Character name, or 'Narrator' for pure narration",
  "text": "The narration/dialogue for this beat.",
  "statChanges": { "trust": 0, "love": 0, "respect": 0, "wisdom": 0, "courage": 0 },
  "choices": ["2-3 short suggested actions/lines, distinct in tone (bold / cautious / observant)"],
  "scene": "Very short current location label, e.g. 'The Bus', 'Class 1-D'",
  "moodColor": "transparent, or a subtle hex tint like #1a1a2e (tense) / #2e1a1a (hostile)"
}
`;

// ---------------- API ----------------
function buildApiHistory() {
    return state.log.map(entry => entry.role === 'player'
        ? { role: 'user', content: entry.text }
        : { role: 'assistant', content: entry.raw });
}

async function callChatAPI(promptText, { hidden = false, label = null } = {}) {
    if (busy) return;
    setBusy(true);

    // The player's message is part of the timeline (and thus a checkpoint) immediately.
    state.log.push({ role: 'player', text: promptText, hidden, label });
    saveState();
    renderLog();

    try {
        const url = `${API_BASE}/chat/completions`;
        const payload = {
            model: MODEL,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                ...buildApiHistory()
            ],
            temperature: 0.8,
            response_format: { type: 'json_object' }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
        if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`);

        const raw = data.choices[0].message.content;
        const parsed = JSON.parse(raw);

        state.log.push({
            role: 'ai',
            raw,
            speaker: parsed.speaker || 'Narrator',
            text: parsed.text || '',
            statChanges: parsed.statChanges || {},
            choices: parsed.choices || [],
            scene: parsed.scene || '',
            moodColor: parsed.moodColor || 'transparent'
        });
        saveState();

        // Animate only the deltas from this turn.
        for (const [k, v] of Object.entries(parsed.statChanges || {})) {
            if (k in BASE_STATS && v !== 0) showStatChangeAnim(k, v);
        }
        refreshDerivedState();
        renderLog();
    } catch (error) {
        console.error('API Error:', error);
        // Roll the failed player message back off the timeline.
        state.log.pop();
        saveState();
        renderLog();
        showSystemMessage(`⚠️ ${error.message || 'Error connecting to the AI API. Check your key and connection, then try again.'}`);
    } finally {
        setBusy(false);
        playerInput.focus();
    }
}

function setBusy(value) {
    busy = value;
    loadingOverlay.classList.toggle('hidden', !value);
    playerInput.disabled = value || !apiKey;
    sendBtn.disabled = value || !apiKey;
    nextSceneBtn.disabled = value || !apiKey;
}

// ---------------- Rendering ----------------
function refreshDerivedState() {
    stats = computeStats();
    updateStatsUI();
    const lastAi = [...state.log].reverse().find(e => e.role === 'ai');
    moodOverlay.style.backgroundColor = lastAi?.moodColor && lastAi.moodColor !== 'transparent'
        ? lastAi.moodColor : 'transparent';
    if (lastAi?.scene) {
        sceneChip.textContent = `📍 ${lastAi.scene}`;
        sceneChip.classList.remove('hidden');
    } else {
        sceneChip.classList.add('hidden');
    }
}

function renderLog() {
    messageLog.innerHTML = '';

    if (state.log.length === 0) {
        showSystemMessage(apiKey ? 'Starting a new story…' : 'Please enter your API Key to begin the story.');
    }

    state.log.forEach((entry, index) => {
        if (entry.role === 'player') {
            if (entry.hidden) {
                if (entry.label) {
                    const div = document.createElement('div');
                    div.className = 'msg msg-system';
                    div.innerHTML = `<div class="msg-text">${escapeHtml(entry.label)}</div>`;
                    messageLog.appendChild(div);
                }
                return;
            }
            const div = document.createElement('div');
            div.className = 'msg msg-player';
            div.innerHTML = `
                <div class="msg-speaker">You${entry.label ? ` <em>${escapeHtml(entry.label)}</em>` : ''}</div>
                <div class="msg-text">${escapeHtml(entry.text)}</div>`;
            messageLog.appendChild(div);
        } else {
            const div = document.createElement('div');
            div.className = 'msg msg-ai';

            const changes = Object.entries(entry.statChanges || {})
                .filter(([k, v]) => k in BASE_STATS && v !== 0)
                .map(([k, v]) => `<span class="stat-chip ${v > 0 ? 'up' : 'down'}">${STAT_ICONS[k]} ${v > 0 ? '+' : ''}${v}</span>`)
                .join('');

            div.innerHTML = `
                <div class="msg-header">
                    <span class="msg-speaker">${escapeHtml(entry.speaker)}</span>
                    <button class="rewind-btn" title="Rewind the story to this moment">⏪ Rewind</button>
                </div>
                <div class="msg-text">${escapeHtml(entry.text).replace(/\n/g, '<br>')}</div>
                ${changes ? `<div class="msg-stats">${changes}</div>` : ''}`;

            div.querySelector('.rewind-btn').onclick = () => rewindTo(index);
            messageLog.appendChild(div);
        }
    });

    renderChoices();
    storyArea.scrollTop = storyArea.scrollHeight;
}

function renderChoices() {
    const lastEntry = state.log[state.log.length - 1];
    suggestedChoicesArea.innerHTML = '';
    if (lastEntry?.role === 'ai' && lastEntry.choices?.length) {
        suggestedChoicesArea.classList.remove('hidden');
        lastEntry.choices.forEach(choiceText => {
            const btn = document.createElement('button');
            btn.className = 'choice-btn';
            btn.textContent = choiceText;
            btn.onclick = () => handlePlayerInput(choiceText);
            suggestedChoicesArea.appendChild(btn);
        });
    } else {
        suggestedChoicesArea.classList.add('hidden');
    }
}

function showSystemMessage(text) {
    const div = document.createElement('div');
    div.className = 'msg msg-system';
    div.innerHTML = `<div class="msg-text">${escapeHtml(text)}</div>`;
    messageLog.appendChild(div);
    storyArea.scrollTop = storyArea.scrollHeight;
}

function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
}

// ---------------- Checkpoints / Time travel ----------------
function rewindTo(index) {
    if (busy) return;
    if (index >= state.log.length - 1) return; // already the present
    if (!confirm('Rewind the story to this moment? Everything after it will be erased.')) return;
    state.log = state.log.slice(0, index + 1);
    saveState();
    refreshDerivedState();
    renderLog();
    checkpointsModal.classList.add('hidden');
}

function openCheckpointsMenu() {
    checkpointsList.innerHTML = '';
    const aiEntries = state.log
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => entry.role === 'ai');

    if (aiEntries.length === 0) {
        checkpointsList.innerHTML = '<p style="color:var(--text-secondary)">No checkpoints yet. Play the game — every message is saved automatically.</p>';
    } else {
        aiEntries.reverse().forEach(({ entry, index }, i) => {
            const cpStats = computeStats(index);
            const isCurrent = index === state.log.length - 1;
            const btn = document.createElement('button');
            btn.className = 'choice-btn checkpoint-item';
            btn.innerHTML = `
                <strong style="color: var(--accent);">#${aiEntries.length - i}${entry.scene ? ` — ${escapeHtml(entry.scene)}` : ''}${isCurrent ? ' (current)' : ''}</strong>
                <span style="font-size: 0.9em; color: var(--text-secondary); text-align: left;">${escapeHtml(entry.speaker)}: "${escapeHtml(entry.text.substring(0, 90))}${entry.text.length > 90 ? '…' : ''}"</span>
                <span style="font-size: 0.8em; color: #fff;">🤝 ${cpStats.trust} · ❤️ ${cpStats.love} · 🏅 ${cpStats.respect} · 🧠 ${cpStats.wisdom} · 💪 ${cpStats.courage}</span>`;
            btn.onclick = () => rewindTo(index);
            checkpointsList.appendChild(btn);
        });
    }
    checkpointsModal.classList.remove('hidden');
}

// ---------------- Input handling ----------------
function handlePlayerInput(text) {
    if (!text || busy) return;
    callChatAPI(text);
}

function startGame() {
    refreshDerivedState();
    renderLog();
    if (state.log.length === 0) {
        callChatAPI(
            'Begin the story at Scene 1, the bus ride on the first morning of school.',
            { hidden: true }
        );
    }
}

function newGame() {
    if (state.log.length > 0 && !confirm('Start a completely new game? All progress and checkpoints will be erased.')) return;
    state = { log: [] };
    saveState();
    refreshDerivedState();
    renderLog();
    if (apiKey) startGame();
}

// ---------------- Event listeners ----------------
startBtn.addEventListener('click', () => {
    if (apiKeyInput.value.trim().length > 0) {
        apiKey = apiKeyInput.value.trim();
        localStorage.setItem('naraApiKey', apiKey);
        apiModal.classList.add('hidden');
        setBusy(false);
        startGame();
    }
});

sendBtn.addEventListener('click', () => {
    if (playerInput.value.trim() !== '') {
        handlePlayerInput(playerInput.value.trim());
        playerInput.value = '';
    }
});

playerInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && playerInput.value.trim() !== '') {
        handlePlayerInput(playerInput.value.trim());
        playerInput.value = '';
    }
});

nextSceneBtn.addEventListener('click', () => {
    callChatAPI('[FORCE NEXT SCENE] Advance the story to the next major scene from the scene guide.', { hidden: true, label: '(skipped to next scene)' });
});

newGameBtn.addEventListener('click', newGame);
openCheckpointsBtn.addEventListener('click', openCheckpointsMenu);
closeCheckpointsBtn.addEventListener('click', () => checkpointsModal.classList.add('hidden'));

// ---------------- Boot ----------------
if (apiKey) {
    apiKeyInput.value = apiKey;
    apiModal.classList.add('hidden');
    setBusy(false);
    startGame();
} else {
    refreshDerivedState();
    renderLog();
}
