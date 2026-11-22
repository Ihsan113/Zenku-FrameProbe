// Helper minimal buat halaman GPU+ (gpu_plus.html): exec(), logActivity(), updateStatus().
// Isinya disalin dari gpu.js supaya halaman ini gak perlu memuat gpu.js penuh
// (gpu.js mengharapkan banyak elemen yang cuma ada di gpu.html).

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


const statusDiv = document.getElementById('status');
const logMonitorDiv = document.getElementById('logMonitor');
let statusTimeout = null;
let countdownInterval = null;

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
