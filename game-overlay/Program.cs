using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using System.Net.WebSockets;
using System.Text;
using Newtonsoft.Json.Linq;

namespace SimWidgetGameOverlay
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            Console.WriteLine();
            Console.WriteLine("╔══════════════════════════════════════════════════════════╗");
            Console.WriteLine("║     SimWidget Overlay (Works with MSFS 2020 & 2024!)     ║");
            Console.WriteLine("╚══════════════════════════════════════════════════════════╝");
            Console.WriteLine();
            Console.WriteLine("NOTE: MSFS must be in BORDERLESS or WINDOWED mode.");
            Console.WriteLine("      Exclusive fullscreen will hide the overlay.");
            Console.WriteLine();
            Console.WriteLine("Starting overlay...");
            
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new OverlayForm());
        }
    }
    
    public class OverlayForm : Form
    {
        // Win32 constants for click-through window
        private const int WS_EX_LAYERED = 0x80000;
        private const int WS_EX_TRANSPARENT = 0x20;
        private const int WS_EX_TOPMOST = 0x8;
        private const int WS_EX_TOOLWINDOW = 0x80;
        private const int GWL_EXSTYLE = -20;
        
        [DllImport("user32.dll")]
        private static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
        
        [DllImport("user32.dll")]
        private static extern int GetWindowLong(IntPtr hWnd, int nIndex);
        
        [DllImport("user32.dll")]
        private static extern bool SetLayeredWindowAttributes(IntPtr hwnd, uint crKey, byte bAlpha, uint dwFlags);
        
        [DllImport("user32.dll")]
        private static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
        
        [DllImport("user32.dll")]
        private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
        
        [StructLayout(LayoutKind.Sequential)]
        public struct RECT
        {
            public int Left, Top, Right, Bottom;
        }
        
        private SimDataClient _simData;
        private System.Windows.Forms.Timer _renderTimer;
        private System.Windows.Forms.Timer _positionTimer;
        private IntPtr _msfsWindow = IntPtr.Zero;
        private bool _clickThrough = true;
        
        // Panel position (relative to window)
        private int _panelX = 50;
        private int _panelY = 100;
        private int _panelWidth = 300;
        private int _panelHeight = 450;
        
        public OverlayForm()
        {
            // Form setup for overlay
            this.FormBorderStyle = FormBorderStyle.None;
            this.StartPosition = FormStartPosition.Manual;
            this.TopMost = true;
            this.ShowInTaskbar = false;
            this.BackColor = Color.Magenta;  // Transparency key
            this.TransparencyKey = Color.Magenta;
            this.DoubleBuffered = true;
            this.Text = "SimWidget Overlay";
            
            // Start fullscreen
            this.Bounds = Screen.PrimaryScreen.Bounds;
            
            // Initialize sim data client
            _simData = new SimDataClient();
            _simData.Connect("ws://localhost:8484");
            
            // Find MSFS window
            FindMSFS();
            
            // Render timer (60fps)
            _renderTimer = new System.Windows.Forms.Timer();
            _renderTimer.Interval = 16;
            _renderTimer.Tick += (s, e) => this.Invalidate();
            _renderTimer.Start();
            
            // Position tracking timer
            _positionTimer = new System.Windows.Forms.Timer();
            _positionTimer.Interval = 500;
            _positionTimer.Tick += (s, e) => UpdatePosition();
            _positionTimer.Start();
        }
        
        protected override void OnLoad(EventArgs e)
        {
            base.OnLoad(e);
            
            // Make window click-through
            if (_clickThrough)
            {
                int exStyle = GetWindowLong(this.Handle, GWL_EXSTYLE);
                SetWindowLong(this.Handle, GWL_EXSTYLE, exStyle | WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_TOOLWINDOW);
            }
        }
        
        protected override CreateParams CreateParams
        {
            get
            {
                CreateParams cp = base.CreateParams;
                cp.ExStyle |= WS_EX_LAYERED | WS_EX_TOPMOST | WS_EX_TOOLWINDOW;
                if (_clickThrough)
                    cp.ExStyle |= WS_EX_TRANSPARENT;
                return cp;
            }
        }
        
        private void FindMSFS()
        {
            foreach (var process in Process.GetProcesses())
            {
                try
                {
                    if (process.MainWindowTitle.Contains("Microsoft Flight Simulator"))
                    {
                        _msfsWindow = process.MainWindowHandle;
                        Console.WriteLine("[OK] Found MSFS window!");
                        return;
                    }
                }
                catch { }
            }
            Console.WriteLine("[WARN] MSFS not found - overlay will show on primary screen");
        }
        
        private void UpdatePosition()
        {
            // Try to find MSFS if not found yet
            if (_msfsWindow == IntPtr.Zero)
            {
                FindMSFS();
            }
            
            // If found, track its position
            if (_msfsWindow != IntPtr.Zero)
            {
                if (GetWindowRect(_msfsWindow, out RECT rect))
                {
                    int width = rect.Right - rect.Left;
                    int height = rect.Bottom - rect.Top;
                    
                    if (width > 0 && height > 0)
                    {
                        this.Location = new Point(rect.Left, rect.Top);
                        this.Size = new Size(width, height);
                    }
                }
            }
        }
        
        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;
            
            // Panel coordinates
            int x = _panelX;
            int y = _panelY;
            int w = _panelWidth;
            int h = _panelHeight;
            int padding = 15;
            int lineHeight = 26;
            
            // Draw panel background
            using (var path = CreateRoundedRectangle(x, y, w, h, 12))
            {
                using (var bgBrush = new SolidBrush(Color.FromArgb(245, 15, 23, 42)))
                {
                    g.FillPath(bgBrush, path);
                }
                using (var borderPen = new Pen(Color.FromArgb(80, 56, 189, 248), 1))
                {
                    g.DrawPath(borderPen, path);
                }
            }
            
            int textY = y + padding;
            
            // Fonts
            using (var titleFont = new Font("Segoe UI", 14, FontStyle.Bold))
            using (var normalFont = new Font("Segoe UI", 12, FontStyle.Bold))
            using (var smallFont = new Font("Segoe UI", 10))
            using (var accentBrush = new SolidBrush(Color.FromArgb(56, 189, 248)))
            using (var textBrush = new SolidBrush(Color.FromArgb(230, 240, 255)))
            using (var labelBrush = new SolidBrush(Color.FromArgb(100, 116, 139)))
            using (var greenBrush = new SolidBrush(Color.FromArgb(34, 197, 94)))
            using (var redBrush = new SolidBrush(Color.FromArgb(239, 68, 68)))
            using (var orangeBrush = new SolidBrush(Color.FromArgb(245, 158, 11)))
            {
                // Title
                g.DrawString("SIMWIDGET OVERLAY", titleFont, accentBrush, x + padding, textY);
                textY += lineHeight + 2;
                
                // Connection status
                string status = _simData.Connected ? "● Connected to server" : "○ Connecting...";
                var statusBrush = _simData.Connected ? greenBrush : orangeBrush;
                g.DrawString(status, smallFont, statusBrush, x + padding, textY);
                textY += lineHeight + 8;
                
                // Get data
                var data = _simData.Data;
                
                // Flight Data
                g.DrawString("FLIGHT DATA", normalFont, accentBrush, x + padding, textY);
                textY += lineHeight;
                
                DrawDataRow(g, "ALTITUDE", string.Format("{0:N0} ft", data.Altitude), x + padding, textY, w - padding * 2, smallFont, normalFont, labelBrush, textBrush);
                textY += lineHeight;
                
                DrawDataRow(g, "SPEED", string.Format("{0:N0} kts", data.Speed), x + padding, textY, w - padding * 2, smallFont, normalFont, labelBrush, textBrush);
                textY += lineHeight;
                
                DrawDataRow(g, "HEADING", string.Format("{0:000}°", data.Heading), x + padding, textY, w - padding * 2, smallFont, normalFont, labelBrush, textBrush);
                textY += lineHeight;
                
                string vsPrefix = data.VerticalSpeed >= 0 ? "+" : "";
                DrawDataRow(g, "V/S", string.Format("{0}{1:N0} fpm", vsPrefix, data.VerticalSpeed), x + padding, textY, w - padding * 2, smallFont, normalFont, labelBrush, textBrush);
                textY += lineHeight + 10;
                
                // Engine
                g.DrawString("ENGINE", normalFont, accentBrush, x + padding, textY);
                textY += lineHeight;
                
                var engBrush = data.EngineRunning ? greenBrush : redBrush;
                DrawDataRow(g, "STATUS", data.EngineRunning ? "RUNNING" : "OFF", x + padding, textY, w - padding * 2, smallFont, normalFont, labelBrush, engBrush);
                textY += lineHeight;
                
                DrawDataRow(g, "THROTTLE", string.Format("{0:N0}%", data.Throttle), x + padding, textY, w - padding * 2, smallFont, normalFont, labelBrush, textBrush);
                textY += lineHeight + 10;
                
                // Fuel
                g.DrawString("FUEL", normalFont, accentBrush, x + padding, textY);
                textY += lineHeight;
                
                DrawDataRow(g, "QUANTITY", string.Format("{0:N0} gal", data.FuelQuantity), x + padding, textY, w - padding * 2, smallFont, normalFont, labelBrush, textBrush);
                textY += lineHeight;
                
                // Fuel bar
                int barWidth = w - padding * 2;
                int barHeight = 10;
                float fillPercent = (float)data.FuelPercent / 100f;
                
                using (var barBg = new SolidBrush(Color.FromArgb(128, 0, 0, 0)))
                using (var barPath = CreateRoundedRectangle(x + padding, textY, barWidth, barHeight, 4))
                {
                    g.FillPath(barBg, barPath);
                }
                
                var fuelColor = data.FuelPercent > 30 ? greenBrush : (data.FuelPercent > 15 ? orangeBrush : redBrush);
                int fillWidth = (int)(barWidth * fillPercent);
                if (fillWidth > 4)
                {
                    using (var fillPath = CreateRoundedRectangle(x + padding, textY, fillWidth, barHeight, 4))
                    {
                        g.FillPath(fuelColor, fillPath);
                    }
                }
                
                textY += barHeight + 5;
                g.DrawString(string.Format("{0:N0}%", data.FuelPercent), smallFont, labelBrush, x + padding, textY);
            }
        }
        
        private void DrawDataRow(Graphics g, string label, string value, int x, int y, int width, Font labelFont, Font valueFont, Brush labelBrush, Brush valueBrush)
        {
            g.DrawString(label, labelFont, labelBrush, x, y);
            
            var valueSize = g.MeasureString(value, valueFont);
            g.DrawString(value, valueFont, valueBrush, x + width - valueSize.Width, y);
        }
        
        private GraphicsPath CreateRoundedRectangle(int x, int y, int width, int height, int radius)
        {
            var path = new GraphicsPath();
            path.AddArc(x, y, radius * 2, radius * 2, 180, 90);
            path.AddArc(x + width - radius * 2, y, radius * 2, radius * 2, 270, 90);
            path.AddArc(x + width - radius * 2, y + height - radius * 2, radius * 2, radius * 2, 0, 90);
            path.AddArc(x, y + height - radius * 2, radius * 2, radius * 2, 90, 90);
            path.CloseFigure();
            return path;
        }
        
        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            _renderTimer?.Stop();
            _positionTimer?.Stop();
            _simData?.Disconnect();
            base.OnFormClosing(e);
        }
    }
    
    // SimData classes
    public class SimData
    {
        public double Altitude { get; set; }
        public double Speed { get; set; }
        public double Heading { get; set; }
        public double VerticalSpeed { get; set; }
        public double Throttle { get; set; }
        public bool EngineRunning { get; set; }
        public double FuelQuantity { get; set; }
        public double FuelCapacity { get; set; } = 100;
        public double FuelPercent { get { return FuelCapacity > 0 ? (FuelQuantity / FuelCapacity) * 100 : 0; } }
    }
    
    public class SimDataClient
    {
        private ClientWebSocket _ws;
        private CancellationTokenSource _cts;
        private bool _connected = false;
        
        public SimData Data { get; private set; } = new SimData();
        public bool Connected { get { return _connected; } }
        
        public void Connect(string url)
        {
            Task.Run(() => ConnectAsync(url));
        }
        
        private async Task ConnectAsync(string url)
        {
            while (true)
            {
                try
                {
                    _ws = new ClientWebSocket();
                    _cts = new CancellationTokenSource();
                    
                    await _ws.ConnectAsync(new Uri(url), _cts.Token);
                    _connected = true;
                    Console.WriteLine("[SimData] Connected!");
                    
                    await ReceiveLoop();
                }
                catch
                {
                    _connected = false;
                }
                
                await Task.Delay(3000);
            }
        }
        
        private async Task ReceiveLoop()
        {
            var buffer = new byte[4096];
            
            while (_ws != null && _ws.State == WebSocketState.Open)
            {
                try
                {
                    var result = await _ws.ReceiveAsync(new ArraySegment<byte>(buffer), _cts.Token);
                    
                    if (result.MessageType == WebSocketMessageType.Text)
                    {
                        var json = Encoding.UTF8.GetString(buffer, 0, result.Count);
                        ProcessMessage(json);
                    }
                }
                catch { break; }
            }
            _connected = false;
        }
        
        private void ProcessMessage(string json)
        {
            try
            {
                var msg = JObject.Parse(json);
                if (msg["type"]?.ToString() == "simvars" && msg["data"] is JObject data)
                {
                    Data.Altitude = GetValue(data, "A:INDICATED ALTITUDE");
                    Data.Speed = GetValue(data, "A:AIRSPEED INDICATED");
                    Data.Heading = GetValue(data, "A:HEADING INDICATOR");
                    Data.VerticalSpeed = GetValue(data, "A:VERTICAL SPEED");
                    Data.Throttle = GetValue(data, "A:GENERAL ENG THROTTLE LEVER POSITION:1");
                    Data.EngineRunning = GetBool(data, "A:GENERAL ENG COMBUSTION:1");
                    Data.FuelQuantity = GetValue(data, "A:FUEL TOTAL QUANTITY");
                    Data.FuelCapacity = GetValue(data, "A:FUEL TOTAL CAPACITY", 100);
                }
            }
            catch { }
        }
        
        private double GetValue(JObject data, string key, double def = 0)
        {
            return data[key]?["value"]?.Value<double>() ?? def;
        }
        
        private bool GetBool(JObject data, string key)
        {
            var val = data[key]?["value"];
            if (val == null) return false;
            if (val.Type == JTokenType.Boolean) return val.Value<bool>();
            return val.Value<double>() != 0;
        }
        
        public void Disconnect()
        {
            _cts?.Cancel();
            _ws?.Dispose();
        }
    }
}
