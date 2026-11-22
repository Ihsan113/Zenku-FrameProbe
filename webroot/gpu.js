// --- KSU API Function (from previous example, verified to be working) ---
function exec(command) {
    return new Promise((resolve, reject) => {
        if (typeof window.ksu === 'undefined' || typeof window.ksu.exec === 'undefined') {
            const apiError = new Error('KernelSU WebUI API (window.ksu.exec) not found. Please open this WebUI using the official KernelSU Manager app.');
            console.error('[KSU API ERROR] KernelSU API "ksu.exec" not available:', apiError);
            resolve({ code: 1, stdout: '', stderr: 'KernelSU API not available.' }); // Resolve with error code for graceful handling
            return;
        }

        const callbackFuncName = `exec_callback_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        
        window[callbackFuncName] = (errno, stdout, stderr) => {
            delete window[callbackFuncName];
            resolve({ code: errno, stdout: stdout || "", stderr: stderr || "" }); // Replace errno with code
        };

        try {
            window.ksu.exec(command, "{}", callbackFuncName);
        } catch (error) {
            delete window[callbackFuncName];
            reject(error);
        }
    });
}


// ====== FILESYSTEM PATH CONSTANTS ======
const GPU_OPP_TABLE_PATH = "/proc/gpufreqv2/gpu_working_opp_table";
const GPU_FIX_TARGET_OPP_INDEX_PATH = "/proc/gpufreqv2/fix_target_opp_index";
const GPU_FIX_FREQ_PATH = "/proc/gpufreqv2/fix_custom_freq_volt";
const GPU_STATUS_PATH = "/proc/gpufreqv2/gpufreq_status";

// --- Rendering Backend Constants ---
const HWUI_RENDERER_PROP = "debug.hwui.renderer";
const RENDERENGINE_BACKEND_PROP = "debug.renderengine.backend";

// --- Per-App ANGLE Override Constants ---
const ANGLE_PKGS_SETTING = "angle_gl_driver_selection_pkgs";
const ANGLE_VALUES_SETTING = "angle_gl_driver_selection_values";

// --- FPSGO Constants ---
const FPSGO_ENABLE_PATH = "/sys/kernel/fpsgo/common/fpsgo_enable";
const FSTB_SELF_CTRL_FPS_ENABLE_PATH = "/sys/kernel/fpsgo/fstb/fstb_self_ctrl_fps_enable";
const FSTB_TARGET_FPS_MARGIN_HIGH_FPS_PATH = "/sys/module/mtk_fpsgo/parameters/fstb_target_fps_margin_high_fps";
const FSTB_TARGET_FPS_MARGIN_LOW_FPS_PATH = "/sys/module/mtk_fpsgo/parameters/fstb_target_fps_margin_low_fps";
const FSTB_SET_RENDER_MAX_FPS_PATH = "/sys/kernel/fpsgo/fstb/set_render_max_fps";

// --- NEW VCore DVFS & GPU DVFS Constants ---
const HELIO_DVFS_FORCE_VCORE_DVFS_OPP_PATH = "/sys/kernel/helio-dvfsrc/dvfsrc_force_vcore_dvfs_opp";
const GED_GPU_DVFS_ENABLE_PATH = "/sys/module/ged/parameters/gpu_dvfs_enable";
// Jalur untuk membaca status VCore DVFS dari dump (sesuai permintaan)
const DVFSRC_DUMP_PATH = "/sys/kernel/helio-dvfsrc/dvfsrc_dump"; 

// ====== DVFSRC MEMORY TUNING CONSTANTS ======
const DVFSRC_GOVERNOR_PATH = "/sys/class/devfreq/mtk-dvfsrc-devfreq/governor";
const DVFSRC_MIN_FREQ_PATH = "/sys/class/devfreq/mtk-dvfsrc-devfreq/min_freq";
const DVFSRC_MAX_FREQ_PATH = "/sys/class/devfreq/mtk-dvfsrc-devfreq/max_freq";
const DVFSRC_CUR_FREQ_PATH = "/sys/class/devfreq/mtk-dvfsrc-devfreq/cur_freq";
const DVFSRC_AVAILABLE_FREQS_PATH = "/sys/class/devfreq/mtk-dvfsrc-devfreq/available_frequencies";

const MODULE_ID = "mtk_idle_charging_magisk"; // Your module ID

// Path untuk save config
const LAST_APPLIED_DVFSRC_CONFIG_PATH = `/data/adb/modules/${MODULE_ID}/cache/last_applied_dvfsrc_config.txt`;
const LAST_APPLIED_CONFIG_PATH = `/data/adb/modules/${MODULE_ID}/cache/last_applied_config.txt`;
const LAST_APPLIED_RENDERING_CONFIG_PATH = `/data/adb/modules/${MODULE_ID}/cache/last_applied_rendering_config.txt`;
const LAST_APPLIED_FPSGO_CONFIG_PATH = `/data/adb/modules/${MODULE_ID}/cache/last_applied_fpsgo_config.txt`;
const LAST_APPLIED_VCORE_GPU_CONFIG_PATH = `/data/adb/modules/${MODULE_ID}/cache/last_applied_vcore_gpu_config.txt`;
const GAMES_JSON_PATH = `/data/adb/modules/${MODULE_ID}/webroot/games.json`;

// Default values
const DVFSRC_DEFAULT_GOVERNOR = "simple_ondemand";
const DVFSRC_DEFAULT_MIN_FREQ = "800000000";
const DVFSRC_DEFAULT_MAX_FREQ = "4266000000"; // Default max freq 4266 MHz

// JSON file for fixed frequencies
const FIXED_FREQUENCIES_JSON = "fixed_frequencies.json";

// Specific values for reset and cleanup
const RESET_VALUE = "-1";
const RESET_FIX_FREQ_VOLT_VALUE = "0 0";

// Default values for FPSGO (as per the original Zenku script for factory reset)
const FPSGO_DEFAULT_ENABLE = "1"; // Default active
const FSTB_DEFAULT_SELF_CTRL_FPS_ENABLE = "1"; // Default active
const FSTB_DEFAULT_TARGET_FPS_MARGIN_HIGH_FPS = "5"; // Default 5%
const FSTB_DEFAULT_TARGET_FPS_MARGIN_LOW_FPS = "3"; // Default 3%
const FSTB_DEFAULT_SET_RENDER_MAX_FPS = "90"; // Default 60 (estimation)

// Default values for VCore DVFS & GPU DVFS
const VCORE_DVFS_DEFAULT_VALUE = "-1"; // Original default value in your script
const GPU_DVFS_DEFAULT_VALUE = "1";


// ====== UI ELEMENTS ======
const statusDiv = document.getElementById('status');
const currentStatusDiv = document.getElementById('currentStatus');

// UI elements for Fixed Frequencies
const fixedFreqSelect = document.getElementById('fixedFreqSelect');
const applyFixedFreqButton = document.getElementById('applyFixedFreqButton');

// UI elements for Custom Frequencies
const customFreqSelect = document.getElementById('customFreqSelect');
const applyCustomFreqButton = document.getElementById('applyCustomFreqButton');

const resetFixedFreqButton = document.getElementById('resetFixedFreqButton'); 
const container = document.querySelector('.container');

// --- Rendering Backend UI Elements ---
const hwuiRendererSelect = document.getElementById('hwuiRendererSelect');
const renderengineBackendSelect = document.getElementById('renderengineBackendSelect');
const applyRenderingSettingsButton = document.getElementById('applyRenderingSettingsButton');
const resetRenderingSettingsButton = document.getElementById('resetRenderingSettingsButton');
const presetFullVulkanBtn = document.getElementById('presetFullVulkanBtn');
const presetFullGlBtn = document.getElementById('presetFullGlBtn');
const presetResetBtn = document.getElementById('presetResetBtn');

// --- Per-App ANGLE Override UI Elements ---
const perAppPackageSelect = document.getElementById('perAppPackageSelect');
const perAppDriverSelect = document.getElementById('perAppDriverSelect');
const refreshAppListButton = document.getElementById('refreshAppListButton');
const applyPerAppButton = document.getElementById('applyPerAppButton');
const perAppOverrideListDiv = document.getElementById('perAppOverrideList');
const gpuAppPicker = ZenkuApps.enhanceSelect(perAppPackageSelect,{title:'GPU · Pilih Aplikasi / Game',empty:'Pilih aplikasi untuk driver ANGLE',secondary:'Daftar otomatis dari Android / KernelSU'});

// --- FPSGO Tweak UI Elements ---
const applyFpsgoOptimizationsButton = document.getElementById('applyFpsgoOptimizationsButton');
const resetFpsgoDefaultsButton = document.getElementById('resetFpsgoDefaultsButton');

// --- NEW VCore DVFS & GPU DVFS UI Elements ---
const applyVcoreGpuBoostingButton = document.getElementById('applyVcoreGpuBoostingButton');
const resetVcoreGpuDvfsButton = document.getElementById('resetVcoreGpuDvfsButton');

// --- DVFSRC Memory Tuning UI Elements ---
const dvfsrcGovernorSelect = document.getElementById('dvfsrcGovernorSelect');
const dvfsrcMinFreqSelect = document.getElementById('dvfsrcMinFreqSelect');
const dvfsrcMaxFreqSelect = document.getElementById('dvfsrcMaxFreqSelect');
const applyDvfsrcSettingsButton = document.getElementById('applyDvfsrcSettingsButton');
const resetDvfsrcSettingsButton = document.getElementById('resetDvfsrcSettingsButton');

// --- Log Monitor UI Elements ---
const logMonitorDiv = document.getElementById('logMonitor'); // Get the log monitor element

// Array to store loaded OPP data
let availableGpuOpps = [];

// Variable to hold timeout so it can be canceled if there's a new status update
let statusTimeout = null;
let countdownInterval = null; // Add this to manage the countdown interval

// ====== UTILITY FUNCTIONS ======

/**
 * Gets the current date and time string in a readable format.
 * @returns {string} Current date and time (e.g., "2023-10-27 10:30:00").
 */
function getCurrentDateTime() {
    const now = new Date();
    const year = String(now.getFullYear()).padStart(4, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Adds a log entry to the log monitor.
 * @param {string} type - Type of log (e.g., 'INFO', 'SUCCESS', 'ERROR').
 * @param {string} message - Log message.
 * @param {string} [instruction=""] - Additional instructions or notes for this log.
 */
function logActivity(type, message, instruction = "") {
    const logEntryDiv = document.createElement('div');
    logEntryDiv.classList.add('log-entry', `log-${type.toLowerCase()}`);

    const timeSpan = document.createElement('span');
    timeSpan.classList.add('log-time');
    timeSpan.textContent = getCurrentDateTime();
    logEntryDiv.appendChild(timeSpan);

    const messageSpan = document.createElement('span');
    messageSpan.classList.add('log-message');
    messageSpan.textContent = message;
    logEntryDiv.appendChild(messageSpan);

    if (instruction) {
        const instructionSpan = document.createElement('span');
        instructionSpan.classList.add('log-instruction');
        instructionSpan.textContent = instruction;
        logEntryDiv.appendChild(instructionSpan);
    }

    // Add new log at the top
    if (logMonitorDiv.firstChild) {
        logMonitorDiv.insertBefore(logEntryDiv, logMonitorDiv.firstChild);
    } else {
        logMonitorDiv.appendChild(logEntryDiv);
    }

    // Limit the number of logs to prevent a too-large DOM
    const maxLogEntries = 20; // Limit to 20 log entries
    while (logMonitorDiv.children.length > maxLogEntries) {
        logMonitorDiv.removeChild(logMonitorDiv.lastChild);
    }
}

/**
 * Displays a status message in the UI.
 * @param {string} message - The message to be displayed.
 * @param {boolean} isError - True if the message is an error, false for success/info.
 * @param {boolean} isFinalStatus - True if this is the final status ('Ready.').
 * @param {number} delayBeforeFinal - Delay (in ms) before showing 'Ready.', if isFinalStatus is true.
 * @param {boolean} showCountdown - True if you want to show a countdown before 'Ready.' appears. Only relevant if isFinalStatus=true.
 */
function updateStatus(message, isError = false, isFinalStatus = false, delayBeforeFinal = 0, showCountdown = false) {
    // Clear previous timeout or interval so messages don't clash
    if (statusTimeout) {
        clearTimeout(statusTimeout);
        statusTimeout = null;
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }

    statusDiv.textContent = message;
    statusDiv.style.color = isError ? '#e06c75' : (isFinalStatus ? '#61afef' : '#98c379');

    // Instantly remove previous animation classes
    statusDiv.classList.remove('animate-pop', 'animate-blink');

    if (isError) {
        statusDiv.classList.add('animate-pop'); // Pop effect for errors
    } else if (isFinalStatus) {
        // For 'Ready.', we will do a countdown if showCountdown is true
        if (showCountdown && delayBeforeFinal > 0) {
            let countdown = delayBeforeFinal / 1000; // Convert ms to seconds
            const initialMessage = message; // Save the original message before the countdown
            statusDiv.textContent = `${initialMessage} (${countdown}s)`; // Display the initial message with the countdown
            statusDiv.classList.add('animate-pop'); // Can use pop for the countdown

            countdownInterval = setInterval(() => {
                countdown--;
                if (countdown > 0) {
                    statusDiv.textContent = `${initialMessage} (${countdown}s)`;
                } else {
                    clearInterval(countdownInterval);
                    countdownInterval = null;
                    statusDiv.textContent = "Siap."; // Finally show "Ready."
                    statusDiv.classList.add('animate-blink');
                    statusDiv.classList.remove('animate-pop'); // Remove pop if present
                }
            }, 1000); // Update every second
        } else {
            // If no countdown, show 'Ready.' directly after the delay
            statusTimeout = setTimeout(() => {
                statusDiv.textContent = message;
                statusDiv.classList.add('animate-blink');
                statusTimeout = null;
            }, delayBeforeFinal);
        }
        return; 
    } else {
        // For temporary status messages (e.g., "Loading...", "Applying...")
        statusDiv.classList.add('animate-pop');
        // There is no automatic timeout for this pop message, it will be replaced by the next updateStatus
        // or will be cleared if a countdown starts.
    }
}

/**
 * Writes data to a filesystem file as root.
 * @param {string} filePath - Path of the file to be written.
 * @param {string} data - Data to be written.
 * @returns {string} The shell command to be executed.
 */
function writeToProcFile(filePath, data) {
    // This function only creates the command string.
    // chmod will be handled by boot-script.sh during boot
    // or if you want to chmod from WebUI, you need to call exec for chmod first.
    // As per the discussion, boot-script.sh will manage chmod 644 and 444.
    return `echo -n '${data}' > "${filePath}"`;
}


/**
 * Executes a shell command as root.
 * Uses the provided KernelSU `exec` function.
 * @param {string} command - The shell command to be executed.
 * @param {string} actionDescription - Description of the action being performed.
 * @returns {Promise<Object>} Resolves with { code, stdout, stderr } of the command execution.
 */
async function executeShellCommand(command, actionDescription = "Executing command...") {
    try {
        const result = await exec(command);
        
        if (result.code === 0) {
            console.log("Command executed successfully:", command, result.stdout);
            logActivity('INFO', actionDescription, 'Command executed successfully.');
        } else {
            console.error("Command failed:", command, result.stderr, "Code:", result.code);
            logActivity('ERROR', actionDescription, `Command failed: ${result.stderr || 'No stderr'}`);
        }
        return result;
    } catch (e) {
        updateStatus(`Error during execution: ${e.message}`, true);
        console.error("Error during KSU exec:", e);
        logActivity('ERROR', actionDescription, `Error during KSU exec: ${e.message}`);
        return { code: 1, stdout: '', stderr: e.message };
    }
}

// --- Functions for system properties ---
/**
 * Sets the value of a system property using setprop.
 * @param {string} propName - Property name (e.g., debug.hwui.renderer).
 * @param {string} value - Property value. Leave empty to reset the property.
 * @returns {Promise<boolean>} True if successful, false if failed.
 */
async function setSystemProperty(propName, value) {
    let command;
    let actionDesc;

    if (value === 'default' || value === '') {
        command = `setprop ${propName} ""`; // Reset the property (setprop, not resetprop: avoids PATH issues in ksu.exec() and actually clears the value)
        actionDesc = `Resetting property ${propName}`;
    } else {
        command = `setprop ${propName} ${value}`;
        actionDesc = `Setting property ${propName} to ${value}`;
    }

    const result = await executeShellCommand(command, actionDesc);
    if (result.code === 0) {
        console.log(`Successfully set/reset property ${propName} to ${value}.`);
        return true;
    } else {
        console.error(`Failed to set/reset property ${propName} to ${value}: ${result.stderr}`);
        return false;
    }
}

/**
 * Reads the value of a system property.
 * @param {string} propName - Property name (e.g., debug.hwui.renderer).
 * @returns {Promise<string|null>} Property value, or null if not found/failed.
*/
async function getSystemProperty(propName) {
    const command = `getprop ${propName}`;
    const result = await exec(command);

    if (result.code === 0) {
        const value = result.stdout.trim();
        return value === '' ? null : value;
    } else {
        console.warn(`Could not read property ${propName}: ${result.stderr}`);
        return null;
    }
}

/**
 * Loads the GPU OPP table from the filesystem.
 */
async function loadGpuOppTable() {
    try {
        updateStatus("Loading available GPU frequencies..."); 
        const result = await executeShellCommand(`cat ${GPU_OPP_TABLE_PATH}`, "Loading GPU frequencies...");
        
        if (result.code !== 0) {
            throw new Error(result.stderr || "Failed to read GPU OPP table.");
        }

        const lines = result.stdout.split('\n').filter(line => line.trim() !== '');
        availableGpuOpps = [];

        lines.forEach(line => {
            const match = line.match(/\[(\d+)\]\s+freq:\s*(\d+),\s+volt:\s*(\d+)/);
            if (match) {
                const index = parseInt(match[1]);
                const freqKHz = parseInt(match[2]);
                const voltUV = parseInt(match[3]);

                const freqMHz = freqKHz / 1000;
                const voltMV = (voltUV / 1000).toFixed(3);

                availableGpuOpps.push({
                    index: index,
                    freqKHz: freqKHz,
                    voltUV: voltUV,
                    display: `Index ${index}: ${freqMHz} MHz (${voltMV} mV)`
                });
            }
        });

        populateCustomFreqSelect();
        customFreqSelect.disabled = false;
        applyCustomFreqButton.disabled = false;

    } catch (error) {
        updateStatus(`ERROR: Failed to load GPU frequencies. Make sure your device is compatible. (${error.message})`, true);
        console.error("Error loading GPU OPP table:", error);
        logActivity("ERROR", "Failed to load GPU frequencies.", `Make sure your device is compatible and KernelSU is installed correctly. Error: ${error.message}`);
    }
}

/**
 * Loads and populates the fixed frequencies dropdown from a JSON file.
 */
async function loadFixedFrequencies() {
    try {
        updateStatus("Loading fixed frequency options...");
        const response = await fetch(FIXED_FREQUENCIES_JSON);
        if (!response.ok) {
            throw new Error(`Failed to load ${FIXED_FREQUENCIES_JSON}: ${response.statusText}`);
        }
        const data = await response.json();

        fixedFreqSelect.innerHTML = '<option value="" disabled selected>Select fixed frequency...</option>';
        data.forEach(item => {
            const option = document.createElement('option');
            option.value = item.value;
            option.textContent = item.label;
            fixedFreqSelect.appendChild(option);
        });

        fixedFreqSelect.disabled = false;
        applyFixedFreqButton.disabled = false;
        logActivity("SUCCESS", "Fixed frequency options loaded successfully.", "");
    } catch (error) {
        updateStatus(`ERROR: Failed to load fixed frequencies. (${error.message})`, true);
        console.error("Error loading fixed frequencies:", error);
        logActivity("ERROR", "Failed to load fixed frequency options.", `Make sure the ${FIXED_FREQUENCIES_JSON} file exists and is correct. Error: ${error.message}`);
        fixedFreqSelect.disabled = true;
        applyFixedFreqButton.disabled = true;
    }
}

/**
 * Debug function untuk mengecek path DVFSRC
 */
async function debugDvfsrcPaths() {
    console.log("=== DEBUG DVFSRC PATHS ===");
    
    const pathsToCheck = [
        DVFSRC_GOVERNOR_PATH,
        DVFSRC_MIN_FREQ_PATH,
        DVFSRC_MAX_FREQ_PATH,
        DVFSRC_CUR_FREQ_PATH,
        DVFSRC_AVAILABLE_FREQS_PATH
    ];
    
    for (const path of pathsToCheck) {
        try {
            const result = await exec(`ls -la "${path}"`);
            console.log(`Path: ${path} - Exists: ${result.code === 0}`);
            if (result.code === 0) {
                const content = await exec(`cat "${path}"`);
                console.log(`Content: ${content.stdout.trim()}`);
            }
        } catch (error) {
            console.log(`Path: ${path} - Error: ${error.message}`);
        }
    }
}

/**
 * Load available DVFSRC memory frequencies and governors - FIXED VERSION WITH PERMISSIONS
 */
async function loadDvfsrcInfo() {
    try {
        // Debug paths first
        await debugDvfsrcPaths();
        
        // Load available frequencies
        const freqResult = await executeShellCommand(`cat ${DVFSRC_AVAILABLE_FREQS_PATH}`, "Loading DVFSRC frequencies");
        
        if (freqResult.code === 0 && freqResult.stdout.trim() !== '') {
            const freqs = freqResult.stdout.trim().split(' ').filter(f => f !== '' && f !== '0');
            console.log("Available DVFSRC frequencies:", freqs);
            
            // Populate min freq dropdown
            dvfsrcMinFreqSelect.innerHTML = '<option value="default">Default (System)</option>';
            freqs.forEach(freq => {
                const freqMHz = parseInt(freq) / 1000000;
                const option = document.createElement('option');
                option.value = freq;
                option.textContent = `${freqMHz} MHz`;
                dvfsrcMinFreqSelect.appendChild(option);
            });

            // Populate max freq dropdown  
            dvfsrcMaxFreqSelect.innerHTML = '<option value="default">Default (System)</option>';
            freqs.forEach(freq => {
                const freqMHz = parseInt(freq) / 1000000;
                const option = document.createElement('option');
                option.value = freq;
                option.textContent = `${freqMHz} MHz`;
                dvfsrcMaxFreqSelect.appendChild(option.cloneNode(true));
            });
        } else {
            console.warn("No DVFSRC frequencies available or file not accessible");
            dvfsrcMinFreqSelect.innerHTML = '<option value="default">Default (System)</option>';
            dvfsrcMaxFreqSelect.innerHTML = '<option value="default">Default (System)</option>';
        }

        // Load current governor
        const govResult = await executeShellCommand(`cat ${DVFSRC_GOVERNOR_PATH}`, "Loading current DVFSRC governor");
        let currentGovernor = "simple_ondemand";
        if (govResult.code === 0) {
            currentGovernor = govResult.stdout.trim();
        }

        // Populate governor dropdown dengan governor yang lebih umum
        dvfsrcGovernorSelect.innerHTML = `
            <option value="simple_ondemand" ${currentGovernor === 'simple_ondemand' ? 'selected' : ''}>Simple Ondemand - Governor dinamis berdasarkan beban</option>
            <option value="performance" ${currentGovernor === 'performance' ? 'selected' : ''}>Performance - Selalu frekuensi maksimal</option>
            <option value="powersave" ${currentGovernor === 'powersave' ? 'selected' : ''}>Powersave - Selalu frekuensi minimal</option>
            <option value="userspace" ${currentGovernor === 'userspace' ? 'selected' : ''}>Userspace - Kontrol manual oleh user</option>
            <option value="dummy" ${currentGovernor === 'dummy' ? 'selected' : ''}>Dummy - Governor sederhana</option>
        `;

        // Enable UI elements
        dvfsrcGovernorSelect.disabled = false;
        dvfsrcMinFreqSelect.disabled = false;
        dvfsrcMaxFreqSelect.disabled = false;
        applyDvfsrcSettingsButton.disabled = false;
        resetDvfsrcSettingsButton.disabled = false;

        logActivity("SUCCESS", "DVFSRC memory tuning loaded", "Memory settings ready for configuration");

    } catch (error) {
        console.error("Error loading DVFSRC info:", error);
        logActivity("ERROR", "Failed to load DVFSRC information", "Device might not support DVFSRC memory tuning");
        
        // Fallback - still enable UI but with limited functionality
        dvfsrcGovernorSelect.disabled = false;
        dvfsrcMinFreqSelect.disabled = false;
        dvfsrcMaxFreqSelect.disabled = false;
        applyDvfsrcSettingsButton.disabled = false;
        resetDvfsrcSettingsButton.disabled = false;
    }
}

/**
 * Loads and displays the current GPU and rendering backend status.
 */
async function loadCurrentGpuStatus() {
    try {
        currentStatusDiv.innerHTML = "Memuat status GPU & Rendering...";
        let statusHtml = '';

        // --- GPU Status Section ---
        const gpuResult = await exec(`cat ${GPU_STATUS_PATH}`);

        if (gpuResult.code === 0) {
            const lines = gpuResult.stdout.split('\n').filter(line => line.trim() !== '');
            let gpuOppStatus = {};

            lines.forEach(line => {
                if (line.includes('[GPU-OPP]')) {
                    const match = line.match(/Index:\s*(\d+),\s*Freq:\s*(\d+),\s*Volt:\s*(\d+)/);
                    if (match) {
                        gpuOppStatus.index = parseInt(match[1]);
                        gpuOppStatus.freqKHz = parseInt(match[2]);
                        gpuOppStatus.voltUV = parseInt(match[3]);
                    }
                }
            });

            if (gpuOppStatus.freqKHz && gpuOppStatus.voltUV) {
                // Dua mekanisme mengubah frekuensi GPU dan masing-masing cuma update "catatannya" sendiri:
                //  - Fixed/Custom Frequencies (proc gpufreqv2) → update gpufreq_status, TIDAK update tabel OPP
                //  - OC Engine (.ko) → patch tabel OPP idx0 (dan GED), TIDAK update gpufreq_status (cache stock)
                // Jadi kalau keduanya beda, dibedakan pakai baseline stock idx0 (dicatat service.sh saat boot):
                //  status == stock → cache basi, OC Engine yang aktif → tampilkan tabel
                //  status != stock → Fixed Freq diterapkan belakangan → tampilkan status, OC Engine jadi catatan
                let shownFreqKHz = gpuOppStatus.freqKHz;
                let shownVoltRaw = gpuOppStatus.voltUV;
                let cacheNote = '';
                try {
                    const [oppRes, stockRes] = await Promise.all([
                        exec(`cat ${GPU_OPP_TABLE_PATH} 2>/dev/null`),
                        exec(`cat /data/adb/modules/${MODULE_ID}/cache/oc_gpu_stock.json 2>/dev/null`),
                    ]);
                    let row = null;
                    if (oppRes.code === 0) {
                        for (const l of oppRes.stdout.split('\n')) {
                            const m = l.match(/\[\s*(\d+)\]\s*freq:\s*(\d+),\s*volt:\s*(\d+)/);
                            if (m && parseInt(m[1]) === gpuOppStatus.index) {
                                row = { f: parseInt(m[2]), v: parseInt(m[3]) };
                                break;
                            }
                        }
                    }
                    let stock = null;
                    try {
                        const j = JSON.parse(stockRes.stdout);
                        if (j.freq_khz > 0) stock = { f: j.freq_khz, v: j.volt_raw };
                    } catch (e) { /* baseline belum ada */ }

                    if (row && row.f !== gpuOppStatus.freqKHz) {
                        const warn = 'var(--ios-warning-orange)';
                        const rowMHz = (row.f / 1000).toFixed(0);
                        if (stock && gpuOppStatus.index === 0 && gpuOppStatus.freqKHz === stock.f) {
                            shownFreqKHz = row.f;
                            shownVoltRaw = row.v;
                            cacheNote = `<br><strong>gpufreq_status:</strong> <span style="color: ${warn};">${(gpuOppStatus.freqKHz / 1000).toFixed(0)} MHz (cache driver, OPP idx 0 sudah diubah OC Engine)</span>`;
                        } else if (stock && gpuOppStatus.index === 0) {
                            cacheNote = `<br><strong>OC Engine:</strong> <span style="color: ${warn};">${rowMHz} MHz (tabel OPP idx 0, ditimpa Fixed Frequency yang diterapkan setelahnya)</span>`;
                        } else {
                            cacheNote = `<br><strong>OC Engine:</strong> <span style="color: ${warn};">${rowMHz} MHz (tabel OPP) — beda sumber, belum pasti mana yang aktif. Baseline stock GPU belum tercatat, reboot sekali.</span>`;
                        }
                    }
                } catch (e) {
                    console.warn("Gagal cross-check status GPU dengan tabel OPP:", e);
                }
                const freqMHz = (shownFreqKHz / 1000).toFixed(0);
                // Satuan volt driver MTK = mV*100 (75000 = 750 mV), bukan µV
                const voltMV = parseFloat((shownVoltRaw / 100).toFixed(2));
                statusHtml += `
                    <h3>GPU Status</h3>
                    <strong>Index:</strong> ${gpuOppStatus.index}<br>
                    <strong>Frequency:</strong> ${freqMHz} MHz<br>
                    <strong>Voltage:</strong> ${voltMV} mV${cacheNote}
                `;
            } else {
                statusHtml += `<h3>GPU Status</h3><span style="color: var(--ios-warning-orange);">Relevant GPU status data not found.</span>`;
                logActivity("WARN", "GPU status data not found.", "Perhaps no fixed frequency is applied or the system does not provide complete info.");
            }
        } else {
            statusHtml += `<h3>GPU Status</h3><span style="color: var(--ios-error-red);">Failed to read GPU status: ${gpuResult.stderr || "file not found or inaccessible."}</span>`;
            console.error("Error reading GPU status:", gpuResult.stderr);
            logActivity("ERROR", "Failed to read GPU status.", `Make sure the ${GPU_STATUS_PATH} file is accessible. Error: ${gpuResult.stderr}`);
        }

        // --- Rendering Backend Status Section ---
        statusHtml += `
            <div style="margin-top: 20px;"></div> <h3>Rendering Backend Status</h3>
        `;
        
        const hwuiRenderer = await getSystemProperty(HWUI_RENDERER_PROP);
        const renderengineBackend = await getSystemProperty(RENDERENGINE_BACKEND_PROP);

        statusHtml += `
            <strong>HWUI Renderer:</strong> ${hwuiRenderer || '<span style="color: var(--ios-text-secondary);">Default (Not Set)</span>'}<br>
            <strong>RenderEngine Backend:</strong> ${renderengineBackend || '<span style="color: var(--ios-text-secondary);">Default (Not Set)</span>'}
        `;

        // --- FPSGO Status Section ---
        statusHtml += `
            <div style="margin-top: 20px;"></div> <h3>FPSGO Status</h3>
        `;
        const fpsgoEnableResult = await exec(`cat ${FPSGO_ENABLE_PATH}`);
        const fstbSelfCtrlEnableResult = await exec(`cat ${FSTB_SELF_CTRL_FPS_ENABLE_PATH}`);
        const fstbMarginHighResult = await exec(`cat ${FSTB_TARGET_FPS_MARGIN_HIGH_FPS_PATH}`);
        const fstbMarginLowResult = await exec(`cat ${FSTB_TARGET_FPS_MARGIN_LOW_FPS_PATH}`);
        // set_render_max_fps cannot be read, so it won't be displayed in the status

        statusHtml += `
            <strong>FPSGO Enabled:</strong> ${fpsgoEnableResult.code === 0 ? (fpsgoEnableResult.stdout.trim() === '1' ? '<span style="color: var(--ios-success-green);">Yes</span>' : '<span style="color: var(--ios-error-red);">No</span>') : '<span style="color: var(--ios-warning-orange);">Unknown</span>'}<br>
            <strong>FSTB Self-Control:</strong> ${fstbSelfCtrlEnableResult.code === 0 ? (fstbSelfCtrlEnableResult.stdout.trim() === '1' ? '<span style="color: var(--ios-success-green);">Yes</span>' : '<span style="color: var(--ios-error-red);">No</span>') : '<span style="color: var(--ios-warning-orange);">Unknown</span>'}<br>
            <strong>High FPS Margin:</strong> ${fstbMarginHighResult.code === 0 ? fstbMarginHighResult.stdout.trim() : '<span style="color: var(--ios-warning-orange);">Unknown</span>'}%<br>
            <strong>Low FPS Margin:</strong> ${fstbMarginLowResult.code === 0 ? fstbMarginLowResult.stdout.trim() : '<span style="color: var(--ios-warning-orange);">Unknown</span>'}%
        `;

        // --- NEW VCore DVFS & GPU DVFS Status Section ---
        statusHtml += `
            <div style="margin-top: 20px;"></div> <h3>VCore DVFS & GPU DVFS Status</h3>
        `;
        
        // Reading VCore DVFS Force OPP from dvfsrc_dump as requested
        let forceOppIdxValueFromDump = '<span style="color: var(--ios-warning-orange);">Unknown</span>';
        try {
            const dumpResult = await exec(`cat "${DVFSRC_DUMP_PATH}"`);
            if (dumpResult.code === 0 && dumpResult.stdout) {
                const lines = dumpResult.stdout.split('\n');
                for (const line of lines) {
                    if (line.includes('FORCE_OPP_IDX')) {
                        const match = line.match(/FORCE_OPP_IDX\s*:\s*(\d+)/);
                        if (match && match[1]) {
                            const val = match[1];
                            if (val === '0') {
                                forceOppIdxValueFromDump = `<span style="color: var(--ios-success-green);">Boosting (${val})</span>`;
                            } else if (val === '255') {
                                forceOppIdxValueFromDump = `<span style="color: var(--ios-text-secondary);">Off/Default (${val})</span>`;
                            } else {
                                forceOppIdxValueFromDump = `<span style="color: var(--ios-warning-orange);">Custom (${val})</span>`;
                            }
                            break;
                        }
                    }
                }
            } else {
                logActivity('WARN', `Failed to read DVFSRC dump for FORCE_OPP_IDX: ${dumpResult.stderr}`, `Path: ${DVFSRC_DUMP_PATH}`);
            }
        } catch (e) {
            logActivity('ERROR', `Error accessing DVFSRC dump for FORCE_OPP_IDX: ${e.message}`, `Path: ${DVFSRC_DUMP_PATH}`);
        }

        const gpuDvfsEnableStatus = await exec(`cat ${GED_GPU_DVFS_ENABLE_PATH}`);

        statusHtml += `
            <strong>VCore DVFS Force OPP:</strong> ${forceOppIdxValueFromDump}<br>
            <strong>GPU DVFS Enabled:</strong> ${gpuDvfsEnableStatus.code === 0 ? (gpuDvfsEnableStatus.stdout.trim() === '0' ? '<span style="color: var(--ios-error-red);">Disabled (Locked)</span>' : '<span style="color: var(--ios-success-green);">Enabled (Dynamic)</span>') : '<span style="color: var(--ios-warning-orange);">Unknown</span>'}
        `;

        // --- Enhanced DVFSRC Memory Status Section ---
        statusHtml += `
            <div style="margin-top: 20px;"></div> <h3>DVFSRC Memory Status</h3>
        `;

        // Check if DVFSRC paths exist
        const dvfsrcCheck = await exec(`ls ${DVFSRC_GOVERNOR_PATH} > /dev/null 2>&1 && echo "exists" || echo "not_found"`);
        
        if (dvfsrcCheck.code === 0 && dvfsrcCheck.stdout.includes("exists")) {
            const dvfsrcCurFreq = await exec(`cat ${DVFSRC_CUR_FREQ_PATH} 2>/dev/null || echo "N/A"`);
            const dvfsrcGovernor = await exec(`cat ${DVFSRC_GOVERNOR_PATH} 2>/dev/null || echo "N/A"`);
            const dvfsrcMinFreq = await exec(`cat ${DVFSRC_MIN_FREQ_PATH} 2>/dev/null || echo "N/A"`);
            const dvfsrcMaxFreq = await exec(`cat ${DVFSRC_MAX_FREQ_PATH} 2>/dev/null || echo "N/A"`);

            statusHtml += `
                <strong>Current Governor:</strong> ${dvfsrcGovernor.stdout.trim()}<br>
                <strong>Current Frequency:</strong> ${dvfsrcCurFreq.stdout.trim() !== 'N/A' ? (parseInt(dvfsrcCurFreq.stdout.trim()) / 1000000) + ' MHz' : 'N/A'}<br>
                <strong>Min Frequency:</strong> ${dvfsrcMinFreq.stdout.trim() !== 'N/A' ? (parseInt(dvfsrcMinFreq.stdout.trim()) / 1000000) + ' MHz' : 'N/A'}<br>
                <strong>Max Frequency:</strong> ${dvfsrcMaxFreq.stdout.trim() !== 'N/A' ? (parseInt(dvfsrcMaxFreq.stdout.trim()) / 1000000) + ' MHz' : 'N/A'}
            `;
        } else {
            statusHtml += `<span style="color: var(--ios-warning-orange);">DVFSRC not available on this device</span>`;
        }

        currentStatusDiv.innerHTML = statusHtml;

    } catch (error) {
        currentStatusDiv.innerHTML = `<span style="color: var(--ios-error-red);">Error loading status: ${error.message}</span>`;
        console.error("Error loading combined status:", error);
        logActivity("ERROR", "Error loading combined status.", `Error: ${error.message}`);
    }
}


/**
 * Populates the custom frequencies dropdown with loaded data.
 */
function populateCustomFreqSelect() {
    customFreqSelect.innerHTML = '<option value="" disabled selected>Select custom frequency</option>';
    availableGpuOpps.forEach(opp => {
        const option = document.createElement('option');
        option.value = opp.index;
        option.textContent = opp.display;
        customFreqSelect.appendChild(option);
    });
}

/**
 * Sets the GPU frequency.
 * @param {'fixed'|'custom'|'reset'} mode - Setting mode (fixed, custom, reset).
 * @param {string} value - The value to apply (freqKHz voltUV for fixed, index for custom).
 */
async function setGpuFrequency(mode, value) {
    let commandToExecute = '';
    let configToSave = '';
    let statusMessage = '';
    let actionDesc = '';
    let logMessage = '';
    let logInstruction = '';

    // --- UNIVERSAL RESET BEFORE EACH APPLICATION ---
    // Here we don't use chmod 644/444 because the permissions of proc files are already set by the kernel
    let resetCommands = `
        ${writeToProcFile(GPU_FIX_TARGET_OPP_INDEX_PATH, RESET_VALUE)};
        ${writeToProcFile(GPU_FIX_FREQ_PATH, RESET_FIX_FREQ_VOLT_VALUE)};
    `;
    updateStatus("Resetting previous GPU settings for system stability..."); 
    const resetResult = await executeShellCommand(resetCommands, "Resetting previous GPU");
    if (resetResult.code !== 0) {
        updateStatus(`Failed to reset previous GPU settings: ${resetResult.stderr}`, true);
        logActivity("ERROR", "Failed to reset previous GPU settings.", `This might cause instability. Error: ${resetResult.stderr}`);
        return;
    }

    if (mode === 'fixed') {
        commandToExecute = writeToProcFile(GPU_FIX_FREQ_PATH, value);
        configToSave = `fixed_freq=${value}`;
        const freqKHz = value.split(' ')[0];
        const freqMHz = (parseInt(freqKHz) / 1000);
        statusMessage = `Applying Fixed frequency ${freqMHz} MHz...`;
        actionDesc = `Applying fixed frequency ${freqMHz} MHz`;
        logMessage = `GPU frequency set to Fixed ${freqMHz} MHz.`;
        logInstruction = "This change takes effect immediately. Check 'Current Status' for confirmation.";
    } else if (mode === 'custom') {
        commandToExecute = writeToProcFile(GPU_FIX_TARGET_OPP_INDEX_PATH, value);
        configToSave = `custom_opp_index=${value}`;
        const selectedOpp = availableGpuOpps.find(opp => opp.index.toString() === value);
        if (selectedOpp) {
            statusMessage = `Applying Custom frequency ${selectedOpp.display}...`;
            actionDesc = `Applying custom frequency (Index ${value})`;
            logMessage = `GPU frequency set to Custom ${selectedOpp.display}.`;
            logInstruction = "This change takes effect immediately. Check 'Current Status' for confirmation.";
        } else {
            statusMessage = `Invalid custom OPP index.`;
            actionDesc = `Applying custom frequency (Index ${value})`;
            updateStatus(statusMessage, true);
            logActivity("ERROR", "Invalid custom OPP index.", "Please select a valid OPP from the list.");
            return;
        }
    } else if (mode === 'reset') {
        commandToExecute = `rm -f ${LAST_APPLIED_CONFIG_PATH}`; // Delete the configuration file
        configToSave = 'reset';
        statusMessage = "Resetting GPU frequency to system default (Auto Mode)...";
        actionDesc = "Resetting GPU frequency";
        logMessage = "GPU frequency reset to Auto mode (System Default).";
        logInstruction = "Default settings are applied after this operation. Sometimes requires a reboot for full stability.";
    } else {
        updateStatus("Invalid frequency mode.", true);
        logActivity("ERROR", "Attempted to set frequency with an invalid mode.", "");
        return;
    }

    updateStatus(statusMessage, false); 

    const result = await executeShellCommand(commandToExecute, actionDesc);

    if (result.code === 0) {
        if (mode !== 'reset') {
            const saveConfigResult = await executeShellCommand(
                `echo "${configToSave}" > "${LAST_APPLIED_CONFIG_PATH}"`,
                "Saving configuration"
            );
            if (saveConfigResult.code !== 0) {
                console.warn(`Failed to save config: ${saveConfigResult.stderr}`);
                updateStatus(`Successfully applied, but failed to save configuration. (${saveConfigResult.stderr})`, true);
                logActivity("WARN", `Successfully applied, but failed to save configuration.`, `Error: ${saveConfigResult.stderr}. The configuration may not persist after reboot.`);
            }
        }
        await loadCurrentGpuStatus();
        updateStatus("Operation complete", false, true, 3000, true); 
        logActivity("SUCCESS", logMessage, logInstruction); // Add success log
    } else {
        updateStatus(`Failed to apply frequency: ${result.stderr}`, true);
        logActivity("ERROR", `Failed to apply frequency.`, `Error: ${result.stderr}. Make sure KernelSU has full root permissions.`);
    }
}

/**
 * Fetches installed third-party packages via `pm list packages -3`
 * and populates perAppPackageSelect. Cross-references games.json (if present)
 * to show a friendly name next to the raw package name.
 */
async function fetchInstalledApps() {
    updateStatus('Mengambil nama dan ikon aplikasi dari Android...');
    refreshAppListButton.disabled = true;
    const old = perAppPackageSelect.value;
    perAppPackageSelect.disabled=true;
    applyPerAppButton.disabled=true;
    try {
        const {apps,source,verified}=await ZenkuApps.catalog({exec,refresh:true});
        if (!apps.length) throw new Error('Tidak ada aplikasi ditemukan');
        perAppPackageSelect.replaceChildren();
        const first=document.createElement('option');first.value='';first.textContent='-- Pilih aplikasi --';perAppPackageSelect.append(first);
        apps.forEach(app=>{
            const opt=document.createElement('option');opt.value=app.packageName;
            opt.dataset.package=app.packageName;opt.dataset.label=app.name;
            opt.textContent=`${app.name} (${app.packageName})`;
            opt.disabled=!app.installed;
            perAppPackageSelect.append(opt);
        });
        if (apps.some(a=>a.packageName===old && a.installed))perAppPackageSelect.value=old;
        gpuAppPicker?.setHint(`${apps.length} aplikasi · sumber: ${source}${verified?'':' · fallback belum diverifikasi'}`);
        gpuAppPicker?.refresh();
        applyPerAppButton.disabled=!perAppPackageSelect.value;
        updateStatus(`${apps.length} aplikasi berhasil dimuat`,false,true,2500,true);
        logActivity('SUCCESS','App picker dinamis',`${apps.length} aplikasi melalui ${source}`);
        await renderPerAppOverrideList();
    } catch(error) {
        perAppPackageSelect.replaceChildren();
        const opt=document.createElement('option');opt.value='';opt.textContent='Gagal memuat aplikasi';perAppPackageSelect.append(opt);
        gpuAppPicker?.setHint('Daftar gagal dibaca. Tekan Refresh Aplikasi.');gpuAppPicker?.refresh();
        updateStatus('Gagal memuat aplikasi: '+error.message,true);
        logActivity('ERROR','Daftar aplikasi gagal',error.message);
    } finally {perAppPackageSelect.disabled=false;refreshAppListButton.disabled=false;}
}

/**
 * Reads current per-app ANGLE overrides from Settings.Global and returns
 * them as a { packageName: driverValue } map. `settings get` returns the
 * literal string "null" when a key was never set, so that case is filtered out.
 */
async function getPerAppAngleOverrides() {
    const pkgsRes = await exec(`settings get global ${ANGLE_PKGS_SETTING}`);
    const valsRes = await exec(`settings get global ${ANGLE_VALUES_SETTING}`);
    const pkgsRaw = (pkgsRes.code === 0 ? pkgsRes.stdout.trim() : '');
    const valsRaw = (valsRes.code === 0 ? valsRes.stdout.trim() : '');

    const pkgs = (pkgsRaw && pkgsRaw !== 'null') ? pkgsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
    const vals = (valsRaw && valsRaw !== 'null') ? valsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

    const map = {};
    pkgs.forEach((pkg, i) => { map[pkg] = vals[i] || 'default'; });
    return map;
}

/**
 * Writes the given { packageName: driverValue } map back to Settings.Global.
 * An empty map deletes both settings entirely instead of writing empty strings.
 */
async function savePerAppAngleOverrides(map) {
    const pkgs = Object.keys(map);
    const vals = pkgs.map(p => map[p]);

    if (pkgs.length === 0) {
        await executeShellCommand(`settings delete global ${ANGLE_PKGS_SETTING}`, "Menghapus daftar override ANGLE");
        await executeShellCommand(`settings delete global ${ANGLE_VALUES_SETTING}`, "Menghapus daftar driver ANGLE");
    } else {
        await executeShellCommand(`settings put global ${ANGLE_PKGS_SETTING} "${pkgs.join(',')}"`, "Menyimpan daftar package ANGLE");
        await executeShellCommand(`settings put global ${ANGLE_VALUES_SETTING} "${vals.join(',')}"`, "Menyimpan daftar driver ANGLE");
    }
}

/**
 * Renders the current per-app override map into #perAppOverrideList,
 * one row per package with a "Hapus" button.
 */
async function renderPerAppOverrideList() {
    perAppOverrideListDiv.innerHTML = 'Memuat...';
    try {
        const map = await getPerAppAngleOverrides();
        const entries = Object.entries(map);

        if (entries.length === 0) {
            perAppOverrideListDiv.innerHTML = '<span style="opacity:0.6;">Belum ada override per-app.</span>';
            return;
        }

        perAppOverrideListDiv.innerHTML = '';
        entries.forEach(([pkg, driver]) => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex; gap:8px; justify-content:space-between; align-items:center; padding:10px 4px; border-bottom:1px solid rgba(255,255,255,0.08);';

            const label = document.createElement('span');
            label.className='za-option-text';
            const name=document.createElement('strong');name.textContent=ZenkuApps.appName(pkg);
            const details=document.createElement('small');details.textContent=`${pkg} · ${driver.toUpperCase()}`;
            label.append(name,details);
            label.style.cssText='flex:1;min-width:0;margin-right:8px;';

            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'Hapus';
            removeBtn.type = 'button';
            removeBtn.className = 'action-button secondary';
            removeBtn.style.cssText = 'padding:3px 12px; width:auto; font-size:11px; flex-shrink:0;';
            removeBtn.addEventListener('click', () => removePerAppOverride(pkg));

            row.appendChild(ZenkuApps.icon(pkg,34));
            row.appendChild(label);
            row.appendChild(removeBtn);
            perAppOverrideListDiv.appendChild(row);
        });
    } catch (error) {
        perAppOverrideListDiv.innerHTML = `<span style="color:#ff6b6b;">Gagal memuat override: ${error.message}</span>`;
    }
}

/**
 * Applies AOSP per-app ANGLE selection using Settings.Global.
 * Supported values: default, native, angle.
 */
async function applyPerAppOverride() {
    const pkg = perAppPackageSelect.value;
    const driverChoice = perAppDriverSelect.value; // 'default' | 'native' | 'angle'

    if (!pkg) {
        updateStatus("Pilih aplikasi dulu sebelum menerapkan.", true);
        return;
    }

    updateStatus(`Menerapkan override untuk ${pkg}...`);
    applyPerAppButton.disabled = true;

    try {
        const map = await getPerAppAngleOverrides();
        if (driverChoice === 'default') {
            delete map[pkg];
        } else if (driverChoice === 'native' || driverChoice === 'angle') {
            map[pkg] = driverChoice;
        } else {
            throw new Error(`Pilihan driver tidak valid: ${driverChoice}`);
        }
        await savePerAppAngleOverrides(map);

        updateStatus(`Override untuk ${pkg} diterapkan. Force-stop & buka ulang app-nya agar aktif.`, false, true, 4000, true);
        logActivity("SUCCESS", "Per-app ANGLE override diterapkan.", `${pkg} → ${driverChoice}`);
        await renderPerAppOverrideList();
    } catch (error) {
        updateStatus(`ERROR: Gagal menerapkan override. (${error.message})`, true);
        logActivity("ERROR", "Gagal menerapkan per-app override.", error.message);
    } finally {
        applyPerAppButton.disabled = false;
    }
}

/**
 * Removes a single package from the per-app ANGLE override list.
 */
async function removePerAppOverride(pkg) {
    updateStatus(`Menghapus override untuk ${pkg}...`);
    try {
        const map = await getPerAppAngleOverrides();
        delete map[pkg];
        await savePerAppAngleOverrides(map);

        updateStatus(`Override untuk ${pkg} dihapus.`, false, true, 2500, true);
        logActivity("SUCCESS", `Override ANGLE dihapus.`, pkg);
        await renderPerAppOverrideList();
    } catch (error) {
        updateStatus(`ERROR: Gagal menghapus override. (${error.message})`, true);
        logActivity("ERROR", "Gagal menghapus per-app override.", error.message);
    }
}

/** Applies a predefined HWUI + RenderEngine combo. */
async function applyRenderingPreset(hwui, renderengine) {
    hwuiRendererSelect.value = hwui;
    renderengineBackendSelect.value = renderengine;
    await applyRenderingSettings();
}

/**
 * Applies the selected rendering backend settings.
 */
async function applyRenderingSettings() {
    const selectedHwui = hwuiRendererSelect.value;
    const selectedRenderengine = renderengineBackendSelect.value;
    let successCount = 0;
    const failMessages = [];
    let logMessage = "Rendering settings applied:";
    const logInstruction = "Some changes may require a reboot to be fully applied.";

    updateStatus("Applying rendering settings...", false);

    const hwuiSuccess = await setSystemProperty(HWUI_RENDERER_PROP, selectedHwui);
    if (hwuiSuccess) { successCount++; logMessage += ` HWUI: ${selectedHwui}`; }
    else failMessages.push(`HWUI Renderer: ${selectedHwui}`);

    const renderengineSuccess = await setSystemProperty(RENDERENGINE_BACKEND_PROP, selectedRenderengine);
    if (renderengineSuccess) { successCount++; logMessage += ` RenderEngine: ${selectedRenderengine}`; }
    else failMessages.push(`RenderEngine Backend: ${selectedRenderengine}`);

    if (successCount === 2) {
        const configToSave = `hwui=${selectedHwui}\nrenderengine=${selectedRenderengine}`;
        const saveConfigResult = await executeShellCommand(
            `printf '%s\n' "${configToSave}" > "${LAST_APPLIED_RENDERING_CONFIG_PATH}"`,
            "Saving rendering configuration"
        );
        if (saveConfigResult.code !== 0) {
            console.warn(`Failed to save rendering config: ${saveConfigResult.stderr}`);
            updateStatus(`Successfully applied, but failed to save rendering configuration. (${saveConfigResult.stderr})`, true);
            logActivity("WARN", "Successfully applied, but failed to save rendering configuration.", `Error: ${saveConfigResult.stderr}.`);
        } else {
            updateStatus("Settings applied", false, true, 3000, true);
            logActivity("SUCCESS", logMessage, logInstruction);
        }
    } else if (successCount > 0) {
        updateStatus(`Some rendering settings failed to apply: ${failMessages.join(', ')}.`, true);
        logActivity("ERROR", "Failed to apply some rendering settings.", `Details: ${failMessages.join(', ')}.`);
    } else {
        updateStatus("Failed to apply rendering settings.", true);
        logActivity("ERROR", "Failed to apply rendering settings.", "Make sure KernelSU has full root permissions.");
    }
    await loadCurrentGpuStatus();
}

/**
 * Resets rendering backend settings to 'default' (deletes the properties).
 */
async function resetRenderingSettings() {
    let successCount = 0;
    const failMessages = [];
    updateStatus("Resetting rendering settings to default...", false);

    if (await setSystemProperty(HWUI_RENDERER_PROP, 'default')) successCount++;
    else failMessages.push('HWUI Renderer');

    if (await setSystemProperty(RENDERENGINE_BACKEND_PROP, 'default')) successCount++;
    else failMessages.push('RenderEngine Backend');

    const deleteConfigResult = await executeShellCommand(
        `rm -f "${LAST_APPLIED_RENDERING_CONFIG_PATH}"`,
        "Deleting saved rendering configuration"
    );
    if (deleteConfigResult.code !== 0) {
        console.warn(`Failed to delete saved rendering config: ${deleteConfigResult.stderr}`);
    }

    if (successCount === 2) {
        hwuiRendererSelect.value = 'default';
        renderengineBackendSelect.value = 'default';
        updateStatus("Reset complete", false, true, 3000, true);
        logActivity("SUCCESS", "Rendering settings reset to default.", "A reboot may be required for all effects to apply.");
    } else {
        updateStatus(`Reset tidak lengkap: ${failMessages.join(', ')}.`, true);
        logActivity("ERROR", "Failed to reset some rendering settings.", failMessages.join(', '));
    }
    await loadCurrentGpuStatus();
}

/**
 * Applies all FPSGO optimizations from the Zenku script.
 */
async function applyFpsgoOptimizations() {
    updateStatus("Applying FPSGO optimizations...", false);
    let success = true;
    let failMessages = [];
    let command;

    const tweaks = [
        { path: FPSGO_ENABLE_PATH, value: "0", desc: "Disable FPSGO Core" },
        { path: FSTB_SELF_CTRL_FPS_ENABLE_PATH, value: "0", desc: "Disable FSTB Self-Control" },
        { path: FSTB_TARGET_FPS_MARGIN_HIGH_FPS_PATH, value: "100", desc: "Change high FPS margin" },
        { path: FSTB_TARGET_FPS_MARGIN_LOW_FPS_PATH, value: "100", desc: "Change low FPS margin" },
        { path: FSTB_SET_RENDER_MAX_FPS_PATH, value: "120", desc: "Set maximum render FPS (120)" }
    ];

    let appliedConfig = [];

    for (const tweak of tweaks) {
        // Before writing, try to set chmod to 644
        const chmodCmd = `chmod 644 "${tweak.path}"`;
        const chmodResult = await executeShellCommand(chmodCmd, `Attempting to set RW permissions for ${tweak.path}`);
        if (chmodResult.code !== 0) {
            console.warn(`Warning: Failed to chmod 644 for ${tweak.path}. The file may be read-only by the kernel or permissions are insufficient. Error: ${chmodResult.stderr}`);
            // Continue trying to write, because sometimes echo still works even if chmod fails
        }

        command = writeToProcFile(tweak.path, tweak.value);
        const writeResult = await executeShellCommand(command, `Applying: ${tweak.desc}`);
        
        // After writing, try to set chmod back to 444
        const chmodBackCmd = `chmod 444 "${tweak.path}"`;
        const chmodBackResult = await executeShellCommand(chmodBackCmd, `Attempting to restore R permissions for ${tweak.path}`);
        if (chmodBackResult.code !== 0) {
            console.warn(`Warning: Failed to chmod 444 for ${tweak.path}. Error: ${chmodBackResult.stderr}`);
        }

        if (writeResult.code !== 0) {
            success = false;
            failMessages.push(tweak.desc);
            logActivity("ERROR", `Failed: ${tweak.desc}.`, `Error: ${writeResult.stderr}.`);
        } else {
            appliedConfig.push(`${tweak.path}=${tweak.value}`);
            logActivity("SUCCESS", `Successful: ${tweak.desc}.`, `Value: ${tweak.value}`);
        }
    }

    if (success) {
        // Save the configuration to cache
        const saveConfigResult = await executeShellCommand(
            `echo "${appliedConfig.join('\n')}" > "${LAST_APPLIED_FPSGO_CONFIG_PATH}"`,
            "Saving FPSGO configuration"
        );
        if (saveConfigResult.code !== 0) {
            console.warn(`Failed to save FPSGO config: ${saveConfigResult.stderr}`);
            updateStatus(`Successfully applied optimizations, but failed to save FPSGO configuration. (${saveConfigResult.stderr})`, true);
            logActivity("WARN", `Successfully applied optimizations, but failed to save FPSGO configuration.`, `Error: ${saveConfigResult.stderr}. The configuration may not persist after reboot.`);
        } else {
            updateStatus("FPSGO optimizations applied successfully!", false, true, 3000, true);
            logActivity("SUCCESS", "All FPSGO optimizations applied successfully.", "The device may need to be rebooted for full effect.");
        }
    } else {
        updateStatus(`Failed to apply some FPSGO optimizations: ${failMessages.join(', ')}.`, true);
        logActivity("ERROR", `Failed to apply some FPSGO optimizations.`, `Details: ${failMessages.join(', ')}. Check permissions or compatibility.`);
    }
    await loadCurrentGpuStatus();
}

/**
 * Resets all FPSGO settings to factory defaults.
 */
async function resetFpsgoDefaults() {
    updateStatus("Resetting FPSGO settings to default...", false);
    let success = true;
    let failMessages = [];
    let command;

    const defaultTweaks = [
        { path: FPSGO_ENABLE_PATH, value: FPSGO_DEFAULT_ENABLE, desc: "Enable FPSGO Core (Default)" },
        { path: FSTB_SELF_CTRL_FPS_ENABLE_PATH, value: FSTB_DEFAULT_SELF_CTRL_FPS_ENABLE, desc: "Enable FSTB Self-Control (Default)" },
        { path: FSTB_TARGET_FPS_MARGIN_HIGH_FPS_PATH, value: FSTB_DEFAULT_TARGET_FPS_MARGIN_HIGH_FPS, desc: "Reset high FPS margin (Default)" },
        { path: FSTB_TARGET_FPS_MARGIN_LOW_FPS_PATH, value: FSTB_DEFAULT_TARGET_FPS_MARGIN_LOW_FPS, desc: "Reset low FPS margin (Default)" },
        { path: FSTB_SET_RENDER_MAX_FPS_PATH, value: FSTB_DEFAULT_SET_RENDER_MAX_FPS, desc: "Reset maximum render FPS (Default)" }
    ];

    for (const tweak of defaultTweaks) {
        // Before writing, try to set chmod to 644
        const chmodCmd = `chmod 644 "${tweak.path}"`;
        const chmodResult = await executeShellCommand(chmodCmd, `Attempting to set RW permissions for ${tweak.path}`);
        if (chmodResult.code !== 0) {
            console.warn(`Warning: Failed to chmod 644 for ${tweak.path}. The file may be read-only by the kernel or permissions are insufficient. Error: ${chmodResult.stderr}`);
        }

        command = writeToProcFile(tweak.path, tweak.value);
        const writeResult = await executeShellCommand(command, `Resetting: ${tweak.desc}`);

        // After writing, try to set chmod back to 444
        const chmodBackCmd = `chmod 444 "${tweak.path}"`;
        const chmodBackResult = await executeShellCommand(chmodBackCmd, `Attempting to restore R permissions for ${tweak.path}`);
        if (chmodBackResult.code !== 0) {
            console.warn(`Warning: Failed to chmod 444 for ${tweak.path}. Error: ${chmodBackResult.stderr}`);
        }

        if (writeResult.code !== 0) {
            success = false;
            failMessages.push(tweak.desc);
            logActivity("ERROR", `Failed to reset: ${tweak.desc}.`, `Error: ${writeResult.stderr}.`);
        } else {
            logActivity("SUCCESS", `Successfully reset: ${tweak.desc}.`, `Value: ${tweak.value}`);
        }
    }

    // Delete the saved FPSGO configuration file
    const deleteConfigResult = await executeShellCommand(
        `rm -f ${LAST_APPLIED_FPSGO_CONFIG_PATH}`,
        "Deleting saved FPSGO configuration"
    );
    if (deleteConfigResult.code !== 0) {
        console.warn(`Failed to delete saved FPSGO config: ${deleteConfigResult.stderr}`);
        logActivity("WARN", `Failed to delete saved FPSGO configuration.`, `Error: ${deleteConfigResult.stderr}.`);
    }

    if (success) {
        updateStatus("FPSGO settings successfully reset to default.", false, true, 3000, true);
        logActivity("SUCCESS", "All FPSGO settings successfully reset to default.", "The device **may need to be rebooted** for the effects to fully work.");
    } else {
        updateStatus(`Failed to reset some FPSGO settings: ${failMessages.join(', ')}.`, true);
        logActivity("ERROR", `Failed to reset some FPSGO settings.`, `Details: ${failMessages.join(', ')}. Check permissions or compatibility.`);
    }
    await loadCurrentGpuStatus();
}

/**
 * Applies VCore and GPU DVFS boosting.
 */
async function applyVcoreGpuBoosting() {
    updateStatus("Applying VCore & GPU Boosting...", false);
    let success = true;
    let failMessages = [];
    let appliedConfig = [];

    const tweaks = [
        { path: HELIO_DVFS_FORCE_VCORE_DVFS_OPP_PATH, value: "0", desc: "Force VCore DVFS OPP to 0 (Boosting)" },
        { path: GED_GPU_DVFS_ENABLE_PATH, value: "0", desc: "Disable GPU DVFS (Lock GPU frequency)" }
    ];

    for (const tweak of tweaks) {
        // Attempt to set chmod 644 before writing
        const chmodCmd = `chmod 644 "${tweak.path}"`;
        const chmodResult = await executeShellCommand(chmodCmd, `Attempting to set RW permissions for ${tweak.path}`);
        if (chmodResult.code !== 0) {
            console.warn(`Warning: Failed to chmod 644 for ${tweak.path}. Error: ${chmodResult.stderr}`);
        }

        const writeResult = await executeShellCommand(writeToProcFile(tweak.path, tweak.value), `Applying: ${tweak.desc}`);

        // Attempt to set chmod 444 after writing
        const chmodBackCmd = `chmod 444 "${tweak.path}"`;
        const chmodBackResult = await executeShellCommand(chmodBackCmd, `Attempting to restore R permissions for ${tweak.path}`);
        if (chmodBackResult.code !== 0) {
            console.warn(`Warning: Failed to chmod 444 for ${tweak.path}. Error: ${chmodBackResult.stderr}`);
        }

        if (writeResult.code !== 0) {
            success = false;
            failMessages.push(tweak.desc);
            logActivity("ERROR", `Failed: ${tweak.desc}.`, `Error: ${writeResult.stderr}.`);
        } else {
            appliedConfig.push(`${tweak.path}=${tweak.value}`);
            logActivity("SUCCESS", `Successful: ${tweak.desc}.`, `Value: ${tweak.value}`);
        }
    }

    if (success) {
        const saveConfigResult = await executeShellCommand(
            `echo "${appliedConfig.join('\n')}" > "${LAST_APPLIED_VCORE_GPU_CONFIG_PATH}"`,
            "Saving VCore & GPU DVFS configuration"
        );
        if (saveConfigResult.code !== 0) {
            console.warn(`Failed to save VCore & GPU DVFS config: ${saveConfigResult.stderr}`);
            updateStatus(`Successfully applied, but failed to save VCore & GPU DVFS configuration. (${saveConfigResult.stderr})`, true);
            logActivity("WARN", `Successfully applied, but failed to save VCore & GPU DVFS configuration.`, `Error: ${saveConfigResult.stderr}. The configuration may not persist after reboot.`);
        } else {
            updateStatus("VCore & GPU Boosting applied successfully!", false, true, 3000, true);
            logActivity("SUCCESS", "VCore & GPU Boosting applied successfully.", "This aims to lock GPU frequency and prevent DVFS.");
        }
    } else {
        updateStatus(`Failed to apply some VCore & GPU Boosting settings: ${failMessages.join(', ')}.`, true);
        logActivity("ERROR", `Failed to apply some VCore & GPU Boosting settings.`, `Details: ${failMessages.join(', ')}. Check compatibility or permissions.`);
    }
    await loadCurrentGpuStatus();
}

/**
 * Resets VCore and GPU DVFS to default values.
 */
async function resetVcoreGpuDvfs() {
    updateStatus("Resetting VCore & GPU DVFS to default...", false);
    let success = true;
    let failMessages = [];

    const defaultTweaks = [
        // Menggunakan nilai "255" untuk reset VCore DVFS sesuai permintaan pengguna
        { path: HELIO_DVFS_FORCE_VCORE_DVFS_OPP_PATH, value: "255", desc: "Reset VCore DVFS (Off/Default)" },
        { path: GED_GPU_DVFS_ENABLE_PATH, value: GPU_DVFS_DEFAULT_VALUE, desc: "Enable GPU DVFS (Default)" }
    ];

    for (const tweak of defaultTweaks) {
        // Attempt to set chmod 644 before writing
        const chmodCmd = `chmod 644 "${tweak.path}"`;
        const chmodResult = await executeShellCommand(chmodCmd, `Attempting to set RW permissions for ${tweak.path}`);
        if (chmodResult.code !== 0) {
            console.warn(`Warning: Failed to chmod 644 for ${tweak.path}. Error: ${chmodResult.stderr}`);
        }

        const writeResult = await executeShellCommand(writeToProcFile(tweak.path, tweak.value), `Resetting: ${tweak.desc}`);

        // Attempt to set chmod 444 after writing
        const chmodBackCmd = `chmod 444 "${tweak.path}"`;
        const chmodBackResult = await executeShellCommand(chmodBackCmd, `Attempting to restore R permissions for ${tweak.path}`);
        if (chmodBackResult.code !== 0) {
            console.warn(`Warning: Failed to chmod 444 for ${tweak.path}. Error: ${chmodBackResult.stderr}`);
        }

        if (writeResult.code !== 0) {
            success = false;
            failMessages.push(tweak.desc);
            logActivity("ERROR", `Failed to reset: ${tweak.desc}.`, `Error: ${writeResult.stderr}.`);
        } else {
            logActivity("SUCCESS", `Successfully reset: ${tweak.desc}.`, `Value: ${tweak.value}`);
        }
    }

    // Delete the saved VCore & GPU DVFS configuration file
    const deleteConfigResult = await executeShellCommand(
        `rm -f ${LAST_APPLIED_VCORE_GPU_CONFIG_PATH}`,
        "Deleting saved VCore & GPU DVFS configuration"
    );
    if (deleteConfigResult.code !== 0) {
        console.warn(`Failed to delete saved VCore & GPU DVFS config: ${deleteConfigResult.stderr}`);
        logActivity("WARN", `Failed to delete saved VCore & GPU DVFS configuration.`, `Error: ${deleteConfigResult.stderr}.`);
    }

    if (success) {
        updateStatus("VCore & GPU DVFS settings successfully reset to default.", false, true, 3000, true);
        logActivity("SUCCESS", "VCore & GPU DVFS settings successfully reset to default.", "The device **may need to be rebooted** for the effects to fully work.");
    } else {
        updateStatus(`Failed to reset some VCore & GPU DVFS settings: ${failMessages.join(', ')}.`, true);
        logActivity("ERROR", `Failed to reset some VCore & GPU DVFS settings.`, `Details: ${failMessages.join(', ')}. Check permissions or compatibility.`);
    }
    await loadCurrentGpuStatus();
}

/**
 * Applies DVFSRC memory tuning settings - FIXED VERSION WITH PERMISSIONS
 */
async function applyDvfsrcSettings() {
    const selectedGovernor = dvfsrcGovernorSelect.value;
    const selectedMinFreq = dvfsrcMinFreqSelect.value;
    const selectedMaxFreq = dvfsrcMaxFreqSelect.value;
    
    let success = true;
    let failMessages = [];
    let appliedConfig = [];

    updateStatus("Applying DVFSRC memory tuning...", false);

    // Apply governor
    if (selectedGovernor !== "default") {
        // Set permissions first
        const chmodCmd = `chmod 644 "${DVFSRC_GOVERNOR_PATH}"`;
        await executeShellCommand(chmodCmd, `Setting permissions for governor`);
        
        const govResult = await executeShellCommand(
            `echo '${selectedGovernor}' > "${DVFSRC_GOVERNOR_PATH}"`,
            `Setting DVFSRC governor to ${selectedGovernor}`
        );
        
        // Restore permissions
        const chmodBackCmd = `chmod 444 "${DVFSRC_GOVERNOR_PATH}"`;
        await executeShellCommand(chmodBackCmd, `Restoring permissions for governor`);
        
        if (govResult.code === 0) {
            appliedConfig.push(`governor=${selectedGovernor}`);
            logActivity("SUCCESS", `DVFSRC governor set to ${selectedGovernor}`, "");
        } else {
            success = false;
            failMessages.push(`Governor: ${selectedGovernor}`);
            logActivity("ERROR", `Failed to set governor to ${selectedGovernor}`, "Path might be read-only or incompatible");
        }
    }

    // Apply min frequency
    if (selectedMinFreq !== "default") {
        // Set permissions first
        const chmodCmd = `chmod 644 "${DVFSRC_MIN_FREQ_PATH}"`;
        await executeShellCommand(chmodCmd, `Setting permissions for min freq`);
        
        const minFreqResult = await executeShellCommand(
            `echo '${selectedMinFreq}' > "${DVFSRC_MIN_FREQ_PATH}"`,
            `Setting DVFSRC min freq`
        );
        
        // Restore permissions
        const chmodBackCmd = `chmod 444 "${DVFSRC_MIN_FREQ_PATH}"`;
        await executeShellCommand(chmodBackCmd, `Restoring permissions for min freq`);
        
        if (minFreqResult.code === 0) {
            appliedConfig.push(`min_freq=${selectedMinFreq}`);
            const freqMHz = parseInt(selectedMinFreq) / 1000000;
            logActivity("SUCCESS", `DVFSRC min freq set to ${freqMHz} MHz`, "");
        } else {
            success = false;
            failMessages.push(`Min Freq: ${selectedMinFreq}`);
        }
    }

    // Apply max frequency
    if (selectedMaxFreq !== "default") {
        // Set permissions first
        const chmodCmd = `chmod 644 "${DVFSRC_MAX_FREQ_PATH}"`;
        await executeShellCommand(chmodCmd, `Setting permissions for max freq`);
        
        const maxFreqResult = await executeShellCommand(
            `echo '${selectedMaxFreq}' > "${DVFSRC_MAX_FREQ_PATH}"`,
            `Setting DVFSRC max freq`
        );
        
        // Restore permissions
        const chmodBackCmd = `chmod 444 "${DVFSRC_MAX_FREQ_PATH}"`;
        await executeShellCommand(chmodBackCmd, `Restoring permissions for max freq`);
        
        if (maxFreqResult.code === 0) {
            appliedConfig.push(`max_freq=${selectedMaxFreq}`);
            const freqMHz = parseInt(selectedMaxFreq) / 1000000;
            logActivity("SUCCESS", `DVFSRC max freq set to ${freqMHz} MHz`, "");
        } else {
            success = false;
            failMessages.push(`Max Freq: ${selectedMaxFreq}`);
        }
    }

    if (success || appliedConfig.length > 0) {
        // Save configuration even if partial success
        if (appliedConfig.length > 0) {
            const saveResult = await executeShellCommand(
                `echo "${appliedConfig.join('\n')}" > "${LAST_APPLIED_DVFSRC_CONFIG_PATH}"`,
                "Saving DVFSRC configuration"
            );
            
            if (saveResult.code !== 0) {
                logActivity("WARN", "DVFSRC settings applied but failed to save config", "Settings may not persist after reboot");
            }
        }
        
        if (failMessages.length === 0) {
            updateStatus("DVFSRC tuning applied successfully!", false, true, 3000, true);
            logActivity("SUCCESS", "DVFSRC memory tuning applied", "Check current status for confirmation");
        } else {
            updateStatus(`Partially applied: ${failMessages.join(', ')} failed`, true);
            logActivity("WARN", "DVFSRC settings partially applied", `Failed: ${failMessages.join(', ')}`);
        }
    } else {
        updateStatus(`Failed to apply DVFSRC settings: ${failMessages.join(', ')}`, true);
        logActivity("ERROR", "Failed to apply DVFSRC settings", `All attempts failed: ${failMessages.join(', ')}`);
    }
    
    // Always refresh status to see current state
    await loadCurrentGpuStatus();
}

/**
 * Resets DVFSRC settings to default - FIXED VERSION WITH PERMISSIONS
 */
async function resetDvfsrcSettings() {
    updateStatus("Resetting DVFSRC to default...", false);

    const settings = [
        { path: DVFSRC_GOVERNOR_PATH, value: DVFSRC_DEFAULT_GOVERNOR, desc: "governor" },
        { path: DVFSRC_MIN_FREQ_PATH, value: DVFSRC_DEFAULT_MIN_FREQ, desc: "min freq" },
        { path: DVFSRC_MAX_FREQ_PATH, value: DVFSRC_DEFAULT_MAX_FREQ, desc: "max freq" }
    ];

    let success = true;
    let failMessages = [];

    for (const setting of settings) {
        // Set permissions first
        const chmodCmd = `chmod 644 "${setting.path}"`;
        await executeShellCommand(chmodCmd, `Setting permissions for ${setting.desc}`);
        
        const result = await executeShellCommand(
            `echo '${setting.value}' > "${setting.path}"`,
            `Resetting DVFSRC ${setting.desc}`
        );
        
        // Restore permissions
        const chmodBackCmd = `chmod 444 "${setting.path}"`;
        await executeShellCommand(chmodBackCmd, `Restoring permissions for ${setting.desc}`);
        
        if (result.code !== 0) {
            success = false;
            failMessages.push(setting.desc);
        }
    }

    // Delete config file
    await executeShellCommand(
        `rm -f ${LAST_APPLIED_DVFSRC_CONFIG_PATH}`,
        "Deleting DVFSRC config"
    );

    if (success) {
        updateStatus("DVFSRC reset to default", false, true, 3000, true);
        logActivity("SUCCESS", "DVFSRC settings reset to default", "");
    } else {
        updateStatus(`Failed to reset some DVFSRC settings: ${failMessages.join(', ')}`, true);
        logActivity("ERROR", "Failed to reset some DVFSRC settings", `Failed: ${failMessages.join(', ')}`);
    }

    await loadCurrentGpuStatus();
}

/**
 * Loads the last applied configuration when the UI is loaded.
 */
async function loadLastAppliedConfig() {
    try {
        // Load GPU frequency configuration
        const freqConfigResult = await exec(`cat ${LAST_APPLIED_CONFIG_PATH}`);
        if (freqConfigResult.code === 0 && freqConfigResult.stdout.trim() !== "") {
            const config = freqConfigResult.stdout.trim();
            if (config.startsWith("fixed_freq=")) {
                const value = config.substring("fixed_freq=".length);
                const freqKHz = value.split(' ')[0];
                const freqMHz = (parseInt(freqKHz) / 1000);
                
                // Set the value of the fixedFreqSelect dropdown if it matches
                const interval = setInterval(() => {
                    if (fixedFreqSelect.options.length > 1) { // Wait until there are options other than the default
                        fixedFreqSelect.value = value;
                        clearInterval(interval);
                    }
                }, 100);
                logActivity("INFO", `Last GPU frequency set to Fixed ${freqMHz} MHz.`, "This configuration was loaded from the cache file.");
                console.log(`Last applied fixed GPU frequency: ${value}`);
            } else if (config.startsWith("custom_opp_index=")) {
                const index = config.substring("custom_opp_index=".length);
                const interval = setInterval(() => {
                    if (customFreqSelect.options.length > 1) { // Wait until there are options other than the default
                        customFreqSelect.value = index;
                        clearInterval(interval);
                    }
                }, 100);
                logActivity("INFO", `Last GPU frequency set to Custom (Index ${index}).`, "This configuration was loaded from the cache file.");
                console.log(`Last applied custom GPU frequency (index): ${index}`);
            }
        } else {
            logActivity("INFO", "No last GPU frequency configuration found.", "The system will use default settings.");
        }

        // Load rendering backend configuration
        const renderConfigResult = await exec(`cat ${LAST_APPLIED_RENDERING_CONFIG_PATH}`);
        if (renderConfigResult.code === 0 && renderConfigResult.stdout.trim() !== "") {
            const lines = renderConfigResult.stdout.trim().split('\n');
            let hwui = '';
            let renderengine = '';
            lines.forEach(line => {
                if (line.startsWith("hwui=")) {
                    hwui = line.substring("hwui=".length);
                } else if (line.startsWith("renderengine=")) {
                    renderengine = line.substring("renderengine=".length);
                }
            });

            if (hwui) hwuiRendererSelect.value = hwui;
            if (renderengine) renderengineBackendSelect.value = renderengine;
            logActivity("INFO", `Last rendering settings loaded.`, `HWUI: ${hwui || 'Default'}, RenderEngine: ${renderengine || 'Default'}.`);
            console.log(`Last applied rendering settings: HWUI=${hwui}, RenderEngine=${renderengine}`);
        } else {
            logActivity("INFO", "No last rendering configuration found.", "The system will use default settings.");
        }

        // Load FPSGO configuration
        const fpsgoConfigResult = await exec(`cat ${LAST_APPLIED_FPSGO_CONFIG_PATH}`);
        if (fpsgoConfigResult.code === 0 && fpsgoConfigResult.stdout.trim() !== "") {
            const configLines = fpsgoConfigResult.stdout.trim().split('\n');
            let statusLog = "Last FPSGO optimizations loaded from cache:";
            configLines.forEach(line => {
                const [path, value] = line.split('=');
                let desc = "Unknown";
                // Add logic to translate the path to a more readable description
                if (path === FPSGO_ENABLE_PATH) desc = `FPSGO Core: ${value === '0' ? 'Disabled' : 'Enabled'}`;
                else if (path === FSTB_SELF_CTRL_FPS_ENABLE_PATH) desc = `FSTB Self-Control: ${value === '0' ? 'Disabled' : 'Enabled'}`;
                else if (path === FSTB_TARGET_FPS_MARGIN_HIGH_FPS_PATH) desc = `High FPS Margin: ${value}%`;
                else if (path === FSTB_TARGET_FPS_MARGIN_LOW_FPS_PATH) desc = `Low FPS Margin: ${value}%`;
                else if (path === FSTB_SET_RENDER_MAX_FPS_PATH) desc = `Render Max FPS: ${value}`;
                
                statusLog += `\n- ${desc}`;
            });
            logActivity("INFO", statusLog, "This is the status of the last applied and saved FPSGO optimizations.");
            console.log("Last applied FPSGO configuration loaded.");
        } else {
            logActivity("INFO", "No last FPSGO configuration found.", "The system will use default settings or those set by the system.");
        }

        // Load VCore DVFS & GPU DVFS configuration
        const vcoreGpuConfigResult = await exec(`cat ${LAST_APPLIED_VCORE_GPU_CONFIG_PATH}`);
        if (vcoreGpuConfigResult.code === 0 && vcoreGpuConfigResult.stdout.trim() !== "") {
            const configLines = vcoreGpuConfigResult.stdout.trim().split('\n');
            let statusLog = "Last VCore DVFS & GPU DVFS configuration loaded from cache:";
            configLines.forEach(line => {
                const [path, value] = line.split('=');
                let desc = "Unknown";
                if (path === HELIO_DVFS_FORCE_VCORE_DVFS_OPP_PATH) desc = `VCore DVFS Force OPP: ${value === '0' ? 'Boosting/Locked' : (value === '-1' ? 'Default/Auto' : value)}`;
                else if (path === GED_GPU_DVFS_ENABLE_PATH) desc = `GPU DVFS: ${value === '0' ? 'Disabled (Locked)' : 'Enabled (Dynamic)'}`;
                statusLog += `\n- ${desc}`;
            });
            logActivity("INFO", statusLog, "This is the status of the last applied and saved VCore DVFS & GPU DVFS settings.");
            console.log("Last applied VCore DVFS & GPU DVFS configuration loaded.");
        } else {
            logActivity("INFO", "No last VCore DVFS & GPU DVFS configuration found.", "The system will use default settings.");
        }

        // Load DVFSRC configuration
        const dvfsrcConfigResult = await exec(`cat ${LAST_APPLIED_DVFSRC_CONFIG_PATH}`);
        if (dvfsrcConfigResult.code === 0 && dvfsrcConfigResult.stdout.trim() !== "") {
            const lines = dvfsrcConfigResult.stdout.trim().split('\n');
            lines.forEach(line => {
                if (line.startsWith("governor=")) {
                    const governor = line.substring("governor=".length);
                    dvfsrcGovernorSelect.value = governor;
                } else if (line.startsWith("min_freq=")) {
                    const minFreq = line.substring("min_freq=".length);
                    dvfsrcMinFreqSelect.value = minFreq;
                } else if (line.startsWith("max_freq=")) {
                    const maxFreq = line.substring("max_freq=".length);
                    dvfsrcMaxFreqSelect.value = maxFreq;
                }
            });
            logActivity("INFO", "Last DVFSRC configuration loaded", "Memory tuning settings restored");
        }

    } catch (error) {
        console.warn("No previous configurations found or error reading config files. This is normal on first run.", error);
        logActivity("WARN", "No saved configuration found (Normal on first use).", "All settings will use system default values.");
    }
}


/**
 * UI and data initialization function.
 */
async function initializeUI() {
    updateStatus("Loading data...", false, false);
    logActivity("INFO", "Starting application", "Loading GPU and memory data");
    await loadGpuOppTable();
    await loadFixedFrequencies();
    await loadDvfsrcInfo();
    await loadLastAppliedConfig();
    await loadCurrentGpuStatus();
    await fetchInstalledApps();
    updateStatus("Ready.", false, true, 3000, true);
    logActivity("INFO", "Application is ready", "All data loaded including memory tuning");
}

// ====== EVENT LISTENERS ======

// Event listener for the Apply Fixed Frequencies button (the new one)
applyFixedFreqButton.addEventListener('click', async () => {
    const selectedValue = fixedFreqSelect.value;
    if (selectedValue) {
        await setGpuFrequency('fixed', selectedValue);
        container.classList.add('active');
        setTimeout(() => container.classList.remove('active'), 300);
    } else {
        updateStatus("Please select a fixed frequency first.", true);
        logActivity("ERROR", "Failed to apply fixed frequency.", "No selection was made.");
    }
});

// Event listener for the Apply Custom Frequencies button
applyCustomFreqButton.addEventListener('click', async () => {
    const selectedOppIndex = customFreqSelect.value;
    if (selectedOppIndex) {
        await setGpuFrequency('custom', selectedOppIndex);
        container.classList.add('active');
        setTimeout(() => container.classList.remove('active'), 300);
    } else {
        updateStatus("Please select a custom frequency first.", true);
        logActivity("ERROR", "Failed to apply custom frequency.", "No selection was made.");
    }
});

// Event listener for the Reset Fixed Frequencies button
if (resetFixedFreqButton) { 
    resetFixedFreqButton.addEventListener('click', async () => {
        await setGpuFrequency('reset', RESET_VALUE);
        container.classList.add('active');
        setTimeout(() => container.classList.remove('active'), 300);
    });
} else {
    console.error("The 'resetFixedFreqButton' element was not found in the DOM. Make sure the HTML has the correct ID.");
}


// Event listener for the Apply Rendering Settings button
applyRenderingSettingsButton.addEventListener('click', applyRenderingSettings);

// Event listener for the Reset Rendering Settings button
resetRenderingSettingsButton.addEventListener('click', resetRenderingSettings);

// Event listeners for quick preset combo buttons
if (presetFullVulkanBtn) {
    // Quick preset changes only the actual HWUI/RenderEngine pipelines.
    // ANGLE is left on Auto/Default because it is a separate per-app GLES driver selection.
    presetFullVulkanBtn.addEventListener('click', () => applyRenderingPreset('skiavk', 'skiavkthreaded'));
}
if (presetFullGlBtn) {
    // Same principle for the OpenGL preset: do not force ANGLE globally.
    presetFullGlBtn.addEventListener('click', () => applyRenderingPreset('skiagl', 'skiaglthreaded'));
}
if (presetResetBtn) {
    presetResetBtn.addEventListener('click', () => applyRenderingPreset('default', 'default'));
}

// Event listeners for Per-App ANGLE override controls
perAppPackageSelect.addEventListener('change',()=>{applyPerAppButton.disabled=!perAppPackageSelect.value;});
if (refreshAppListButton) {
    refreshAppListButton.addEventListener('click', fetchInstalledApps);
}
if (applyPerAppButton) {
    applyPerAppButton.addEventListener('click', applyPerAppOverride);
}

// Event listener for the Apply FPSGO Optimizations button
if (applyFpsgoOptimizationsButton) {
    applyFpsgoOptimizationsButton.addEventListener('click', async () => {
        await applyFpsgoOptimizations();
        container.classList.add('active');
        setTimeout(() => container.classList.remove('active'), 300);
    });
}

// Event listener for the Reset FPSGO Defaults button
if (resetFpsgoDefaultsButton) {
    resetFpsgoDefaultsButton.addEventListener('click', async () => {
        await resetFpsgoDefaults();
        container.classList.add('active');
        setTimeout(() => container.classList.remove('active'), 300);
    });
}

// --- NEW EVENT LISTENERS for VCore DVFS & GPU DVFS ---
if (applyVcoreGpuBoostingButton) {
    applyVcoreGpuBoostingButton.addEventListener('click', async () => {
        await applyVcoreGpuBoosting();
        container.classList.add('active');
        setTimeout(() => container.classList.remove('active'), 300);
    });
}

if (resetVcoreGpuDvfsButton) {
    resetVcoreGpuDvfsButton.addEventListener('click', async () => {
        await resetVcoreGpuDvfs();
        container.classList.add('active');
        setTimeout(() => container.classList.remove('active'), 300);
    });
}

// --- DVFSRC Memory Tuning Event Listeners ---
if (applyDvfsrcSettingsButton) {
    applyDvfsrcSettingsButton.addEventListener('click', async () => {
        await applyDvfsrcSettings();
        container.classList.add('active');
        setTimeout(() => container.classList.remove('active'), 300);
    });
}

if (resetDvfsrcSettingsButton) {
    resetDvfsrcSettingsButton.addEventListener('click', async () => {
        await resetDvfsrcSettings();
        container.classList.add('active');
        setTimeout(() => container.classList.remove('active'), 300);
    });
}


// Call the initialization function when DOMContentLoaded
document.addEventListener('DOMContentLoaded', initializeUI);