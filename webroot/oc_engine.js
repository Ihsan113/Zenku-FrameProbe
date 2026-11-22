// ====== OC ENGINE (overclock_mt6789.ko) ======
// Dipakai di halaman GPU+ (gpu_plus.html), terpisah total dari gpu.js. Gak nulis ke path yang sama
// dengan fitur GPU bawaan (fix_target_opp_index / fix_custom_freq_volt) — dua-duanya
// independen dan boleh dipakai bersamaan tanpa saling timpa.
//
// Dropdown GPU Target diisi dari fixed_frequencies.json (file yang sama dengan dropdown
// Fixed Frequencies), format value "<freq_khz> <volt>". Volt ditulis MENTAH ke
// gpu_target_volt (satuan .ko: mV*100, mis. 90000 = 900mV). vsram = 0 → "sama dengan volt"
// (definisi parameter gpu_target_vsram bawaan modul). Batas volt/freq divalidasi oleh .ko
// sendiri — kalau ditolak, alasannya muncul di gpu_oc_result.
//
// Ini pakai fungsi exec() global yang sudah didefinisikan di gpu_plus.js (dimuat sebelum
// file ini), jadi gak didefinisikan ulang di sini.

(() => {
    'use strict';

    const OC_PARAMS = "/sys/module/overclock_mt6789/parameters";
    const OC_MODULE_SYSFS_DIR = "/sys/module/overclock_mt6789";
    const OC_MODULE_ID = "mtk_idle_charging_magisk";
    const OC_BASELINE_PATH = `/data/adb/modules/${OC_MODULE_ID}/cache/oc_baseline.json`;
    const OC_CACHE_DIR = `/data/adb/modules/${OC_MODULE_ID}/cache`;
    const OC_GPU_STOCK_PATH = `${OC_CACHE_DIR}/oc_gpu_stock.json`; // stock GPU idx0, dicatat service.sh saat boot
    const OC_GPU_PRESETS_JSON = "fixed_frequencies.json"; // relatif ke webroot, sama kayak gpu.js
    const OC_GPU_OPP_TABLE_PATH = "/proc/gpufreqv2/gpu_working_opp_table";
    const OC_GPU_STATUS_PATH = "/proc/gpufreqv2/gpufreq_status";
    const OC_GED_FREQ_PATH = "/sys/kernel/ged/hal/current_freqency";
    const OC_CPU_LL_LIVE_PATH = "/sys/devices/system/cpu/cpufreq/policy0/cpuinfo_max_freq";
    const OC_CPU_B_LIVE_PATH = "/sys/devices/system/cpu/cpufreq/policy6/cpuinfo_max_freq";
    const OC_CPU_CAP_MHZ = 2450; // 2.45GHz — batas stabil hasil tes, masih di bawah ceiling absolut kernel (2600MHz)

    // ---- UI elements ----
    const ocEngineBadge = document.getElementById('ocEngineBadge');
    const ocGpuSelect = document.getElementById('ocGpuSelect');
    const ocApplyGpuButton = document.getElementById('ocApplyGpuButton');
    const ocResetGpuButton = document.getElementById('ocResetGpuButton');
    const ocCpuLlSlider = document.getElementById('ocCpuLlSlider');
    const ocCpuBSlider = document.getElementById('ocCpuBSlider');
    const ocCpuLlValue = document.getElementById('ocCpuLlValue');
    const ocCpuBValue = document.getElementById('ocCpuBValue');
    const ocCpuLlMinLabel = document.getElementById('ocCpuLlMinLabel');
    const ocCpuBMinLabel = document.getElementById('ocCpuBMinLabel');
    const ocApplyCpuButton = document.getElementById('ocApplyCpuButton');
    const ocResetCpuButton = document.getElementById('ocResetCpuButton');
    const ocStatusDiv = document.getElementById('currentStatus');
    const ocRefreshStatusButton = document.getElementById('ocRefreshStatusButton');

    if (!ocEngineBadge) return; // Halaman ini gak punya section OC Engine, skip diam-diam.

    let ocGpuOpps = [];
    let ocModuleReady = false;               // modul .ko sudah ke-load (dicek saat init)
    let ocGpuFreqParam = 'gpu_target_khz';   // .ko baru; .ko lama namanya gpu_target_freq (dideteksi di init)

    // ---- Low-level helpers ----
    async function ocReadParam(name) {
        const r = await exec(`cat ${OC_PARAMS}/${name} 2>/dev/null`);
        return r.code === 0 ? r.stdout.trim() : null;
    }

    async function ocWriteParam(name, value) {
        return exec(`echo '${value}' > ${OC_PARAMS}/${name} 2>/dev/null`);
    }

    async function ocDetectGpuFreqParam() {
        const r = await exec(`[ -e "${OC_PARAMS}/gpu_target_khz" ] && echo new || { [ -e "${OC_PARAMS}/gpu_target_freq" ] && echo old || echo none; }`);
        if (r.stdout.trim() === 'old') ocGpuFreqParam = 'gpu_target_freq';
    }

    // Kunci tombol GPU selama proses jalan (cegah tap ganda), lalu balikin sesuai kondisi modul.
    function ocSetGpuBusy(busy) {
        ocApplyGpuButton.disabled = busy || !ocModuleReady || ocGpuOpps.length === 0;
        ocResetGpuButton.disabled = busy || !ocModuleReady; // reset gak butuh daftar preset
    }

    async function ocModuleLoaded() {
        const r = await exec(`[ -d "${OC_MODULE_SYSFS_DIR}" ] && echo 1 || echo 0`);
        return r.stdout.trim() === '1';
    }

    // ---- Status badge: "module: loaded · OC active" ----
    async function ocUpdateBadge() {
        const loaded = await ocModuleLoaded();
        if (!loaded) {
            ocEngineBadge.textContent = 'module: not loaded';
            ocEngineBadge.className = 'oc-badge oc-badge-unloaded';
            return false;
        }
        const [gpuTarget, cpuLl, cpuB] = await Promise.all([
            ocReadParam(ocGpuFreqParam),
            ocReadParam('cpu_ll_target_khz'),
            ocReadParam('cpu_b_target_khz'),
        ]);
        const active = (parseInt(gpuTarget) > 0) || (parseInt(cpuLl) > 0) || (parseInt(cpuB) > 0);
        ocEngineBadge.textContent = active ? 'module: loaded · OC active' : 'module: loaded · OC inactive';
        ocEngineBadge.className = active ? 'oc-badge oc-badge-active' : 'oc-badge oc-badge-inactive';
        return true;
    }

    // ---- Status aktual GPU + CPU: tampilkan tiap sumber apa adanya, tandai kalau ada yang beda ----
    async function ocRefreshStatus() {
        if (!ocStatusDiv) return;
        const WARN = 'var(--ios-warning-orange, #e5c07b)';
        const pol = n => `/sys/devices/system/cpu/cpufreq/policy${n}`;
        const sec = (name, path) => `echo "@@${name}"; cat ${path} 2>/dev/null; echo;`;
        const cmd = [
            sec('gst', OC_GPU_STATUS_PATH),
            sec('gstock', OC_GPU_STOCK_PATH),
            sec('opp', OC_GPU_OPP_TABLE_PATH),
            sec('ged', OC_GED_FREQ_PATH),
            sec('gtf', `${OC_PARAMS}/${ocGpuFreqParam}`),
            sec('gtv', `${OC_PARAMS}/gpu_target_volt`),
            sec('gres', `${OC_PARAMS}/gpu_oc_result`),
            sec('lt', `${OC_PARAMS}/cpu_ll_target_khz`),
            sec('bt', `${OC_PARAMS}/cpu_b_target_khz`),
            sec('cres', `${OC_PARAMS}/cpu_oc_result`),
            sec('lc', `${pol(0)}/scaling_cur_freq`), sec('lm', `${pol(0)}/scaling_max_freq`), sec('lx', `${pol(0)}/cpuinfo_max_freq`),
            sec('bc', `${pol(6)}/scaling_cur_freq`), sec('bm', `${pol(6)}/scaling_max_freq`), sec('bx', `${pol(6)}/cpuinfo_max_freq`),
        ].join(' ');

        let r;
        try { r = await exec(cmd); } catch (e) { r = { code: 1, stdout: '' }; }
        if (!r || !r.stdout) {
            ocStatusDiv.innerHTML = `<span style="color:${WARN};">Gagal membaca status sistem.</span>`;
            return;
        }
        const o = {};
        let cur = null;
        r.stdout.split('\n').forEach(line => {
            if (line.startsWith('@@')) { cur = line.slice(2).trim(); o[cur] = ''; }
            else if (cur) o[cur] += line + '\n';
        });
        const num = k => { const v = parseInt((o[k] || '').trim()); return isNaN(v) ? 0 : v; };
        const firstLine = k => ((o[k] || '').split('\n').find(l => l.trim()) || '').trim();
        const mhz = khz => Math.round(khz / 1000);
        const mv = raw => parseFloat((raw / 100).toFixed(2)); // satuan driver MTK: mV*100
        const differs = (aKhz, bKhz) => aKhz > 0 && bKhz > 0 && Math.abs(aKhz - bKhz) >= 1000;
        const flag = txt => ` <span style="color:${WARN};">⚠ ${txt}</span>`;

        // -- GPU --
        const table = {};
        (o.opp || '').split('\n').forEach(l => {
            const m = l.match(/\[\s*(\d+)\]\s*freq:\s*(\d+),\s*volt:\s*(\d+)/);
            if (m) table[parseInt(m[1])] = { f: parseInt(m[2]), v: parseInt(m[3]) };
        });
        let st = null;
        (o.gst || '').split('\n').forEach(l => {
            if (!l.includes('[GPU-OPP]')) return;
            const m = l.match(/Index:\s*(\d+),\s*Freq:\s*(\d+),\s*Volt:\s*(\d+)/);
            if (m) st = { i: parseInt(m[1]), f: parseInt(m[2]), v: parseInt(m[3]) };
        });
        const tf = num('gtf'), tv = num('gtv');
        const idx0 = table[0];
        const gres = firstLine('gres');

        // Baseline stock GPU idx0. Kalau belum ada dan OC lagi mati, tabel idx0 pasti stock → catat sekarang.
        let stock = null;
        try { const j = JSON.parse(o.gstock || ''); if (j.freq_khz > 0) stock = { f: j.freq_khz, v: j.volt_raw }; } catch (e) { /* belum ada */ }
        if (!stock && tf === 0 && idx0 && (!gres || /disabled|stock restored/i.test(gres))) {
            stock = { f: idx0.f, v: idx0.v };
            await exec(`mkdir -p "${OC_CACHE_DIR}" && echo '{"freq_khz": ${idx0.f}, "volt_raw": ${idx0.v}}' > "${OC_GPU_STOCK_PATH}" 2>/dev/null`);
        }

        // Fixed Freq → update gpufreq_status saja; OC Engine → patch tabel idx0 (& GED) saja.
        // Kalau beda, baseline stock yang menentukan: status == stock → cache basi (OC Engine aktif);
        // status != stock → Fixed Freq diterapkan belakangan.
        const activeIdx = st ? st.i : 0;
        const row = table[activeIdx] || null;
        let act = null, kind = 'table';
        if (!st) { act = row; }
        else if (!row || row.f === st.f) { act = { f: st.f, v: st.v }; kind = 'same'; }
        else if (stock && st.i === 0) {
            if (st.f === stock.f) { act = row; kind = 'stale'; }
            else { act = { f: st.f, v: st.v }; kind = 'override'; }
        } else { act = { f: st.f, v: st.v }; kind = 'unknown'; }
        const basis = { stale: 'OC Engine', override: 'Fixed Freq', unknown: 'belum pasti' }[kind];

        // Format node GED di HP ini: "<index> <freq KHz>", mis. "0 1100000"
        let gedMhz = null, gedIdx = null;
        const gedRaw = firstLine('ged');
        const gm2 = gedRaw.match(/^(\d+)\s+(\d+)\s*$/);
        if (gm2) {
            gedIdx = parseInt(gm2[1]);
            gedMhz = Math.round(parseInt(gm2[2]) / 1000);
        } else {
            // cadangan kalau formatnya angka tunggal (KHz / Hz / MHz)
            const gm = gedRaw.match(/\d+/);
            if (gm) {
                let n = parseInt(gm[0]);
                if (n >= 1e8) n /= 1e6; else if (n >= 1e5) n /= 1e3;
                if (n >= 100 && n <= 5000) gedMhz = Math.round(n);
            }
        }

        let idx0Flag = '';
        if (tf > 0 && idx0 && differs(idx0.f, tf)) idx0Flag = flag('beda dari target');
        else if (kind === 'override' && activeIdx === 0) idx0Flag = flag('ditimpa Fixed Freq');
        else if (kind === 'unknown' && idx0 && st && differs(idx0.f, st.f)) idx0Flag = flag('beda sumber');
        let stFlag = '';
        if (kind === 'stale') stFlag = flag('cache driver');
        else if (kind === 'unknown' && st && row && differs(st.f, row.f)) stFlag = flag('beda sumber');

        let html = '<h3>GPU</h3>';
        html += `<strong>Aktif:</strong> ${act ? `Index ${activeIdx} · ${mhz(act.f)} MHz · ${mv(act.v)} mV` : 'N/A'}${basis ? ` <span style="opacity:0.6;">(${basis})</span>` : ''}<br>`;
        html += `<strong>OPP idx0:</strong> ${idx0 ? `${mhz(idx0.f)} MHz · ${mv(idx0.v)} mV` : 'N/A'}${idx0Flag}<br>`;
        html += `<strong>Target OC:</strong> ${tf > 0 ? `${mhz(tf)} MHz · ${mv(tv)} mV` : 'Stock (OC off)'}<br>`;
        html += `<strong>gpufreq_status:</strong> ${st ? `${mhz(st.f)} MHz · ${mv(st.v)} mV` : 'N/A'}${stFlag}<br>`;
        html += `<strong>GED:</strong> ${gedMhz ? (gedIdx !== null ? `Index ${gedIdx} · ` : '') + gedMhz + ' MHz' : (gedRaw ? gedRaw.slice(0, 40) : 'N/A')}${(gedMhz && act && differs(gedMhz * 1000, act.f)) ? flag('beda') : ''}<br>`;
        html += `<strong>Hasil .ko:</strong> ${gres || '-'}`;
        if (kind === 'unknown') {
            html += '<div style="margin-top:6px; font-size:0.85em; opacity:0.6;">Baseline stock GPU belum tercatat: reboot sekali, atau Reset GPU OC lalu Refresh.</div>';
        }

        // -- CPU --
        const cpuRow = (label, c, m, x, t) => {
            const line = c > 0 ? `${mhz(c)} MHz <span style="opacity:0.6;">(limit ${mhz(m)} · maks ${mhz(x)})</span>` : 'N/A';
            const tgt = t > 0 ? `<br><strong>&nbsp;</strong>Target OC ${mhz(t)} MHz${differs(x, t) ? flag('maks beda') : ''}` : '';
            return `<strong>${label}:</strong> ${line}${tgt}<br>`;
        };
        html += '<div style="margin-top: 14px;"></div><h3>CPU</h3>';
        html += cpuRow('Little', num('lc'), num('lm'), num('lx'), num('lt'));
        html += cpuRow('Big', num('bc'), num('bm'), num('bx'), num('bt'));
        html += `<strong>Hasil .ko:</strong> ${firstLine('cres') || '-'}`;

        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        html += `<div style="margin-top: 10px; font-size:0.8em; opacity:0.5;">Diperbarui ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}</div>`;
        ocStatusDiv.innerHTML = html;
    }

    if (ocRefreshStatusButton) {
        ocRefreshStatusButton.addEventListener('click', async () => {
            ocRefreshStatusButton.disabled = true;
            try { await ocRefreshStatus(); } finally { ocRefreshStatusButton.disabled = false; }
        });
    }

    // ---- GPU dropdown, diisi dari fixed_frequencies.json ("<freq_khz> <volt>") ----
    async function ocLoadGpuOpps(moduleLoaded) {
        ocGpuOpps = [];
        try {
            const response = await fetch(OC_GPU_PRESETS_JSON);
            if (!response.ok) throw new Error(`${OC_GPU_PRESETS_JSON}: ${response.statusText}`);
            const data = await response.json();
            data.forEach((item, i) => {
                const parts = String(item.value).trim().split(/\s+/);
                const freqKhz = parseInt(parts[0]);
                const voltRaw = parseInt(parts[1]);
                if (!freqKhz || !voltRaw) return; // skip entry yang formatnya salah
                ocGpuOpps.push({
                    index: i,
                    label: item.label,
                    freqKhz,
                    voltRaw,
                    vsramRaw: 0, // 0 = "same as volt" per definisi parameter gpu_target_vsram
                });
            });
        } catch (e) {
            logActivity('ERROR', 'OC Engine: gagal muat preset GPU.', `${OC_GPU_PRESETS_JSON} — ${e.message}`);
        }

        ocGpuSelect.innerHTML = '';
        if (ocGpuOpps.length === 0) {
            ocGpuSelect.innerHTML = '<option value="" disabled selected>Preset GPU tidak terbaca</option>';
            ocGpuSelect.disabled = true;
            ocApplyGpuButton.disabled = true;
            return;
        }
        ocGpuSelect.innerHTML = '<option value="" disabled selected>Pilih frekuensi GPU...</option>';
        ocGpuOpps.forEach(o => {
            const opt = document.createElement('option');
            opt.value = o.index;
            opt.textContent = o.label;
            ocGpuSelect.appendChild(opt);
        });
        ocGpuSelect.disabled = false;
        ocSetGpuBusy(false);
    }

    ocApplyGpuButton.addEventListener('click', async () => {
        const idx = parseInt(ocGpuSelect.value);
        const opp = ocGpuOpps.find(o => o.index === idx);
        if (!opp) return;
        ocSetGpuBusy(true);
        try {
            updateStatus(`Menerapkan GPU OC: ${opp.freqKhz / 1000} MHz, volt ${opp.voltRaw}...`);
            await ocWriteParam(ocGpuFreqParam, opp.freqKhz);
            await ocWriteParam('gpu_target_volt', opp.voltRaw);
            await ocWriteParam('gpu_target_vsram', opp.vsramRaw);
            await ocWriteParam('gpu_oc_apply', 1);
            const result = await ocReadParam('gpu_oc_result');
            const ok = !!(result && result.startsWith('OK'));
            logActivity(ok ? 'SUCCESS' : 'ERROR', 'OC Engine: GPU OC diterapkan', result || '(tidak ada hasil)');
            updateStatus(ok ? 'GPU OC diterapkan.' : `GPU OC gagal: ${result}`, !ok, true, 2000);
            await ocUpdateBadge();
            await ocRefreshStatus();
        } finally {
            ocSetGpuBusy(false);
        }
    });

    ocResetGpuButton.addEventListener('click', async () => {
        ocSetGpuBusy(true);
        try {
            updateStatus('Mereset GPU OC ke stock...');
            await ocWriteParam(ocGpuFreqParam, 0);
            await ocWriteParam('gpu_target_volt', 0);
            await ocWriteParam('gpu_target_vsram', 0);
            await ocWriteParam('gpu_oc_apply', 1);
            const result = await ocReadParam('gpu_oc_result');
            const ok = !!(result && /^OK|stock restored/i.test(result));
            logActivity(ok ? 'INFO' : 'ERROR', 'OC Engine: GPU OC direset ke stock', result || '');
            ocGpuSelect.selectedIndex = 0; // balik ke placeholder
            updateStatus(ok ? 'GPU OC direset.' : `Reset GPU gagal: ${result}`, !ok, true, ok ? 1500 : 2000);
            await ocUpdateBadge();
            await ocRefreshStatus();
        } finally {
            ocSetGpuBusy(false);
        }
    });

    // ---- CPU sliders: min = stock max freq (dari baseline yang dicatat service.sh saat boot), max = 2450MHz cap ----
    async function ocLoadCpuBaseline() {
        let llStockKhz = 0, bStockKhz = 0;
        const r = await exec(`cat ${OC_BASELINE_PATH} 2>/dev/null`);
        if (r.code === 0 && r.stdout.trim()) {
            try {
                const j = JSON.parse(r.stdout);
                llStockKhz = parseInt(j.cpu_ll_stock_khz) || 0;
                bStockKhz = parseInt(j.cpu_b_stock_khz) || 0;
            } catch (e) {
                console.warn('OC Engine: gagal parse oc_baseline.json', e);
            }
        }
        // Fallback kalau file baseline belum sempat dibuat (mis. sebelum reboot pertama kali)
        if (!llStockKhz) {
            const rr = await exec(`cat ${OC_CPU_LL_LIVE_PATH} 2>/dev/null`);
            llStockKhz = parseInt(rr.stdout) || 0;
        }
        if (!bStockKhz) {
            const rr = await exec(`cat ${OC_CPU_B_LIVE_PATH} 2>/dev/null`);
            bStockKhz = parseInt(rr.stdout) || 0;
        }

        const llStockMhz = Math.round(llStockKhz / 1000);
        const bStockMhz = Math.round(bStockKhz / 1000);

        if (llStockMhz > 0) {
            ocCpuLlSlider.min = llStockMhz;
            ocCpuLlSlider.max = Math.max(OC_CPU_CAP_MHZ, llStockMhz);
            ocCpuLlSlider.step = 10;
            ocCpuLlSlider.value = llStockMhz;
            ocCpuLlSlider.disabled = false;
            ocCpuLlMinLabel.textContent = `${llStockMhz} MHz stock`;
            ocCpuLlValue.textContent = `${llStockMhz} MHz (stock)`;
        } else {
            ocCpuLlValue.textContent = 'N/A';
            logActivity('WARN', 'OC Engine: gagal baca stock max freq little cluster.', `Path dicek: ${OC_BASELINE_PATH} & ${OC_CPU_LL_LIVE_PATH}`);
        }

        if (bStockMhz > 0) {
            ocCpuBSlider.min = bStockMhz;
            ocCpuBSlider.max = Math.max(OC_CPU_CAP_MHZ, bStockMhz);
            ocCpuBSlider.step = 10;
            ocCpuBSlider.value = bStockMhz;
            ocCpuBSlider.disabled = false;
            ocCpuBMinLabel.textContent = `${bStockMhz} MHz stock`;
            ocCpuBValue.textContent = `${bStockMhz} MHz (stock)`;
        } else {
            ocCpuBValue.textContent = 'N/A';
            logActivity('WARN', 'OC Engine: gagal baca stock max freq big cluster.', `Path dicek: ${OC_BASELINE_PATH} & ${OC_CPU_B_LIVE_PATH}`);
        }

        const bothReady = llStockMhz > 0 && bStockMhz > 0;
        ocApplyCpuButton.disabled = !bothReady;
        ocResetCpuButton.disabled = !bothReady;
    }

    ocCpuLlSlider.addEventListener('input', () => {
        ocCpuLlValue.textContent = `${ocCpuLlSlider.value} MHz`;
    });
    ocCpuBSlider.addEventListener('input', () => {
        ocCpuBValue.textContent = `${ocCpuBSlider.value} MHz`;
    });

    ocApplyCpuButton.addEventListener('click', async () => {
        const llKhz = parseInt(ocCpuLlSlider.value) * 1000;
        const bKhz = parseInt(ocCpuBSlider.value) * 1000;
        updateStatus(`Menerapkan CPU OC: LL=${ocCpuLlSlider.value}MHz, B=${ocCpuBSlider.value}MHz...`);
        await ocWriteParam('cpu_ll_target_khz', llKhz);
        await ocWriteParam('cpu_b_target_khz', bKhz);
        await ocWriteParam('cpu_oc_apply', 1);
        const result = await ocReadParam('cpu_oc_result');
        const ok = !!(result && result.startsWith('OK'));
        logActivity(ok ? 'SUCCESS' : 'ERROR', 'OC Engine: CPU OC diterapkan', result || '(tidak ada hasil)');
        updateStatus(ok ? 'CPU OC diterapkan.' : `CPU OC gagal: ${result}`, !ok, true, 2000);
        await ocUpdateBadge();
        await ocRefreshStatus();
    });

    ocResetCpuButton.addEventListener('click', async () => {
        updateStatus('Mereset CPU OC ke stock...');
        await ocWriteParam('cpu_ll_target_khz', 0);
        await ocWriteParam('cpu_b_target_khz', 0);
        await ocWriteParam('cpu_oc_apply', 1);
        const result = await ocReadParam('cpu_oc_result');
        logActivity('INFO', 'OC Engine: CPU OC direset ke stock', result || '');
        ocCpuLlSlider.value = ocCpuLlSlider.min;
        ocCpuBSlider.value = ocCpuBSlider.min;
        ocCpuLlValue.textContent = `${ocCpuLlSlider.min} MHz (stock)`;
        ocCpuBValue.textContent = `${ocCpuBSlider.min} MHz (stock)`;
        updateStatus('CPU OC direset.', false, true, 1500);
        await ocUpdateBadge();
        await ocRefreshStatus();
    });

    // ---- Init ----
    async function ocInit() {
        await ocDetectGpuFreqParam();
        const loaded = await ocUpdateBadge();
        ocModuleReady = loaded;
        await ocLoadGpuOpps(loaded);
        await ocLoadCpuBaseline();
        await ocRefreshStatus();
        if (!loaded) {
            logActivity('WARN', 'OC Engine: overclock_mt6789.ko belum loaded.', 'Reboot dulu, atau cek cache/checkpoint.log buat lihat kenapa insmod gagal.');
        }
    }

    document.addEventListener('DOMContentLoaded', ocInit);
})();
