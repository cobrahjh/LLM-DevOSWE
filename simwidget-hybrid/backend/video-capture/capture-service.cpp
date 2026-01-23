// High-Performance Screen Capture Service
// Uses Windows Desktop Duplication API (DXGI) for minimal latency
// Compile: cl /EHsc /O2 capture-service.cpp /link d3d11.lib dxgi.lib ole32.lib ws2_32.lib

#define WIN32_LEAN_AND_MEAN
#include <winsock2.h>
#include <windows.h>
#include <d3d11.h>
#include <dxgi1_2.h>
#include <stdio.h>
#pragma comment(lib, "ws2_32.lib")

#define PORT 9998
#define BUFFER_SIZE 16777216  // 16MB max frame (supports up to 4K)

class ScreenCapture {
private:
    ID3D11Device* device = nullptr;
    ID3D11DeviceContext* context = nullptr;
    IDXGIOutputDuplication* duplication = nullptr;
    ID3D11Texture2D* stagingTexture = nullptr;
    UINT width = 0, height = 0;

public:
    bool Initialize() {
        // Create D3D11 device
        D3D_FEATURE_LEVEL featureLevel;
        HRESULT hr = D3D11CreateDevice(nullptr, D3D_DRIVER_TYPE_HARDWARE, nullptr,
            0, nullptr, 0, D3D11_SDK_VERSION, &device, &featureLevel, &context);
        if (FAILED(hr)) return false;

        // Get DXGI device
        IDXGIDevice* dxgiDevice;
        hr = device->QueryInterface(__uuidof(IDXGIDevice), (void**)&dxgiDevice);
        if (FAILED(hr)) return false;

        // Get adapter
        IDXGIAdapter* adapter;
        hr = dxgiDevice->GetAdapter(&adapter);
        dxgiDevice->Release();
        if (FAILED(hr)) return false;

        // Get output (monitor)
        IDXGIOutput* output;
        hr = adapter->EnumOutputs(0, &output);
        adapter->Release();
        if (FAILED(hr)) return false;

        // Get output1 for duplication
        IDXGIOutput1* output1;
        hr = output->QueryInterface(__uuidof(IDXGIOutput1), (void**)&output1);
        output->Release();
        if (FAILED(hr)) return false;

        // Create duplication
        hr = output1->DuplicateOutput(device, &duplication);
        output1->Release();
        if (FAILED(hr)) return false;

        // Get output description
        DXGI_OUTDUPL_DESC desc;
        duplication->GetDesc(&desc);
        width = desc.ModeDesc.Width;
        height = desc.ModeDesc.Height;

        // Create staging texture for CPU access
        D3D11_TEXTURE2D_DESC texDesc = {};
        texDesc.Width = width;
        texDesc.Height = height;
        texDesc.MipLevels = 1;
        texDesc.ArraySize = 1;
        texDesc.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
        texDesc.SampleDesc.Count = 1;
        texDesc.Usage = D3D11_USAGE_STAGING;
        texDesc.CPUAccessFlags = D3D11_CPU_ACCESS_READ;

        hr = device->CreateTexture2D(&texDesc, nullptr, &stagingTexture);
        return SUCCEEDED(hr);
    }

    bool hasFrame = false;

    int CaptureFrame(BYTE* buffer, int maxSize) {
        DXGI_OUTDUPL_FRAME_INFO frameInfo;
        IDXGIResource* resource = nullptr;

        // Release previous frame if we had one
        if (hasFrame) {
            duplication->ReleaseFrame();
            hasFrame = false;
        }

        // Acquire new frame (500ms timeout)
        HRESULT hr = duplication->AcquireNextFrame(500, &frameInfo, &resource);
        if (hr == DXGI_ERROR_WAIT_TIMEOUT) {
            return -2;  // Timeout - screen didn't change
        }
        if (hr == DXGI_ERROR_ACCESS_LOST) {
            printf("DXGI_ERROR_ACCESS_LOST - need to reinitialize\n");
            fflush(stdout);
            return -3;
        }
        if (FAILED(hr)) {
            printf("AcquireNextFrame error: 0x%08X\n", hr);
            fflush(stdout);
            return -1;
        }
        hasFrame = true;

        // Get texture
        ID3D11Texture2D* texture;
        hr = resource->QueryInterface(__uuidof(ID3D11Texture2D), (void**)&texture);
        resource->Release();
        if (FAILED(hr)) {
            printf("QueryInterface texture failed: 0x%08X\n", hr);
            fflush(stdout);
            return -1;
        }

        // Copy to staging texture
        context->CopyResource(stagingTexture, texture);
        texture->Release();

        // Map staging texture
        D3D11_MAPPED_SUBRESOURCE mapped;
        hr = context->Map(stagingTexture, 0, D3D11_MAP_READ, 0, &mapped);
        if (FAILED(hr)) {
            printf("Map staging texture failed: 0x%08X\n", hr);
            fflush(stdout);
            return -1;
        }

        // Calculate size (simple BMP-like format: width, height, BGRA data)
        int headerSize = 8;
        int dataSize = width * height * 4;
        int totalSize = headerSize + dataSize;

        if (totalSize > maxSize) {
            printf("Buffer too small: need %d, have %d\n", totalSize, maxSize);
            fflush(stdout);
            context->Unmap(stagingTexture, 0);
            return -1;
        }

        // Write header: width (4 bytes), height (4 bytes)
        memcpy(buffer, &width, 4);
        memcpy(buffer + 4, &height, 4);

        // Copy pixel data (handle pitch)
        BYTE* dst = buffer + headerSize;
        BYTE* src = (BYTE*)mapped.pData;
        for (UINT y = 0; y < height; y++) {
            memcpy(dst + y * width * 4, src + y * mapped.RowPitch, width * 4);
        }

        context->Unmap(stagingTexture, 0);
        return totalSize;
    }

