using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using EasyHook;
using SharpDX;
using SharpDX.Direct3D11;
using SharpDX.DXGI;
using SharpDX.Direct2D1;
using SharpDX.DirectWrite;
using Device = SharpDX.Direct3D11.Device;
using FactoryD2D = SharpDX.Direct2D1.Factory;
using FactoryDWrite = SharpDX.DirectWrite.Factory;

namespace SimWidgetOverlay
{
    /// <summary>
    /// DirectX 11 Hook - Intercepts Present() to draw overlay
    /// </summary>
    public class DXHook : IEntryPoint
    {
        // Log file for debugging
        private static string _logFile;
        
        // Hook for IDXGISwapChain::Present
        private LocalHook _presentHook;
        
        // DirectX resources
        private Device _device;
        private SwapChain _swapChain;
        private RenderTargetView _renderTargetView;
        private FactoryD2D _factoryD2D;
        private FactoryDWrite _factoryDWrite;
        private RenderTarget _renderTarget2D;
        private SolidColorBrush _textBrush;
        private SolidColorBrush _bgBrush;
        private TextFormat _textFormat;
        
        // State
        private bool _initialized = false;
        private int _frameCount = 0;
        private OverlayRenderer _renderer;
        private SimDataClient _simData;
        
        // Present delegate
        [UnmanagedFunctionPointer(CallingConvention.StdCall, CharSet = CharSet.Unicode, SetLastError = true)]
        private delegate int DXGISwapChain_PresentDelegate(IntPtr swapChainPtr, int syncInterval, int flags);
        
        // Original Present function
        private DXGISwapChain_PresentDelegate _originalPresent;
        
        public DXHook(RemoteHooking.IContext context, string channelName)
        {
            // Setup log file
            _logFile = Path.Combine(Path.GetTempPath(), "SimWidgetOverlay.log");
            File.WriteAllText(_logFile, "SimWidget DirectX Hook Log\n");
            File.AppendAllText(_logFile, "==========================\n\n");
            
            Log("Constructor called");
            Log("Channel: " + channelName);
            
            _renderer = new OverlayRenderer();
            _simData = new SimDataClient();
        }
        
        public void Run(RemoteHooking.IContext context, string channelName)
        {
            try
            {
                Log("Run() started");
                Log("Process: " + System.Diagnostics.Process.GetCurrentProcess().ProcessName);
                
                // Get the address of Present from the swap chain vtable
                Log("Getting Present address...");
                IntPtr presentAddr = GetPresentAddress();
                
                if (presentAddr == IntPtr.Zero)
                {
                    Log("ERROR: Could not find Present address");
                    return;
                }
                
                Log(string.Format("Found Present at: 0x{0:X}", presentAddr.ToInt64()));
                
                // Create the hook
                Log("Creating hook...");
                _presentHook = LocalHook.Create(
                    presentAddr,
                    new DXGISwapChain_PresentDelegate(PresentHook),
                    this
                );
                
                Log("Setting thread ACL...");
                _presentHook.ThreadACL.SetExclusiveACL(new int[] { 0 });
                
                Log("Hook installed successfully!");
                
                // Connect to SimConnect server
                Log("Connecting to SimWidget server...");
                _simData.Connect("ws://localhost:8484");
                
                // Wake up the process
                Log("Waking up process...");
                RemoteHooking.WakeUpProcess();
                
                Log("Entering main loop...");
                
                // Keep the hook alive
                while (true)
                {
                    Thread.Sleep(500);
                    _simData.Update();
                    
                    // Log frame count periodically
                    if (_frameCount > 0 && _frameCount % 100 == 0)
                    {
                        Log(string.Format("Frames hooked: {0}, Initialized: {1}", _frameCount, _initialized));
                    }
                }
            }
            catch (Exception ex)
            {
                Log("FATAL ERROR: " + ex.ToString());
            }
            finally
            {
                Log("Cleaning up...");
                if (_presentHook != null) _presentHook.Dispose();
                Cleanup();
            }
        }
        
