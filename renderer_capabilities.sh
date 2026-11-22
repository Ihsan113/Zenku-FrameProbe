#!/system/bin/sh
# ZENKU renderer API capability report.
# Read-only: checks the exact driver fingerprint previously validated by the
# ZENKU GLES runtime probe. It does NOT toggle renderer APIs globally.
PATH=/system/bin:/system/xbin:$PATH
export PATH

EXPECTED_SDK=33
EXPECTED_PLATFORM=MT6789
EXPECTED_MALI_SHA=f1fb52d820be0a14baaeab7bf4ed9781c6be42470397e0bfee28681d194cfa13
MALI_LIB=/vendor/lib64/egl/mt6789/libGLES_mali.so

getprop_value() { getprop "$1" 2>/dev/null; }
unknown_report() {
    echo 'driver_match=0'
    echo "reason=$1"
    echo 'renderer=Unknown'
    echo 'pls=UNKNOWN'
    echo 'pls2=UNKNOWN'
    echo 'framebuffer_fetch=UNKNOWN'
    echo 'discard_framebuffer=UNKNOWN'
    echo 'rgba16f=UNKNOWN'
    echo 'rgba32f=UNKNOWN'
    echo 'shader_binary=UNKNOWN'
    echo 'activation=APPLICATION_RENDERER_REQUIRED'
}
status() {
    sdk=$(getprop_value ro.build.version.sdk)
    platform=$(getprop_value ro.vendor.mediatek.platform)
    case "$platform" in MT6789|mt6789) ;; *) unknown_report platform_mismatch; return 0 ;; esac
    [ "$sdk" = "$EXPECTED_SDK" ] || { unknown_report sdk_mismatch; return 0; }
    [ -r "$MALI_LIB" ] || { unknown_report mali_driver_missing; return 0; }
    hash_line=$(sha256sum "$MALI_LIB" 2>/dev/null) || { unknown_report cannot_read_driver_hash; return 0; }
    actual_hash=${hash_line%% *}
    [ "$actual_hash" = "$EXPECTED_MALI_SHA" ] || { unknown_report mali_driver_hash_mismatch; return 0; }

    # These results are from the user's completed GLES runtime probe for this
    # exact Mali binary. Fingerprint mismatch intentionally downgrades to UNKNOWN.
    echo 'driver_match=1'
    echo 'reason=validated_driver_fingerprint'
    echo 'renderer=Mali-G57 MC2'
    echo 'pls=WRITE_READ_RESOLVE_PASS'
    echo 'pls2=UNSUPPORTED'
    echo 'framebuffer_fetch=ARM_EXTENSIONS_PRESENT'
    echo 'discard_framebuffer=EXT_EXTENSION_PRESENT'
    echo 'rgba16f=FBO_BLEND_PASS'
    echo 'rgba32f=FBO_BLEND_PASS'
    echo 'shader_binary=EXPORT_RELOAD_PASS'
    echo 'activation=APPLICATION_RENDERER_REQUIRED'
}
[ "$(id -u)" = 0 ] || { echo 'Root UID diperlukan' >&2; exit 1; }
case "${1:-status}" in
    status) status ;;
    *) echo 'Usage: renderer_capabilities.sh status' >&2; exit 2 ;;
esac
