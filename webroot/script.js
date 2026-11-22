// --- KSU API Function (No changes needed here) ---
function exec(command) {
    return new Promise((resolve, reject) => {
        if (typeof window.ksu === 'undefined' || typeof window.ksu.exec === 'undefined') {
            const apiError = new Error('KernelSU WebUI API (window.ksu.exec) not found. Please open this WebUI using the official KernelSU Manager app.');
            console.error('[KSU API ERROR] KernelSU API "ksu.exec" not available:', apiError);
            logError('KernelSU API "ksu.exec" not available. Please open this WebUI using the official KernelSU Manager app.'); // Log to internal array
            reject(apiError);
            return;
        }

        const callbackFuncName = `exec_callback_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

        window[callbackFuncName] = (errno, stdout, stderr) => {
            delete window[callbackFuncName];
            resolve({ errno, stdout: stdout || "", stderr: stderr || "" });
        };

        try {
            window.ksu.exec(command, "{}", callbackFuncName);
        } catch (error) {
            delete window[callbackFuncName];
            reject(error);
        }
    });
}

// --- Global Variables and DOM Elements ---
const MODULE_BIN_PATH = '/data/adb/modules/mtk_idle_charging_magisk/system/bin/';
const MODULE_ROOT_PATH = "/data/adb/modules/mtk_idle_charging_magisk/webroot/";
const LOG_FILE_PATH = "/data/local/tmp/mtk_idle_charging_webui.log"; // This is for download, not for internal auto-save
const INTERNAL_LOG_CACHE_PATH = "/data/adb/modules/mtk_idle_charging_magisk/cache/webui_log.json";

// --- Audio Resampler Quality (af.resampler.quality, AOSP AudioResampler) ---
const AUDIO_RESAMPLER_PROP = "af.resampler.quality";
const LAST_APPLIED_RESAMPLER_CONFIG_PATH = "/data/adb/modules/mtk_idle_charging_magisk/cache/last_applied_resampler_config.txt";
const RESAMPLER_QUALITY_LABELS = {
    '0': 'Mode Harian (Default)',
    '1': 'Low',
    '2': 'Medium',
    '3': 'High',
    '4': 'Mode Game (Very High)'
};

const bypassStatusElem = document.getElementById('bypassStatus');
const batteryIconElem = document.getElementById('batteryIcon');
const batteryFillElem = batteryIconElem ? batteryIconElem.querySelector('.battery-fill') : null;
const batteryOutlineElem = batteryIconElem ? batteryIconElem.querySelector('.battery-outline') : null;
const batteryTerminalElem = batteryIconElem ? batteryIconElem.querySelector('.battery-terminal') : null;

const batteryLevelElem = document.getElementById('batteryLevel');
const batteryHealthElem = document.getElementById('batteryHealth');
const chargeFullElem = document.getElementById('chargeFull');
const cycleCountElem = document.getElementById('cycleCount');
const voltageNowElem = document.getElementById('voltageNow');
const currentNowElem = document.getElementById('currentNow');
const healthScoreElem = document.getElementById('healthScore');
const healthMessageElem = document.getElementById('healthMessage');
const outputLogElem = document.getElementById('outputLog'); // UI log display

const phoneTempElem = document.getElementById('phoneTemp');
const cpuFreqElem = document.getElementById('cpuFreq');
const ufsHealthElem = document.getElementById('ufsHealth');

const appSelectElem = document.getElementById('appSelect');
const niceSelectElem = document.getElementById('niceSelect');
const applyPriorityBtn = document.getElementById('applyPriorityBtn');
const refreshAppsBtn = document.getElementById('refreshAppsBtn');
const currentAppNiceElem = document.getElementById('currentAppNice');

const editGamesBtn = document.getElementById('editGamesBtn');
const editGamesModal = document.getElementById('editGamesModal');
const closeEditGamesModal = editGamesModal ? editGamesModal.querySelector('.close-button') : null;
const gamesListEditor = document.getElementById('gamesListEditor');
const newGameNameInput = document.getElementById('newGameName');
const newGamePackageInput = document.getElementById('newGamePackage');
const addGameBtn = document.getElementById('addGameBtn');
const cancelEditGamesBtn = document.getElementById('cancelEditGamesBtn');
const deleteSelectedGamesBtn = document.getElementById('deleteSelectedGamesBtn');


const enableBtn = document.getElementById('enableBtn');
const disableBtn = document.getElementById('disableBtn');
const saveLogBtn = document.getElementById('saveLogBtn');
const refreshBatteryInfo = document.getElementById('refreshBatteryInfo');
const calibrateBatteryBtn = document.getElementById('calibrateBatteryBtn'); // Calibrate Battery Button

const currentResamplerQualityElem = document.getElementById('currentResamplerQuality');
const resamplerQualitySelect = document.getElementById('resamplerQualitySelect');

const terminalOutputElem = document.getElementById('terminalOutput');
const terminalCommandInput = document.getElementById('terminalCommandInput');
const executeCommandBtn = document.getElementById('executeCommandBtn');

// New: Internal log array
let internalLogs = [];
let logSaveTimeout = null;
const LOG_SAVE_DELAY = 1000; // Save logs after 1 second of inactivity

let currentGamesList = [];
let batteryAppPicker = null;

// --- NEW: Function to save internal logs to file ---
async function saveInternalLogs() {
    clearTimeout(logSaveTimeout); // Clear any pending save
    logSaveTimeout = setTimeout(async () => {
        try {
            const jsonContent = JSON.stringify(internalLogs, null, 2);
            const tempFilePath = `/data/local/tmp/webui_log_temp_${Date.now()}.json`;

            const writeTempCommand = `printf %s '${jsonContent.replace(/'/g, "'\\''")}' > "${tempFilePath}"`;
            const resultTempWrite = await exec(writeTempCommand);

            if (resultTempWrite.errno !== 0) {
                console.error(`[INTERNAL LOG SAVE ERROR] Failed to write temp log file: ${resultTempWrite.stderr || resultTempWrite.errno}`);
                // Don't appendLog here to avoid infinite loop
                return;
            }

            const moveCommand = `mv -f "${tempFilePath}" "${INTERNAL_LOG_CACHE_PATH}" && chmod 666 "${INTERNAL_LOG_CACHE_PATH}"`;
            const resultMove = await exec(moveCommand);

            if (resultMove.errno !== 0) {
                console.error(`[INTERNAL LOG SAVE ERROR] Failed to move log file: ${resultMove.stderr || resultMove.errno}`);
                // Don't appendLog here
                return;
            }
            console.log(`[INTERNAL LOG SAVE] Logs successfully auto-saved to ${INTERNAL_LOG_CACHE_PATH}`);
        } catch (error) {
            console.error(`[INTERNAL LOG SAVE ERROR] Critical error during auto-save: ${error.message}`);
            // Don't appendLog here
        }
    }, LOG_SAVE_DELAY);
}

// --- NEW: Helper for logging to internal array ---
function addInternalLogEntry(level, message) {
    const timestamp = new Date().toISOString();
    internalLogs.push({ timestamp, level, message });
    // Keep log array from growing indefinitely (e.g., max 500 entries)
    if (internalLogs.length > 500) {
        internalLogs = internalLogs.slice(-500);
    }
    saveInternalLogs(); // Trigger auto-save
}

function logInfo(message) { addInternalLogEntry('info', message); }
function logWarning(message) { addInternalLogEntry('warning', message); }
function logError(message) { addInternalLogEntry('error', message); }


// --- Modified: Fungsi Logging ke UI dan Konsol (now calls internal log) ---
function appendLog(message, type = 'info') {
    const logEntry = document.createElement('p');
    logEntry.classList.add('log-entry');

    if (type === 'error') {
        logEntry.classList.add('error');
        console.error(`[UI LOG] ${message}`);
        logError(message); // Also log to internal array
    } else if (type === 'warning') {
        logEntry.classList.add('warning');
        console.warn(`[UI LOG] ${message}`);
        logWarning(message); // Also log to internal array
    } else {
        console.log(`[UI LOG] ${message}`);
        logInfo(message); // Also log to internal array
    }

    logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    if (outputLogElem) {
        outputLogElem.appendChild(logEntry);
        outputLogElem.scrollTop = outputLogElem.scrollHeight;
    }
}

