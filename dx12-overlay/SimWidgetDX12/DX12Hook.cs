using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using EasyHook;
using Vortice.Direct3D12;
using Vortice.Direct3D11;
using Vortice.Direct2D1;
using Vortice.DirectWrite;
using Vortice.DXGI;
using Vortice.Mathematics;
using Vortice;

using D3D11Device = Vortice.Direct3D11.ID3D11Device;
using D3D12Device = Vortice.Direct3D12.ID3D12Device;
using DXGIFactory = Vortice.DXGI.IDXGIFactory4;

namespace SimWidgetDX12
{
    /// <summary>
    /// DirectX 12 Hook for MSFS 2024
    /// Uses D3D11On12 interop for Direct2D rendering
    /// </summary>
    public class DX12Hook : IEntryPoint
    {
        private static string _logFile;
        
        // Hooks
        private LocalHook _presentHook;
        private LocalHook _resizeBuffersHook;
        
        // DX12 resources (from game)
        private IDXGISwapChain3 _swapChain;
        private ID3D12Device _device12;
        private ID3D12CommandQueue _commandQueue;
        
        // D3D11On12 interop
        private ID3D11Device _device11;
        private ID3D11DeviceContext _context11;
        private ID3D11On12Device _device11on12;
        
        // Direct2D
        private ID2D1Factory1 _factory2D;
        private IDWriteFactory _factoryDWrite;
        private ID2D1DeviceContext _deviceContext2D;
        private ID2D1Device _device2D;
        
        // Per-buffer resources
        private ID3D11Resource[] _wrappedBackBuffers;
        private ID2D1Bitmap1[] _renderTargets2D;
        private int _bufferCount;
        
        // Brushes/fonts
        private ID2D1SolidColorBrush _textBrush;
        private ID2D1SolidColorBrush _bgBrush;
        private ID2D1SolidColorBrush _accentBrush;
        private IDWriteTextFormat _textFormat;
        private IDWriteTextFormat _titleFormat;
        
        // State
        private bool _initialized = false;
        private int _frameCount = 0;
        private OverlayRenderer _renderer;
        private SimDataClient _simData;
        
        // Present delegates
        [UnmanagedFunctionPointer(CallingConvention.StdCall)]
        private delegate int PresentDelegate(IntPtr swapChainPtr, int syncInterval, int flags);
        
        [UnmanagedFunctionPointer(CallingConvention.StdCall)]
        private delegate int ResizeBuffersDelegate(IntPtr swapChainPtr, int bufferCount, int width, int height, int newFormat, int swapChainFlags);
        
        private PresentDelegate _originalPresent;
        private ResizeBuffersDelegate _originalResizeBuffers;

        public DX12Hook(RemoteHooking.IContext context, string channelName)
        {
            _logFile = Path.Combine(Path.GetTempPath(), "SimWidgetDX12.log");
            File.WriteAllText(_logFile, "SimWidget DX12 Hook Log\n");
            File.AppendAllText(_logFile, "========================\n\n");
            
            Log("Constructor called - DX12 Hook");
            _renderer = new OverlayRenderer();
            _simData = new SimDataClient();
        }
        
        public void Run(RemoteHooking.IContext context, string channelName)
        {
            try
            {
                Log("Run() started - DX12 Hook");
                Log("Process: " + System.Diagnostics.Process.GetCurrentProcess().ProcessName);
                
                // Get Present address from DX12 swap chain
                Log("Getting DX12 Present address...");
                IntPtr presentAddr = GetDX12PresentAddress();
                
                if (presentAddr == IntPtr.Zero)
                {
                    Log("ERROR: Could not find DX12 Present address");
                    return;
                }
                
                Log(string.Format("Found Present at: 0x{0:X}", presentAddr.ToInt64()));
                
                // Create Present hook
                Log("Creating Present hook...");
                _presentHook = LocalHook.Create(
                    presentAddr,
                    new PresentDelegate(PresentHook),
                    this
                );
                _presentHook.ThreadACL.SetExclusiveACL(new int[] { 0 });
                
                Log("DX12 Hook installed!");
                
                // Connect to sim data server
                Log("Connecting to SimWidget server...");
                _simData.Connect("ws://localhost:8484");
                
                RemoteHooking.WakeUpProcess();
                
                Log("Entering main loop...");
                while (true)
                {
                    Thread.Sleep(500);
                    _simData.Update();
                    
                    if (_frameCount > 0 && _frameCount % 60 == 0)
                    {
                        Log(string.Format("Frames: {0}, Init: {1}", _frameCount, _initialized));
                    }
                }
            }
            catch (Exception ex)
            {
                Log("FATAL: " + ex.ToString());
            }
            finally
            {
                Log("Cleanup...");
                _presentHook?.Dispose();
                Cleanup();
            }
        }

