/**
 * Prototype 5: Correct MSFS WASM API
 *
 * Uses the ACTUAL MSFS WASM functions found in working addons:
 * - register_named_variable()
 * - get_named_variable_id()
 * - set_named_variable_value()
 * - get_named_variable_value()
 *
 * These are from <MSFS/Legacy/gauges.h>
 */

#include <MSFS/MSFS.h>
#include <MSFS/Legacy/gauges.h>

// Global LVar IDs
static ID g_lvarReady = -1;
static ID g_lvarCmd = -1;
static ID g_lvarStatus = -1;
static ID g_lvarSmooth = -1;

extern "C" {

MSFS_CALLBACK void module_init(void) {
    // Register LVars using correct API
    g_lvarReady = register_named_variable("L:SIMWIDGET_CAM_READY");
    g_lvarCmd = register_named_variable("L:SIMWIDGET_CAM_CMD");
    g_lvarStatus = register_named_variable("L:SIMWIDGET_CAM_STATUS");
    g_lvarSmooth = register_named_variable("L:SIMWIDGET_CAM_SMOOTH");

    // Initialize values
    set_named_variable_value(g_lvarReady, 1.0);
    set_named_variable_value(g_lvarCmd, 0.0);
    set_named_variable_value(g_lvarStatus, 0.0);
    set_named_variable_value(g_lvarSmooth, 50.0);
}

MSFS_CALLBACK void module_deinit(void) {
    if (g_lvarReady != -1) {
        set_named_variable_value(g_lvarReady, 0.0);
    }
}

}