// --- Function to update battery SVG icon (No changes needed here) ---
function updateBatteryIcon(status, level = 0) {
    if (!batteryFillElem || !batteryOutlineElem || !batteryTerminalElem) {
        return;
    }

    let fillColor, outlineColor, terminalColor;

    if (status === 'enabled') {
        fillColor = 'var(--ios-blue)';
        outlineColor = 'var(--ios-blue)';
        terminalColor = 'var(--ios-blue)';
    } else if (status === 'disabled') {
        fillColor = 'var(--ios-red)';
        outlineColor = 'var(--ios-red)';
        terminalColor = 'var(--ios-red)';
    } else if (status === 'loading') {
        fillColor = 'var(--ios-gray)';
        outlineColor = 'var(--ios-gray)';
        terminalColor = 'var(--ios-gray)';
    } else if (status === 'error') {
        fillColor = 'var(--ios-red)';
        outlineColor = 'var(--ios-red)';
        terminalColor = 'var(--ios-red)';
    } else {
        fillColor = 'var(--ios-gray)';
        outlineColor = 'var(--ios-gray)';
        terminalColor = 'var(--ios-gray)';
    }

    batteryFillElem.style.fill = fillColor;
    batteryOutlineElem.style.stroke = outlineColor;
    batteryTerminalElem.style.fill = terminalColor;

    if (status === 'enabled') {
        batteryFillElem.setAttribute('height', 10);
        batteryFillElem.setAttribute('y', 7);
    } else {
        batteryFillElem.setAttribute('height', 0);
        batteryFillElem.setAttribute('y', 17);
    }
}

// Function to load and display game list in modal
async function loadGamesForEdit() {
    appendLog("Memuat daftar game untuk diedit...");
    if (!gamesListEditor) {
        appendLog("Error: gamesListEditor element not found. Cannot load games for edit.", 'error');
        return;
    }
    try {
        const gamesJsonPath = MODULE_ROOT_PATH + 'games.json';
        const readResult = await exec(`cat "${gamesJsonPath}"`);

        if (readResult.errno !== 0) {
            if (readResult.stderr.includes('No such file or directory') || readResult.stdout.trim() === '') {
                currentGamesList = [];
                appendLog("games.json tidak ditemukan atau kosong, membuat daftar kosong.", 'warning');
            } else {
                throw new Error(`Gagal membaca games.json: ${readResult.stderr}`);
            }
        } else {
            try {
                currentGamesList = JSON.parse(readResult.stdout.trim());
                if (!Array.isArray(currentGamesList)) {
                    throw new Error("Konten games.json bukan array yang valid.");
                }
            } catch (e) {
                appendLog(`Gagal memparsing games.json: ${e.message}. Menggunakan daftar kosong.`, 'error');
                currentGamesList = [];
            }
        }
        renderGamesListEditor();
    } catch (error) {
        appendLog(`Error saat memuat games.json untuk diedit: ${error.message}`, 'error');
        alert(`Error: ${error.message}\nGagal memuat daftar game untuk diedit.`);
        currentGamesList = [];
        renderGamesListEditor();
    }
}

// Function to render (display) game list in modal editor
function renderGamesListEditor() {
    if (!gamesListEditor) {
        appendLog("Error: gamesListEditor element not found. Cannot render games list.", 'error');
        return;
    }
    appendLog("Rendering games list editor...");
    gamesListEditor.innerHTML = ''; // Clear all old entries

    if (currentGamesList.length === 0) {
        gamesListEditor.innerHTML = '<p style="text-align: center; color: var(--ios-gray);">Tidak ada game dalam daftar.</p>';
        appendLog("No games in list, showing empty message.");
        return;
    }
    currentGamesList.forEach((game, index) => {
        const gameEntryDiv = document.createElement('div');
        gameEntryDiv.classList.add('game-entry');
        // Add numbering and save package name in data-package for accurate deletion
        gameEntryDiv.innerHTML = `
            <input type="checkbox" class="game-checkbox" data-index="${index}" data-package="${escapeHtml(game.packageName)}">
            <span class="game-number">${index + 1}.</span>
            <p><strong>Nama:</strong> ${escapeHtml(game.name)}</p>
            <p><strong>Package:</strong> ${escapeHtml(game.packageName)}</p>
        `;
        gamesListEditor.appendChild(gameEntryDiv);
        appendLog(`Added game entry to UI: ${index + 1}. ${game.name} (${game.packageName}) at index ${index}`);
    });

    appendLog("Rendered games list with checkboxes, numbers, and package names.");
}

// Function to add new game
async function addGameEntry() {
    if (!newGameNameInput || !newGamePackageInput) {
        appendLog("Error: newGameNameInput or newGamePackageInput not found. Cannot add game.", 'error');
        return;
    }
    const name = newGameNameInput.value.trim();
    const packageName = newGamePackageInput.value.trim();

    if (!name || !packageName) {
        alert("Nama Game dan Package Name tidak boleh kosong.");
        appendLog("Nama Game atau Package Name kosong saat mencoba menambahkan game.", 'warning');
        return;
    }

    if (currentGamesList.some(game => game.packageName === packageName)) {
        alert(`Package Name '${packageName}' sudah ada dalam daftar.`);
        appendLog(`Package Name '${packageName}' sudah ada dalam daftar. Tidak menambahkan.`);
        return;
    }

    currentGamesList.push({ name: name, packageName: packageName });
    appendLog(`Menambahkan game: ${name} (${packageName}) ke array.`);
    renderGamesListEditor();
    newGameNameInput.value = '';
    newGamePackageInput.value = '';

    await saveGamesList(); // Auto-save after adding
}

// Function to delete selected games via checkbox
async function deleteSelectedGames() {
    appendLog("Fungsi deleteSelectedGames() dipanggil.");
    if (!gamesListEditor) {
        appendLog("Error: gamesListEditor element not found. Cannot delete selected games.", 'error');
        return;
    }

    const checkboxes = gamesListEditor.querySelectorAll('.game-checkbox:checked');
    if (checkboxes.length === 0) {
        alert("Tidak ada game yang dipilih untuk dihapus.");
        appendLog("Tidak ada game yang dipilih untuk dihapus.", 'warning');
        return;
    }

    const packagesToDelete = Array.from(checkboxes)
        .map(cb => cb.dataset.package) // Ensure this reads data-package
        .filter(pkg => typeof pkg === 'string' && pkg.length > 0);

    appendLog(`Package names yang akan dihapus: ${packagesToDelete.join(', ')}`, 'info');

    // Filter currentGamesList, keeping only games NOT in packagesToDelete
    const initialCount = currentGamesList.length;
    currentGamesList = currentGamesList.filter(game => !packagesToDelete.includes(game.packageName));
    const deletedCount = initialCount - currentGamesList.length;

    appendLog(`Berhasil menghapus ${deletedCount} game yang dipilih secara logis dari array.`);
    renderGamesListEditor(); // Re-render the list after deletion

    await saveGamesList(); // Auto-save after deleting
}


// Function to save modified game list to games.json
async function saveGamesList() {
    appendLog("Menyimpan perubahan ke games.json...");
    try {
        const gamesJsonPath = MODULE_ROOT_PATH + 'games.json';
        const jsonContent = JSON.stringify(currentGamesList, null, 2);

        const tempFilePath = `/data/local/tmp/games_temp_${Date.now()}.json`;

        // Command to create temporary file with JSON content
        // Using printf %s and escaping single quotes
        const writeTempCommand = `printf %s '${jsonContent.replace(/'/g, "'\\''")}' > "${tempFilePath}"`;
        const resultTempWrite = await exec(writeTempCommand);

        if (resultTempWrite.errno !== 0) {
            throw new Error(`Gagal menulis file sementara games.json. Stderr: ${resultTempWrite.stderr || resultTempWrite.errno}`);
        }
        appendLog(`File sementara berhasil ditulis ke ${tempFilePath}.`);
        appendLog(`Konten yang ditulis (sample, max 100 chars): ${jsonContent.substring(0, Math.min(jsonContent.length, 100))}...`);


        // Move temporary file to games.json location
        const moveCommand = `mv -f "${tempFilePath}" "${gamesJsonPath}" && chmod 644 "${gamesJsonPath}"`;
        const resultMove = await exec(moveCommand);

        if (resultMove.errno !== 0) {
            throw new Error(`Gagal memindahkan file games.json dari ${tempFilePath} ke ${gamesJsonPath}. Stderr: ${resultMove.stderr || resultMove.errno}`);
        }
        appendLog("Perubahan games.json berhasil disimpan!", 'info');

    } catch (error) {
        appendLog(`Error saat menyimpan games.json: ${error.message}`, 'error');
        alert(`Gagal menyimpan daftar game: ${error.message}\nSilakan periksa log untuk detail lebih lanjut.`);
    }
}

