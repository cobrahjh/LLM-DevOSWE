/**
 * Prototype 4: CommBus Event Pattern
 *
 * Uses MSFS CommBus for communication (like some newer addons)
 * CommBus allows cross-module communication
 */

#include <MSFS/MSFS.h>
#include <MSFS/MSFS_CommBus.h>
#include <MSFS/Legacy/gauges.h>

static ID lvarReady = -1;
static ID lvarCmd = -1;
static ID lvarStatus = -1;
static FsCommBusId commBusId = {};

// CommBus message handler
void CommBusCallback(FsCommBusCall* pCall, void* pContext) {
    if (pCall && pCall->name) {
        if (strcmp(pCall->name, "SIMWIDGET.CMD") == 0) {
            // Received command via CommBus
            double cmd = pCall->value;
            set_named_variable_value(lvarCmd, cmd);
            set_named_variable_value(lvarStatus, cmd);
        }
    }
}

extern "C" {

MSFS_CALLBACK void module_init(void) {
    // Register LVars
    lvarReady = register_named_variable("SIMWIDGET_CAM_READY");
    lvarCmd = register_named_variable("SIMWIDGET_CAM_CMD");
    lvarStatus = register_named_variable("SIMWIDGET_CAM_STATUS");

    // Initialize values
    set_named_variable_value(lvarReady, 0.0);
    set_named_variable_value(lvarCmd, 0.0);
    set_named_variable_value(lvarStatus, 0.0);

    // Register CommBus listener
    fsCommBusRegister("SIMWIDGET", &commBusId);
    fsCommBusSubscribe(commBusId, "SIMWIDGET.*", CommBusCallback, nullptr);

    // Mark ready
    set_named_variable_value(lvarReady, 1.0);
}

MSFS_CALLBACK void module_deinit(void) {
    fsCommBusUnsubscribe(commBusId, "SIMWIDGET.*");
    fsCommBusUnregister(commBusId);
    set_named_variable_value(lvarReady, 0.0);
}

}
