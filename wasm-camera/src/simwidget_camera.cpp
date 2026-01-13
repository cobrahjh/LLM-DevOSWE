/**
 * SimWidget Camera WASM Module
 * Version: 0.4.0
 * 
 * Simple LVar provider for camera control
 * External client (SimWidget server via Lorby) handles actual camera positioning
 */

typedef long long __int64;
typedef int __int32;

#include <MSFS/MSFS.h>
#include <MSFS/MSFS_Vars.h>

static bool g_initialized = false;

extern "C" {

MSFS_CALLBACK void module_init(void) {
    // Register all camera LVars
    FsUnitId unitNum = fsVarsGetUnitId("number");
    
    // Command input LVars (written by external client)
    FsLVarId lvarCmd = fsVarsRegisterLVar("SIMWIDGET_CAM_CMD");
    FsLVarId lvarSmooth = fsVarsRegisterLVar("SIMWIDGET_CAM_SMOOTH");
    FsLVarId lvarTargetX = fsVarsRegisterLVar("SIMWIDGET_CAM_TARGET_X");
    FsLVarId lvarTargetY = fsVarsRegisterLVar("SIMWIDGET_CAM_TARGET_Y");
    FsLVarId lvarTargetZ = fsVarsRegisterLVar("SIMWIDGET_CAM_TARGET_Z");
    
    // Status output LVars (read by external client)
    FsLVarId lvarReady = fsVarsRegisterLVar("SIMWIDGET_CAM_READY");
    FsLVarId lvarStatus = fsVarsRegisterLVar("SIMWIDGET_CAM_STATUS");
    FsLVarId lvarMode = fsVarsRegisterLVar("SIMWIDGET_CAM_MODE");
    
    // Initialize values
    fsVarsLVarSet(lvarReady, unitNum, 1.0);
    fsVarsLVarSet(lvarStatus, unitNum, 0.0);
    fsVarsLVarSet(lvarMode, unitNum, 0.0);
    fsVarsLVarSet(lvarCmd, unitNum, 0.0);
    fsVarsLVarSet(lvarSmooth, unitNum, 50.0);
    
    g_initialized = true;
}

MSFS_CALLBACK void module_deinit(void) {
    g_initialized = false;
}

}