        /// <summary>
        /// Hooked Present function - called every frame
        /// </summary>
        private int PresentHook(IntPtr swapChainPtr, int syncInterval, int flags)
        {
            _frameCount++;
            
            try
            {
                if (!_initialized)
                {
                    Log(string.Format("First Present call! SwapChain: 0x{0:X}", swapChainPtr.ToInt64()));
                    InitializeDirectX(swapChainPtr);
                }
                
                if (_initialized && _renderer.Visible)
                {
                    DrawOverlay();
                }
            }
            catch (Exception ex)
            {
                if (_frameCount < 10)
                {
                    Log("Present error: " + ex.Message);
                }
            }
            
            // Call original Present
            return _originalPresent(swapChainPtr, syncInterval, flags);
        }
        
        /// <summary>
        /// Initialize DirectX resources for drawing
        /// </summary>
        private void InitializeDirectX(IntPtr swapChainPtr)
        {
            try
            {
                Log("InitializeDirectX starting...");
                
                _swapChain = new SwapChain(swapChainPtr);
                Log("SwapChain created");
                
                _device = _swapChain.GetDevice<Device>();
                Log("Device obtained");
                
                // Get back buffer
                using (var backBuffer = _swapChain.GetBackBuffer<Texture2D>(0))
                {
                    Log(string.Format("BackBuffer: {0}x{1}", backBuffer.Description.Width, backBuffer.Description.Height));
                    
                    _renderTargetView = new RenderTargetView(_device, backBuffer);
                    Log("RenderTargetView created");
                    
                    // Create Direct2D factory
                    _factoryD2D = new FactoryD2D();
                    _factoryDWrite = new FactoryDWrite();
                    Log("Factories created");
                    
                    // Get DXGI surface for Direct2D
                    using (var surface = backBuffer.QueryInterface<Surface>())
                    {
                        Log("Surface obtained");
                        
                        var props = new RenderTargetProperties(
                            RenderTargetType.Default,
                            new SharpDX.Direct2D1.PixelFormat(Format.Unknown, SharpDX.Direct2D1.AlphaMode.Premultiplied),
                            96, 96,
                            RenderTargetUsage.None,
                            FeatureLevel.Level_DEFAULT
                        );
                        
                        _renderTarget2D = new RenderTarget(_factoryD2D, surface, props);
                        Log("RenderTarget2D created");
                    }
                }
                
                // Create brushes
                _textBrush = new SolidColorBrush(_renderTarget2D, new Color4(0.9f, 0.95f, 1f, 1f));
                _bgBrush = new SolidColorBrush(_renderTarget2D, new Color4(0.06f, 0.09f, 0.16f, 0.95f));
                Log("Brushes created");
                
                // Create text format
                _textFormat = new TextFormat(_factoryDWrite, "Segoe UI", 14f);
                Log("TextFormat created");
                
                _initialized = true;
                Log("DirectX initialization COMPLETE!");
            }
            catch (Exception ex)
            {
                Log("Init error: " + ex.ToString());
                _initialized = false;
            }
        }
        