// Helper function to escape HTML (for XSS security)
function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

// --- Modified: listRunningApps() function (retrieves from games.json) ---
async function listRunningApps() {
    if (!appSelectElem) return;
    const last = appSelectElem.selectedOptions[0]?.dataset.package || '';
    const placeholder = document.createElement('option');placeholder.value='';placeholder.textContent='Memuat aplikasi terpasang...';
    appSelectElem.replaceChildren(placeholder);
    batteryAppPicker?.refresh();
    refreshAppsBtn.disabled=true;
    try {
        const {apps,source,verified}=await ZenkuApps.catalog({exec,refresh:true});
        if (!apps.length) throw new Error('Tidak ditemukan aplikasi; cek akses PackageManager/KernelSU.');
        // Process snapshot: use the real process name, NEVER a substring from ps args.
        let snapshot = await exec('ps -A -o PID,ARGS 2>/dev/null');
        if (snapshot.errno !== 0 || !snapshot.stdout.trim()) snapshot=await exec('ps -A -o PID,NAME 2>/dev/null');
        if (snapshot.errno !== 0) throw new Error('Gagal mengambil daftar proses aktif: '+snapshot.stderr);
        const processMap=new Map();
        for(const line of snapshot.stdout.split(/\r?\n/)) {
            const m=line.trim().match(/^(\d+)\s+(\S+)/);
            if(!m)continue;
            const pid=Number(m[1]),name=m[2];
            if(!Number.isSafeInteger(pid)||pid<=0)continue;
            // All applications are matched by exact package/process identity.
            if(!processMap.has(name))processMap.set(name, pid);
        }
        const running = new Map();
        apps.forEach(app=>{
            let pid=processMap.get(app.packageName);
            if(!pid){
                for(const [name,processPid] of processMap){
                    if(name.startsWith(app.packageName+':')){pid=processPid;break;}
                }
            }
            if(pid)running.set(app.packageName,pid);
        });
        const all=apps.slice().sort((a,b)=>Number(running.has(b.packageName))-Number(running.has(a.packageName)) || a.name.localeCompare(b.name,'id'));
        const first=document.createElement('option');first.value='';first.textContent='-- Pilih aplikasi --';
        appSelectElem.replaceChildren(first);
        for(const app of all){
            const pid=running.get(app.packageName),option=document.createElement('option');
            option.value=pid?String(pid):'inactive:'+app.packageName;
            option.textContent=`${app.name} (${app.packageName})${pid?' · PID '+pid:' · tidak berjalan'}`;
            option.dataset.package=app.packageName;
            option.dataset.label=app.name;
            option.dataset.running=pid?'1':'0';
            option.disabled=!pid;
            appSelectElem.appendChild(option);
        }
        const restore=all.find(item=>item.packageName===last && running.has(last));
        if(restore)appSelectElem.value=String(running.get(last));
        batteryAppPicker?.setHint(`${apps.length} aplikasi · ${running.size} aktif · sumber: ${source}${verified?'':' (cadangan)'}`);
        batteryAppPicker?.refresh();
        appSelectElem.dispatchEvent(new Event('change',{bubbles:true}));
        appendLog(`App picker: ${apps.length} aplikasi, ${running.size} proses aktif, sumber ${source}.`);
    } catch(error) {
        appendLog(`Gagal memperbarui picker aplikasi: ${error.message}`,'error');
        const opt=document.createElement('option');opt.value='';opt.textContent='Daftar aplikasi gagal dimuat';
        appSelectElem.replaceChildren(opt);
        batteryAppPicker?.setHint('Gagal memuat aplikasi. Tekan Refresh Apps.');
        batteryAppPicker?.refresh();
    } finally {refreshAppsBtn.disabled=false;}
}

// --- Function to populate Nice Priority options (No changes needed here) ---
function populateNiceValues() {
    if (!niceSelectElem) {
        appendLog("Error: niceSelectElem not found when trying to populate nice values.", 'error');
        return;
    }
    niceSelectElem.innerHTML = '';
    for (let i = -20; i <= 19; i++) {
        const option = document.createElement('option');
        option.value = i;
        let description = '';
        if (i < 0) {
            description = `(Prioritas Lebih Tinggi, ${Math.abs(i)} lebih "nice" dari 0)`;
        } else if (i === 0) {
            description = '(Default, Prioritas Normal)';
        } else {
            description = `(Prioritas Lebih Rendah, ${i} kurang "nice" dari 0)`;
        }
        option.textContent = `${i} ${description}`;
        niceSelectElem.appendChild(option);
    }
    niceSelectElem.value = 0; // Set default nice value to 0
    appendLog("Nice values dropdown populated.");
}


// --- Function to Set Nice Priority (Final Version) ---
async function applyPriority() {
    if (!appSelectElem || !niceSelectElem || !currentAppNiceElem) {
        appendLog("Error: appSelectElem, niceSelectElem, or currentAppNiceElem not found when applying priority.", 'error');
        return;
    }
    const selectedPid = appSelectElem.value;
    const targetNice = parseInt(niceSelectElem.value); // Nilai nice yang diinginkan pengguna

    // Validasi input
    if (!/^\d+$/.test(selectedPid)) {
        alert("Pilih aplikasi yang sedang berjalan terlebih dahulu.");
        return;
    }
    if (isNaN(targetNice)) {
        alert("Pilih nilai prioritas yang valid.");
        return;
    }

    // Guard against an exited/reused PID: verify the selected package is still the process.
    const selectedPackage=appSelectElem.selectedOptions[0]?.dataset.package || '';
    if(!ZenkuApps.safePackage(selectedPackage)){alert('Package tidak valid.');return;}
    const verifyPid=await exec(`tr '\\000' '\\n' < /proc/${selectedPid}/cmdline 2>/dev/null | head -n 1`);
    const processName=(verifyPid.stdout||'').trim();
    if(verifyPid.errno!==0 || (processName!==selectedPackage && !processName.startsWith(selectedPackage+':'))){
        alert('Proses aplikasi sudah berubah atau berhenti. Tekan Refresh Apps.');return;
    }
    // Dapatkan nilai nice saat ini dari UI. Jika tidak valid, coba baca ulang dari sistem.
    let currentNice = parseInt(currentAppNiceElem.textContent);
    if (isNaN(currentNice) || currentAppNiceElem.textContent === 'N/A' || currentAppNiceElem.textContent.includes('Error')) {
        appendLog("Mencoba membaca nilai nice saat ini sebelum menerapkan perubahan.", 'info');
        await updateCurrentAppNice(); // Memanggil fungsi untuk mendapatkan nilai terkini
        currentNice = parseInt(currentAppNiceElem.textContent);
        if (isNaN(currentNice)) {
            appendLog("Gagal mendapatkan nilai nice saat ini. Tidak bisa melanjutkan.", 'error');
            alert("Gagal mendapatkan prioritas aplikasi saat ini. Silakan coba lagi.");
            return;
        }
    }

    // Jika nilai target sama dengan nilai saat ini, tidak perlu melakukan apa-apa.
    if (currentNice === targetNice) {
        appendLog(`Prioritas nice untuk PID ${selectedPid} sudah ${targetNice}. Tidak ada perubahan diperlukan.`, 'info');
        return;
    }

    // --- Kunci Solusinya: Hitung selisih (delta) antara nilai target dan nilai saat ini ---
    const niceDelta = targetNice - currentNice;

    appendLog(`Mengatur prioritas nice dari ${currentNice} menuju ${targetNice} untuk PID ${selectedPid}...`);
    appendLog(`Mengirim selisih (delta) nice: ${niceDelta}`, 'info');

    try {
        // Jalankan perintah renice dengan delta yang sudah dihitung
        const command = `renice -n ${niceDelta} -p ${selectedPid}`;
        const result = await exec(command);

        if (result.errno !== 0) {
            appendLog(`Perintah renice gagal dengan kode ${result.errno}. Stderr: "${result.stderr.trim()}"`, 'error');
            throw new Error(`Perintah renice gagal dengan kode ${result.errno}. Stderr: ${result.stderr.trim()}`);
        } else if (result.stderr.trim() !== '') {
            appendLog(`Peringatan/Info dari renice: "${result.stderr.trim()}"`, 'warning');
        }

        appendLog(`Perintah renice dengan delta ${niceDelta} berhasil dijalankan.`, 'info');

        // Perbarui UI dan verifikasi hasil aktual
        await updateCurrentAppNice();
        const actualNiceAfterCommand = parseInt(currentAppNiceElem.textContent);

        if (actualNiceAfterCommand === targetNice) {
            appendLog(`Prioritas nice untuk PID ${selectedPid} berhasil diatur ke ${targetNice}.`, 'info');
        } else {
            // Ini akan muncul jika sistem menerapkan delta, tetapi ada batasan yang membuat nilai akhir tidak persis target
            appendLog(`Peringatan: Prioritas nice untuk PID ${selectedPid} diatur ke ${actualNiceAfterCommand}, bukan ${targetNice}. Sistem mungkin membatasi nilai yang diizinkan meskipun delta diterapkan.`, 'warning');
            alert(`Peringatan: Prioritas nice diatur ke ${actualNiceAfterCommand}, bukan ${targetNice}. Sistem mungkin membatasi nilai yang diizinkan.`);
        }

    } catch (error) {
        appendLog(`Gagal menerapkan prioritas: ${error.message}`, 'error');
        alert(`Error: ${error.message}`);
    }
}

