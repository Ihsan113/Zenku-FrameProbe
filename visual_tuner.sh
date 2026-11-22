#!/system/bin/sh
# ZENKU verified GPUD texture controls. Session-only; no cache or persistent profile.
# Probe readback proves hook state, not direct in-game rendering or FPS.
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
    if ! setprop "$1" "$2"; then trace "FAIL setprop $1"; return 1; fi
    actual=$(prop "$1")
    if [ "$actual" != "$2" ]; then trace "FAIL readback $1 expected=[$2] actual=[$actual]"; return 1; fi
    trace "OK $1=[$actual]"
}
match_hash() {
    [ -r "$1" ] || return 1
    actual_hash=$(sha256sum "$1" 2>/dev/null) || return 1
    actual_hash_head=$(echo "$actual_hash" | awk '{print $1}')
    [ "$actual_hash_head" = "$2" ]
}
compatible() {
    compat_reason=OK
    if [ "$(prop ro.build.version.sdk)" != 33 ]; then compat_reason=SDK_mismatch; return 1; fi
    case "$(prop ro.vendor.mediatek.platform)" in MT6789|mt6789) ;; *) compat_reason=Platform_mismatch; return 1 ;; esac
    if ! match_hash "$GPUD_LIB" "$GPUD_SHA"; then compat_reason=GPUD_hash_or_read_failure; return 1; fi
    if ! match_hash "$MALI_LIB" "$MALI_SHA"; then compat_reason=Mali_hash_or_read_failure; return 1; fi
}
known_target() {
    pkg=$1
    case "$pkg" in
        ''|*[!a-zA-Z0-9_.]*|.*|*..*|*.) return 1 ;;
        com.android.*|android|com.topjohnwu.magisk|me.weishu.kernelsu*|com.rifsxd.ksunext|com.google.android.gms) return 1 ;;
    esac
    case "$pkg" in *.*) ;; *) return 1 ;; esac
    pm list packages -3 2>/dev/null | grep -Fqx "package:$pkg"
}
clear_legacy_experiments() {
    put debug.gpu.enable 0 &&
    put debug.gpu.force.highp 0 &&
    put debug.gpu.specify.app '' &&
    put debug.egl.force_msaa false &&
    put "$G"force.rgb8888.enable 0 &&
    put "$G"egl.choose.config 0 &&
    put "$G"gl.shadersource.hack 0
}
clear_egl_attributes() {
    for f in config.id buffer.size red.size green.size blue.size luminance.size alpha.size alpha.mask.size bind.to.texture.rgb bind.to.texture.rgba color.buffer.type config.caveat conformant depth.size level max.swap.interval min.swap.interval native.renderable native.visual.type renderable.type sample.buffers samples stencil.size surface.type transparent.type transparent.red.value transparent.green.value transparent.blue.value match.native.pixmap recordable.android color.component.type.ext yuv.order.ext yuv.number.of.planes.ext yuv.subsample.ext yuv.depth.range.ext yuv.csc.standard.ext yuv.plane.bpp.ext; do
        put "$G"egl.attr.$f '' || return 1
    done
}
status() {
    if compatible; then echo 'compatible=1'; else echo 'compatible=0'; fi
    printf 'reason=%s\n' "$compat_reason"
    printf 'target=%s\n' "$(prop "$G"process.name)"
    enabled=$(prop "$G"enable)
    printf 'enabled=%s\n' "$enabled"

    af_tex=$(prop "$G"gl.tex.parameterf.param)
    af_sampler=$(prop "$G"gl.sampler.parameterf.param)
    af_tex_pname=$(prop "$G"gl.tex.parameterf.pname)
    af_sampler_pname=$(prop "$G"gl.sampler.parameterf.pname)
    af_target=$(prop "$G"gl.tex.parameterf.target)
    tex_pname=$(prop "$G"gl.tex.parameteri.pname)
    sampler_pname=$(prop "$G"gl.sampler.parameteri.pname)
    tex_value=$(prop "$G"gl.tex.parameteri.param)
    sampler_value=$(prop "$G"gl.sampler.parameteri.param)
    tex_target=$(prop "$G"gl.tex.parameteri.target)

    afstate=off
    filterstate=native
    if [ "$enabled" = 1 ]; then
        if [ -n "$af_tex_pname$af_sampler_pname" ]; then
            afstate=mismatch
            if [ "$af_tex_pname" = GL_TEXTURE_MAX_ANISOTROPY_EXT ] &&
               [ "$af_sampler_pname" = "$af_tex_pname" ] &&
               [ "$af_target" = GL_TEXTURE_2D ] && [ "$af_tex" = "$af_sampler" ]; then
                case "$af_tex" in 4.0|16.0) afstate=$af_tex ;; esac
            fi
        fi

        if [ -z "$tex_pname$sampler_pname$tex_value$sampler_value" ]; then
            filterstate=native
        elif [ "$tex_target" = GL_TEXTURE_2D ] &&
             [ "$tex_pname" = GL_TEXTURE_MIN_FILTER ] &&
             [ "$tex_value" = GL_LINEAR_MIPMAP_LINEAR ] &&
             [ "$sampler_pname" = GL_TEXTURE_MIN_FILTER ] &&
             [ "$sampler_value" = GL_LINEAR_MIPMAP_LINEAR ]; then
            filterstate=trilinear
        elif [ "$tex_target" = GL_TEXTURE_2D ] &&
             [ "$tex_pname" = GL_TEXTURE_MIN_FILTER ] &&
             [ "$tex_value" = GL_LINEAR_MIPMAP_LINEAR ] &&
             [ "$sampler_pname" = GL_TEXTURE_MAG_FILTER ] &&
             [ "$sampler_value" = GL_LINEAR ]; then
            filterstate=split
        elif [ "$tex_target" = GL_TEXTURE_2D ] &&
             [ "$tex_pname" = GL_TEXTURE_MAG_FILTER ] &&
             [ "$tex_value" = GL_LINEAR ] &&
             [ "$sampler_pname" = GL_TEXTURE_MAG_FILTER ] &&
             [ "$sampler_value" = GL_LINEAR ]; then
            filterstate=mag
        else
            filterstate=mismatch
        fi
    fi
    printf 'af=%s\nfilter=%s\n' "$afstate" "$filterstate"

    printf 'PROP %s=[%s]\n' "$G"enable "$enabled"
    for key in process.name gl.tex.parameterf.target gl.tex.parameterf.pname gl.tex.parameterf.param gl.sampler.parameterf.pname gl.sampler.parameterf.param gl.tex.parameteri.target gl.tex.parameteri.pname gl.tex.parameteri.param gl.sampler.parameteri.pname gl.sampler.parameteri.param force.rgb8888.enable egl.choose.config; do
        printf 'PROP %s=[%s]\n' "$G$key" "$(prop "$G$key")"
    done
    for key in debug.gpu.enable debug.gpu.force.highp debug.egl.force_msaa; do
        printf 'PROP %s=[%s]\n' "$key" "$(prop "$key")"
    done
}

