/* ZENKU Renderer API capability status. Read-only; no fake global toggles. */
(() => {
    'use strict';
    const script='/data/adb/modules/mtk_idle_charging_magisk/renderer_capabilities.sh';
    const $=id=>document.getElementById(id);
    const labels={
        pls:['WRITE_READ_RESOLVE_PASS','PLS test PASS'],
        fetch:['ARM_EXTENSIONS_PRESENT','ARM / EXT ada'],
        discard:['EXT_EXTENSION_PRESENT','EXT ada'],
        precision:['FBO_BLEND_PASS','RGBA16F / 32F PASS'],
        binary:['EXPORT_RELOAD_PASS','Export / reload PASS']
    };
    const ids={pls:'cap-pls',fetch:'cap-fetch',discard:'cap-discard',precision:'cap-precision',binary:'cap-binary'};
    function paintUnknown(reason){
        $('renderer-fingerprint').textContent='Driver belum tervalidasi';
        $('renderer-fingerprint').className='v-tag v-warn';
        Object.values(ids).forEach(id=>{ $(id).textContent='UNKNOWN'; $(id).className='v-tag v-warn'; });
        $('renderer-note').textContent='Tidak memakai hasil probe lama: '+(reason||'fingerprint tidak cocok')+'. Jalankan probe ulang sebelum mengandalkan dukungan fitur.';
    }
    function paint(data){
        if(data.driver_match!=='1'){paintUnknown(data.reason);return;}
        $('renderer-fingerprint').textContent='Fingerprint cocok';
        $('renderer-fingerprint').className='v-tag v-good';
        for(const key of Object.keys(ids)){
            const raw=data[key==='fetch'?'framebuffer_fetch':key==='discard'?'discard_framebuffer':key==='precision'?'rgba16f':key==='binary'?'shader_binary':'pls']||'UNKNOWN';
            const supported=key==='precision' ? raw==='FBO_BLEND_PASS' && data.rgba32f==='FBO_BLEND_PASS' : raw===labels[key][0];
            const node=$(ids[key]);
            node.textContent=supported?labels[key][1]:'UNKNOWN';
            node.className='v-tag '+(supported?'v-good':'v-warn');
        }
        $('renderer-note').textContent='Driver Mali-G57 MC2 cocok dengan fingerprint probe. Hasil ini membuktikan dukungan API / tes dasar, bukan berarti semua game otomatis menggunakannya. Aktivasi tetap memerlukan integrasi renderer aplikasi.';
    }
    function refresh(){
        const button=$('renderer-refresh');
        button.disabled=true;
        $('renderer-note').textContent='Membaca fingerprint driver...';
        if(!window.ksu||typeof window.ksu.exec!=='function'){
            paintUnknown('KernelSU Next root bridge tidak tersedia');
            button.disabled=false;
            return;
        }
        const callback='zenku_renderer_cb_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);
        const timer=setTimeout(()=>{delete window[callback];paintUnknown('timeout membaca driver');button.disabled=false;},20000);
        window[callback]=(errno,stdout,stderr)=>{
            clearTimeout(timer);delete window[callback];button.disabled=false;
            if(Number(errno)!==0){paintUnknown(String(stderr||stdout||'perintah gagal'));return;}
            const data=Object.create(null);
            String(stdout||'').split(/\r?\n/).forEach(line=>{const i=line.indexOf('=');if(i>0)data[line.slice(0,i)]=line.slice(i+1).trim();});
            paint(data);
        };
        try{window.ksu.exec('/system/bin/sh '+script+' status','{}',callback);}
        catch(e){clearTimeout(timer);delete window[callback];paintUnknown(e.message);button.disabled=false;}
    }
    $('renderer-refresh').addEventListener('click',refresh);
    refresh();
})();
