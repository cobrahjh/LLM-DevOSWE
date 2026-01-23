/**
 * Prototype 3: SimConnect Client Pattern
 *
 * Creates a SimConnect client within WASM (like MobiFlight)
 * This allows sending/receiving SimConnect events
 */

#include <MSFS/MSFS.h>
#include <MSFS/MSFS_Render.h>
#include <SimConnect.h>
#include <cstring>

static HANDLE hSimConnect = NULL;
static bool bConnected = false;

// LVar IDs
static ID lvarReady = -1;
static ID lvarCmd = -1;
static ID lvarStatus = -1;

// SimConnect callback
void CALLBACK SimConnectCallback(SIMCONNECT_RECV* pData, DWORD cbData, void* pContext) {
    switch (pData->dwID) {
        case SIMCONNECT_RECV_ID_OPEN:
            bConnected = true;
            set_named_variable_value(lvarReady, 1.0);
            break;

        case SIMCONNECT_RECV_ID_QUIT:
            bConnected = false;
            set_named_variable_value(lvarReady, 0.0);
            break;
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

    // Connect to SimConnect
    HRESULT hr = SimConnect_Open(&hSimConnect, "SimWidget Camera", NULL, 0, 0, 0);
    if (SUCCEEDED(hr)) {
        set_named_variable_value(lvarReady, 1.0);
    }
}

MSFS_CALLBACK void module_deinit(void) {
    if (hSimConnect) {
        SimConnect_Close(hSimConnect);
        hSimConnect = NULL;
    }
    set_named_variable_value(lvarReady, 0.0);
}

// Called each frame by MSFS
MSFS_CALLBACK void module_update(void) {
    if (hSimConnect) {
        SimConnect_CallDispatch(hSimConnect, SimConnectCallback, NULL);

        // Check for commands
        double cmd = get_named_variable_value(lvarCmd);
        if (cmd > 0) {
            set_named_variable_value(lvarStatus, cmd);
            set_named_variable_value(lvarCmd, 0.0);
        }
    }
}

}
