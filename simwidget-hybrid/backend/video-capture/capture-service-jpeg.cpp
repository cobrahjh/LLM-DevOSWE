// High-Performance Screen Capture Service with JPEG Compression
// Uses Windows Desktop Duplication API + WIC for JPEG encoding
// Target: 60+ FPS at 1920x1080

#define WIN32_LEAN_AND_MEAN
#include <winsock2.h>
#include <windows.h>
#include <d3d11.h>
#include <dxgi1_2.h>
#include <wincodec.h>
#include <stdio.h>
#include <chrono>
#pragma comment(lib, "ws2_32.lib")
#pragma comment(lib, "windowscodecs.lib")

#define PORT 9998
#define BUFFER_SIZE 2097152  // 2MB for compressed frames

class ScreenCapture {
private:
    ID3D11Device* device = nullptr;
    ID3D11DeviceContext* context = nullptr;
    IDXGIOutputDuplication* duplication = nullptr;
    ID3D11Texture2D* stagingTexture = nullptr;
    IWICImagingFactory* wicFactory = nullptr;
    UINT width = 0, height = 0;
    bool hasFrame = false;
    int jpegQuality = 70;  // 0-100, lower = smaller/faster

public:
    bool Initialize() {
        // Initialize COM for WIC
        CoInitializeEx(nullptr, COINIT_MULTITHREADED);

        // Create WIC factory
        HRESULT hr = CoCreateInstance(CLSID_WICImagingFactory, nullptr,
            CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&wicFactory));
        if (FAILED(hr)) {
            printf("Failed to create WIC factory: 0x%08X\n", hr);
            return false;
        }

        // Create D3D11 device
        D3D_FEATURE_LEVEL featureLevel;
        hr = D3D11CreateDevice(nullptr, D3D_DRIVER_TYPE_HARDWARE, nullptr,
            0, nullptr, 0, D3D11_SDK_VERSION, &device, &featureLevel, &context);
        if (FAILED(hr)) {
            printf("Failed to create D3D device: 0x%08X\n", hr);
            return false;
        }

        // Get DXGI device
        IDXGIDevice* dxgiDevice;
        hr = device->QueryInterface(__uuidof(IDXGIDevice), (void**)&dxgiDevice);
        if (FAILED(hr)) return false;

        IDXGIAdapter* adapter;
        hr = dxgiDevice->GetAdapter(&adapter);
        dxgiDevice->Release();
        if (FAILED(hr)) return false;

        IDXGIOutput* output;
        hr = adapter->EnumOutputs(0, &output);
        adapter->Release();
        if (FAILED(hr)) return false;

        IDXGIOutput1* output1;
        hr = output->QueryInterface(__uuidof(IDXGIOutput1), (void**)&output1);
        output->Release();
        if (FAILED(hr)) return false;

        hr = output1->DuplicateOutput(device, &duplication);
        output1->Release();
        if (FAILED(hr)) {
            printf("Failed to create duplication: 0x%08X\n", hr);
            return false;
        }

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

        hr = device->CreateTexture2D(&texDesc, nullptr, &stagingTexture);
        return SUCCEEDED(hr);
    }

    void SetQuality(int q) { jpegQuality = q; }

    int CaptureFrameJPEG(BYTE* buffer, int maxSize) {
        DXGI_OUTDUPL_FRAME_INFO frameInfo;
        IDXGIResource* resource = nullptr;

        if (hasFrame) {
            duplication->ReleaseFrame();
            hasFrame = false;
        }

        HRESULT hr = duplication->AcquireNextFrame(16, &frameInfo, &resource);
        if (hr == DXGI_ERROR_WAIT_TIMEOUT) return -2;
        if (FAILED(hr)) return -1;
        hasFrame = true;

        ID3D11Texture2D* texture;
        hr = resource->QueryInterface(__uuidof(ID3D11Texture2D), (void**)&texture);
        resource->Release();
        if (FAILED(hr)) return -1;

        context->CopyResource(stagingTexture, texture);
        texture->Release();

        D3D11_MAPPED_SUBRESOURCE mapped;
        hr = context->Map(stagingTexture, 0, D3D11_MAP_READ, 0, &mapped);
        if (FAILED(hr)) return -1;

        // Encode to JPEG using WIC
        IWICStream* stream = nullptr;
        IWICBitmapEncoder* encoder = nullptr;
        IWICBitmapFrameEncode* frame = nullptr;
        IPropertyBag2* props = nullptr;

        hr = wicFactory->CreateStream(&stream);
        if (FAILED(hr)) { context->Unmap(stagingTexture, 0); return -1; }

        // Write to memory buffer (skip 8 bytes for header)
        hr = stream->InitializeFromMemory(buffer + 8, maxSize - 8);
        if (FAILED(hr)) { stream->Release(); context->Unmap(stagingTexture, 0); return -1; }

        hr = wicFactory->CreateEncoder(GUID_ContainerFormatJpeg, nullptr, &encoder);
        if (FAILED(hr)) { stream->Release(); context->Unmap(stagingTexture, 0); return -1; }

        hr = encoder->Initialize(stream, WICBitmapEncoderNoCache);
        if (FAILED(hr)) { encoder->Release(); stream->Release(); context->Unmap(stagingTexture, 0); return -1; }

        hr = encoder->CreateNewFrame(&frame, &props);
        if (FAILED(hr)) { encoder->Release(); stream->Release(); context->Unmap(stagingTexture, 0); return -1; }

        // Set JPEG quality
        PROPBAG2 option = {};
        option.pstrName = L"ImageQuality";
        VARIANT value;
        VariantInit(&value);
        value.vt = VT_R4;
        value.fltVal = jpegQuality / 100.0f;
        props->Write(1, &option, &value);

        hr = frame->Initialize(props);
        props->Release();
        if (FAILED(hr)) { frame->Release(); encoder->Release(); stream->Release(); context->Unmap(stagingTexture, 0); return -1; }

        hr = frame->SetSize(width, height);
        if (FAILED(hr)) { frame->Release(); encoder->Release(); stream->Release(); context->Unmap(stagingTexture, 0); return -1; }

        WICPixelFormatGUID format = GUID_WICPixelFormat32bppBGRA;
        hr = frame->SetPixelFormat(&format);
        if (FAILED(hr)) { frame->Release(); encoder->Release(); stream->Release(); context->Unmap(stagingTexture, 0); return -1; }

        // Write pixels (handle pitch)
        hr = frame->WritePixels(height, mapped.RowPitch, height * mapped.RowPitch, (BYTE*)mapped.pData);
        context->Unmap(stagingTexture, 0);

        if (FAILED(hr)) { frame->Release(); encoder->Release(); stream->Release(); return -1; }

        hr = frame->Commit();
        frame->Release();
        if (FAILED(hr)) { encoder->Release(); stream->Release(); return -1; }

        hr = encoder->Commit();
        encoder->Release();
        if (FAILED(hr)) { stream->Release(); return -1; }

        // Get actual JPEG size
        ULARGE_INTEGER pos;
        LARGE_INTEGER zero = {};
        stream->Seek(zero, STREAM_SEEK_CUR, &pos);
        int jpegSize = (int)pos.QuadPart;
        stream->Release();

        // Write header: width (2 bytes), height (2 bytes), jpeg size (4 bytes)
        ((USHORT*)buffer)[0] = (USHORT)width;
        ((USHORT*)buffer)[1] = (USHORT)height;
        ((UINT*)(buffer + 4))[0] = jpegSize;

        return 8 + jpegSize;
    }

    UINT GetWidth() { return width; }
    UINT GetHeight() { return height; }

    void Cleanup() {
        if (stagingTexture) stagingTexture->Release();
        if (duplication) duplication->Release();
        if (context) context->Release();
        if (device) device->Release();
        if (wicFactory) wicFactory->Release();
        CoUninitialize();
    }
};

