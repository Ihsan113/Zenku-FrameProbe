#!/system/bin/sh
# ZENKU R5.4.15 full Visual controls. Session-only; exact driver fingerprint gated.
PATH=/system/bin:/system/xbin:$PATH
export PATH
G=vendor.debug.gpud.
GPUD_SHA=561f84e37814769b85facb52e330753db34ada69edac9dfe15573485bd8b8712
MALI_SHA=f1fb52d820be0a14baaeab7bf4ed9781c6be42470397e0bfee28681d194cfa13
GPUD_LIB=/vendor/lib64/libgpud.so
MALI_LIB=/vendor/lib64/egl/mt6789/libGLES_mali.so
prop() { getprop "$1"; }
trace() { printf 'LOG %s\n' "$*"; }
put() {
    setprop "$1" "$2" || { trace "FAIL setprop $1"; return 1; }
    actual=$(prop "$1")
    [ "$actual" = "$2" ] || { trace "FAIL readback $1 expected=[$2] actual=[$actual]"; return 1; }
    trace "OK $1=[$actual]"
}
match_hash() {
    [ -r "$1" ] || return 1
    actual_hash=$(sha256sum "$1" 2>/dev/null) || return 1
    actual_hash_head=$(echo "$actual_hash" | cut -d' ' -f1)
    [ "$actual_hash_head" = "$2" ]
}
compatible() {
    compat_reason=OK
    [ "$(prop ro.build.version.sdk)" = 33 ] || { compat_reason=SDK_mismatch; return 1; }
    case "$(prop ro.vendor.mediatek.platform)" in MT6789|mt6789) ;; *) compat_reason=Platform_mismatch; return 1 ;; esac
    match_hash "$GPUD_LIB" "$GPUD_SHA" || { compat_reason=GPUD_hash_or_read_failure; return 1; }
    match_hash "$MALI_LIB" "$MALI_SHA" || { compat_reason=Mali_hash_or_read_failure; return 1; }
}
known_target() {
    pkg=$1
    case "$pkg" in ''|*[!a-zA-Z0-9_.]*|.*|*..*|*.) return 1 ;; esac
    case "$pkg" in com.android.*|android|com.topjohnwu.magisk|me.weishu.kernelsu*|com.rifsxd.ksunext|com.google.android.gms) return 1 ;; esac
    case "$pkg" in *.*) ;; *) return 1 ;; esac
    pm list packages -3 2>/dev/null | grep -Fqx "package:$pkg"
}
boolean() { case "$1" in 0|1) return 0 ;; *) return 1 ;; esac; }
clear_attrs() {
    for f in config.id buffer.size red.size green.size blue.size luminance.size alpha.size alpha.mask.size bind.to.texture.rgb bind.to.texture.rgba color.buffer.type config.caveat conformant depth.size level max.swap.interval min.swap.interval native.renderable native.visual.type renderable.type sample.buffers samples stencil.size surface.type transparent.type transparent.red.value transparent.green.value transparent.blue.value match.native.pixmap recordable.android color.component.type.ext yuv.order.ext yuv.number.of.planes.ext yuv.subsample.ext yuv.depth.range.ext yuv.csc.standard.ext yuv.plane.bpp.ext; do
        prop_name="$G"egl.attr.$f
        put "$prop_name" '' || return 1
    done
}
status() {
    if compatible; then echo compatible=1; else echo compatible=0; fi
    printf 'reason=%s\n' "$compat_reason"
    printf 'target=%s\n' "$(prop "$G"process.name)"
    enabled=$(prop "$G"enable); printf 'enabled=%s\n' "$enabled"
    at=$(prop "$G"gl.tex.parameterf.param); as=$(prop "$G"gl.sampler.parameterf.param)
    ap=$(prop "$G"gl.tex.parameterf.pname); asp=$(prop "$G"gl.sampler.parameterf.pname)
    targetf=$(prop "$G"gl.tex.parameterf.target)
    tp=$(prop "$G"gl.tex.parameteri.pname); sp=$(prop "$G"gl.sampler.parameteri.pname)
    tv=$(prop "$G"gl.tex.parameteri.param); sv=$(prop "$G"gl.sampler.parameteri.param)
    tt=$(prop "$G"gl.tex.parameteri.target)
    af=off; filter=native
    if [ "$enabled" = 1 ]; then
        if [ -n "$ap$asp" ]; then
            af=mismatch
            if [ "$ap" = GL_TEXTURE_MAX_ANISOTROPY_EXT ] && [ "$asp" = "$ap" ] && [ "$targetf" = GL_TEXTURE_2D ] && [ "$at" = "$as" ]; then
                case "$at" in 2.0|4.0|8.0|16.0) af=$at ;; esac
            fi
        fi
        if [ -z "$tp$sp$tv$sv" ]; then filter=native
        elif [ "$tt" = GL_TEXTURE_2D ] && [ "$tp" = GL_TEXTURE_MIN_FILTER ] && [ "$tv" = GL_LINEAR_MIPMAP_LINEAR ] && [ "$sp" = GL_TEXTURE_MIN_FILTER ] && [ "$sv" = GL_LINEAR_MIPMAP_LINEAR ]; then filter=trilinear
        elif [ "$tt" = GL_TEXTURE_2D ] && [ "$tp" = GL_TEXTURE_MAG_FILTER ] && [ "$tv" = GL_LINEAR ] && [ "$sp" = GL_TEXTURE_MAG_FILTER ] && [ "$sv" = GL_LINEAR ]; then filter=mag
        elif [ "$tt" = GL_TEXTURE_2D ] && [ "$tp" = GL_TEXTURE_MIN_FILTER ] && [ "$tv" = GL_LINEAR_MIPMAP_LINEAR ] && [ "$sp" = GL_TEXTURE_MAG_FILTER ] && [ "$sv" = GL_LINEAR ]; then filter=split
        else filter=mismatch
        fi
    fi
    printf 'af=%s\nfilter=%s\n' "$af" "$filter"
    [ "$enabled" = 1 ] && [ "$(prop "$G"force.rgb8888.enable)" = 1 ] && echo rgb=1 || echo rgb=0
    [ "$enabled" = 1 ] && [ "$(prop "$G"egl.choose.config)" = 1 ] && echo native=1 || echo native=0
    [ "$(prop debug.gpu.enable)" = 1 ] && [ "$(prop debug.gpu.force.highp)" = 1 ] && [ "$(prop debug.gpu.specify.app)" = "$(prop "$G"process.name)" ] && echo highp=1 || echo highp=0
    case "$(prop debug.egl.force_msaa)" in 1|true) echo aosp=1 ;; *) echo aosp=0 ;; esac
    printf 'pq=%s\n' "$(prop persist.vendor.sys.pq.picmode)"
    for key in enable process.name gl.tex.parameterf.target gl.tex.parameterf.pname gl.tex.parameterf.param gl.sampler.parameterf.pname gl.sampler.parameterf.param gl.tex.parameteri.target gl.tex.parameteri.pname gl.tex.parameteri.param gl.sampler.parameteri.pname gl.sampler.parameteri.param force.rgb8888.enable egl.choose.config egl.attr.samples egl.attr.sample.buffers; do
        prop_name="$G$key"
        printf 'PROP %s=[%s]\n' "$prop_name" "$(prop "$prop_name")"
    done
    for key in debug.gpu.enable debug.gpu.force.highp debug.gpu.specify.app debug.egl.force_msaa; do printf 'PROP %s=[%s]\n' "$key" "$(prop "$key")"; done
}
fail_closed() {
    put "$G"enable 0 || :
    put debug.gpu.enable 0 || :
    put debug.gpu.force.highp 0 || :
    put "$G"force.rgb8888.enable 0 || :
    put "$G"egl.choose.config 0 || :
    return 1
}
configure() {
    target=$1; af=$2; filter=$3; rgb=$4; native=$5; highp=$6; aosp=$7
    put "$G"process.name "$target" &&
    put "$G"log 0 &&
    put "$G"gl.shadersource.hack 0 &&
    put "$G"force.rgb8888.enable "$rgb" &&
    put "$G"egl.choose.config 0 || return 1
    afp=''; afv=''
    if [ "$af" != off ]; then afp=GL_TEXTURE_MAX_ANISOTROPY_EXT; afv=$af; fi
    put "$G"gl.tex.parameterf.target GL_TEXTURE_2D &&
    put "$G"gl.tex.parameterf.pname "$afp" &&
    put "$G"gl.tex.parameterf.param "$afv" &&
    put "$G"gl.sampler.parameterf.pname "$afp" &&
    put "$G"gl.sampler.parameterf.param "$afv" || return 1
    tp=''; tv=''; sp=''; sv=''
    case "$filter" in
        native) ;;
        trilinear) tp=GL_TEXTURE_MIN_FILTER; tv=GL_LINEAR_MIPMAP_LINEAR; sp=GL_TEXTURE_MIN_FILTER; sv=GL_LINEAR_MIPMAP_LINEAR ;;
        mag) tp=GL_TEXTURE_MAG_FILTER; tv=GL_LINEAR; sp=GL_TEXTURE_MAG_FILTER; sv=GL_LINEAR ;;
        split) tp=GL_TEXTURE_MIN_FILTER; tv=GL_LINEAR_MIPMAP_LINEAR; sp=GL_TEXTURE_MAG_FILTER; sv=GL_LINEAR ;;
        *) return 2 ;;
    esac
    put "$G"gl.tex.parameteri.target GL_TEXTURE_2D &&
    put "$G"gl.tex.parameteri.pname "$tp" &&
    put "$G"gl.tex.parameteri.param "$tv" &&
    put "$G"gl.sampler.parameteri.pname "$sp" &&
    put "$G"gl.sampler.parameteri.param "$sv" || return 1
    clear_attrs || return 1
    if [ "$rgb" = 1 ] || [ "$native" = 1 ]; then
        put "$G"egl.attr.red.size 8 &&
        put "$G"egl.attr.green.size 8 &&
        put "$G"egl.attr.blue.size 8 &&
        put "$G"egl.attr.alpha.size 8 &&
        put "$G"egl.choose.config 1 || return 1
    fi
    if [ "$native" = 1 ]; then
        put "$G"egl.attr.surface.type 5 &&
        put "$G"egl.attr.renderable.type 68 &&
        put "$G"egl.attr.sample.buffers 1 &&
        put "$G"egl.attr.samples 4 || return 1
    fi
    put debug.gpu.specify.app "$target" &&
    put debug.gpu.force.highp "$highp" || return 1
    if [ "$highp" = 1 ]; then put debug.gpu.enable 1 || return 1; else put debug.gpu.enable 0 || return 1; fi
    if [ "$aosp" = 1 ]; then put debug.egl.force_msaa true || return 1; else put debug.egl.force_msaa false || return 1; fi
    if [ "$af" != off ] || [ "$filter" != native ] || [ "$rgb" = 1 ] || [ "$native" = 1 ]; then put "$G"enable 1 || return 1; fi
}
apply_profile() {
    [ "$#" -eq 7 ] || return 2
    target=$1; af=$2; filter=$3; rgb=$4; native=$5; highp=$6; aosp=$7
    known_target "$target" || { echo 'Target tidak diizinkan' >&2; return 2; }
    case "$af" in off|2.0|4.0|8.0|16.0) ;; *) echo 'AF tidak valid' >&2; return 2 ;; esac
    case "$filter" in native|trilinear|mag|split) ;; *) echo 'Filter tidak valid' >&2; return 2 ;; esac
    for flag in "$rgb" "$native" "$highp" "$aosp"; do boolean "$flag" || return 2; done
    compatible || { echo "Driver tidak cocok ($compat_reason); tidak ada perubahan." >&2; return 1; }
    pm path "$target" 2>/dev/null | grep -q '^package:' || { echo 'Target belum terpasang.' >&2; return 1; }
    old_target=$(prop "$G"process.name); old_highp=$(prop debug.gpu.specify.app)
    put "$G"enable 0 && put debug.gpu.enable 0 && put debug.gpu.force.highp 0 || { fail_closed; return 1; }
    configure "$target" "$af" "$filter" "$rgb" "$native" "$highp" "$aosp" || { fail_closed; return 1; }
    for previous in "$old_target" "$old_highp"; do
        if known_target "$previous" && [ "$previous" != "$target" ]; then trace "force-stop $previous"; am force-stop "$previous" || { fail_closed; return 1; }; fi
    done
    trace "force-stop $target"; am force-stop "$target" || { fail_closed; return 1; }
    echo applied=1
    status
}
off() {
    old_target=$(prop "$G"process.name); old_highp=$(prop debug.gpu.specify.app)
    put "$G"enable 0 && put debug.gpu.enable 0 && put debug.gpu.force.highp 0 &&
    put "$G"egl.choose.config 0 && put "$G"force.rgb8888.enable 0 &&
    put debug.egl.force_msaa true || { fail_closed; return 1; }
    for key in gl.tex.parameterf.pname gl.tex.parameterf.param gl.sampler.parameterf.pname gl.sampler.parameterf.param gl.tex.parameteri.pname gl.tex.parameteri.param gl.sampler.parameteri.pname gl.sampler.parameteri.param; do
        prop_name="$G$key"; put "$prop_name" '' || { fail_closed; return 1; }
    done
    clear_attrs || { fail_closed; return 1; }
    for previous in "$old_target" "$old_highp"; do if known_target "$previous"; then trace "force-stop $previous"; am force-stop "$previous" || return 1; fi; done
    echo applied=1
    status
}
[ "$(id -u)" = 0 ] || { echo 'Root UID diperlukan' >&2; exit 1; }
action=$1; [ -n "$action" ] || action=unknown
trace "Root UID=0; action=$action"
case "$action" in status) status ;; apply) shift; apply_profile "$@" ;; off) off ;; *) echo 'Usage: visual_tuner.sh status|apply TARGET AF FILTER RGB NATIVE HIGHP AOSP|off' >&2; exit 2 ;; esac