        /// <summary>
        /// Draw the overlay on top of the game
        /// </summary>
        private void DrawOverlay()
        {
            _renderTarget2D.BeginDraw();
            
            try
            {
                // Panel position and size
                float x = 50f, y = 100f;
                float width = 280f, height = 400f;
                float padding = 15f;
                float lineHeight = 24f;
                
                // Draw background
                var bgRect = new SharpDX.Mathematics.Interop.RawRectangleF(x, y, x + width, y + height);
                _renderTarget2D.FillRoundedRectangle(
                    new RoundedRectangle { Rect = bgRect, RadiusX = 10, RadiusY = 10 },
                    _bgBrush
                );
                
                // Draw border
                using (var borderBrush = new SolidColorBrush(_renderTarget2D, new Color4(0.4f, 0.7f, 1f, 0.3f)))
                {
                    _renderTarget2D.DrawRoundedRectangle(
                        new RoundedRectangle { Rect = bgRect, RadiusX = 10, RadiusY = 10 },
                        borderBrush,
                        1f
                    );
                }
                
                float textY = y + padding;
                
                // Title
                using (var titleFormat = new TextFormat(_factoryDWrite, "Segoe UI", FontWeight.Bold, FontStyle.Normal, 16f))
                using (var accentBrush = new SolidColorBrush(_renderTarget2D, new Color4(0.22f, 0.74f, 0.97f, 1f)))
                {
                    DrawText("SIMWIDGET OVERLAY", x + padding, textY, titleFormat, accentBrush);
                    textY += lineHeight + 10;
                    
                    // Connection status
                    string status = _simData.Connected ? "Connected to server" : "No server connection";
                    DrawText(status, x + padding, textY, _textFormat, _simData.Connected ? accentBrush : _textBrush);
                    textY += lineHeight + 10;
                    
                    // Flight Data Section
                    DrawText("FLIGHT DATA", x + padding, textY, _textFormat, accentBrush);
                    textY += lineHeight;
                    
                    // Get sim data
                    var data = _simData.Data;
                    
                    DrawDataRow("Altitude", string.Format("{0:N0} ft", data.Altitude), x + padding, textY, width - padding * 2, null);
                    textY += lineHeight;
                    
                    DrawDataRow("Speed", string.Format("{0:N0} kts", data.Speed), x + padding, textY, width - padding * 2, null);
                    textY += lineHeight;
                    
                    DrawDataRow("Heading", string.Format("{0:000}°", data.Heading), x + padding, textY, width - padding * 2, null);
                    textY += lineHeight;
                    
                    string vsPrefix = data.VerticalSpeed >= 0 ? "+" : "";
                    DrawDataRow("V/S", string.Format("{0}{1:N0} fpm", vsPrefix, data.VerticalSpeed), x + padding, textY, width - padding * 2, null);
                    textY += lineHeight + 10;
                    
                    // Engine Section
                    DrawText("ENGINE", x + padding, textY, _textFormat, accentBrush);
                    textY += lineHeight;
                    
                    var engColor = data.EngineRunning 
                        ? new Color4(0.13f, 0.77f, 0.37f, 1f)
                        : new Color4(0.94f, 0.27f, 0.27f, 1f);
                    using (var engBrush = new SolidColorBrush(_renderTarget2D, engColor))
                    {
                        DrawDataRow("Status", data.EngineRunning ? "RUNNING" : "OFF", x + padding, textY, width - padding * 2, engBrush);
                    }
                    textY += lineHeight;
                    
                    DrawDataRow("Throttle", string.Format("{0:N0}%", data.Throttle), x + padding, textY, width - padding * 2, null);
                    textY += lineHeight + 10;
                    
                    // Frame counter for debug
                    DrawText(string.Format("Frame: {0}", _frameCount), x + padding, textY, _textFormat, accentBrush);
                }
            }
            finally
            {
                _renderTarget2D.EndDraw();
            }
        }
        
        private void DrawText(string text, float x, float y, TextFormat format, Brush brush)
        {
            _renderTarget2D.DrawText(
                text,
                format,
                new SharpDX.Mathematics.Interop.RawRectangleF(x, y, x + 500, y + 30),
                brush
            );
        }
        
