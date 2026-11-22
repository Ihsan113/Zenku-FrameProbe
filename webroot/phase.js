/* ZENKU R5 / KSU Next root bridge; profile changes apply ONLY during next boot. */
(()=>{'use strict';const $=id=>document.getElementById(id);const path='/data/adb/modules/mtk_idle_charging_magisk/phase_tuner.sh';let running=false;let seq=0;
function note(t){$('notice').textContent=t;$('log').textContent+='\n'+new Date().toLocaleTimeString()+' '+t;}
function exec(args){return new Promise((resolve,reject)=>{if(!window.ksu||typeof window.ksu.exec!=='function'){reject(new Error('KernelSU Next bridge tidak tersedia'));return;}
const name='phase_cb_'+Date.now()+'_'+(++seq);const timeout=setTimeout(()=>{window[name]=()=>{delete window[name]};reject(new Error('Timeout, refresh status untuk verifikasi'));},20000);
window[name]=(code,out,err)=>{clearTimeout(timeout);delete window[name];const c=Number(code);if(c!==0)reject(new Error('exit '+c+': '+String(err||out||'')));else resolve(String(out||''));};
try{window.ksu.exec('/system/bin/sh '+path+' '+args.join(' '),'{}',name);}catch(e){clearTimeout(timeout);delete window[name];reject(e);}
});}
function parse(s){const result={};for(const line of s.split(/\r?\n/)){const i=line.indexOf('=');if(i>0)result[line.slice(0,i)]=line.slice(i+1);}return result;}
function setBusy(b){running=b;$('refresh').disabled=b;$('save').disabled=b;}
async function refresh(){if(running)return;setBusy(true);try{const raw=await exec(['status']);const v=parse(raw);$('configured').textContent=v.configured||'?';$('booted').textContent=v.last_boot||'?';$('mode').textContent=v.mode==='0'?'Manual phase':'ROM duration';$('device').textContent=(v.chipset||'?')+' / SDK '+(v.sdk||'?');
$('details').textContent=raw;const radio=document.querySelector('input[name=profile][value="'+v.configured+'"]');if(radio)radio.checked=true;note('Status terbaca. '+(v.last_boot&&v.last_boot.startsWith(v.configured+':')?'Profil sama dengan boot.':'Jika profil berubah, reboot untuk aktivasi.'));}
catch(e){note('GAGAL status: '+e.message);}finally{setBusy(false);}}
async function save(){if(running)return;const radio=document.querySelector('input[name=profile]:checked');if(!radio)return;const value=radio.value;if(!['rom','stable','balanced','latency'].includes(value))return;setBusy(true);try{const raw=await exec(['set',value]);const r=parse(raw);if(r.saved!=='1'||r.configured!==value)throw new Error('Readback gagal');note('Profil '+value+' tersimpan. REBOOT diperlukan; runtime tidak diubah.');const status=await exec(['status']);const v=parse(status);$('configured').textContent=v.configured||'?';$('details').textContent=status;if(v.configured!==value)throw new Error('Konfigurasi berbeda setelah penulisan');}
catch(e){note('GAGAL simpan: '+e.message);}finally{setBusy(false);}}
$('refresh').addEventListener('click',refresh);$('save').addEventListener('click',save);refresh();})();
