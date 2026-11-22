/* ZENKU R5.4.5 shared installed-app catalog and searchable picker.
 * Sources: KernelSU/KernelSU-Next package bridge; pm -3 fallback; games.json ONLY if needed.
 * App icons: official ksu://icon/ route, then KernelSU-Next getPackagesIcons bridge.
 * Never uses remote servers or fabricates app icons/names.
 */
(function (global) {
  'use strict';
  const PACKAGE = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)+$/;
  const byPackage = new Map();
  let cached = null;
  const iconCache = new Map();
  const safeArray = value => {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string') return [];
    try { const data = JSON.parse(value); return Array.isArray(data) ? data : []; } catch (_) { return []; }
  };
  const safePackage = value => typeof value === 'string' && value.length <= 220 && PACKAGE.test(value);
  const ksu = () => global.ksu || {};
  const bridgePM = () => {
    const b = ksu();
    if (b.pm && typeof b.pm.listPackages === 'function') return b.pm;
    if (typeof b.pm === 'function') {
      try { const p = b.pm(); if (p && typeof p.listPackages === 'function') return p; } catch (_) { /* legacy */ }
    }
    return null;
  };
  async function catalog({ exec, refresh = false } = {}) {
    if (cached && !refresh) return cached;
    const b = ksu(), pm = bridgePM();
    let packages = [], info = [], source = '', jsonNames = new Map();
    try {
      // This is metadata fallback, never a whitelist of installed apps.
      const response = await exec('cat /data/adb/modules/mtk_idle_charging_magisk/webroot/games.json');
      if ((response.code ?? response.errno) === 0) {
        for (const item of safeArray(response.stdout)) {
          if (item && safePackage(item.packageName) && typeof item.name === 'string' && item.name.trim()) {
            jsonNames.set(item.packageName, item.name.trim().slice(0, 100));
          }
        }
      }
    } catch (_) { /* optional fallback */ }
    try {
      if (pm) {
        packages = safeArray(pm.listPackages('user'));
        if (packages.length) source = 'KernelSU PackageManager';
      }
      if (!packages.length && typeof b.listUserPackages === 'function') {
        packages = safeArray(b.listUserPackages());
        if (packages.length) source = 'KernelSU PackageManager';
      }
      if (!packages.length && typeof b.listPackages === 'function') {
        packages = safeArray(b.listPackages('user'));
        if (packages.length) source = 'KernelSU PackageManager';
      }
    } catch (_) { packages = []; }
    if (!packages.length) {
      try {
        const response = await exec('pm list packages -3');
        if ((response.code ?? response.errno) === 0) {
          packages = String(response.stdout || '').split(/\r?\n/).map(s => s.trim()).filter(s => s.startsWith('package:')).map(s => s.slice(8));
          if (packages.length) source = 'Android PackageManager';
        }
      } catch (_) { /* handled by JSON fallback */ }
    }
    packages = [...new Set(packages.filter(safePackage))];
    if (packages.length) {
      const method = (pm && typeof pm.getPackagesInfo === 'function') ? names => pm.getPackagesInfo(names) :
        (typeof b.getPackagesInfo === 'function' ? names => b.getPackagesInfo(JSON.stringify(names)) : null);
      if (method) {
        for (let i = 0; i < packages.length; i += 48) {
          try { info.push(...safeArray(method(packages.slice(i, i + 48)))); } catch (_) { /* keep rest of catalog */ }
        }
      }
    } else if (jsonNames.size) {
      packages = [...jsonNames.keys()];
      source = 'games.json (fallback; instalasi belum terverifikasi)';
    }
    const labelMap = new Map();
    for (const item of info) if (item && safePackage(item.packageName) && !item.error && typeof item.appLabel === 'string' && item.appLabel.trim()) {
      if (!labelMap.has(item.packageName)) labelMap.set(item.packageName, item.appLabel.trim().slice(0, 100));
    }
    const installed = source !== 'games.json (fallback; instalasi belum terverifikasi)';
    const apps = packages.map(pkg => ({packageName: pkg, name: labelMap.get(pkg) || jsonNames.get(pkg) || pkg, installed}));
    apps.sort((a, b) => a.name.localeCompare(b.name, 'id', {sensitivity:'base'}) || a.packageName.localeCompare(b.packageName));
    byPackage.clear();
    apps.forEach(item => byPackage.set(item.packageName, item));
    cached = {apps, source:source || 'Tidak tersedia', verified: installed && !!source};
    return cached;
  }
  function iconUri(pkg) { return safePackage(pkg) ? `ksu://icon/${encodeURIComponent(pkg)}` : ''; }
  function legacyIcon(pkg) {
    if (!safePackage(pkg)) return '';
    if (iconCache.has(pkg)) return iconCache.get(pkg);
    const b = ksu();
    let uri = '';
    if (typeof b.getPackagesIcons === 'function') {
      try {
        const rows = safeArray(b.getPackagesIcons(JSON.stringify([pkg]), 48));
        const value = rows[0] && rows[0].icon;
        if (typeof value === 'string' && value.length > 50 && value.length < 200000) {
          uri = /^data:image\//.test(value) ? value : `data:image/png;base64,${value}`;
        }
      } catch (_) { /* manager unsupported */ }
    }
    iconCache.set(pkg, uri);
    return uri;
  }
  function icon(pkg, size=42) {
    const wrap=document.createElement('span');wrap.className='za-app-icon';wrap.style.setProperty('--za-icon-size',`${size}px`);
    const fallback=document.createElement('span');fallback.className='za-app-icon-placeholder';fallback.textContent=(byPackage.get(pkg)?.name || pkg || '?').slice(0,1).toUpperCase();
    wrap.appendChild(fallback);
    if (safePackage(pkg)) {
      const image=document.createElement('img');image.alt='';image.loading='lazy';image.decoding='async';
      image.onload=()=>{image.hidden=false; fallback.hidden=true;};
      image.onerror=()=>{
        if (image.dataset.legacy==='1') { image.remove();return; }
        image.dataset.legacy='1';
        const uri=legacyIcon(pkg);
        if (uri) image.src=uri;
        else image.remove();
      };
      image.hidden=true;image.src=iconUri(pkg);wrap.appendChild(image);
    }
    return wrap;
  }
  function enhanceSelect(select, {title='Pilih aplikasi / game', empty='Pilih aplikasi', secondary=''}={}) {
    if (!select || select.dataset.zenkuEnhanced === '1') return null;
    select.dataset.zenkuEnhanced='1';select.classList.add('za-native-select');
    const host=document.createElement('div');host.className='za-picker';
    const open=document.createElement('button');open.type='button';open.className='za-trigger';open.setAttribute('aria-haspopup','dialog');
    const show=document.createElement('span');show.className='za-trigger-content';const caret=document.createElement('span');caret.className='za-caret';caret.textContent='⌄';
    open.append(show,caret);host.append(open);
    const hint=document.createElement('div');hint.className='za-hint';hint.textContent=secondary;host.append(hint);
    select.insertAdjacentElement('afterend',host);
    const overlay=document.createElement('div');overlay.className='za-overlay';overlay.hidden=true;
    const panel=document.createElement('div');panel.className='za-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');
    const head=document.createElement('div');head.className='za-head';
    const heading=document.createElement('strong');heading.textContent=title;
    const closeBtn=document.createElement('button');closeBtn.type='button';closeBtn.className='za-close';closeBtn.setAttribute('aria-label','Tutup');closeBtn.textContent='×';
    head.append(heading,closeBtn);
    const search=document.createElement('input');search.type='search';search.className='za-search';search.placeholder='Cari nama aplikasi atau package…';search.setAttribute('aria-label','Cari aplikasi');
    const summary=document.createElement('div');summary.className='za-summary';
    const list=document.createElement('div');list.className='za-results';list.setAttribute('role','listbox');
    panel.append(head,search,summary,list);overlay.append(panel);document.body.append(overlay);
    let previousFocus=null;
    function options(){return [...select.options].filter(o=>o.value && o.dataset.package && safePackage(o.dataset.package));}
    function preview(){
      show.replaceChildren();const option=select.selectedOptions[0];
      if (option && option.value && option.dataset.package) {
        const texts=document.createElement('span');texts.className='za-trigger-text';
        const main=document.createElement('strong');main.textContent=option.dataset.label || option.textContent;
        const detail=document.createElement('small');detail.textContent=option.dataset.package + (option.dataset.running==='1'?' · Berjalan':'');
        texts.append(main,detail);show.append(icon(option.dataset.package,38),texts);
      } else { const text=document.createElement('span');text.className='za-trigger-empty';text.textContent=empty;show.append(text); }
    }
    function render(){
      list.replaceChildren();const term=search.value.toLocaleLowerCase('id').trim();
      const rows=options().filter(o => !term || (o.dataset.label||'').toLocaleLowerCase('id').includes(term) || o.dataset.package.toLowerCase().includes(term));
      const total=options().length;
      summary.textContent=`${rows.length} dari ${total} aplikasi` + (rows.some(o=>o.disabled)?' · Abu-abu = belum berjalan':'');
      const block=document.createDocumentFragment();
      rows.slice(0,250).forEach(option=>{
        const row=document.createElement('button');row.type='button';row.className='za-option';row.setAttribute('role','option');
        row.disabled=option.disabled;row.setAttribute('aria-selected',String(option.value===select.value));
        const text=document.createElement('span');text.className='za-option-text';
        const nm=document.createElement('strong');nm.textContent=option.dataset.label || option.dataset.package;
        const pkg=document.createElement('small');pkg.textContent=option.dataset.package;
        text.append(nm,pkg);
        const state=document.createElement('span');state.className='za-option-status';state.textContent=option.dataset.running==='1'?'Aktif':option.disabled?'Belum berjalan':'Pilih';
        row.append(icon(option.dataset.package,43),text,state);
        row.onclick=()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));preview();dismiss();};
        block.appendChild(row);
      });
      list.appendChild(block);
      if (!rows.length) {const no=document.createElement('p');no.className='za-no-results';no.textContent='Tidak ada aplikasi yang cocok.';list.append(no);}
      if (rows.length>250) {const more=document.createElement('p');more.className='za-no-results';more.textContent='Tampilkan hasil lebih spesifik dengan kolom pencarian.';list.append(more);}
    }
    function dismiss(){overlay.hidden=true;document.body.classList.remove('za-dialog-open');search.value='';if(previousFocus)previousFocus.focus();}
    function display(){previousFocus=document.activeElement;overlay.hidden=false;document.body.classList.add('za-dialog-open');render();search.focus();}
    open.onclick=display;closeBtn.onclick=dismiss;
    overlay.addEventListener('click',ev=>{if(ev.target===overlay)dismiss();});
    overlay.addEventListener('keydown',ev=>{
      if(ev.key==='Escape'){ev.preventDefault();dismiss();}
      if(ev.key==='Tab') {
        const all=[...panel.querySelectorAll('input,button:not([disabled])')];const first=all[0],last=all[all.length-1];
        if(ev.shiftKey && document.activeElement===first){ev.preventDefault();last.focus();}
        else if(!ev.shiftKey && document.activeElement===last){ev.preventDefault();first.focus();}
      }
    });
    search.addEventListener('input',render);
    select.addEventListener('change',preview);
    preview();
    return {refresh(){preview();if(!overlay.hidden)render();},setHint(message){hint.textContent=message;},open:display};
  }
  global.ZenkuApps={catalog,icon,enhanceSelect,safePackage,appName(pkg){return byPackage.get(pkg)?.name || pkg;}};
})(window);
