/**
 * Prototype 1: Minimal LVar Registration
 *
 * Simplest possible WASM - just registers LVars on init
 * Based on: Current simwidget_camera.cpp
 * Expected size: ~200KB+ if SDK links correctly
 */

#include <MSFS/MSFS.h>
#include <MSFS/MSFS_Render.h>
#include <SimConnect.h>

extern "C" {

MSFS_CALLBACK void module_init(void) {
    // Register LVars
    register_named_variable("SIMWIDGET_CAM_READY");
    register_named_variable("SIMWIDGET_CAM_CMD");
    register_named_variable("SIMWIDGET_CAM_STATUS");

    // Set ready flag
    set_named_variable_value(get_named_variable_id("SIMWIDGET_CAM_READY"), 1.0);
}

MSFS_CALLBACK void module_deinit(void) {
    set_named_variable_value(get_named_variable_id("SIMWIDGET_CAM_READY"), 0.0);
}

}