// --- Function to Get Current Nice Priority of Selected App (No changes needed here) ---
async function updateCurrentAppNice() {
    if (!appSelectElem || !currentAppNiceElem) {
        appendLog("Error: appSelectElem or currentAppNiceElem not found when updating current nice value.", 'error');
        return;
    }
    const selectedPid = appSelectElem.value;
    if (!selectedPid) {
        currentAppNiceElem.textContent = 'N/A';
        currentAppNiceElem.className = 'info-value';
        return;
    }

    try {
        const result = await exec(`cat /proc/${selectedPid}/stat`);
        if (result.errno !== 0) {
            throw new Error(`Failed to read stat file for PID ${selectedPid}`);
        }
        const statParts = result.stdout.trim().split(' ');
        if (statParts.length > 18) {
            const niceValue = parseInt(statParts[18]);
            currentAppNiceElem.textContent = niceValue;
            currentAppNiceElem.className = 'info-value';
            currentAppNiceElem.classList.remove('good', 'poor', 'moderate');
            if (niceValue < 0) {
                currentAppNiceElem.classList.add('good');
            } else if (niceValue > 0) {
                currentAppNiceElem.classList.add('poor');
            } else {
                currentAppNiceElem.classList.add('moderate');
            }
            appendLog(`Updated current nice for PID ${selectedPid}: ${niceValue}`);
        } else {
            currentAppNiceElem.textContent = 'Tidak ditemukan (PID mungkin sudah mati atau format stat berbeda)';
            currentAppNiceElem.className = 'info-value error';
            appendLog(`Failed to get nice value from stat for PID ${selectedPid}: Invalid stat format.`, 'warning');
        }
    } catch (error) {
        currentAppNiceElem.textContent = `Error: ${error.message}`;
        currentAppNiceElem.className = 'info-value error';
        appendLog(`Error getting current nice value for PID ${selectedPid}: ${error.message}`, 'error');
    }
}

