#include <jni.h>
#include <dlfcn.h>
#include <link.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <time.h>
#include <atomic>
#include <cstdio>
#include <cstring>
#include <string>
#include "zygisk.hpp"

static std::atomic<bool> g_installed{false};
static void* g_real_queue = nullptr;
static void* g_real_dequeue = nullptr;
static uint64_t mono_ns(){timespec ts{}; if(clock_gettime(CLOCK_MONOTONIC,&ts)!=0)return 0; return uint64_t(ts.tv_sec)*1000000000ULL+ts.tv_nsec;}
static std::string maps_base(const char* needle){FILE*f=fopen("/proc/self/maps","re"); if(!f)return{}; char line[512]; while(fgets(line,sizeof(line),f)){if(strstr(line,needle)&&strstr(line,"r-xp")){unsigned long long a=0;sscanf(line,"%llx-",&a);fclose(f);char b[64];snprintf(b,sizeof(b),"0x%llx",a);return b;}} fclose(f);return{};}
static void write_report(){const char* p="/data/local/tmp/zenku_frameprobe_native.txt"; FILE*f=fopen(p,"we"); if(!f)return; std::string b=maps_base("/system/lib64/libgui.so"); fprintf(f,"pid=%d\\nlibgui_text_base=%s\\ntarget_queue_offset=0x8cb5c\\ntarget_dequeue_offset=0x8b12c\\nqueue_runtime=(base+0x8cb5c)\\ndequeue_runtime=(base+0x8b12c)\\nhook_status=%s\\n",getpid(),b.c_str(),g_installed.load()?"native_probe_ready":"report_only"); fclose(f); chmod(p,0644);}
class FrameProbe: public zygisk::ModuleBase { public: void onLoad(zygisk::Api* api,JNIEnv*) override {api->setOption(zygisk::DLCLOSE_MODULE_LIBRARY);}
void preAppSpecialize(zygisk::AppSpecializeArgs* args) override {(void)args;}
void postAppSpecialize(const zygisk::AppSpecializeArgs* args) override {(void)args;}
void preServerSpecialize(zygisk::ServerSpecializeArgs*) override{}
void postServerSpecialize(const zygisk::ServerSpecializeArgs*) override{}
};
REGISTER_ZYGISK_MODULE(FrameProbe)
extern "C" __attribute__((constructor)) void zenku_init(){write_report(); g_installed.store(true);}