        /// <summary>
        /// Hooked Present - called every frame
        /// </summary>
        private int PresentHook(IntPtr swapChainPtr, int syncInterval, int flags)
        {
            _frameCount++;
            
            try
            {
                if (!_initialized)
                {
                    Log(string.Format("First Present! SwapChain: 0x{0:X}", swapChainPtr.ToInt64()));
                    InitializeDX12(swapChainPtr);
                }
                
                if (_initialized && _renderer.Visible)
                {
                    RenderOverlay();
                }
            }
            catch (Exception ex)
            {
                if (_frameCount < 10)
                {
                    Log("Present error: " + ex.Message);
                }
            }
            
            return _originalPresent(swapChainPtr, syncInterval, flags);
        }
        
        /// <summary>
        /// Initialize DX12 + D3D11On12 + Direct2D
        /// </summary>
        private void InitializeDX12(IntPtr swapChainPtr)
        {
            try
            {
                Log("InitializeDX12 starting...");
                
                // Get swap chain
                _swapChain = new IDXGISwapChain3(swapChainPtr);
                Log("SwapChain3 obtained");
                
                // Get DX12 device from swap chain
                _swapChain.GetDevice(typeof(ID3D12Device).GUID, out IntPtr devicePtr);
                _device12 = new ID3D12Device(devicePtr);
                Log("DX12 Device obtained");
                
                // Get swap chain description
                var desc = _swapChain.Description;
                _bufferCount = desc.BufferCount;
                Log(string.Format("SwapChain: {0}x{1}, {2} buffers", desc.Width, desc.Height, _bufferCount));
                
                // Create D3D11On12 device
                Log("Creating D3D11On12 device...");
                
                var featureLevels = new Vortice.Direct3D.FeatureLevel[]
                {
                    Vortice.Direct3D.FeatureLevel.Level_12_1,
                    Vortice.Direct3D.FeatureLevel.Level_12_0,
                    Vortice.Direct3D.FeatureLevel.Level_11_1,
                    Vortice.Direct3D.FeatureLevel.Level_11_0
                };
                
                // We need the command queue - try to get it
                // For now, create our own (this may not work with game's queue)
                var queueDesc = new CommandQueueDescription(CommandListType.Direct);
                _commandQueue = _device12.CreateCommandQueue(queueDesc);
                
                var result = D3D11.D3D11On12CreateDevice(
                    _device12,
                    DeviceCreationFlags.BgraSupport,
                    featureLevels,
                    new IUnknown[] { _commandQueue },
                    0,
                    out _device11,
                    out _context11,
                    out _
                );
                
                if (result.Failure)
                {
                    Log("D3D11On12CreateDevice failed: " + result.Code);
                    return;
                }
                Log("D3D11On12 device created");
                
                // Get 11On12 interface
                _device11on12 = _device11.QueryInterface<ID3D11On12Device>();
                Log("ID3D11On12Device obtained");
                
                // Create Direct2D factory
                _factory2D = D2D1.D2D1CreateFactory<ID2D1Factory1>();
                _factoryDWrite = DWrite.DWriteCreateFactory<IDWriteFactory>();
                Log("D2D/DWrite factories created");
                
                // Create D2D device from D3D11 device
                using (var dxgiDevice = _device11.QueryInterface<IDXGIDevice>())
                {
                    _device2D = _factory2D.CreateDevice(dxgiDevice);
                    _deviceContext2D = _device2D.CreateDeviceContext(DeviceContextOptions.None);
                }
                Log("D2D device context created");
                
                // Create wrapped resources for each back buffer
                _wrappedBackBuffers = new ID3D11Resource[_bufferCount];
                _renderTargets2D = new ID2D1Bitmap1[_bufferCount];
                
                for (int i = 0; i < _bufferCount; i++)
                {
                    CreateRenderTargetForBuffer(i);
                }
                Log("Render targets created for all buffers");
                
                // Create brushes
                _textBrush = _deviceContext2D.CreateSolidColorBrush(new Color4(0.9f, 0.95f, 1f, 1f));
                _bgBrush = _deviceContext2D.CreateSolidColorBrush(new Color4(0.06f, 0.09f, 0.16f, 0.95f));
                _accentBrush = _deviceContext2D.CreateSolidColorBrush(new Color4(0.22f, 0.74f, 0.97f, 1f));
                
                // Create text formats
                _textFormat = _factoryDWrite.CreateTextFormat("Segoe UI", 14f);
                _titleFormat = _factoryDWrite.CreateTextFormat("Segoe UI", FontWeight.Bold, FontStyle.Normal, 16f);
                
                _initialized = true;
                Log("DX12 initialization COMPLETE!");
            }
            catch (Exception ex)
            {
                Log("Init error: " + ex.ToString());
                _initialized = false;
            }
        }
        
