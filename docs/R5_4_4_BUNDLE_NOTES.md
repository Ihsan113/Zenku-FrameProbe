# ZENKU R5.4.4 Final Bundle Notes

- Source archive: ZENKU_R5.4.3_PQ_Color_WebRoot_MT6789.zip
- Bundled helper: `bin/zenku-pqctl.jar` supplied by user (DEX ZENKUPqCtl and ZENKUPqCtl$Reply validated)
- No Android framework/system binary replacement. Same module ID as installed ZENKU, versionCode 13.
- Same guarded WebRoot: Contrast, Saturation, Brightness PQ **4–9** (server-side enforced); Android Boosted or Automatic; SF factors 1.00–1.30. Gamma/GlobalPQ untouched.
- Templates Natural/Balanced/Vivid/Custom; baseline reset, optional boot restore OFF by default.
- Offline validation only. HAL works with the supplied JAR in user Termux; module-location CLASSPATH and WebRoot exec still need verification on phone.

Recovery (Termux root):
```
su -c 'sh /data/adb/modules/mtk_idle_charging_magisk/pq_tuner.sh status'
su -c 'sh /data/adb/modules/mtk_idle_charging_magisk/pq_tuner.sh restore'
```

For quick validation after flashing: status should show `jar_ready=1` and `hal_ok=1`.
