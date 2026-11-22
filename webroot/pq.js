/* ZENKU PQ WebRoot - KernelSU bridge; no remote network or direct browser syscalls. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const SCRIPT='/data/adb/modules/mtk_idle_charging_magisk/pq_tuner.sh';
const PRESETS=Object.freeze({
 natural:{contrast:4,saturation:4,brightness:4,mode:'automatic',sf:'1.00'},
 balanced:{contrast:5,saturation:5,brightness:4,mode:'boosted',sf:'1.10'},
 vivid:{contrast:7,saturation:7,brightness:5,mode:'boosted',sf:'1.15'},
 baseline:{contrast:4,saturation:4,brightness:4,mode:'boosted',sf:'1.10'}
});
const fields=['contrast','saturation','brightness','mode','sf'];
const state={bridge:!!(window.ksu&&typeof window.ksu.exec==='function'),jar:false,busy:false,profile:'baseline',custom:{...PRESETS.balanced},seq:0};
const out=(text,isError=false)=>{ $('output').textContent=text; $('output').className='result'+(isError?' error':''); };
const n=x=>Number(x);
function setFields(v){for (const id of fields){ if(v[id]!==undefined && v[id]!==null) $(id).value=String(v[id]); } syncSliders();}
function syncSliders(){for (const id of ['contrast','saturation','brightness']) $('v_'+id).textContent=$(id).value;}
function select(p){state.profile=p; for(const el of document.querySelectorAll('.preset'))el.classList.toggle('on',el.dataset.profile===p);$('selected-profile').textContent='Profil: '+({'natural':'Natural','balanced':'Balanced','vivid':'Vivid','custom':'Custom','baseline':'Baseline'}[p]||p);}
function refreshControls(){const enabled=state.bridge&&state.jar&&!state.busy;$('refresh').disabled=!state.bridge||state.busy;$('apply').disabled=!enabled;$('restore').disabled=!enabled; for(const el of document.querySelectorAll('input,select,.preset'))el.disabled=!enabled;}
function validatedArgs(a){if(!a.every(x=>/^[a-zA-Z0-9_.-]+$/.test(String(x))))throw Error('Parameter shell tidak valid.');return a.map(String);}
function exec(args){return new Promise((resolve,reject)=>{
 if(!state.bridge){reject(Error('Buka lewat KernelSU Next > Modul > WebUI; bridge root tidak ditemukan.'));return;}
 const a=validatedArgs(args); const name='zenku_pq_callback_'+Date.now()+'_'+(++state.seq);let done=false;
 const timer=setTimeout(()=>{if(!done){done=true;window[name]=undefined;reject(Error('Timeout dari root bridge; refresh untuk periksa status.'));}},60000);
 window[name]=(errno,stdout,stderr)=>{if(done)return;done=true;clearTimeout(timer);delete window[name];resolve({code:Number(errno),stdout:String(stdout||''),stderr:String(stderr||'')});};
 try{window.ksu.exec('/system/bin/sh '+SCRIPT+' '+a.join(' '),'{}',name);}catch(e){if(!done){done=true;clearTimeout(timer);delete window[name];reject(e);}}
 });}
function parse(s){const o=Object.create(null);for(const line of s.split(/\r?\n/)){let ix=line.indexOf('=');if(ix>0)o[line.slice(0,ix)]=line.slice(ix+1).trim();}return o;}
function readConfigVal(data,what,fallback){return Object.prototype.hasOwnProperty.call(data,what)&&data[what]!==''?data[what]:fallback;}
async function status(initial=false){if(state.busy)return;state.busy=true;refreshControls();if(initial)out('Membaca profil aktif dari MediaTek PQ HAL...');
 try{const r=await exec(['status']);if(r.code!==0)throw Error((r.stderr||r.stdout||'Status gagal').trim());const d=parse(r.stdout);if(d.bridge!=='zenku-pq-v1')throw Error('Output status bukan dari ZENKU PQ bridge yang sesuai.');state.jar=d.jar_ready==='1';
   $('health').textContent=state.jar?(d.hal_ok==='1'?'HAL Aktif':'HAL bermasalah'):'Helper belum terpasang';$('health').className='pill '+(d.hal_ok==='1'?'good':'warn');
   for(const p of ['contrast','saturation','brightness']) $('live_'+p).textContent=readConfigVal(d,'live_'+p,'—');
   $('system-status').textContent='Android mode: '+readConfigVal(d,'android_mode','?')+' · SF getprop: '+readConfigVal(d,'sf_property','?')+' · MediaTek picmode: '+readConfigVal(d,'pq_picmode','?')+'\nSF manual tidak selalu tercermin dalam getprop.';
   const p=readConfigVal(d,'profile','baseline'); const selected=PRESETS[p]||PRESETS.baseline;
   state.custom={contrast:n(readConfigVal(d,'custom_contrast',5)),saturation:n(readConfigVal(d,'custom_saturation',5)),brightness:n(readConfigVal(d,'custom_brightness',5)),mode:readConfigVal(d,'custom_mode','boosted'),sf:readConfigVal(d,'custom_sf','1.10')};
   const cv={};for(const f of fields){cv[f]=readConfigVal(d,'config_'+f,selected[f]);}setFields(cv);select(['natural','balanced','vivid','custom','baseline'].includes(p)?p:'baseline');$('autoboot').checked=d.autoboot==='1';
   out('Status dibaca. '+(d.hal_ok==='1'?'HAL merespons.':'HAL tidak bisa dibaca; cek JAR/root.')+'\nProfil tersimpan: '+p+'\nAutoboot: '+(d.autoboot==='1'?'ON':'OFF'));
 }catch(e){out('Gagal membaca status: '+(e.message||e),true);}finally{state.busy=false;refreshControls();}}
function selections(){const p={};for(const f of fields)p[f]=$(f).value;p.autoboot=$('autoboot').checked?'1':'0';return p;}
function validate(p){for(const k of ['contrast','saturation','brightness'])if(!Number.isInteger(n(p[k]))||n(p[k])<4||n(p[k])>9)throw Error(k+' dibatasi 4–9.');if(!['boosted','automatic'].includes(p.mode))throw Error('Mode tidak sah');if(!['1.00','1.05','1.10','1.15','1.20','1.25','1.30'].includes(p.sf))throw Error('Faktor SF tidak sah');}
async function run(args){if(state.busy)return;state.busy=true;refreshControls();out('Menerapkan melalui MediaTek HIDL, Settings, dan SurfaceFlinger...');
 try{const r=await exec(args);if(r.code!==0)throw Error((r.stderr||r.stdout||'Perintah gagal').trim());const d=parse(r.stdout);if(d.applied!=='1')throw Error('Tidak ada konfirmasi applied=1 dari helper.\n'+r.stdout);
  out('Berhasil dikirim dan diverifikasi via readback PQ HAL.\n'+r.stdout+'\nPeriksa warna secara visual.');
 }catch(e){out('Gagal: '+(e.message||e)+'\nGunakan Refresh untuk memeriksa pengaturan.',true);}finally{state.busy=false;refreshControls();}}
for(const b of document.querySelectorAll('.preset'))b.addEventListener('click',()=>{const p=b.dataset.profile;setFields(p==='custom'?state.custom:PRESETS[p]);select(p);out('Template '+p+' dipilih. Belum diterapkan; tekan Terapkan & simpan.');});
for(const id of fields)$(id).addEventListener('input',()=>{syncSliders();if(state.profile!=='custom')select('custom');});
$('refresh').addEventListener('click',()=>status());
$('apply').addEventListener('click',async()=>{const p=selections();try{validate(p);}catch(e){out(e.message,true);return;}const args=['apply',state.profile==='baseline'?'custom':state.profile,p.contrast,p.saturation,p.brightness,p.mode,p.sf,p.autoboot];await run(args);});
$('restore').addEventListener('click',async()=>{if(!confirm('Kembalikan PQ ke 4/4/4, Android Boosted dan SF 1.10, serta matikan autoboot?'))return;await run(['restore']);});
refreshControls();if(state.bridge)status(true);else out('Tidak ada KernelSU Next root bridge. Buka halaman ini melalui tombol WebUI pada modul ZENKU.',true);
})();
