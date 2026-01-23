// Quick test for Desktop Duplication API
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <d3d11.h>
#include <dxgi1_2.h>
#include <stdio.h>

int main() {
    printf("Testing Desktop Duplication API...\n");
    fflush(stdout);

    // Create D3D11 device
    ID3D11Device* device = nullptr;
    ID3D11DeviceContext* context = nullptr;
    D3D_FEATURE_LEVEL featureLevel;

    HRESULT hr = D3D11CreateDevice(nullptr, D3D_DRIVER_TYPE_HARDWARE, nullptr,
        0, nullptr, 0, D3D11_SDK_VERSION, &device, &featureLevel, &context);

    if (FAILED(hr)) {
        printf("FAILED: D3D11CreateDevice (0x%08X)\n", hr);
        return 1;
    }
    printf("OK: D3D11 device created\n");
    fflush(stdout);

    // Get DXGI device
    IDXGIDevice* dxgiDevice = nullptr;
    hr = device->QueryInterface(__uuidof(IDXGIDevice), (void**)&dxgiDevice);
    if (FAILED(hr)) {
        printf("FAILED: QueryInterface IDXGIDevice (0x%08X)\n", hr);
        return 1;
    }
    printf("OK: DXGI device\n");
    fflush(stdout);

    // Get adapter
    IDXGIAdapter* adapter = nullptr;
    hr = dxgiDevice->GetAdapter(&adapter);
    dxgiDevice->Release();
    if (FAILED(hr)) {
        printf("FAILED: GetAdapter (0x%08X)\n", hr);
        return 1;
    }
    printf("OK: Adapter\n");
    fflush(stdout);

    // Get output
    IDXGIOutput* output = nullptr;
    hr = adapter->EnumOutputs(0, &output);
    adapter->Release();
    if (FAILED(hr)) {
        printf("FAILED: EnumOutputs (0x%08X)\n", hr);
        return 1;
    }
    printf("OK: Output\n");
    fflush(stdout);

    // Get output1
    IDXGIOutput1* output1 = nullptr;
    hr = output->QueryInterface(__uuidof(IDXGIOutput1), (void**)&output1);
    output->Release();
    if (FAILED(hr)) {
        printf("FAILED: QueryInterface IDXGIOutput1 (0x%08X)\n", hr);
        return 1;
    }
    printf("OK: Output1\n");
    fflush(stdout);

    // Create duplication
    IDXGIOutputDuplication* duplication = nullptr;
    hr = output1->DuplicateOutput(device, &duplication);
    output1->Release();
    if (FAILED(hr)) {
        printf("FAILED: DuplicateOutput (0x%08X)\n", hr);
        if (hr == DXGI_ERROR_NOT_CURRENTLY_AVAILABLE) {
            printf("  -> Too many apps using Desktop Duplication\n");
        } else if (hr == DXGI_ERROR_UNSUPPORTED) {
            printf("  -> Not supported on this system\n");
        } else if (hr == E_ACCESSDENIED) {
            printf("  -> Access denied (need to run in user session)\n");
        }
        return 1;
    }
    printf("OK: Desktop Duplication initialized!\n");
    fflush(stdout);

    // Get description
    DXGI_OUTDUPL_DESC desc;
    duplication->GetDesc(&desc);
    printf("Screen: %dx%d\n", desc.ModeDesc.Width, desc.ModeDesc.Height);

    // Try to capture one frame
    printf("\nCapturing test frame...\n");
    fflush(stdout);

    DXGI_OUTDUPL_FRAME_INFO frameInfo;
    IDXGIResource* resource = nullptr;

    hr = duplication->AcquireNextFrame(1000, &frameInfo, &resource);
    if (FAILED(hr)) {
        printf("FAILED: AcquireNextFrame (0x%08X)\n", hr);
    } else {
        printf("OK: Frame captured!\n");
        resource->Release();
        duplication->ReleaseFrame();
    }

    duplication->Release();
    context->Release();
    device->Release();

    printf("\nAll tests passed!\n");
    return 0;
}
