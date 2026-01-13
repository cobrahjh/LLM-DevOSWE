using System;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace SimWidgetDX12
{
    public class SimData
    {
        public double Altitude { get; set; }
        public double Speed { get; set; }
        public double Heading { get; set; }
        public double VerticalSpeed { get; set; }
        public double Throttle { get; set; }
        public bool EngineRunning { get; set; }
        public double FuelQuantity { get; set; }
        public double FuelCapacity { get; set; }
        
        public double FuelPercent 
        { 
            get { return FuelCapacity > 0 ? (FuelQuantity / FuelCapacity) * 100 : 0; }
        }
        
        public SimData()
        {
            FuelCapacity = 100;
        }
    }
    
    public class SimDataClient
    {
        private ClientWebSocket _ws;
        private CancellationTokenSource _cts;
        private readonly object _lock = new object();
        private bool _connected = false;
        private string _serverUrl;
        
        public SimData Data { get; private set; }
        public bool Connected { get { return _connected; } }
        
        public SimDataClient()
        {
            Data = new SimData();
        }
        
        public void Connect(string url)
        {
            _serverUrl = url;
            Task.Run(() => ConnectAsync());
        }
        
        private async Task ConnectAsync()
        {
            while (true)
            {
                try
                {
                    _ws = new ClientWebSocket();
                    _cts = new CancellationTokenSource();
                    
                    await _ws.ConnectAsync(new Uri(_serverUrl), _cts.Token);
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
                    var segment = new ArraySegment<byte>(buffer);
                    var result = await _ws.ReceiveAsync(segment, _cts.Token);
                    
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
                var type = msg["type"] != null ? msg["type"].ToString() : "";
                
                if (type == "simvars" && msg["data"] is JObject)
                {
                    var data = (JObject)msg["data"];
                    
                    lock (_lock)
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
            }
            catch { }
        }
        
        private double GetValue(JObject data, string key, double defaultVal = 0)
        {
            if (data[key] == null) return defaultVal;
            var val = data[key]["value"];
            if (val == null) return defaultVal;
            return val.Value<double>();
        }
        
        private bool GetBool(JObject data, string key)
        {
            if (data[key] == null) return false;
            var val = data[key]["value"];
            if (val == null) return false;
            if (val.Type == JTokenType.Boolean) return val.Value<bool>();
            return val.Value<double>() != 0;
        }
        
        public void Update() { }
        
        public void Disconnect()
        {
            if (_cts != null) _cts.Cancel();
            if (_ws != null) _ws.Dispose();
        }
    }
    
    public class OverlayRenderer
    {
        public bool Visible { get; set; } = true;
        public float X { get; set; } = 50;
        public float Y { get; set; } = 100;
    }
}
