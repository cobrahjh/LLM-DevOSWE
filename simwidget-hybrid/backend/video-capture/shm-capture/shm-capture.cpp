// Shared Memory Screen Capture
// Fastest possible transfer - captures to memory-mapped file
// Compile: cl /EHsc /O2 shm-capture.cpp /link d3d11.lib dxgi.lib

#include <windows.h>
#include <d3d11.h>
#include <dxgi1_2.h>
#include <stdio.h>

#define SHM_NAME "SimWidgetCapture"
#define SHM_SIZE (8 + 1920 * 1080 * 4)  // Header + BGRA data

// Shared memory header
struct ShmHeader {
    UINT32 width;
    UINT32 height;
    UINT32 frameNum;
    UINT32 timestamp;
    UINT32 ready;      // 1 = new frame available
    UINT32 reserved[3];
};

class SharedMemoryCapture {
private:
    ID3D11Device* device = nullptr;
    ID3D11DeviceContext* context = nullptr;
    IDXGIOutputDuplication* duplication = nullptr;
    ID3D11Texture2D* stagingTexture = nullptr;
    UINT width = 0, height = 0;

    HANDLE hMapFile = nullptr;
    LPVOID pSharedMem = nullptr;
    UINT32 frameNum = 0;

public:
    bool Initialize() {
        // Create D3D11 device
        D3D_FEATURE_LEVEL featureLevel;
        HRESULT hr = D3D11CreateDevice(nullptr, D3D_DRIVER_TYPE_HARDWARE, nullptr,
            0, nullptr, 0, D3D11_SDK_VERSION, &device, &featureLevel, &context);
        if (FAILED(hr)) {
            printf("Failed to create D3D device: 0x%08X\n", hr);
            return false;
        }

        // Get DXGI device and output
        IDXGIDevice* dxgiDevice;
        device->QueryInterface(__uuidof(IDXGIDevice), (void**)&dxgiDevice);

        IDXGIAdapter* adapter;
        dxgiDevice->GetAdapter(&adapter);
        dxgiDevice->Release();

        IDXGIOutput* output;
        adapter->EnumOutputs(0, &output);
        adapter->Release();

        IDXGIOutput1* output1;
        output->QueryInterface(__uuidof(IDXGIOutput1), (void**)&output1);
        output->Release();

        // Create duplication
        hr = output1->DuplicateOutput(device, &duplication);
        output1->Release();
        if (FAILED(hr)) {
            printf("Failed to create output duplication: 0x%08X\n", hr);
            return false;
        }

        // Get dimensions
        DXGI_OUTDUPL_DESC desc;
        duplication->GetDesc(&desc);
        width = desc.ModeDesc.Width;
        height = desc.ModeDesc.Height;

        // Create staging texture
        D3D11_TEXTURE2D_DESC texDesc = {};
        texDesc.Width = width;
        texDesc.Height = height;
        texDesc.MipLevels = 1;
        texDesc.ArraySize = 1;
        texDesc.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
        texDesc.SampleDesc.Count = 1;
        texDesc.Usage = D3D11_USAGE_STAGING;
        texDesc.CPUAccessFlags = D3D11_CPU_ACCESS_READ;
        device->CreateTexture2D(&texDesc, nullptr, &stagingTexture);

        // Create shared memory
        DWORD shmSize = sizeof(ShmHeader) + width * height * 4;
        hMapFile = CreateFileMappingA(INVALID_HANDLE_VALUE, nullptr,
            PAGE_READWRITE, 0, shmSize, SHM_NAME);
        if (!hMapFile) {
            printf("Failed to create shared memory\n");
            return false;
        }

        pSharedMem = MapViewOfFile(hMapFile, FILE_MAP_ALL_ACCESS, 0, 0, shmSize);
        if (!pSharedMem) {
            printf("Failed to map shared memory\n");
            return false;
        }

        // Initialize header
        ShmHeader* header = (ShmHeader*)pSharedMem;
        header->width = width;
        header->height = height;
        header->frameNum = 0;
        header->ready = 0;

        printf("Initialized: %dx%d, SHM: %s\n", width, height, SHM_NAME);
        return true;
    }

    bool CaptureFrame() {
        DXGI_OUTDUPL_FRAME_INFO frameInfo;
        IDXGIResource* resource = nullptr;

        duplication->ReleaseFrame();

        HRESULT hr = duplication->AcquireNextFrame(100, &frameInfo, &resource);
        if (FAILED(hr)) return false;

        ID3D11Texture2D* texture;
        resource->QueryInterface(__uuidof(ID3D11Texture2D), (void**)&texture);
        resource->Release();

        context->CopyResource(stagingTexture, texture);
        texture->Release();

        D3D11_MAPPED_SUBRESOURCE mapped;
        hr = context->Map(stagingTexture, 0, D3D11_MAP_READ, 0, &mapped);
        if (FAILED(hr)) return false;

        // Copy to shared memory
        ShmHeader* header = (ShmHeader*)pSharedMem;
        BYTE* pixelData = (BYTE*)pSharedMem + sizeof(ShmHeader);
        BYTE* src = (BYTE*)mapped.pData;

        for (UINT y = 0; y < height; y++) {
            memcpy(pixelData + y * width * 4, src + y * mapped.RowPitch, width * 4);
        }

        header->frameNum = ++frameNum;
        header->timestamp = GetTickCount();
        header->ready = 1;  // Signal new frame

        context->Unmap(stagingTexture, 0);
        return true;
    }

    void Run(int targetFps) {
        printf("Running at %d FPS target\n", targetFps);
        int frameTime = 1000 / targetFps;

        while (true) {
            DWORD start = GetTickCount();

            if (CaptureFrame()) {
                // Frame captured
            }

            DWORD elapsed = GetTickCount() - start;
            if (elapsed < frameTime) {
                Sleep(frameTime - elapsed);
            }
        }
    }

    void Cleanup() {
        if (pSharedMem) UnmapViewOfFile(pSharedMem);
        if (hMapFile) CloseHandle(hMapFile);
        if (stagingTexture) stagingTexture->Release();
        if (duplication) duplication->Release();
        if (context) context->Release();
        if (device) device->Release();
    }
};

int main(int argc, char* argv[]) {
    int fps = 60;
    if (argc > 1) fps = atoi(argv[1]);

    printf("SimWidget Shared Memory Capture\n");

    SharedMemoryCapture capture;
    if (!capture.Initialize()) {
        printf("Initialization failed\n");
        return 1;
    }

    capture.Run(fps);
    capture.Cleanup();
    return 0;
}