// --- Function to parse and display all info ---
async function updateAllInfo() {
    appendLog("Updating battery, phone temperature, CPU frequency, and UFS health info...");
    updateBatteryIcon('loading');

    const updateUIField = (elem, value, defaultValue = 'N/A') => {
        if (elem) elem.textContent = value !== "Unknown" ? value : defaultValue;
    };

    const updateUIFieldWithUnit = (elem, value, unit, defaultValue = 'N/A') => {
        if (elem) elem.textContent = value !== "Unknown" ? `${value}${unit}` : defaultValue;
    };

    if (bypassStatusElem) bypassStatusElem.textContent = 'Loading...';
    if (batteryLevelElem) batteryLevelElem.textContent = 'Loading...';
    if (batteryHealthElem) batteryHealthElem.textContent = 'Loading...';
    if (chargeFullElem) chargeFullElem.textContent = 'Loading...';
    if (cycleCountElem) cycleCountElem.textContent = 'Loading...';
    if (voltageNowElem) voltageNowElem.textContent = 'Loading...';
    if (currentNowElem) currentNowElem.textContent = 'Loading...';
    if (healthScoreElem) healthScoreElem.textContent = 'Loading...';
    if (healthMessageElem) healthMessageElem.textContent = 'Loading...';
    if (phoneTempElem) phoneTempElem.textContent = 'Loading...';
    if (cpuFreqElem) cpuFreqElem.textContent = 'Loading...';
    if (ufsHealthElem) ufsHealthElem.textContent = 'Loading...';

    try {
        const batteryResult = await exec(`${MODULE_BIN_PATH}get_battery_info.sh`);
        if (batteryResult.errno !== 0) {
            throw new Error(`Battery info script failed with exit code ${batteryResult.errno}. Stderr: ${batteryResult.stderr}`);
        }

        const rawBatteryOutput = batteryResult.stdout.trim();
        let batteryInfo;
        try {
            batteryInfo = JSON.parse(rawBatteryOutput);
        } catch (e) {
            throw new Error(`Failed to parse battery info JSON: ${e.message}. Raw: "${rawBatteryOutput}"`);
        }

        const currentBypassStatus = batteryInfo.idle_charging_status;
        if (bypassStatusElem) {
            if (currentBypassStatus === 'enabled') {
                bypassStatusElem.textContent = 'ENABLED (Idle Charging)';
                bypassStatusElem.className = 'status-text enabled';
                updateBatteryIcon('enabled', parseInt(batteryInfo.capacity));
            } else if (currentBypassStatus === 'disabled') {
                bypassStatusElem.textContent = 'DISABLED (Normal Charging)';
                bypassStatusElem.className = 'status-text disabled';
                updateBatteryIcon('disabled', parseInt(batteryInfo.capacity));
            } else {
                bypassStatusElem.textContent = 'Unknown / Failed to read bypass status';
                bypassStatusElem.className = 'status-text error';
                updateBatteryIcon('error');
                appendLog("Could not read bypass status.", 'error');
            }
        }

        updateUIFieldWithUnit(batteryLevelElem, batteryInfo.capacity, '%');
        updateUIField(batteryHealthElem, batteryInfo.health.replace(/_/g, ' '));

        let chargeFullmAh = "N/A";
        if (batteryInfo.charge_full !== "Unknown" && parseInt(batteryInfo.charge_full) > 0) {
            chargeFullmAh = `${(parseInt(batteryInfo.charge_full) / 1000).toFixed(0)}`;
        }
        updateUIFieldWithUnit(chargeFullElem, chargeFullmAh, ' mAh');
        updateUIField(cycleCountElem, batteryInfo.cycle_count);

        let voltageVolts = "N/A";
        if (batteryInfo.voltage_now !== "Unknown" && parseInt(batteryInfo.voltage_now) > 0) {
            voltageVolts = `${(parseInt(batteryInfo.voltage_now) / 1000000).toFixed(3)}`;
        }
        updateUIFieldWithUnit(voltageNowElem, voltageVolts, ' V');

        let currentMa = "N/A";
        if (batteryInfo.current_now !== "Unknown" && parseInt(batteryInfo.current_now) !== 0) {
            currentMa = `${(parseInt(batteryInfo.current_now) / 1000).toFixed(0)}`;
        }        updateUIFieldWithUnit(currentNowElem, currentMa, 'mA');


        let healthScore = "N/A";
        let healthMsg = "";
        let scoreClass = "";

        if (batteryInfo.cycle_count !== "Unknown" && parseInt(batteryInfo.cycle_count) >= 0) {
            const cycles = parseInt(batteryInfo.cycle_count);
            let calculatedScore = 100 - (cycles * 20 / 860);
            if (calculatedScore < 0) calculatedScore = 0;
            if (calculatedScore > 100) calculatedScore = 100;
            healthScore = calculatedScore.toFixed(2);

            if (calculatedScore >= 90) {
                healthMsg = "Baterai sehat, bagus!";
                scoreClass = "good";
            } else if (calculatedScore >= 85) {
                healthMsg = "Baterai cukup baik.";
                scoreClass = "fair";
            } else {
                healthMsg = "Performa baterai menurun :(";
                scoreClass = "poor";
            }
        } else {
            healthMsg = "Info siklus tidak tersedia.";
            if (batteryInfo.charge_full !== "Unknown" && batteryInfo.charge_full_design !== "Unknown" &&
                parseInt(batteryInfo.charge_full_design) > 0) {
                const capacityPercent = Math.round((parseInt(batteryInfo.charge_full) * 100) / parseInt(batteryInfo.charge_full_design));
                if (capacityPercent >= 0) {
                    healthMsg += ` Kapasitas tersisa: ${capacityPercent}%`;
                } else {
                    healthMsg += " Gagal mendapatkan info kapasitas baterai.";
                }
            } else {
                healthMsg += " Gagal mendapatkan info kapasitas baterai.";
            }
            scoreClass = "fair";
        }
        if (healthScoreElem) {
            healthScoreElem.textContent = `${healthScore}%`;
            healthScoreElem.className = `score-text ${scoreClass}`;
        }
        if (healthMessageElem) healthMessageElem.textContent = healthMsg;

        const phoneTempResult = await exec(`${MODULE_BIN_PATH}get_phone_temp.sh`);
        if (phoneTempResult.errno !== 0) {
            appendLog(`Phone temperature script failed with exit code ${phoneTempResult.errno}. Stderr: ${phoneTempResult.stderr}`, 'error');
            updateUIField(phoneTempElem, 'Error');
        } else {
            const rawPhoneTempOutput = phoneTempResult.stdout.trim();
            try {
                const phoneTempInfo = JSON.parse(rawPhoneTempOutput);
                updateUIFieldWithUnit(phoneTempElem, phoneTempInfo.phone_temp, '°C');
            } catch (e) {
                appendLog(`Failed to parse phone temperature JSON: ${e.message}. Raw: "${rawPhoneTempOutput}"`, 'error');
                updateUIField(phoneTempElem, 'Error');
            }
        }

        const cpuFreqResult = await exec(`${MODULE_BIN_PATH}get_cpu_freq.sh`);
        if (cpuFreqResult.errno !== 0) {
            appendLog(`CPU Frequency info script failed with exit code ${cpuFreqResult.errno}. Stderr: ${cpuFreqResult.stderr}`, 'error');
            updateUIField(cpuFreqElem, 'Error');
        } else {
            const rawCpuFreqOutput = cpuFreqResult.stdout.trim();
            try {
                const cpuFreqInfo = JSON.parse(rawCpuFreqOutput);
                updateUIField(cpuFreqElem, cpuFreqInfo.cpu_freq);
            } catch (e) {
                appendLog(`Failed to parse CPU Frequency info JSON: ${e.message}. Raw: "${rawCpuFreqOutput}"`, 'error');
                updateUIField(cpuFreqElem, 'Error');
            }
        }

        const ufsResult = await exec(`${MODULE_BIN_PATH}get_ufs_health.sh`);
        if (ufsResult.errno !== 0) {
            appendLog(`UFS health script failed with exit code ${ufsResult.errno}. Stderr: ${ufsResult.stderr}`, 'error');
            if (ufsHealthElem) {
                ufsHealthElem.textContent = 'Error: Cannot read UFS status';
                ufsHealthElem.classList.add('error');
            }
        } else {
            const rawUfsOutput = ufsResult.stdout.trim();
            let ufsInfo;
            try {
                ufsInfo = JSON.parse(rawUfsOutput);
            } catch (e) {
                throw new Error(`Failed to parse UFS health JSON: ${e.message}. Raw: "${rawUfsOutput}"`);
            }

            let ufsStatusText = 'N/A';
            let ufsStatusCode = ufsInfo.ufs_health_code;

            if (ufsHealthElem) {
                ufsHealthElem.classList.remove('good', 'warning', 'error');

                switch (ufsStatusCode) {
                    case '0x00': ufsStatusText = 'New (0% Wear)'; ufsHealthElem.classList.add('good'); break;
                    case '0x01': ufsStatusText = '0%-10% Wear'; ufsHealthElem.classList.add('good'); break;
                    case '0x02': ufsStatusText = '10%-20% Wear'; ufsHealthElem.classList.add('good'); break;
                    case '0x03': ufsStatusText = '20%-30% Wear'; ufsHealthElem.classList.add('good'); break;
                    case '0x04': ufsStatusText = '30%-40% Wear'; ufsHealthElem.classList.add('warning'); break;
                    case '0x05': ufsStatusText = '40%-50% Wear'; ufsHealthElem.classList.add('warning'); break;
                    case '0x06': ufsStatusText = '50%-60% Wear'; ufsHealthElem.classList.add('warning'); break;
                    case '0x07': ufsStatusText = '60%-70% Wear (Consider replacement)'; ufsHealthElem.classList.add('error'); break;
                    case '0x08': ufsStatusText = '70%-80% Wear (High risk!)'; ufsHealthElem.classList.add('error'); break;
                    case '0x09': ufsStatusText = '80%-90% Wear (Critical!)'; ufsHealthElem.classList.add('error'); break;
                    case '0x0A': ufsStatusText = '90%-100% Wear (Imminent failure!)'; ufsHealthElem.classList.add('error'); break;
                    case '0x0B': ufsStatusText = 'DEAD / Mokad!'; ufsHealthElem.classList.add('error'); break;
                    default: ufsStatusText = `Unknown (${ufsStatusCode})`; ufsHealthElem.classList.add('warning'); break;
                }
                ufsHealthElem.textContent = ufsStatusText;
            }
        }

        appendLog("Battery, phone temperature, CPU frequency, and UFS health info updated successfully.");

    } catch (error) {
        appendLog(`Error updating all info: ${error.message}`, 'error');
        if (bypassStatusElem) {
            bypassStatusElem.textContent = 'Error: Failed to load status';
            bypassStatusElem.className = 'status-text error';
        }
        updateBatteryIcon('error');
        if (batteryLevelElem) batteryLevelElem.textContent = 'Error';
        if (batteryHealthElem) batteryHealthElem.textContent = 'Error';
        if (chargeFullElem) chargeFullElem.textContent = 'Error';
        if (cycleCountElem) cycleCountElem.textContent = 'Error';
        if (voltageNowElem) voltageNowElem.textContent = 'Error';
        if (currentNowElem) currentNowElem.textContent = 'Error';
        if (healthScoreElem) healthScoreElem.textContent = 'Error';
        if (phoneTempElem) phoneTempElem.textContent = 'Error';
        if (cpuFreqElem) cpuFreqElem.textContent = 'Error';
        if (ufsHealthElem) ufsHealthElem.textContent = 'Error';

        if (healthMessageElem) healthMessageElem.textContent = error.message.includes('/proc/mtk_battery_cmd/current_cmd not found') ? "Charging control file not found. Your device may not support this feature." : "An error occurred.";
    }
}

// --- Function to send bypass commands (No changes needed here) ---
// --- Audio Resampler Quality (af.resampler.quality) ---
/**
 * Reads the current af.resampler.quality value via getprop and renders
 * a human-readable label into #currentResamplerQuality.
 */