fail_closed() {
    put "$G"enable 0 || :
    put debug.gpu.enable 0 || :
    put debug.gpu.force.highp 0 || :
    put debug.egl.force_msaa false || :
    put "$G"force.rgb8888.enable 0 || :
    put "$G"egl.choose.config 0 || :
    echo 'Gagal menerapkan profil; GPUD dan eksperimen global diminta OFF. Refresh status sebelum mencoba lagi.' >&2
    return 1
}
configure() {
    target=$1
    af=$2
    filter=$3
    put "$G"process.name "$target" &&
    put "$G"log 0 &&
    put "$G"gl.shadersource.hack 0 || return 1

    af_pname=''
    af_value=''
    if [ "$af" != off ]; then af_pname=GL_TEXTURE_MAX_ANISOTROPY_EXT; af_value=$af; fi
    put "$G"gl.tex.parameterf.target GL_TEXTURE_2D &&
    put "$G"gl.tex.parameterf.pname "$af_pname" &&
    put "$G"gl.tex.parameterf.param "$af_value" &&
    put "$G"gl.sampler.parameterf.pname "$af_pname" &&
    put "$G"gl.sampler.parameterf.param "$af_value" || return 1

    tex_filter_pname=''
    tex_filter_value=''
    sampler_filter_pname=''
    sampler_filter_value=''
    case "$filter" in
        native) ;;
        trilinear)
            tex_filter_pname=GL_TEXTURE_MIN_FILTER
            tex_filter_value=GL_LINEAR_MIPMAP_LINEAR
            sampler_filter_pname=GL_TEXTURE_MIN_FILTER
            sampler_filter_value=GL_LINEAR_MIPMAP_LINEAR
            ;;
        mag)
            tex_filter_pname=GL_TEXTURE_MAG_FILTER
            tex_filter_value=GL_LINEAR
            sampler_filter_pname=GL_TEXTURE_MAG_FILTER
            sampler_filter_value=GL_LINEAR
            ;;
        split)
            # Probe-validated route: texture MIN trilinear + sampler MAG linear.
            tex_filter_pname=GL_TEXTURE_MIN_FILTER
            tex_filter_value=GL_LINEAR_MIPMAP_LINEAR
            sampler_filter_pname=GL_TEXTURE_MAG_FILTER
            sampler_filter_value=GL_LINEAR
            ;;
        *) return 2 ;;
    esac
    put "$G"gl.tex.parameteri.target GL_TEXTURE_2D &&
    put "$G"gl.tex.parameteri.pname "$tex_filter_pname" &&
    put "$G"gl.tex.parameteri.param "$tex_filter_value" &&
    put "$G"gl.sampler.parameteri.pname "$sampler_filter_pname" &&
    put "$G"gl.sampler.parameteri.param "$sampler_filter_value" || return 1

    if [ "$af" != off ] || [ "$filter" != native ]; then put "$G"enable 1 || return 1; fi
}
apply_profile() {
    [ "$#" -eq 3 ] || return 2
    target=$1
    af=$2
    filter=$3
    known_target "$target" || { echo 'Target tidak diizinkan atau bukan aplikasi pihak ketiga terpasang.' >&2; return 2; }
    case "$af" in off|4.0|16.0) ;; *) echo 'AF tidak valid (pilihan teruji: Native, 4x, 16x).' >&2; return 2 ;; esac
    case "$filter" in native|trilinear|mag|split) ;; *) echo 'Filter tidak valid.' >&2; return 2 ;; esac
    compatible || { echo "Driver tidak cocok ($compat_reason); tidak ada perubahan." >&2; return 1; }
    pm path "$target" 2>/dev/null | grep -q '^package:' || { echo 'Target belum terpasang.' >&2; return 1; }

    old_target=$(prop "$G"process.name)
    old_highp=$(prop debug.gpu.specify.app)
    put "$G"enable 0 || { fail_closed; return 1; }
    clear_legacy_experiments && clear_egl_attributes || { fail_closed; return 1; }
    configure "$target" "$af" "$filter" || { fail_closed; return 1; }

    for previous in "$old_target" "$old_highp"; do
        if known_target "$previous" && [ "$previous" != "$target" ]; then
            trace "force-stop $previous"
            am force-stop "$previous" || { fail_closed; return 1; }
            trace "OK force-stop $previous"
        fi
    done
    trace "force-stop $target"
    am force-stop "$target" || { fail_closed; return 1; }
    echo 'applied=1'
    status
}
off() {
    old_target=$(prop "$G"process.name)
    old_highp=$(prop debug.gpu.specify.app)
    put "$G"enable 0 &&
    clear_legacy_experiments &&
    put "$G"process.name '' &&
    put "$G"gl.tex.parameterf.target GL_TEXTURE_2D &&
    put "$G"gl.tex.parameterf.pname '' &&
    put "$G"gl.tex.parameterf.param '' &&
    put "$G"gl.sampler.parameterf.pname '' &&
    put "$G"gl.sampler.parameterf.param '' &&
    put "$G"gl.tex.parameteri.target GL_TEXTURE_2D &&
    put "$G"gl.tex.parameteri.pname '' &&
    put "$G"gl.tex.parameteri.param '' &&
    put "$G"gl.sampler.parameteri.pname '' &&
    put "$G"gl.sampler.parameteri.param '' || { fail_closed; return 1; }
    clear_egl_attributes || { fail_closed; return 1; }
    for previous in "$old_target" "$old_highp"; do
        if known_target "$previous"; then
            trace "force-stop $previous"
            am force-stop "$previous" || return 1
            trace "OK force-stop $previous"
        fi
    done
    echo 'applied=1'
    status
}
[ "$(id -u)" = 0 ] || { echo 'Root UID diperlukan' >&2; exit 1; }
action=$1
[ -n "$action" ] || action=unknown
trace "Root UID=0; action=$action"
case "$action" in
    status) status ;;
    apply) shift; apply_profile "$@" ;;
    off) off ;;
    *) echo 'Usage: visual_tuner.sh status|apply TARGET AF FILTER|off' >&2; exit 2 ;;
esac
