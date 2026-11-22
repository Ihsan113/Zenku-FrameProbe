#!/system/bin/sh
# Session-only native graphics controls. Invoke with sh from root WebUI.
# No disk cache, no service restart, no policy edits. Apply before starting target app.
PATH=/system/bin:/system/xbin:$PATH
export PATH
G=vendor.debug.gpud.
GPUD_SHA=561f84e37814769b85facb52e330753db34ada69edac9dfe15573485bd8b8712
MALI_SHA=f1fb52d820be0a14baaeab7bf4ed9781c6be42470397e0bfee28681d194cfa13
PQ_SHA=ddc5561ea671a25dd298f5c22d7756a20bb8a041a73d602d5af2cb3c4a5c593f
GPUD_LIB=/vendor/lib64/libgpud.so
MALI_LIB=/vendor/lib64/egl/mt6789/libGLES_mali.so
PQ_LIB=/vendor/lib64/hw/vendor.mediatek.hardware.pq@2.15-impl.so

prop() { getprop "$1"; }
trace() { printf 'LOG %s\n' "$*"; }
put() {
    if ! setprop "$1" "$2"; then
        trace "FAIL setprop $1"; return 1
    fi
    actual=$(prop "$1")
    if [ "$actual" != "$2" ]; then
        trace "FAIL readback $1 expected=[$2] actual=[$actual]"; return 1
    fi
    trace "OK $1=[$actual]"
}
match_hash() {
    [ -r "$1" ] || return 1
    actual_hash=$(sha256sum "$1" 2>/dev/null) || return 1
    [ "${actual_hash%% *}" = "$2" ]
}
compatible() {
    compat_reason=OK
    if [ "$(prop ro.build.version.sdk)" != 33 ]; then compat_reason=SDK_mismatch; return 1; fi
    case "$(prop ro.vendor.mediatek.platform)" in MT6789|mt6789) ;; *) compat_reason=Platform_mismatch; return 1 ;; esac
    if ! match_hash "$GPUD_LIB" "$GPUD_SHA"; then compat_reason=GPUD_hash_or_read_failure; return 1; fi
    if ! match_hash "$MALI_LIB" "$MALI_SHA"; then compat_reason=Mali_hash_or_read_failure; return 1; fi
}
# Only allow installed, non-system third-party application packages.
# Never use a user-provided string as a shell command; all callers validate syntax.
known_target() {
    pkg=$1
    case "$pkg" in
        ''|*[!a-zA-Z0-9_.]*|.*|*..*|*.) return 1 ;;
        com.android.*|android|com.topjohnwu.magisk|me.weishu.kernelsu*|com.rifsxd.ksunext|com.google.android.gms) return 1 ;;
    esac
    case "$pkg" in *.*) ;; *) return 1 ;; esac
    # Verified installed third-party package, never trust stale JSON/cache alone.
    pm list packages -3 2>/dev/null | grep -Fqx "package:$pkg"
}
boolean() { case "$1" in 0|1) return 0 ;; *) return 1 ;; esac; }
status() {
    if compatible; then echo 'compatible=1'; else echo 'compatible=0'; fi
    printf 'reason=%s\n' "$compat_reason"
    printf 'target=%s\n' "$(prop "${G}process.name")"
    enabled=$(prop "${G}enable")
    printf 'enabled=%s\n' "$enabled"
    af=$(prop "${G}gl.tex.parameterf.param")
    afsp=$(prop "${G}gl.sampler.parameterf.param")
    afp=$(prop "${G}gl.tex.parameterf.pname")
    afs=$(prop "${G}gl.sampler.parameterf.pname")
    aft=$(prop "${G}gl.tex.parameterf.target")
    tp=$(prop "${G}gl.tex.parameteri.pname")
    sp=$(prop "${G}gl.sampler.parameteri.pname")
    tv=$(prop "${G}gl.tex.parameteri.param")
    sv=$(prop "${G}gl.sampler.parameteri.param")
    tt=$(prop "${G}gl.tex.parameteri.target")
    afstate=off; tristate=0
    if [ "$enabled" = 1 ]; then
        if [ -n "$afp$afs" ]; then
            afstate=mismatch
            if [ "$afp" = GL_TEXTURE_MAX_ANISOTROPY_EXT ] && [ "$afs" = "$afp" ] && [ "$aft" = GL_TEXTURE_2D ] && [ "$af" = "$afsp" ]; then
                case "$af" in 2.0|4.0|8.0|16.0) afstate=$af ;; esac
            fi
        fi
        if [ -n "$tp$sp" ]; then
            tristate=mismatch
            if [ "$tp" = GL_TEXTURE_MIN_FILTER ] && [ "$sp" = "$tp" ] && [ "$tv" = GL_LINEAR_MIPMAP_LINEAR ] && [ "$sv" = "$tv" ] && [ "$tt" = GL_TEXTURE_2D ]; then tristate=1; fi
        fi
    fi
    printf 'af=%s\ntri=%s\n' "$afstate" "$tristate"
    for field in 'rgb:force.rgb8888.enable' 'native:egl.choose.config'; do
        key=${field%%:*}; val=$(prop "${G}${field#*:}")
        [ "$enabled" = 1 ] && [ "$val" = 1 ] && printf '%s=1\n' "$key" || printf '%s=0\n' "$key"
    done
    if [ "$(prop debug.gpu.enable)" = 1 ] && [ "$(prop debug.gpu.force.highp)" = 1 ] && [ "$(prop debug.gpu.specify.app)" = "$(prop "${G}process.name")" ]; then echo 'highp=1'; else echo 'highp=0'; fi
    case "$(prop debug.egl.force_msaa)" in 1|true) echo 'aosp=1';; *) echo 'aosp=0';; esac
    printf 'pq=%s\n' "$(prop persist.vendor.sys.pq.picmode)"
    printf 'saturation=%s\n' "$(prop persist.sys.sf.color_saturation)"
    for key in enable process.name gl.tex.parameterf.target gl.tex.parameterf.pname gl.tex.parameterf.param gl.sampler.parameterf.pname gl.sampler.parameterf.param gl.tex.parameteri.target gl.tex.parameteri.pname gl.tex.parameteri.param gl.sampler.parameteri.pname gl.sampler.parameteri.param force.rgb8888.enable egl.choose.config egl.attr.samples egl.attr.sample.buffers; do
        printf 'PROP %s=[%s]\n' "${G}$key" "$(prop "${G}$key")"
    done
    for key in debug.gpu.enable debug.gpu.force.highp debug.gpu.specify.app debug.egl.force_msaa persist.vendor.sys.pq.picmode; do printf 'PROP %s=[%s]\n' "$key" "$(prop "$key")"; done
}
fail_closed() {
    # Disable switches if a transaction fails; never turn on an incomplete policy.
    put "${G}enable" 0 || :
    put debug.gpu.enable 0 || :
    put debug.gpu.force.highp 0 || :
    echo 'Gagal menerapkan profil; sakelar debug diminta OFF. Tutup target sebelum menguji lagi.' >&2
    return 1
}
apply_profile() {
    [ "$#" -eq 7 ] || return 2
    target=$1; af=$2; tri=$3; rgb=$4; native=$5; highp=$6; aosp=$7
    known_target "$target" || { echo 'Target tidak diizinkan' >&2; return 2; }
    case "$af" in off|2.0|4.0|8.0|16.0) ;; *) echo 'AF tidak valid' >&2; return 2;; esac
    for flag in "$tri" "$rgb" "$native" "$highp" "$aosp"; do boolean "$flag" || return 2; done
    compatible || { echo "Driver tidak cocok ($compat_reason); tidak ada perubahan." >&2; return 1; }
    trace "Memeriksa target $target"
    pm path "$target" 2>/dev/null | grep -q '^package:' || { echo 'Target belum terpasang.' >&2; return 1; }
    old_target=$(prop "${G}process.name")
    old_highp=$(prop debug.gpu.specify.app)
    old_aosp=$(prop debug.egl.force_msaa)
    # Shut down master switches before changing any parameters.
    put "${G}enable" 0 && put debug.gpu.enable 0 && put debug.gpu.force.highp 0 || { fail_closed; return 1; }
    configure || { put debug.egl.force_msaa "$old_aosp" || :; fail_closed; return 1; }
    # Explicit Apply & close action: cached per-process state requires new process.
    # Close previous allowed target to avoid stale overrides, never close arbitrary apps.
    for previous in "$old_target" "$old_highp"; do
        if known_target "$previous" && [ "$previous" != "$target" ]; then
            trace "force-stop $previous"
            am force-stop "$previous" || { fail_closed; return 1; }
            trace "OK force-stop $previous"
        fi
    done
    trace "force-stop $target"
    am force-stop "$target" || { fail_closed; return 1; }
    trace "OK force-stop $target"
    echo 'applied=1'
    status
}
configure() {
    put "${G}process.name" "$target" && put "${G}log" 0 &&
    put "${G}gl.shadersource.hack" 0 && put "${G}force.rgb8888.enable" "$rgb" &&
    put "${G}egl.choose.config" 0 || return 1
    pname=''; value=''
    if [ "$af" != off ]; then pname=GL_TEXTURE_MAX_ANISOTROPY_EXT; value=$af; fi
    put "${G}gl.tex.parameterf.target" GL_TEXTURE_2D &&
    put "${G}gl.tex.parameterf.pname" "$pname" && put "${G}gl.tex.parameterf.param" "$value" &&
    put "${G}gl.sampler.parameterf.pname" "$pname" && put "${G}gl.sampler.parameterf.param" "$value" || return 1
    pname=''; value=''
    if [ "$tri" = 1 ]; then pname=GL_TEXTURE_MIN_FILTER; value=GL_LINEAR_MIPMAP_LINEAR; fi
    put "${G}gl.tex.parameteri.target" GL_TEXTURE_2D &&
    put "${G}gl.tex.parameteri.pname" "$pname" && put "${G}gl.tex.parameteri.param" "$value" &&
    put "${G}gl.sampler.parameteri.pname" "$pname" && put "${G}gl.sampler.parameteri.param" "$value" || return 1
    if [ "$native" = 1 ]; then
        # Native probe proved PBUFFER/ES2 only. Window+PBUFFER, ES2+ES3 is an
        # untested extension of the EGL template (experimental; explicit consent).
        # Clear stale override attributes before constructing the new template.
        for f in config.id buffer.size red.size green.size blue.size luminance.size alpha.size alpha.mask.size bind.to.texture.rgb bind.to.texture.rgba color.buffer.type config.caveat conformant depth.size level max.swap.interval min.swap.interval native.renderable native.visual.type renderable.type sample.buffers samples stencil.size surface.type transparent.type transparent.red.value transparent.green.value transparent.blue.value match.native.pixmap recordable.android color.component.type.ext yuv.order.ext yuv.number.of.planes.ext yuv.subsample.ext yuv.depth.range.ext yuv.csc.standard.ext yuv.plane.bpp.ext; do
            put "${G}egl.attr.$f" '' || return 1
        done
        for kv in surface.type:5 renderable.type:68 red.size:8 green.size:8 blue.size:8 alpha.size:8 sample.buffers:1 samples:4; do
            put "${G}egl.attr.${kv%%:*}" "${kv#*:}" || return 1
        done
        put "${G}egl.choose.config" 1 || return 1
    fi
    # Highp helper exists, rendering precision effect is NOT established.
    put debug.gpu.specify.app "$target" && put debug.gpu.force.highp "$highp" || return 1
    if [ "$highp" = 1 ]; then put debug.gpu.enable 1 || return 1; fi
    if [ "$aosp" = 1 ]; then put debug.egl.force_msaa true || return 1; else put debug.egl.force_msaa false || return 1; fi
    if [ "$af" != off ] || [ "$tri" = 1 ] || [ "$rgb" = 1 ] || [ "$native" = 1 ]; then
        put "${G}enable" 1 || return 1
    fi
}
# Always allow OFF even if a ROM update changed the binary. No cache is written.
off() {
    old_target=$(prop "${G}process.name"); old_highp=$(prop debug.gpu.specify.app)
    put "${G}enable" 0 && put debug.gpu.enable 0 && put debug.gpu.force.highp 0 &&
    put "${G}egl.choose.config" 0 && put "${G}force.rgb8888.enable" 0 &&
    put debug.egl.force_msaa true || { fail_closed; return 1; }
    for previous in "$old_target" "$old_highp"; do
        if known_target "$previous"; then trace "force-stop $previous"; am force-stop "$previous" || return 1; trace "OK force-stop $previous"; fi
    done
    echo 'applied=1'; status
}
[ "$(id -u)" = 0 ] || { echo "Root UID diperlukan" >&2; exit 1; }
trace "Root UID=0; action=${1:-unknown}"
case "${1:-}" in
    status) status ;;
    apply) shift; apply_profile "$@" ;;
    off) off ;;
    *) echo 'Usage: visual_tuner.sh status|apply TARGET AF TRI RGB NATIVE HIGHP AOSP|off' >&2; exit 2 ;;
esac
