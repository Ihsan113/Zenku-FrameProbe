import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.Arrays;

/**
 * ZENKU PQ Control v0.2 - direct HIDL 2.0 transaction from app_process.
 * Compiled with plain javac: reflection is required for Android platform-only HwBinder APIs.
 * Transaction numbers correspond to vendor.mediatek.hardware.pq@2.0/IPictureQuality.hal.
 */
public final class ZENKUPqCtl {
    private static final String INTERFACE = "vendor.mediatek.hardware.pq@2.0::IPictureQuality";
    private static final String INSTANCE = "default";
    private static final int HAL_OK = 0;
    private final Class<?> parcelClass;
    private final Class<?> blobClass;
    private final Object binder;

    private ZENKUPqCtl() throws Exception {
        Class<?> hwBinder = Class.forName("android.os.HwBinder");
        parcelClass = Class.forName("android.os.HwParcel");
        blobClass = Class.forName("android.os.HwBlob");
        Object s;
        try {
            s = hwBinder.getMethod("getService", String.class, String.class, boolean.class)
                    .invoke(null, INTERFACE, INSTANCE, false);
        } catch (NoSuchMethodException e) {
            s = hwBinder.getMethod("getService", String.class, String.class)
                    .invoke(null, INTERFACE, INSTANCE);
        }
        if (s == null) throw new IllegalStateException("HAL service IPictureQuality/default tidak ditemukan");
        binder = s;
    }

    // Never send an unrecognized transaction: all transaction numbers are hardcoded.
    private Object transaction(int code, int... args) throws Exception {
        Object request = parcelClass.getConstructor().newInstance();
        Object reply = parcelClass.getConstructor().newInstance();
        try {
            invoke(request, "writeInterfaceToken", new Class<?>[]{String.class}, INTERFACE);
            for (int i : args) invoke(request, "writeInt32", new Class<?>[]{int.class}, i);
            Method m = Class.forName("android.os.IHwBinder").getMethod("transact", int.class, parcelClass, parcelClass, int.class);
            m.invoke(binder, code, request, reply, 0);
            invoke(reply, "verifySuccess", new Class<?>[]{});
            return new Reply(request, reply);
        } catch (Exception e) {
            try { invoke(reply, "release", new Class<?>[]{}); } catch (Exception ignored) {}
            try { invoke(request, "releaseTemporaryStorage", new Class<?>[]{}); } catch (Exception ignored) {}
            throw e;
        }
    }