int main(int argc, char* argv[]) {
    int quality = 60;
    if (argc > 1) quality = atoi(argv[1]);

    printf("SimWidget JPEG Capture Service v2.0\n");
    printf("Port: %d, Quality: %d\n", PORT, quality);
    fflush(stdout);

    ScreenCapture capture;
    if (!capture.Initialize()) {
        printf("Failed to initialize capture\n");
        fflush(stdout);
        return 1;
    }
    capture.SetQuality(quality);
    printf("Capture initialized: %dx%d\n", capture.GetWidth(), capture.GetHeight());
    fflush(stdout);

    WSADATA wsaData;
    WSAStartup(MAKEWORD(2, 2), &wsaData);

    SOCKET serverSocket = socket(AF_INET, SOCK_STREAM, 0);

    // Enable TCP_NODELAY for lower latency
    int flag = 1;
    setsockopt(serverSocket, IPPROTO_TCP, TCP_NODELAY, (char*)&flag, sizeof(flag));

    sockaddr_in serverAddr = {};
    serverAddr.sin_family = AF_INET;
    serverAddr.sin_addr.s_addr = INADDR_ANY;
    serverAddr.sin_port = htons(PORT);

    bind(serverSocket, (sockaddr*)&serverAddr, sizeof(serverAddr));
    listen(serverSocket, 5);

    printf("Listening on port %d...\n", PORT);
    fflush(stdout);

    BYTE* frameBuffer = new BYTE[BUFFER_SIZE];

    while (true) {
        SOCKET clientSocket = accept(serverSocket, nullptr, nullptr);
        if (clientSocket == INVALID_SOCKET) continue;

        // Enable TCP_NODELAY on client socket too
        setsockopt(clientSocket, IPPROTO_TCP, TCP_NODELAY, (char*)&flag, sizeof(flag));

        printf("Client connected\n");
        fflush(stdout);

        int framesSent = 0;
        auto startTime = std::chrono::steady_clock::now();
        int lastFpsReport = 0;

        while (true) {
            int frameSize = capture.CaptureFrameJPEG(frameBuffer, BUFFER_SIZE);
            if (frameSize == -2) {
                // Timeout, no new frame
                continue;
            }
            if (frameSize <= 0) {
                Sleep(1);
                continue;
            }

            // Send frame size (4 bytes) then frame data
            if (send(clientSocket, (char*)&frameSize, 4, 0) <= 0) break;

            int sent = 0;
            while (sent < frameSize) {
                int result = send(clientSocket, (char*)(frameBuffer + sent), frameSize - sent, 0);
                if (result <= 0) break;
                sent += result;
            }
            if (sent < frameSize) break;

            framesSent++;

            // Report FPS every second
            auto now = std::chrono::steady_clock::now();
            auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(now - startTime).count();
            if (elapsed >= 1000) {
                int fps = framesSent - lastFpsReport;
                printf("FPS: %d, Size: %d KB\n", fps, frameSize / 1024);
                fflush(stdout);
                lastFpsReport = framesSent;
                startTime = now;
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