        private void DrawDataRow(string label, string value, float x, float y, float width, Brush valueBrush)
        {
            using (var labelBrush = new SolidColorBrush(_renderTarget2D, new Color4(0.4f, 0.45f, 0.53f, 1f)))
            using (var smallFormat = new TextFormat(_factoryDWrite, "Segoe UI", 11f))
            {
                DrawText(label.ToUpper(), x, y, smallFormat, labelBrush);
            }
            
            using (var valueFormat = new TextFormat(_factoryDWrite, "Segoe UI", FontWeight.SemiBold, FontStyle.Normal, 14f))
            {
                valueFormat.TextAlignment = TextAlignment.Trailing;
                
                _renderTarget2D.DrawText(
                    value,
                    valueFormat,
                    new SharpDX.Mathematics.Interop.RawRectangleF(x, y, x + width, y + 25),
                    valueBrush ?? _textBrush
                );
            }
        }
        
        /// <summary>
        /// Get Present function address from DXGI
        /// </summary>
        private IntPtr GetPresentAddress()
        {
            try
            {
                Log("Creating temporary factory...");
                
                using (var tempFactory = new SharpDX.DXGI.Factory1())
                {
                    Log("Factory created, getting adapter...");
                    
                    using (var tempAdapter = tempFactory.GetAdapter(0))
                    {
                        Log("Adapter: " + tempAdapter.Description.Description);
                        
                        var desc = new SwapChainDescription
                        {
                            BufferCount = 1,
                            ModeDescription = new ModeDescription(100, 100, new Rational(60, 1), Format.R8G8B8A8_UNorm),
                            IsWindowed = true,
                            OutputHandle = GetDesktopWindow(),
                            SampleDescription = new SampleDescription(1, 0),
                            SwapEffect = SwapEffect.Discard,
                            Usage = Usage.RenderTargetOutput
                        };
                        
                        Log("Creating temp device and swapchain...");
                        
                        Device tempDevice;
                        SwapChain tempSwapChain;
                        
                        Device.CreateWithSwapChain(
                            tempAdapter,
                            DeviceCreationFlags.None,
                            desc,
                            out tempDevice,
                            out tempSwapChain
                        );
                        
                        Log("Temp swapchain created");
                        
                        // Get vtable pointer
                        IntPtr swapChainVTable = Marshal.ReadIntPtr(tempSwapChain.NativePointer);
                        Log(string.Format("VTable at: 0x{0:X}", swapChainVTable.ToInt64()));
                        
                        // Present is at index 8 in the vtable
                        IntPtr presentAddr = Marshal.ReadIntPtr(swapChainVTable, 8 * IntPtr.Size);
                        Log(string.Format("Present at: 0x{0:X}", presentAddr.ToInt64()));
                        
                        // Store original for calling later
                        _originalPresent = Marshal.GetDelegateForFunctionPointer<DXGISwapChain_PresentDelegate>(presentAddr);
                        
                        tempSwapChain.Dispose();
                        tempDevice.Dispose();
                        
                        return presentAddr;
                    }
                }
            }
            catch (Exception ex)
            {
                Log("GetPresentAddress error: " + ex.ToString());
                return IntPtr.Zero;
            }
        }
        
        [DllImport("user32.dll")]
        private static extern IntPtr GetDesktopWindow();
        
        private void Cleanup()
        {
            if (_textFormat != null) _textFormat.Dispose();
            if (_textBrush != null) _textBrush.Dispose();
            if (_bgBrush != null) _bgBrush.Dispose();
            if (_renderTarget2D != null) _renderTarget2D.Dispose();
            if (_factoryDWrite != null) _factoryDWrite.Dispose();
            if (_factoryD2D != null) _factoryD2D.Dispose();
            if (_renderTargetView != null) _renderTargetView.Dispose();
        }
        
        private static void Log(string message)
        {
            string line = string.Format("[{0}] {1}\n", DateTime.Now.ToString("HH:mm:ss.fff"), message);
            Console.WriteLine("[SimWidget] " + message);
            System.Diagnostics.Debug.WriteLine("[SimWidget] " + message);
            
            try
            {
                if (_logFile != null)
                {
                    File.AppendAllText(_logFile, line);
                }
            }
            catch { }
        }
    }
}