        private void CreateRenderTargetForBuffer(int index)
        {
            Log(string.Format("Creating render target for buffer {0}...", index));
            
            // Get DX12 back buffer
            var backBuffer12 = _swapChain.GetBuffer<ID3D12Resource>(index);
            
            // Wrap for D3D11
            var flags = D3D11ResourceFlags.BindRenderTarget;
            
            _device11on12.CreateWrappedResource(
                backBuffer12,
                flags,
                ResourceStates.RenderTarget,
                ResourceStates.Present,
                typeof(ID3D11Resource).GUID,
                out IntPtr wrapped11Ptr
            );
            
            _wrappedBackBuffers[index] = new ID3D11Resource(wrapped11Ptr);
            
            // Create D2D render target from D3D11 surface
            using (var surface = _wrappedBackBuffers[index].QueryInterface<IDXGISurface>())
            {
                var bitmapProps = new BitmapProperties1(
                    new Vortice.DCommon.PixelFormat(Format.B8G8R8A8_UNorm, Vortice.DCommon.AlphaMode.Premultiplied),
                    96, 96,
                    BitmapOptions.Target | BitmapOptions.CannotDraw
                );
                
                _renderTargets2D[index] = _deviceContext2D.CreateBitmapFromDxgiSurface(surface, bitmapProps);
            }
            
            backBuffer12.Dispose();
            Log(string.Format("Buffer {0} ready", index));
        }

        /// <summary>
        /// Render the overlay
        /// </summary>
        private void RenderOverlay()
        {
            int bufferIndex = _swapChain.CurrentBackBufferIndex;
            
            // Acquire the wrapped resource
            var resources = new ID3D11Resource[] { _wrappedBackBuffers[bufferIndex] };
            _device11on12.AcquireWrappedResources(resources, 1);
            
            // Set render target
            _deviceContext2D.Target = _renderTargets2D[bufferIndex];
            _deviceContext2D.BeginDraw();
            
            try
            {
                DrawOverlayContent();
            }
            finally
            {
                _deviceContext2D.EndDraw();
                _deviceContext2D.Target = null;
                
                // Release wrapped resource
                _device11on12.ReleaseWrappedResources(resources, 1);
                _context11.Flush();
            }
        }
        