async function updateResamplerStatus() {
    if (!currentResamplerQualityElem) return;
    try {
        const result = await exec(`getprop ${AUDIO_RESAMPLER_PROP}`);
        const raw = (result.errno === 0) ? result.stdout.trim() : '';
        if (raw && RESAMPLER_QUALITY_LABELS[raw]) {
            currentResamplerQualityElem.textContent = `${RESAMPLER_QUALITY_LABELS[raw]} [${raw}]`;
        } else if (raw) {
            currentResamplerQualityElem.textContent = `Custom [${raw}]`;
        } else {
            currentResamplerQualityElem.textContent = 'Default (kosong / belum di-set)';
        }
        if (resamplerQualitySelect && raw && ['0','1','2','3','4'].includes(raw)) {
            resamplerQualitySelect.value = raw;
        }
    } catch (error) {
        currentResamplerQualityElem.textContent = 'N/A';
        console.error('[RESAMPLER] Gagal membaca af.resampler.quality:', error);
    }
}

/**
 * Sets af.resampler.quality to the given value (0-4), then restarts
 * audioserver so already-created AudioResampler instances pick up the
 * new value (AudioResampler::create() reads the property once, at
 * instance-creation time, not dynamically). Also caches the value so
 * service.sh can reapply it on boot, since this is a plain property
 * (not persist.*) and gets wiped every reboot.
 * @param {number} value - 0 (DEFAULT_QUALITY) .. 4 (VERY_HIGH_QUALITY)
 * @param {string} modeLabel - human label for log messages, e.g. "Mode Game"
 */
async function setResamplerQuality(value, modeLabel) {
    appendLog(`Mengubah Audio Resampler Quality ke ${modeLabel} (value ${value})...`);
    try {
        const setResult = await exec(`setprop ${AUDIO_RESAMPLER_PROP} ${value}`);
        if (setResult.errno !== 0) {
            throw new Error(`Gagal set property: ${setResult.stderr || 'errno ' + setResult.errno}`);
        }

        const killResult = await exec('pkill audioserver');
        if (killResult.errno !== 0) {
            // pkill balikin exit code non-zero kalau prosesnya gak ketemu -- itu bukan error fatal,
            // cuma berarti audioserver kebetulan lagi gak jalan. init akan otomatis restart dia.
            appendLog(`Catatan: pkill audioserver keluar dengan code ${killResult.errno} (biasanya aman, berarti prosesnya sempat tidak berjalan).`, 'warning');
        }

        const cacheResult = await exec(`echo "${value}" > "${LAST_APPLIED_RESAMPLER_CONFIG_PATH}"`);
        if (cacheResult.errno !== 0) {
            appendLog(`Peringatan: gagal menyimpan cache untuk reapply saat boot: ${cacheResult.stderr}`, 'warning');
        }

        appendLog(`Audio Resampler Quality berhasil diubah ke ${modeLabel} (value ${value}). Audioserver di-restart.`);
        await updateResamplerStatus();
    } catch (error) {
        appendLog(`Gagal mengubah Audio Resampler Quality: ${error.message}`, 'error');
        alert(`Error: ${error.message}`);
    }
}


async function sendCommand(command) {
    appendLog(`Sending command: ${command}`);
    try {
        const fullCommand = `${MODULE_BIN_PATH}set_idle_charging_status.sh "${command}"`;
        const result = await exec(fullCommand);

        if (result.errno !== 0) {
            throw new Error(`Shell command failed with exit code ${result.errno}. Stderr: ${result.stderr}`);
        }

        const stdout = result.stdout.trim();
        if (stdout.includes('SUCCESS:')) {
            appendLog('Command applied successfully!');
            await updateAllInfo();
        } else if (stdout.includes('ERROR:')) {
            throw new Error(stdout.replace('ERROR: ', ''));
        } else {
            throw new Error(`Unexpected script output: "${stdout}"`);
        }
    } catch (error) {
        appendLog(`Failed to apply command: ${error.message}`, 'error');
        alert(`Error: ${error.message}`);
    }
}

// --- FIXED: Function to execute battery calibration script ---
async function calibrateBattery() {
    appendLog("Memulai proses kalibrasi baterai...", 'info');
    appendLog("PENTING: Perangkat akan REBOOT setelah proses ini.", 'warning');
    appendLog("Syarat: baterai ≥95%, tegangan ≥4150mV, dan HP harus dalam keadaan Charging.", 'info');
    appendLog("Setelah reboot, gunakan baterai sampai 3–5%, lalu cas penuh tanpa interupsi untuk hasil optimal.", 'info');

    try {
        const calibrationScriptPath = `${MODULE_BIN_PATH}battery_calibrator.sh`;

        appendLog(`Mengeksekusi skrip kalibrasi: ${calibrationScriptPath}`, 'info');
        const result = await exec(`sh ${calibrationScriptPath}`);

        const shellStdout = result.stdout.trim();
        const shellStderr = result.stderr.trim();
        const shellErrno = result.errno;

        appendLog(
            `Output skrip kalibrasi baterai:\nSTDOUT:\n${shellStdout}\nSTDERR:\n${shellStderr}`,
            'info'
        );

        // --- Evaluasi hasil eksekusi ---
        if (shellErrno !== 0) {
            appendLog(`❌ Kalibrasi Baterai GAGAL dieksekusi (kode: ${shellErrno}).`, 'error');
            alert(`Kalibrasi Baterai GAGAL dieksekusi. Periksa log.`);
            return;
        }

        if (shellStdout.includes("⚠️ PERINGATAN: Syarat kalibrasi belum terpenuhi")) {
            appendLog("⚠️ Kalibrasi Baterai TIDAK dilanjutkan. Syarat belum terpenuhi.", 'warning');

            // --- Deteksi detail kenapa gagal (cek tanda ❌, bukan sekedar kata kunci) ---
            if (shellStdout.includes("❌ Persentase")) {
                appendLog("➡️ Persentase baterai masih <95%.", 'warning');
            }
            if (shellStdout.includes("❌ Tegangan")) {
                appendLog("➡️ Tegangan masih <4150mV.", 'warning');
            }
            if (shellStdout.includes("❌ HP tidak sedang di-charge")) {
                appendLog("➡️ HP belum dalam keadaan charging.", 'warning');
            }

            alert("Kalibrasi Baterai TIDAK dilanjutkan. Isi daya hingga semua syarat terpenuhi lalu coba lagi.");
            return;
        }

        if (shellStdout.includes("REBOOT_TRIGGER")) {
            appendLog("✅ Kalibrasi selesai. Perangkat akan reboot dalam 5 detik...", 'info');
            setTimeout(() => {
                exec("reboot").catch(err => {
                    appendLog(`⚠️ Gagal memicu reboot: ${err.message}`, 'error');
                });
            }, 5000);
            return;
        }

        // Default fallback
        appendLog("ℹ️ Kalibrasi selesai dengan status tidak jelas. Cek log manual.", 'warning');
        alert("Kalibrasi selesai dengan status tidak jelas. Periksa log.");

    } catch (error) {
        appendLog(`🔥 Error kritis: ${error.message}`, 'error');
        alert(`Error Kalibrasi: ${error.message}\nPastikan file battery_calibrator.sh ada & bisa dieksekusi di ${MODULE_BIN_PATH}`);
    }
}



