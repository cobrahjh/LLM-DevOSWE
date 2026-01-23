/**
 * SimWidget Camera WASM Module
 * Version: 0.5.2
 *
 * Uses Legacy gauges.h API (same as Lorby, MobiFlight, etc.)
 * NOT the newer MSFS_Vars.h API which doesn't seem to work
 */

// Define Microsoft types as macros for WASM target before any SDK includes
#ifndef __int64
#define __int64 long long
#endif

#include <MSFS/MSFS.h>

// Suppress deprecation warnings - gauges.h API still works despite warnings
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
#include <MSFS/Legacy/gauges.h>
#pragma clang diagnostic pop

// Global LVar IDs
static ID g_lvarReady = -1;
static ID g_lvarCmd = -1;
static ID g_lvarStatus = -1;
static ID g_lvarSmooth = -1;
static ID g_lvarMode = -1;

extern "C" {

MSFS_CALLBACK void module_init(void) {
    // Register LVars using Legacy gauges.h API
    // Note: L: prefix is optional but explicit
    g_lvarReady = register_named_variable("SIMWIDGET_CAM_READY");
    g_lvarCmd = register_named_variable("SIMWIDGET_CAM_CMD");
    g_lvarStatus = register_named_variable("SIMWIDGET_CAM_STATUS");
    g_lvarSmooth = register_named_variable("SIMWIDGET_CAM_SMOOTH");
    g_lvarMode = register_named_variable("SIMWIDGET_CAM_MODE");

    // Initialize values
    set_named_variable_value(g_lvarReady, 1.0);
    set_named_variable_value(g_lvarCmd, 0.0);
    set_named_variable_value(g_lvarStatus, 0.0);
    set_named_variable_value(g_lvarSmooth, 50.0);
    set_named_variable_value(g_lvarMode, 0.0);
}

MSFS_CALLBACK void module_deinit(void) {
    if (g_lvarReady != -1) {
        set_named_variable_value(g_lvarReady, 0.0);
    }
}

}