        private void DrawOverlayContent()
        {
            // Panel dimensions
            float x = 50, y = 100;
            float w = 280, h = 400;
            float pad = 15;
            float line = 24;
            
            // Background
            var bgRect = new RawRectF(x, y, x + w, y + h);
            _deviceContext2D.FillRoundedRectangle(
                new RoundedRectangle(bgRect, 10, 10),
                _bgBrush
            );
            
            // Border
            using (var borderBrush = _deviceContext2D.CreateSolidColorBrush(new Color4(0.4f, 0.7f, 1f, 0.3f)))
            {
                _deviceContext2D.DrawRoundedRectangle(
                    new RoundedRectangle(bgRect, 10, 10),
                    borderBrush,
                    1f
                );
            }
            
            float ty = y + pad;
            
            // Title
            _deviceContext2D.DrawText("SIMWIDGET DX12", _titleFormat, new RawRectF(x + pad, ty, x + w - pad, ty + 30), _accentBrush);
            ty += line + 5;
            
            // Connection
            string status = _simData.Connected ? "● Connected" : "○ Connecting...";
            using (var statusBrush = _deviceContext2D.CreateSolidColorBrush(
                _simData.Connected ? new Color4(0.13f, 0.77f, 0.37f, 1f) : new Color4(0.96f, 0.62f, 0.04f, 1f)))
            {
                _deviceContext2D.DrawText(status, _textFormat, new RawRectF(x + pad, ty, x + w - pad, ty + 25), statusBrush);
            }
            ty += line + 10;
            
            var data = _simData.Data;
            
            // Flight Data
            _deviceContext2D.DrawText("FLIGHT DATA", _textFormat, new RawRectF(x + pad, ty, x + w - pad, ty + 25), _accentBrush);
            ty += line;
            
            DrawRow("ALTITUDE", string.Format("{0:N0} ft", data.Altitude), x + pad, ty, w - pad * 2);
            ty += line;
            DrawRow("SPEED", string.Format("{0:N0} kts", data.Speed), x + pad, ty, w - pad * 2);
            ty += line;
            DrawRow("HEADING", string.Format("{0:000}°", data.Heading), x + pad, ty, w - pad * 2);
            ty += line;
            string vs = (data.VerticalSpeed >= 0 ? "+" : "") + string.Format("{0:N0} fpm", data.VerticalSpeed);
            DrawRow("V/S", vs, x + pad, ty, w - pad * 2);
            ty += line + 10;
            
            // Engine
            _deviceContext2D.DrawText("ENGINE", _textFormat, new RawRectF(x + pad, ty, x + w - pad, ty + 25), _accentBrush);
            ty += line;
            
            using (var engBrush = _deviceContext2D.CreateSolidColorBrush(
                data.EngineRunning ? new Color4(0.13f, 0.77f, 0.37f, 1f) : new Color4(0.94f, 0.27f, 0.27f, 1f)))
            {
                DrawRow("STATUS", data.EngineRunning ? "RUNNING" : "OFF", x + pad, ty, w - pad * 2, engBrush);
            }
            ty += line;
            DrawRow("THROTTLE", string.Format("{0:N0}%", data.Throttle), x + pad, ty, w - pad * 2);
            ty += line + 10;
            
            // Frame counter
            _deviceContext2D.DrawText(string.Format("Frame: {0}", _frameCount), _textFormat, 
                new RawRectF(x + pad, ty, x + w - pad, ty + 25), _accentBrush);
        }
        
        private void DrawRow(string label, string value, float x, float y, float width, ID2D1Brush valueBrush = null)
        {
            using (var labelBrush = _deviceContext2D.CreateSolidColorBrush(new Color4(0.4f, 0.45f, 0.53f, 1f)))
            {
                _deviceContext2D.DrawText(label, _textFormat, new RawRectF(x, y, x + 100, y + 25), labelBrush);
            }
            
            using (var rightFormat = _factoryDWrite.CreateTextFormat("Segoe UI", FontWeight.SemiBold, FontStyle.Normal, 14f))
            {
                rightFormat.TextAlignment = TextAlignment.Trailing;
                _deviceContext2D.DrawText(value, rightFormat, new RawRectF(x, y, x + width, y + 25), valueBrush ?? _textBrush);
            }
        }

