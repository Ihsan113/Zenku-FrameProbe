## Perbaikan v0.2 (20 Nov 2026)

Output v0.1 `NoClassDefFoundError: LZENKUPqCtl$Reply;` berasal dari **kesalahan installer**: hanya `ZENKUPqCtl.class` yang dikirim ke D8, sedangkan `ZENKUPqCtl$Reply.class` terlewat. Bukan indikasi SELinux menolak HIDL. v0.2 menyertakan semua berkas `.class`, memvalidasi kedua descriptor dalam DEX, dan mengganti JAR secara atomik. **Belum diuji pada HP yang sesungguhnya.**

Pemasangan v0.2 menimpa launcher/JAR v0.1; tidak mengubah ZENKU atau nilai warna.

# ZENKU-PQCTL v0.2 — MediaTek MT6789 / Android 13

**Perintah Terminal untuk berkomunikasi dengan MediaTek PictureQuality HIDL 2.0.**

Tipe: **Java DEX (app_process Android) yang dibangun di Termux**. Bukan APK dan bukan binary ELF. Tidak memerlukan Android NDK atau source AOSP, tetapi memerlukan root dan jalur HIDL Android yang dapat diakses dari konteks shell root. Kode memakai reflection untuk antarmuka `android.os.HwBinder`/`HwParcel`/`HwBlob` yang tidak menjadi API Android SDK publik.

## Apa yang sudah diverifikasi

- File `vendor.mediatek.hardware.pq@2.15-impl.so` asli MT6789 (449.264 byte) dari arsip audit sebelumnya dievaluasi di lingkungan analisis.
- Metode HIDL v2.0 dan nomor transaksi dicocokkan dengan `IPictureQuality.hal` publik.
- Disassembly vendor `PictureQuality::setPQParamlevel`: **index 1 = saturasi / gsatidx**, **index 9 = kontras / contrastidx**, **index 10 = brightness / brightidx**. Ketiganya menguji level maksimum **21** dalam cabang tersebut. `setPQIndex()` memerlukan `(level, scenario, tuning_mode, index, step)`.
- `status`, `color`, dan perintah tulisan telah diuji pada **mock HAL di Linux** (`tests/test-host.sh`), bukan pada Poco M5 nyata.

**Yang belum bisa diverifikasi di sini:** kompatibilitas real `app_process`/SELinux/hidden APIs dan efek visual setelah pemanggilan HAL di HP kamu. **Tidak ada perangkat fisik yang diuji.**

## Pasang (Termux asli, bukan su/proot)

```sh
cd ~/storage/downloads
unzip -o ZENKU_PQCTL_MT6789_v0.2.zip
cd zenku-pqctl-v0.2
bash install-termux.sh
```

Installer akan memasang `openjdk-17`, `d8` atau `dx`, dan `zip` jika belum ada. Installer melakukan kompilasi DEX **di HP kamu**, menempatkan `zenku-pqctl.jar` di `/data/local/tmp` (perlu root), lalu memasang perintah `zenku-pqctl` ke `$PREFIX/bin`. **Installer tidak mengubah display.**

## Penggunaan

```sh
zenku-pqctl status
zenku-pqctl color 0 1
zenku-pqctl set contrast 11           # dry-run, TIDAK mengubah
zenku-pqctl set saturation 11         # dry-run, TIDAK mengubah
```

Untuk percobaan tulis hanya setelah menilai status, mencatat pengaturan awal, dan menerima risiko:

```sh
zenku-pqctl set contrast 11 --apply
zenku-pqctl set saturation 11 --apply
```

Angka **11 hanya CONTOH**, **bukan rekomendasi aman/default**. Pilih perubahan kecil dari baseline yang benar-benar terbaca dan amati tampilan. `--apply` **akan mengirim transaksi HAL** dan dapat mengubah persistent property vendor; tidak ada jaminan bersifat sementara.

Perintah `global switch|strength` tersedia untuk percobaan lanjutan. Mengingat `ro.vendor.globalpq.support` kosong dan `TDSHP=0` di audit, **jangan jalankan dengan `--apply` sebelum fungsi Global PQ benar-benar sukses dibaca dan dukungannya dipahami**.

Gamma hanya dibaca dengan `status`: belum ada penentuan rentang indeks valid untuk pengaturan gamma.

## Pengaman dan keterbatasan

1. Tanpa `--apply`, perintah `set`/`global` tidak mengirim transaksi setter; `status` hanya getter.
2. Sebelum `--apply`, skrip launcher membuat snapshot nilai properti `zenku_pq_before_YYYYMMDD_HHMMSS.txt` di Download.
3. HIDL mengembalikan `Result=0` bila transaksi berhasil pada sisi HAL. Itu **belum membuktikan perubahan warna benar-benar terlihat di layar game**.
4. `getColorIndex(0,1)` membaca profil Vivid pada skenario 0; beberapa getter vendor dapat memodifikasi state internal meskipun tidak menulis properti. Status tanpa `color` lebih konservatif.
5. Nilai properti semula kosong. **Rollback ke kondisi persis sama tidak otomatis terjamin**; pemasangan value dapat membuat properti persisten. Catat backup dan jangan eksperimen banyak parameter bersamaan. Reboot **belum tentu** mengembalikan keadaan semula.
6. Tidak merubah zRAM, governor, FPSGo, `system.prop`, `service.sh`, modul KernelSU/Magisk, sepolicy, atau file vendor.
7. Jika mendapat `SecurityException`, `NoSuchMethodException`, atau `RemoteException`, jangan paksa permissive SELinux. Kirim output `zenku-pqctl status` untuk diagnosa.

## Sumber

- MediaTek HIDL V2_0: https://github.com/AIV-97/vendor_mediatek_interfaces/blob/eleven/pq/2.0/IPictureQuality.hal
- Tipe struktur data: https://github.com/AIV-97/vendor_mediatek_interfaces/blob/eleven/pq/2.0/types.hal
- Android `HwBinder` dan `HwParcel`: https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/core/java/android/os/HwBinder.java

**Baca `DETAIL_HAL.md` untuk parameter yang sudah dipetakan melalui pemeriksaan binary asli.**