    void Cleanup() {
        if (stagingTexture) stagingTexture->Release();
        if (duplication) duplication->Release();
        if (context) context->Release();
        if (device) device->Release();
    }

    UINT GetWidth() { return width; }
    UINT GetHeight() { return height; }
};

int main() {
    printf("SimWidget Capture Service v1.0\n");
    printf("Port: %d\n", PORT);
    fflush(stdout);

    // Initialize capture
    ScreenCapture capture;
    if (!capture.Initialize()) {
        printf("Failed to initialize capture\n");
        fflush(stdout);
        return 1;
    }
    printf("Capture initialized: %dx%d\n", capture.GetWidth(), capture.GetHeight());
    fflush(stdout);

    // Initialize Winsock
    WSADATA wsaData;
    WSAStartup(MAKEWORD(2, 2), &wsaData);

    // Create socket
    SOCKET serverSocket = socket(AF_INET, SOCK_STREAM, 0);
    sockaddr_in serverAddr = {};
    serverAddr.sin_family = AF_INET;
    serverAddr.sin_addr.s_addr = INADDR_ANY;
    serverAddr.sin_port = htons(PORT);

    bind(serverSocket, (sockaddr*)&serverAddr, sizeof(serverAddr));
    listen(serverSocket, 5);

    printf("Listening on port %d...\n", PORT);
    fflush(stdout);

    // Allocate frame buffer
    BYTE* frameBuffer = new BYTE[BUFFER_SIZE];

    while (true) {
        SOCKET clientSocket = accept(serverSocket, nullptr, nullptr);
        if (clientSocket == INVALID_SOCKET) continue;

        printf("Client connected\n");
        fflush(stdout);

        int framesSent = 0;
        int timeoutCount = 0;
        int errorCount = 0;

        // Simple protocol: send frames continuously
        while (true) {
            int frameSize = capture.CaptureFrame(frameBuffer, BUFFER_SIZE);
            if (frameSize == -2) {
                // Timeout - screen didn't change
                timeoutCount++;
                if (timeoutCount == 1 || timeoutCount % 50 == 0) {
                    printf("Timeout (no screen change): %d\n", timeoutCount);
                    fflush(stdout);
                }
                Sleep(1);
                continue;
            }
            if (frameSize <= 0) {
                errorCount++;
                if (errorCount == 1 || errorCount % 10 == 0) {
                    printf("Capture error (count: %d)\n", errorCount);
                    fflush(stdout);
                }
                Sleep(10);
                continue;
            }
            timeoutCount = 0;
            errorCount = 0;

            // Send frame size first (4 bytes)
            if (send(clientSocket, (char*)&frameSize, 4, 0) <= 0) break;

            // Send frame data
            int sent = 0;
            while (sent < frameSize) {
                int result = send(clientSocket, (char*)(frameBuffer + sent), frameSize - sent, 0);
                if (result <= 0) break;
                sent += result;
            }
            if (sent < frameSize) break;

            framesSent++;
            if (framesSent % 100 == 0) {
                printf("Frames sent: %d\n", framesSent);
                fflush(stdout);
            }
        }

        closesocket(clientSocket);
        printf("Client disconnected (sent %d frames)\n", framesSent);
        fflush(stdout);
    }

    delete[] frameBuffer;
    capture.Cleanup();
    WSACleanup();
    return 0;
}
