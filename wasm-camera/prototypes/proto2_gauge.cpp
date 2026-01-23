/**
 * Prototype 2: Gauge Callback Pattern
 *
 * Uses gauge_callback for periodic updates like FBW/Fenix
 * This pattern is more common in production addons
 */

#include <MSFS/MSFS.h>
#include <MSFS/MSFS_Render.h>
#include <MSFS/Legacy/gauges.h>
#include <SimConnect.h>

// LVar IDs
static ID lvarReady = -1;
static ID lvarCmd = -1;
static ID lvarStatus = -1;

// Gauge callback - called every frame
extern "C" void CALLBACK gauge_callback(PGAUGEHDR pgauge, int service_id, UINT32 extra_data) {
    switch (service_id) {
        case PANEL_SERVICE_PRE_INSTALL:
            // Register LVars
            lvarReady = register_named_variable("SIMWIDGET_CAM_READY");
            lvarCmd = register_named_variable("SIMWIDGET_CAM_CMD");
            lvarStatus = register_named_variable("SIMWIDGET_CAM_STATUS");
            set_named_variable_value(lvarReady, 1.0);
            break;

        case PANEL_SERVICE_PRE_UPDATE:
            // Check for commands each frame
            if (lvarCmd != -1) {
                double cmd = get_named_variable_value(lvarCmd);
                if (cmd > 0) {
                    // Process command
                    set_named_variable_value(lvarStatus, cmd);
                    set_named_variable_value(lvarCmd, 0.0); // Clear command
                }
            }
            break;

        case PANEL_SERVICE_PRE_KILL:
            set_named_variable_value(lvarReady, 0.0);
            break;
    }
}

extern "C" {

__attribute__((export_name("simwidget_gauge_callback")))
void simwidget_gauge_callback(PGAUGEHDR pgauge, int service_id, UINT32 extra_data) {
    gauge_callback(pgauge, service_id, extra_data);
}

MSFS_CALLBACK void module_init(void) {
    // Empty - gauge_callback handles init
}

MSFS_CALLBACK void module_deinit(void) {
    // Empty - gauge_callback handles deinit
}

}