    private static Object invoke(Object target, String method, Class<?>[] types, Object... args) throws Exception {
        try {
            return target.getClass().getMethod(method, types).invoke(target, args);
        } catch (InvocationTargetException ex) {
            Throwable cause = ex.getCause();
            if (cause instanceof Exception) throw (Exception) cause;
            if (cause instanceof Error) throw (Error) cause;
            throw ex;
        }
    }
    private class Reply implements AutoCloseable {
        final Object request, response;
        Reply(Object request, Object response) { this.request=request; this.response=response; }
        int readInt() throws Exception { return ((Number)invoke(response, "readInt32", new Class<?>[]{})).intValue(); }
        Object readBuffer(long length) throws Exception {
            return invoke(response, "readBuffer", new Class<?>[]{long.class}, length);
        }
        @Override public void close() {
            try { invoke(response, "release", new Class<?>[]{}); } catch (Exception ignored) {}
            try { invoke(request, "releaseTemporaryStorage", new Class<?>[]{}); } catch (Exception ignored) {}
        }
    }
    private static void ok(int result, String method) {
        if (result != HAL_OK) throw new IllegalStateException(method+" ditolak vendor HAL: Result="+result+
                " (0=OK,1=NOT_INITIALIZED,2=INVALID_ARGUMENTS,3=INVALID_STATE,4=NOT_SUPPORTED)");
    }
    private int readScalar(int transaction, String method, int... args) throws Exception {
        try (Reply p=(Reply)transaction(transaction,args)) {
            ok(p.readInt(), method);
            return p.readInt();
        }
    }
    private void write(int transaction, String method, int... args) throws Exception {
        try (Reply p=(Reply)transaction(transaction,args)) { ok(p.readInt(), method); }
    }
    private long blobU32(Object blob, long offset) throws Exception {
        return ((Number)invoke(blob,"getInt32", new Class<?>[]{long.class},offset)).intValue() & 0xffffffffL;
    }
    private void color(int scenario, int mode, boolean mapped) throws Exception {
        int tx=mapped?6:8;
        try (Reply r=(Reply)transaction(tx,scenario,mode)) {
            ok(r.readInt(), mapped?"getMappedColorIndex":"getColorIndex");
            Object b=r.readBuffer(60);
            System.out.println("color.scenario="+scenario+" mode="+mode+" mapped="+mapped);
            String[] names={"SHPGain","SatGain","PartialY","HueAdj0","HueAdj1","HueAdj2","HueAdj3",
                    "SatAdj0","SatAdj1","SatAdj2","SatAdj3","Contrast","Brightness","Ccorr","ColorLUT"};
            for(int i=0;i<names.length;i++) System.out.println("  "+names[i]+"="+blobU32(b,i*4L));
            System.out.println("CATATAN: nilai profil/tabel, bukan bukti efek live pada panel.");
        }
    }
    private void status() throws Exception {
        System.out.println("ZENKU PQ HIDL v0.2 | HAL "+INTERFACE+"/default");
        System.out.println("READ-ONLY; tidak ada properti yang diubah.");
        for (int[] f: new int[][]{{0,0},{6,6},{7,7},{4,4},{3,3}}) {
            String[] labels={"display_color","content_color","content_color_video","sharpness","dynamic_contrast","dynamic_sharpness","ccorr","gamma"};
            try { System.out.println("feature."+labels[f[0]]+"="+readScalar(13,"getFeatureSwitch",f[1])); }
            catch(Exception e) { System.out.println("feature."+labels[f[0]]+"=ERROR: "+e.getMessage()); }
        }
        for (int[] x: new int[][]{{28,0},{35,1},{37,2},{38,3}}) {
            String[] labels={"gamma_index","globalpq_switch","globalpq_strength","globalpq_strength_range"};
            try { System.out.println(labels[x[1]]+"="+readScalar(x[0], labels[x[1]])); }
            catch(Exception e) { System.out.println(labels[x[1]]+"=ERROR: "+e.getMessage()); }
        }
        System.out.println("Gunakan 'color 0 1' untuk membaca profil warna Vivid.");
    }
    private static int number(String s, int lo, int hi, String label) {
        try { int n=Integer.parseInt(s);if(n<lo||n>hi)throw new NumberFormatException();return n; }
        catch(NumberFormatException e){throw new IllegalArgumentException(label+" harus angka "+lo+".."+hi);}
    }
    private static boolean apply(String[] args, int ix) {
        if(args.length==ix) return false;
        if(args.length==ix+1 && "--apply".equals(args[ix])) return true;
        throw new IllegalArgumentException("Akhiri dengan --apply untuk melakukan perubahan; tanpa itu hanya simulasi.");
    }
    private void set(String[] a) throws Exception {
        if(a.length<3)throw new IllegalArgumentException("set <contrast|saturation|brightness> <0..21> [--apply]");
        int idx;
        String prop;
        if("contrast".equals(a[1])) {idx=9;prop="persist.vendor.sys.pq.contrastidx";}
        else if("saturation".equals(a[1])) {idx=1;prop="persist.vendor.sys.pq.gsatidx";}
        else if("brightness".equals(a[1])) {idx=10;prop="persist.vendor.sys.pq.brightidx";}
        else throw new IllegalArgumentException("Tipe tidak dikenal: "+a[1]);
        int n=number(a[2],0,21,a[1]);
        boolean doApply=apply(a,3);
        System.out.println("HAL setPQIndex(level="+n+",scenario=0,tuning_mode=0,index="+idx+",step=0)");
        System.out.println("Properti vendor terkait: "+prop);
        if(!doApply){System.out.println("DRY-RUN. Tambahkan --apply untuk melakukan perubahan.");return;}
        // Verify core display color reported as enabled. Note: HAL feature switch may differ
        // from ro.vendor feature flags. Conservative; refuses write if unavailable/disabled.
        int displayColor=readScalar(13,"getFeatureSwitch(DISPLAY_COLOR)",0);
        if(displayColor!=1)throw new IllegalStateException("DISPLAY_COLOR tidak aktif di HAL (value="+displayColor+"); perubahan dibatalkan.");
        write(10,"setPQIndex",n,0,0,idx,0);
        System.out.println("HAL mengembalikan OK. Efek display masih harus dicek secara visual.");
        System.out.println("PERINGATAN: vendor dapat menulis persist property. Lihat snapshot otomatis di shell wrapper.");
    }
    private void setGlobal(String[] a) throws Exception {
        if(a.length<3)throw new IllegalArgumentException("global <switch|strength> <angka> [--apply]");
        boolean doApply=apply(a,3);
        if("switch".equals(a[1])) {
            int n=number(a[2],0,1,"switch");
            int previous=readScalar(35,"getGlobalPQSwitch");
            System.out.println("GlobalPQ switch sebelumnya="+previous+", baru="+n);
            if(!doApply){System.out.println("DRY-RUN. Tambahkan --apply untuk benar-benar mengubah.");return;}
            write(34,"setGlobalPQSwitch",n);
            System.out.println("HAL OK, terbaca sekarang="+readScalar(35,"getGlobalPQSwitch"));
        } else if("strength".equals(a[1])) {
            int range=readScalar(38,"getGlobalPQStrengthRange");
            int old=readScalar(37,"getGlobalPQStrength");
            if(range<=0 || range>100000)throw new IllegalStateException("Rentang strength tidak kredibel: "+range);
            int n=number(a[2],0,range,"strength");
            System.out.println("GlobalPQ strength sebelumnya="+old+", baru="+n+", range_scalar="+range);
            System.out.println("Range adalah satu angka dari HAL, bukan {min,max,default}; 0..range asumsi untuk pengaman.");
            if(!doApply){System.out.println("DRY-RUN. Tambahkan --apply untuk benar-benar mengubah.");return;}
            write(36,"setGlobalPQStrength",n);
            System.out.println("HAL OK, terbaca sekarang="+readScalar(37,"getGlobalPQStrength"));
        } else throw new IllegalArgumentException("Gunakan global switch atau global strength");
    }
    private static void help() {
        System.out.println("ZENKU PQ Control v0.2 - MT6789 Android 13");
        System.out.println("  zenku-pqctl status                      baca status HAL (tanpa menulis)");
        System.out.println("  zenku-pqctl color 0 1                  baca profil Vivid (getter HAL)");
        System.out.println("  zenku-pqctl set contrast 11            simulasi, tidak menulis");
        System.out.println("  zenku-pqctl set contrast 11 --apply    TULIS level kontras via HAL");
        System.out.println("  zenku-pqctl set saturation 11 --apply  TULIS saturasi via HAL");
        System.out.println("  zenku-pqctl set brightness 11 --apply  TULIS brightness via HAL");
        System.out.println("  zenku-pqctl global switch 1            simulasi Global PQ");
        System.out.println("  zenku-pqctl global strength 2          simulasi Global PQ strength");
        System.out.println("  zenku-pqctl global switch 1 --apply    TULIS Global PQ switch (eksperimental)");
        System.out.println("  zenku-pqctl global strength 2 --apply  TULIS strength (eksperimental)");
        System.out.println("Tanpa --apply semua perintah 'set'/'global' hanya simulasi.");
        System.out.println("Gamma hanya baca; belum ada peta aman indeks gamma untuk write.");
        System.out.println("Perubahan dapat persisten dan mungkin perlu rollback manual; cek README.");
    }
    public static void main(String[] args) {
        try {
            String command=args.length>0?args[0]:"help";
            if("help".equals(command) || "--help".equals(command)){help();return;}
            ZENKUPqCtl ctl=new ZENKUPqCtl();
            switch(command) {
                case "status": if(args.length!=1)throw new IllegalArgumentException("status tanpa argumen");ctl.status();break;
                case "color": if(args.length!=3)throw new IllegalArgumentException("color <scenario 0..2> <mode 0..2>");
                    ctl.color(number(args[1],0,2,"scenario"),number(args[2],0,2,"mode"),false);break;
                case "mapped-color": if(args.length!=3)throw new IllegalArgumentException("mapped-color <scenario> <mode>");
                    ctl.color(number(args[1],0,2,"scenario"),number(args[2],0,2,"mode"),true);break;
                case "set": ctl.set(args);break;
                case "global": ctl.setGlobal(args);break;
                default: throw new IllegalArgumentException("Perintah tidak dikenal: "+command);
            }
        } catch(Throwable e) {
            Throwable root=e;
            while(root instanceof InvocationTargetException && ((InvocationTargetException)root).getCause()!=null)
                root=((InvocationTargetException)root).getCause();
            System.err.println("ZENKU_PQCTL_ERROR: "+root.getClass().getSimpleName()+": "+root.getMessage());
            if (root instanceof NoClassDefFoundError || root instanceof ClassNotFoundException) {
                System.err.println("Periksa paket DEX/JAR dan pastikan semua nested class dimasukkan (v0.2).");
            } else {
                System.err.println("Kemungkinan akses HIDL/hidden API, SELinux, atau fitur HAL tidak didukung.");
            }
            System.exit(2);
        }
    }
}
