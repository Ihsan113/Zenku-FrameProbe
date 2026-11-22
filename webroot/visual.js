/* R5.4.15: full Visual controls restored; KSU Next session bridge. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const script='/data/adb/modules/mtk_idle_charging_magisk/visual_tuner.sh';
 const state={compatible:false,bridge:false,busy:false,activeTarget:''};
 const logs=[],flags=['rgb','native','highp','aosp'];
 let seq=0,visualPicker=null;
 async function loadVisualApps(current){
  const selected=current||state.activeTarget||$('target').value||'com.mobile.legends';
  const button=$('visual-refresh-apps');if(button)button.disabled=true;
  try{
   const result=await ZenkuApps.catalog({exec,refresh:true});
   const options=[],first=document.createElement('option');first.value='';first.textContent='-- Pilih aplikasi --';options.push(first);
   result.apps.forEach(app=>{const item=document.createElement('option');item.value=app.packageName;item.dataset.package=app.packageName;item.dataset.label=app.name;item.textContent=app.name+' ('+app.packageName+')';item.disabled=!app.installed;options.push(item);});
   $('target').replaceChildren(...options);
   const want=state.activeTarget||selected;if(result.apps.some(a=>a.packageName===want&&a.installed))$('target').value=want;
   visualPicker?.setHint(result.apps.length+' aplikasi · sumber: '+result.source+(result.verified?'':' · fallback belum diverifikasi'));visualPicker?.refresh();
   if(state.activeTarget)$('live-target').textContent=ZenkuApps.appName(state.activeTarget)+' ('+state.activeTarget+')';
   log('info','Aplikasi dinamis: '+result.apps.length+' dari '+result.source);
  }catch(e){log('error','Gagal memuat aplikasi: '+e.message);visualPicker?.setHint('Gagal memuat; tekan Refresh aplikasi.');}
  finally{if(button)button.disabled=false;}
 }
 function log(type,msg){
  const line='['+new Date().toLocaleTimeString()+'] '+type.toUpperCase()+' '+msg;logs.push(line);
  const el=document.createElement('div');el.className='v-log-entry '+type;el.textContent=line;$('logMonitor').appendChild(el);
  while(logs.length>350){logs.shift();$('logMonitor').removeChild($('logMonitor').firstChild);}
  $('log-count').textContent=String(logs.length);$('logMonitor').scrollTop=$('logMonitor').scrollHeight;
  if(!$('log-export').hidden)$('log-export').value=logs.join('\n');
 }
 const message=s=>{$('message').textContent=s;};
 function exec(command){
  return new Promise((resolve,reject)=>{
   if(typeof window.ksu==='undefined'||typeof window.ksu.exec==='undefined'){reject(new Error('KernelSU Next root bridge tidak tersedia'));return;}
   const callback='exec_callback_'+Date.now()+'_'+(++seq)+'_'+Math.random().toString(36).slice(2,8);
   const timer=setTimeout(()=>{window[callback]=()=>{delete window[callback];};reject(new Error('Timeout KSU; hasil tidak diketahui. Refresh setelah shell selesai.'));},60000);
   window[callback]=(errno,stdout,stderr)=>{clearTimeout(timer);delete window[callback];resolve({code:Number(errno),stdout:String(stdout||''),stderr:String(stderr||'')});};
   try{window.ksu.exec(command,'{}',callback);}catch(e){clearTimeout(timer);delete window[callback];reject(e);}
  });
 }
 async function shell(args){
  if(!args.every(a=>/^[A-Za-z0-9_.-]+$/.test(a)))throw new Error('Argumen tidak valid');
  const command='/system/bin/sh '+script+' '+args.join(' ');log('info',command);
  const r=await exec(command);
  for(const line of r.stdout.split(/\r?\n/)){if(!line)continue;if(line.startsWith('LOG '))log(line.startsWith('LOG FAIL')?'error':'info',line.slice(4));else if(!line.startsWith('PROP '))log('info',line);}
  if(r.stderr.trim())log('error',r.stderr.trim());log(r.code===0?'info':'error','KSU exit code: '+r.code);
  if(r.code!==0)throw new Error(r.stderr.trim()||r.stdout.trim().split('\n').slice(-3).join('; ')||'Shell gagal: '+r.code);
  return r.stdout;
 }
 function selectAf(value){const input=Array.from(document.querySelectorAll('input[name=af]')).find(el=>el.value===value);(input||$('af0')).checked=true;}
 function advanced(){return ['rgb','native','highp'].some(id=>$(id).checked);}
 function buttons(){
  const lock=state.busy||!state.compatible;$('profile').disabled=lock;$('advanced').disabled=lock;$('apply').disabled=lock;$('defaults').disabled=lock;
  $('refresh').disabled=state.busy||!state.bridge;$('off').disabled=state.busy||!state.bridge;$('visual-refresh-apps').disabled=state.busy;
  $('consent').disabled=lock;$('consent-row').hidden=!advanced();
 }
 function selectPreset(name){
  const p={
   aaa:{af:'16.0',filter:'trilinear',rgb:true,native:true,highp:true,aosp:true,summary:'AAA++: AF 16×, Trilinear, AOSP MSAA, RGBA8888, Native Mali MSAA, Highp — semua ON.'},
   performance:{af:'off',filter:'native',rgb:false,native:false,highp:false,aosp:false,summary:'Performance: Native AF/filter, seluruh MSAA dan eksperimen OFF.'},
   balance:{af:'4.0',filter:'trilinear',rgb:false,native:false,highp:false,aosp:true,summary:'Balance: AF 4× + Trilinear, AOSP MSAA ON, eksperimen RGBA/Mali MSAA/Highp OFF.'}
  }[name];if(!p)return;
  selectAf(p.af);$('filter-mode').value=p.filter;$('aosp').checked=p.aosp;$('rgb').checked=p.rgb;$('native').checked=p.native;$('highp').checked=p.highp;$('consent').checked=false;
  $('preset-summary').textContent=p.summary+' Tekan Terapkan untuk menjalankannya.';buttons();log('info','Preset dipilih: '+name.toUpperCase()+' (belum diterapkan).');
 }
 function parse(text){
  const result=Object.create(null),raw=[];
  for(const line of text.split(/\r?\n/)){if(line.startsWith('PROP ')){raw.push(line.slice(5));continue;}if(line.startsWith('LOG '))continue;const i=line.indexOf('=');if(i>0)result[line.slice(0,i)]=line.slice(i+1).trim();}
  if(!['0','1'].includes(result.compatible)||!['0','1',''].includes(result.enabled)||!('target'in result)||!('af'in result)||!('filter'in result)||!flags.every(k=>k in result))throw new Error('Respons status tidak lengkap (cek log).');
  result.raw=raw.join('\n');return result;
 }
 function show(s){
  state.compatible=s.compatible==='1';$('compat').textContent=state.compatible?'Driver cocok':'Driver berbeda';$('compat').className='v-tag '+(state.compatible?'v-good':'v-warn');
  $('live-gpud').textContent=s.enabled==='1'?'ON':s.enabled==='0'?'OFF':'Tidak terbaca';state.activeTarget=s.target||'';
  $('live-target').textContent=s.target?ZenkuApps.appName(s.target)+' ('+s.target+')':'—';
  const af=s.af==='mismatch'?'AF mismatch':s.af!=='off'?s.af.replace('.0','')+'×':'Native';
  const names={trilinear:'Trilinear',split:'Split MIN/MAG',mag:'Linear MAG',native:'Native',mismatch:'Filter mismatch'};
  $('live-filter').textContent=af+' · '+(names[s.filter]||s.filter);$('live-pq').textContent=({'0':'Standard','1':'Vivid','2':'User'})[s.pq]||s.pq||'ROM';$('raw-props').textContent=s.raw||'Tidak tersedia';
  if(Array.from($('target').options).some(o=>o.value===s.target)){$('target').value=s.target;visualPicker?.refresh();}
  selectAf(s.af);if(['native','trilinear','mag','split'].includes(s.filter))$('filter-mode').value=s.filter;
  for(const id of flags)$(id).checked=s[id]==='1';$('consent').checked=false;
  if(s.af==='mismatch'||s.filter==='mismatch')log('warn','AF/filter texture dan sampler tidak cocok.');buttons();
 }
 async function readback(){const s=parse(await shell(['status']));show(s);return s;}
 function verify(s,args){
  if(args[0]==='off')return s.enabled==='0'&&s.af==='off'&&s.filter==='native'&&s.rgb==='0'&&s.native==='0'&&s.highp==='0'&&s.aosp==='1';
  const target=args[1],af=args[2],filter=args[3],rgb=args[4],native=args[5],highp=args[6],aosp=args[7];
  const enabled=af!=='off'||filter!=='native'||rgb==='1'||native==='1'?'1':'0';
  return s.compatible==='1'&&s.target===target&&s.enabled===enabled&&s.af===af&&s.filter===filter&&s.rgb===rgb&&s.native===native&&s.highp===highp&&s.aosp===aosp;
 }
 async function run(args){
  if(state.busy)return;state.busy=true;buttons();message('Memproses via KernelSU Next...');
  try{
   if(args[0]==='status'){const s=await readback();message(state.compatible?'Getprop aktual dibaca.':'Apply dikunci: '+(s.reason||'driver tidak cocok'));log(state.compatible?'success':'warn','Status: '+(s.reason||'OK'));}
   else{const result=parse(await shell(args));if(result.applied!=='1')throw new Error('Shell tidak mengonfirmasi applied=1');log('info','Memverifikasi dengan pembacaan terpisah...');const s=await readback();if(!verify(s,args))throw new Error('Readback berbeda dari profil yang diminta.');message('Berhasil diverifikasi via getprop. Target ditutup; buka ulang secara manual.');log('success','APPLIED + VERIFIED: '+s.target+' | AF '+s.af+' | Filter '+s.filter+' | GPUD '+s.enabled);}
  }catch(e){const err=e.message||String(e);log('error',err);message('Gagal: '+err);state.compatible=false;if(args[0]!=='status'&&!/Timeout/.test(err)){try{await readback();log('warn','Status aktual setelah gagal telah dibaca.');}catch(re){log('error','Refresh gagal: '+re.message);}}}
  finally{state.busy=false;buttons();}
 }
 visualPicker=ZenkuApps.enhanceSelect($('target'),{title:'Visual · Pilih Aplikasi / Game',empty:'Pilih aplikasi untuk profil visual',secondary:'Membaca aplikasi terpasang...'});
 loadVisualApps();$('visual-refresh-apps').addEventListener('click',()=>loadVisualApps());$('refresh').addEventListener('click',()=>run(['status']));
 $('preset-aaa').addEventListener('click',()=>selectPreset('aaa'));$('preset-performance').addEventListener('click',()=>selectPreset('performance'));$('preset-balance').addEventListener('click',()=>selectPreset('balance'));
 $('defaults').addEventListener('click',()=>{if(Array.from($('target').options).some(o=>o.value==='com.mobile.legends'))$('target').value='com.mobile.legends';visualPicker?.refresh();selectAf('4.0');$('filter-mode').value='trilinear';$('aosp').checked=true;for(const id of ['rgb','native','highp'])$(id).checked=false;$('consent').checked=false;buttons();message('Default R4 diisi. Tekan Terapkan.');});
 for(const id of ['rgb','native','highp'])$(id).addEventListener('change',()=>{$('consent').checked=false;buttons();});
 $('apply').addEventListener('click',()=>{
  if(!state.compatible||state.busy)return;if(advanced()&&!$('consent').checked){message('Centang persetujuan eksperimen terlebih dahulu.');return;}
  if(!$('target').value){message('Pilih aplikasi terpasang terlebih dahulu.');return;}
  const af=document.querySelector('input[name=af]:checked').value,filter=$('filter-mode').value;
  run(['apply',$('target').value,af,filter,$('rgb').checked?'1':'0',$('native').checked?'1':'0',$('highp').checked?'1':'0',$('aosp').checked?'1':'0']);
 });
 $('off').addEventListener('click',()=>run(['off']));
 $('clear-log').addEventListener('click',()=>{logs.length=0;$('logMonitor').textContent='';$('log-count').textContent='0';$('log-export').value='';});
 $('copy-log').addEventListener('click',()=>{const out=$('log-export');out.hidden=false;out.value=logs.join('\n');out.focus();out.select();try{if(document.execCommand('copy'))message('Log disalin.');else message('Log dipilih; gunakan Salin dari Android.');}catch(e){message('Log dipilih; gunakan Salin dari Android.');}});
 state.bridge=typeof window.ksu!=='undefined'&&typeof window.ksu.exec!=='undefined';buttons();
 if(state.bridge){log('info','KernelSU Next exec bridge terdeteksi');run(['status']);}else{$('compat').textContent='Tanpa root bridge';message('Buka dari KernelSU Next WebUI.');log('error','window.ksu.exec tidak tersedia');}
})();