// --- Function to save logs to file (Modified for large log handling) ---
async function saveLogToFile() {
    appendLog("Menyimpan log ke Downloads folder...", 'info');
    
    try {
        let logs = "";
        if (outputLogElem) {
            logs = Array.from(outputLogElem.children).map(p => p.textContent).join('\n');
        }

        const fileName = `mtk_log_${new Date().getTime()}.txt`;
        const filePath = `/sdcard/Download/${fileName}`;
        
        appendLog(`Mencoba menyimpan ke: ${filePath}`, 'info');

        // Method 1: Gunakan printf untuk handling yang lebih baik
        const sanitizedLogs = logs.replace(/'/g, "'\\''");
        const command = `su -c "printf '%s' '${sanitizedLogs}' > '${filePath}' && chmod 644 '${filePath}'"`;
        
        const result = await exec(command);
        
        if (result.errno === 0) {
            // Verifikasi file berhasil dibuat
            const verifyCommand = `su -c "ls -la '${filePath}'"`;
            const verifyResult = await exec(verifyCommand);
            
            if (verifyResult.errno === 0) {
                appendLog(`✅ Log berhasil disimpan di: ${filePath}`, 'info');
                alert(`✅ Log berhasil disimpan!\n\nLokasi: ${filePath}\n\nFile sudah tersimpan di folder Downloads perangkat Anda.`);
            } else {
                appendLog(`❌ File tidak ditemukan setelah penyimpanan`, 'error');
                alert(`❌ Gagal memverifikasi file. Coba buka folder Downloads secara manual.`);
            }
        } else {
            // Fallback: coba tanpa su -c (mungkin sudah running sebagai root)
            appendLog(`Coba method alternatif...`, 'info');
            const fallbackCommand = `printf '%s' '${sanitizedLogs}' > '${filePath}' && chmod 644 '${filePath}'`;
            const fallbackResult = await exec(fallbackCommand);
            
            if (fallbackResult.errno === 0) {
                appendLog(`✅ Log berhasil disimpan (method alternatif): ${filePath}`, 'info');
                alert(`✅ Log berhasil disimpan!\n\nLokasi: ${filePath}`);
            } else {
                throw new Error(`Method 1: ${result.stderr || result.errno}, Method 2: ${fallbackResult.stderr || fallbackResult.errno}`);
            }
        }
    } catch (error) {
        appendLog(`❌ Gagal menyimpan log: ${error.message}`, 'error');
        alert(`❌ Gagal menyimpan log: ${error.message}\n\nPastikan KernelSU memberikan permission root.`);
    }
}

// --- Function to Add Output to Terminal (No changes needed here) ---
function appendTerminalOutput(command, stdout, stderr, errno) {
    if (!terminalOutputElem) {
        console.error("Terminal output element not found.");
        return;
    }

    const commandLine = document.createElement('p');
    commandLine.classList.add('command-line');
    commandLine.textContent = `$ ${command}`;
    terminalOutputElem.appendChild(commandLine);

    if (stdout) {
        const stdoutPara = document.createElement('p');
        stdoutPara.classList.add('stdout');
        stdoutPara.textContent = stdout;
        terminalOutputElem.appendChild(stdoutPara);
        appendLog(`[Terminal - STDOUT] ${command}: ${stdout.trim()}`);
    }

    if (stderr) {
        const stderrPara = document.createElement('p');
        stderrPara.classList.add('stderr');
        stderrPara.textContent = stderr;
        terminalOutputElem.appendChild(stderrPara);
        appendLog(`[Terminal - STDERR] ${command}: ${stderr.trim()}`, 'error');
    }

    if (errno !== 0) {
        const errorLine = document.createElement('p');
        errorLine.classList.add('stderr');
        errorLine.textContent = `Exit Code: ${errno}`;
        terminalOutputElem.appendChild(errorLine);
        appendLog(`[Terminal - ERROR] Command "${command}" exited with code ${errno}`, 'error');
    }

    terminalOutputElem.scrollTop = terminalOutputElem.scrollHeight;
}

// --- Function to Execute Terminal Command (No changes needed here) ---
async function executeTerminalCommand() {
    if (!terminalCommandInput || !executeCommandBtn) {
        appendLog("Error: Terminal input or button element not found.", 'error');
        return;
    }

    const command = terminalCommandInput.value.trim();
    if (!command) {
        alert("Silakan masukkan perintah.");
        return;
    }

    terminalCommandInput.disabled = true;
    executeCommandBtn.disabled = true;
    executeCommandBtn.textContent = 'Menjalankan...';

    appendLog(`[Terminal] Menjalankan perintah: ${command}`);

    try {
        const result = await exec(command);
        appendTerminalOutput(command, result.stdout, result.stderr, result.errno);
    } catch (error) {
        const errorMessage = `Gagal menjalankan perintah: ${error.message}`;
        appendTerminalOutput(command, "", errorMessage, -1);
        appendLog(`[Terminal - CRITICAL ERROR] ${command}: ${errorMessage}`, 'error');
    } finally {
        terminalCommandInput.disabled = false;
        executeCommandBtn.disabled = false;
        executeCommandBtn.textContent = 'Jalankan';
        terminalCommandInput.value = '';
        terminalCommandInput.focus();
    }
}


// --- Inisialisasi DOM dan Event Listeners ---
document.addEventListener('DOMContentLoaded', async () => {
    // Pastikan semua ID elemen HTML yang kritikal ada
    const criticalElementIds = [
        'bypassStatus', 'outputLog', 'enableBtn', 'disableBtn', 'saveLogBtn', 'refreshBatteryInfo',
        'editGamesBtn', 'editGamesModal', 'gamesListEditor', 'newGameName', 'newGamePackage',
        'addGameBtn',
        'cancelEditGamesBtn', 'deleteSelectedGamesBtn',
        'appSelect', 'niceSelect', 'applyPriorityBtn', 'refreshAppsBtn', 'currentAppNice',
        'batteryLevel', 'batteryHealth', 'chargeFull', 'cycleCount', 'voltageNow', 'currentNow',
        'healthScore', 'healthMessage', 'phoneTemp', 'cpuFreq', 'ufsHealth',
        'terminalOutput', 'terminalCommandInput', 'executeCommandBtn',
        'batteryIcon',
        'calibrateBatteryBtn', // Added calibrateBatteryBtn to critical elements
        'currentResamplerQuality', 'resamplerQualitySelect'
    ];

    const missingElements = [];
    for (const id of criticalElementIds) {
        if (!document.getElementById(id)) {
            missingElements.push(id);
        }
    }

    if (missingElements.length > 0) {
        const errorMessage = `[CRITICAL ERROR] Some required DOM elements are missing. Please check your HTML IDs. Missing: ${missingElements.join(', ')}`;
        console.error(errorMessage);
        logError(errorMessage); // Log this critical error internally
        alert(`ERROR: ${errorMessage}\nFunctionality may be limited. Please ensure your HTML IDs match the JavaScript.`);
    }

    // NEW: Load existing internal logs on startup
    try {
        const readLogResult = await exec(`cat "${INTERNAL_LOG_CACHE_PATH}"`);
        if (readLogResult.errno === 0) {
            try {
                internalLogs = JSON.parse(readLogResult.stdout.trim());
                appendLog(`Loaded ${internalLogs.length} previous log entries from ${INTERNAL_LOG_CACHE_PATH}`);
                // Re-populate UI log from internalLogs (optional, for persistent UI log)
                internalLogs.forEach(entry => appendLog(entry.message, entry.level));
            } catch (e) {
                appendLog(`Failed to parse existing log.json: ${e.message}`, 'error');
                internalLogs = []; // Reset if parsing fails
            }
        } else {
            appendLog(`No existing log file found at ${INTERNAL_LOG_CACHE_PATH} or failed to read: ${readLogResult.stderr}`, 'warning');
            internalLogs = [];
        }
    } catch (e) {
        appendLog(`Error reading initial log file: ${e.message}`, 'error');
        internalLogs = [];
    }


    batteryAppPicker=ZenkuApps.enhanceSelect(appSelectElem,{
        title:'Prioritas Proses · Pilih Aplikasi',empty:'Pilih aplikasi yang sedang berjalan',
        secondary:'Membaca daftar aplikasi terpasang...'
    });
    populateNiceValues();

    if (enableBtn) enableBtn.addEventListener('click', () => sendCommand('0 1'));
    if (disableBtn) disableBtn.addEventListener('click', () => sendCommand('0 0'));
    if (saveLogBtn) saveLogBtn.addEventListener('click', saveLogToFile);
    if (refreshBatteryInfo) refreshBatteryInfo.addEventListener('click', updateAllInfo);
    // Event Listener for Calibrate Battery Button
    if (calibrateBatteryBtn) calibrateBatteryBtn.addEventListener('click', calibrateBattery);

    // Event Listener for Audio Resampler Quality dropdown (auto-apply on change, no button pair)
    if (resamplerQualitySelect) {
        resamplerQualitySelect.addEventListener('change', () => {
            const value = resamplerQualitySelect.value;
            setResamplerQuality(parseInt(value, 10), RESAMPLER_QUALITY_LABELS[value] || value);
        });
    }
    updateResamplerStatus();


    if (editGamesBtn) {
        editGamesBtn.addEventListener('click', async () => {
            appendLog("Edit Games button clicked. Opening modal...");
            await loadGamesForEdit();
            if (editGamesModal) {
                editGamesModal.style.display = 'flex';
                setTimeout(() => {
                    editGamesModal.classList.add('show');
                }, 10);
            }
        });
    }

    if (closeEditGamesModal) {
        closeEditGamesModal.addEventListener('click', () => {
            appendLog("Close modal button clicked.");
            listRunningApps(); // Update app list after modal closes
            if (editGamesModal) {
                editGamesModal.classList.remove('show');
                setTimeout(() => {
                    editGamesModal.style.display = 'none';
                }, 300);
            }
        });
    }

    if (cancelEditGamesBtn) {
        cancelEditGamesBtn.addEventListener('click', () => {
            appendLog("Cancel Edit Games button clicked.");
            listRunningApps(); // Update app list after modal closes
            if (editGamesModal) {
                editGamesModal.classList.remove('show');
                setTimeout(() => {
                    editGamesModal.style.display = 'none';
                }, 300);
            }
        });
    }

    if (addGameBtn) addGameBtn.addEventListener('click', addGameEntry);

    if (deleteSelectedGamesBtn) {
        appendLog("Event listener for deleteSelectedGamesBtn attached.");
        deleteSelectedGamesBtn.addEventListener('click', deleteSelectedGames);
    } else {
        appendLog("WARNING: deleteSelectedGamesBtn element not found. Deletion by checkbox will not work.", 'warning');
    }


    window.addEventListener('click', (event) => {
        if (editGamesModal && event.target === editGamesModal) {
            appendLog("Clicked outside modal. Closing modal.");
            listRunningApps(); // Update app list after modal closes
            editGamesModal.classList.remove('show');
            setTimeout(() => {
                editGamesModal.style.display = 'none';
            }, 300);
        }
    });

    if (appSelectElem) appSelectElem.addEventListener('change', updateCurrentAppNice);
    if (applyPriorityBtn) applyPriorityBtn.addEventListener('click', applyPriority);
    if (refreshAppsBtn) refreshAppsBtn.addEventListener('click', listRunningApps);

    if (executeCommandBtn) executeCommandBtn.addEventListener('click', executeTerminalCommand);
    if (terminalCommandInput) {
        terminalCommandInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                executeTerminalCommand();
            }
        });
    }

    // Initial data load and updates
    await updateAllInfo();
    await listRunningApps();

    // Set up periodic updates for live data (battery, temp, cpu, ufs)
    setInterval(async () => {
        try {
            const batteryResult = await exec(`${MODULE_BIN_PATH}get_battery_info.sh`);
            if (batteryResult.errno === 0) {
                const batteryInfo = JSON.parse(batteryResult.stdout.trim());
                let currentMa = "N/A";
                if (batteryInfo.current_now !== "Unknown" && parseInt(batteryInfo.current_now) !== 0) {
                    currentMa = `${(parseInt(batteryInfo.current_now) / 1000).toFixed(0)}`;
                }
                // Change ' ' to 'mA' here
                if (currentNowElem) currentNowElem.textContent = `${currentMa}mA`; // Directly append 'mA' for consistency
                if (batteryLevelElem) batteryLevelElem.textContent = batteryInfo.capacity !== "Unknown" ? `${batteryInfo.capacity}%` : 'N/A';
            } else {
                appendLog(`Error in interval (battery info): ${batteryResult.stderr}`, 'error');
                if (currentNowElem) currentNowElem.textContent = 'Error';
                if (batteryLevelElem) batteryLevelElem.textContent = 'Error';
            }

            const phoneTempResult = await exec(`${MODULE_BIN_PATH}get_phone_temp.sh`);
            if (phoneTempResult.errno === 0) {
                const phoneTempInfo = JSON.parse(phoneTempResult.stdout.trim());
                if (phoneTempElem) phoneTempElem.textContent = phoneTempInfo.phone_temp !== "Unknown" ? `${phoneTempInfo.phone_temp}°C` : 'N/A';
            } else {
                appendLog(`Error in interval (phone temp): ${phoneTempResult.stderr}`, 'error');
                if (phoneTempElem) phoneTempElem.textContent = 'Error';
            }

            const cpuFreqResult = await exec(`${MODULE_BIN_PATH}get_cpu_freq.sh`);
            if (cpuFreqResult.errno === 0) {
                const cpuFreqInfo = JSON.parse(cpuFreqResult.stdout.trim());
                if (cpuFreqElem) cpuFreqElem.textContent = cpuFreqInfo.cpu_freq !== "Unknown" ? cpuFreqInfo.cpu_freq : 'N/A';
            } else {
                appendLog(`Error in interval (cpu freq): ${cpuFreqResult.stderr}`, 'error');
                if (cpuFreqElem) cpuFreqElem.textContent = 'Error';
            }

            const ufsResult = await exec(`${MODULE_BIN_PATH}get_ufs_health.sh`);
            if (ufsResult.errno === 0) {
                const ufsInfo = JSON.parse(ufsResult.stdout.trim());
                let ufsStatusText = 'N/A';
                if (ufsHealthElem) {
                    ufsHealthElem.classList.remove('good', 'warning', 'error');

                    switch (ufsInfo.ufs_health_code) {
                        case '0x00': ufsStatusText = 'New (0% Wear)'; ufsHealthElem.classList.add('good'); break;
                        case '0x01': ufsStatusText = '0%-10% Wear'; ufsHealthElem.classList.add('good'); break;
                        case '0x02': ufsStatusText = '10%-20% Wear'; ufsHealthElem.classList.add('good'); break;
                        case '0x03': ufsStatusText = '20%-30% Wear'; ufsHealthElem.classList.add('good'); break;
                        case '0x04': ufsStatusText = '30%-40% Wear'; ufsHealthElem.classList.add('warning'); break;
                        case '0x05': ufsStatusText = '40%-50% Wear'; ufsHealthElem.classList.add('warning'); break;
                        case '0x06': ufsStatusText = '50%-60% Wear'; ufsHealthElem.classList.add('warning'); break;
                        case '0x07': ufsStatusText = '60%-70% Wear (Consider replacement)'; ufsHealthElem.classList.add('error'); break;
                        case '0x08': ufsStatusText = '70%-80% Wear (High risk!)'; ufsHealthElem.classList.add('error'); break;
                        case '0x09': ufsStatusText = '80%-90% Wear (Critical!)'; ufsHealthElem.classList.add('error'); break;
                        case '0x0A': ufsStatusText = '90%-100% Wear (Imminent failure!)'; ufsHealthElem.classList.add('error'); break;
                        case '0x0B': ufsStatusText = 'DEAD / Mokad!'; ufsHealthElem.classList.add('error'); break;
                        default: ufsStatusText = `Unknown (${ufsInfo.ufs_health_code})`; ufsHealthElem.classList.add('warning'); break;
                    }
                    ufsHealthElem.textContent = ufsStatusText;
                }
            } else {
                appendLog(`Error in interval (ufs health): ${ufsResult.stderr}`, 'error');
                if (ufsHealthElem) ufsHealthElem.textContent = 'Error';
            }

        } catch (error) {
            console.error(`Unhandled error in interval update: ${error.message}`);
            logError(`Unhandled error in interval update: ${error.message}`); // Log internal error
            if (currentNowElem) currentNowElem.textContent = 'Error';
            if (phoneTempElem) phoneTempElem.textContent = 'Error';
            if (cpuFreqElem) cpuFreqElem.textContent = 'Error';
            if (batteryLevelElem) batteryLevelElem.textContent = 'Error';
            if (ufsHealthElem) ufsHealthElem.textContent = 'Error';
        }
    }, 1000);
});