        /// <summary>
        /// Get DX12 Present address by creating temp swap chain
        /// </summary>
        private IntPtr GetDX12PresentAddress()
        {
            try
            {
                Log("Creating temp DX12 factory...");
                
                // Create DXGI Factory
                if (DXGI.CreateDXGIFactory2(false, out IDXGIFactory4 factory).Failure)
                {
                    Log("Failed to create DXGI factory");
                    return IntPtr.Zero;
                }
                
                // Get adapter
                var adapter = factory.GetAdapter1(0);
                Log("Adapter: " + adapter.Description1.Description);
                
                // Create DX12 device
                Log("Creating temp DX12 device...");
                if (D3D12.D3D12CreateDevice(adapter, Vortice.Direct3D.FeatureLevel.Level_11_0, out ID3D12Device tempDevice).Failure)
                {
                    Log("Failed to create DX12 device");
                    return IntPtr.Zero;
                }
                
                // Create command queue
                var queueDesc = new CommandQueueDescription(CommandListType.Direct);
                var tempQueue = tempDevice.CreateCommandQueue(queueDesc);
                
                // Create temp swap chain
                Log("Creating temp swap chain...");
                var swapChainDesc = new SwapChainDescription1
                {
                    Width = 100,
                    Height = 100,
                    Format = Format.R8G8B8A8_UNorm,
                    BufferUsage = Usage.RenderTargetOutput,
                    BufferCount = 2,
                    SampleDescription = new SampleDescription(1, 0),
                    Scaling = Scaling.Stretch,
                    SwapEffect = SwapEffect.FlipDiscard,
                    AlphaMode = Vortice.DXGI.AlphaMode.Unspecified
                };
                
                // Need a window handle - use desktop
                IntPtr hwnd = GetDesktopWindow();
                
                var tempSwapChain = factory.CreateSwapChainForHwnd(tempQueue, hwnd, swapChainDesc);
                Log("Temp swap chain created");
                
                // Get vtable
                IntPtr swapChainVTable = Marshal.ReadIntPtr(tempSwapChain.NativePointer);
                Log(string.Format("VTable at: 0x{0:X}", swapChainVTable.ToInt64()));
                
                // Present is at index 8 (same as DX11)
                IntPtr presentAddr = Marshal.ReadIntPtr(swapChainVTable, 8 * IntPtr.Size);
                Log(string.Format("Present at: 0x{0:X}", presentAddr.ToInt64()));
                
                // Store original
                _originalPresent = Marshal.GetDelegateForFunctionPointer<PresentDelegate>(presentAddr);
                
                // Cleanup temp resources
                tempSwapChain.Dispose();
                tempQueue.Dispose();
                tempDevice.Dispose();
                adapter.Dispose();
                factory.Dispose();
                
                return presentAddr;
            }
            catch (Exception ex)
            {
                Log("GetDX12PresentAddress error: " + ex.ToString());
                return IntPtr.Zero;
            }
        }
        
        [DllImport("user32.dll")]
        private static extern IntPtr GetDesktopWindow();
        
        private void Cleanup()
        {
            try
            {
                _textFormat?.Dispose();
                _titleFormat?.Dispose();
                _textBrush?.Dispose();
                _bgBrush?.Dispose();
                _accentBrush?.Dispose();
                
                if (_renderTargets2D != null)
                {
                    foreach (var rt in _renderTargets2D)
                        rt?.Dispose();
                }
                
                if (_wrappedBackBuffers != null)
                {
                    foreach (var buf in _wrappedBackBuffers)
                        buf?.Dispose();
                }
                
                _deviceContext2D?.Dispose();
                _device2D?.Dispose();
                _factoryDWrite?.Dispose();
                _factory2D?.Dispose();
                _device11on12?.Dispose();
                _context11?.Dispose();
                _device11?.Dispose();
                _commandQueue?.Dispose();
            }
            catch { }
        }
        
        private static void Log(string msg)
        {
            string line = string.Format("[{0}] {1}\n", DateTime.Now.ToString("HH:mm:ss.fff"), msg);
            Console.WriteLine("[DX12] " + msg);
            System.Diagnostics.Debug.WriteLine("[DX12] " + msg);
            
            try
            {
                if (_logFile != null)
                    File.AppendAllText(_logFile, line);
            }
            catch { }
        }
    }
}
