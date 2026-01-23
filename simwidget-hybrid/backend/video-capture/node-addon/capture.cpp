// Node.js Native Addon for Screen Capture
// Uses N-API wrapper around Desktop Duplication API
// Build: npm install && node-gyp rebuild

#include <napi.h>
#include <windows.h>
#include <d3d11.h>
#include <dxgi1_2.h>

class ScreenCaptureAddon {
private:
    ID3D11Device* device = nullptr;
    ID3D11DeviceContext* context = nullptr;
    IDXGIOutputDuplication* duplication = nullptr;
    ID3D11Texture2D* stagingTexture = nullptr;
    UINT width = 0, height = 0;
    bool initialized = false;

public:
    bool Initialize() {
        if (initialized) return true;

        D3D_FEATURE_LEVEL featureLevel;
        HRESULT hr = D3D11CreateDevice(nullptr, D3D_DRIVER_TYPE_HARDWARE, nullptr,
            0, nullptr, 0, D3D11_SDK_VERSION, &device, &featureLevel, &context);
        if (FAILED(hr)) return false;

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
        if (FAILED(hr)) return false;

        DXGI_OUTDUPL_DESC desc;
        duplication->GetDesc(&desc);
        width = desc.ModeDesc.Width;
        height = desc.ModeDesc.Height;

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
        if (FAILED(hr)) return false;

        initialized = true;
        return true;
    }

    Napi::Buffer<uint8_t> CaptureFrame(Napi::Env env) {
        if (!initialized) {
            return Napi::Buffer<uint8_t>::New(env, 0);
        }

        DXGI_OUTDUPL_FRAME_INFO frameInfo;
        IDXGIResource* resource = nullptr;

        duplication->ReleaseFrame();

        HRESULT hr = duplication->AcquireNextFrame(100, &frameInfo, &resource);
        if (FAILED(hr)) {
            return Napi::Buffer<uint8_t>::New(env, 0);
        }

        ID3D11Texture2D* texture;
        hr = resource->QueryInterface(__uuidof(ID3D11Texture2D), (void**)&texture);
        resource->Release();
        if (FAILED(hr)) {
            return Napi::Buffer<uint8_t>::New(env, 0);
        }

        context->CopyResource(stagingTexture, texture);
        texture->Release();

        D3D11_MAPPED_SUBRESOURCE mapped;
        hr = context->Map(stagingTexture, 0, D3D11_MAP_READ, 0, &mapped);
        if (FAILED(hr)) {
            return Napi::Buffer<uint8_t>::New(env, 0);
        }

        // Create buffer: 8 byte header + BGRA data
        size_t headerSize = 8;
        size_t dataSize = width * height * 4;
        size_t totalSize = headerSize + dataSize;

        auto buffer = Napi::Buffer<uint8_t>::New(env, totalSize);
        uint8_t* data = buffer.Data();

        // Write header
        memcpy(data, &width, 4);
        memcpy(data + 4, &height, 4);

        // Copy pixel data (handle pitch)
        uint8_t* dst = data + headerSize;
        uint8_t* src = (uint8_t*)mapped.pData;
        for (UINT y = 0; y < height; y++) {
            memcpy(dst + y * width * 4, src + y * mapped.RowPitch, width * 4);
        }

        context->Unmap(stagingTexture, 0);
        return buffer;
    }

    UINT GetWidth() { return width; }
    UINT GetHeight() { return height; }

    void Cleanup() {
        if (stagingTexture) { stagingTexture->Release(); stagingTexture = nullptr; }
        if (duplication) { duplication->Release(); duplication = nullptr; }
        if (context) { context->Release(); context = nullptr; }
        if (device) { device->Release(); device = nullptr; }
        initialized = false;
    }
};

// Global instance
static ScreenCaptureAddon* captureInstance = nullptr;

// N-API wrapper functions
Napi::Boolean Initialize(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!captureInstance) {
        captureInstance = new ScreenCaptureAddon();
    }

    bool result = captureInstance->Initialize();
    return Napi::Boolean::New(env, result);
}

Napi::Buffer<uint8_t> CaptureFrame(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!captureInstance) {
        return Napi::Buffer<uint8_t>::New(env, 0);
    }

    return captureInstance->CaptureFrame(env);
}

Napi::Object GetInfo(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Object result = Napi::Object::New(env);

    if (captureInstance) {
        result.Set("width", captureInstance->GetWidth());
        result.Set("height", captureInstance->GetHeight());
        result.Set("initialized", true);
    } else {
        result.Set("width", 0);
        result.Set("height", 0);
        result.Set("initialized", false);
    }

    return result;
}

void Cleanup(const Napi::CallbackInfo& info) {
    if (captureInstance) {
        captureInstance->Cleanup();
        delete captureInstance;
        captureInstance = nullptr;
    }
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("initialize", Napi::Function::New(env, Initialize));
    exports.Set("captureFrame", Napi::Function::New(env, CaptureFrame));
    exports.Set("getInfo", Napi::Function::New(env, GetInfo));
    exports.Set("cleanup", Napi::Function::New(env, Cleanup));
    return exports;
}

NODE_API_MODULE(screen_capture, Init)
