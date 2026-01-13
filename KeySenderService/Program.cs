using System;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Runtime.InteropServices;
using System.Diagnostics;
using System.Threading;
using System.Collections.Generic;

namespace KeySenderService
{
    /// <summary>
    /// SimWidget Key Sender Service v1.0.0
    /// 
    /// A lightweight TCP service that sends keyboard input to MSFS.
    /// Much faster than PowerShell (~5ms vs ~700ms per key).
    /// 
    /// Usage: KeySenderService.exe [port]
    /// Default port: 9999
    /// 
    /// Protocol: Send key name, receive "OK" or "ERROR: message"
    /// Example: "F10" -> "OK"
    ///          "SHIFT+X" -> "OK"
    /// </summary>
    class Program
    {
        const string VERSION = "1.0.0";
        static IntPtr msfsWindow = IntPtr.Zero;
        static DateTime lastWindowCheck = DateTime.MinValue;

        static void Main(string[] args)
        {
            int port = 9999;
            if (args.Length > 0) int.TryParse(args[0], out port);

            Console.WriteLine($"╔════════════════════════════════════════════╗");
            Console.WriteLine($"║  SimWidget Key Sender Service v{VERSION}    ║");
            Console.WriteLine($"╠════════════════════════════════════════════╣");
            Console.WriteLine($"║  Port: {port,-36}║");
            Console.WriteLine($"╚════════════════════════════════════════════╝");

            TcpListener server = new TcpListener(IPAddress.Any, port);
            server.Start();
            Console.WriteLine($"[KeySender] Listening on port {port}...");

            while (true)
            {
                TcpClient client = server.AcceptTcpClient();
                ThreadPool.QueueUserWorkItem(HandleClient, client);
            }
        }

        static void HandleClient(object obj)
        {
            TcpClient client = (TcpClient)obj;
            NetworkStream stream = client.GetStream();
            StringBuilder buffer = new StringBuilder();
            byte[] readBuffer = new byte[256];

            try
            {
                while (client.Connected)
                {
                    int bytesRead = stream.Read(readBuffer, 0, readBuffer.Length);
                    if (bytesRead == 0) break;

                    buffer.Append(Encoding.ASCII.GetString(readBuffer, 0, bytesRead));
                    
                    // Process complete messages (newline-delimited)
                    string data = buffer.ToString();
                    int newlineIndex;
                    while ((newlineIndex = data.IndexOf('\n')) >= 0)
                    {
                        string key = data.Substring(0, newlineIndex).Trim();
                        data = data.Substring(newlineIndex + 1);
                        buffer.Clear();
                        buffer.Append(data);

                        if (string.IsNullOrEmpty(key)) continue;

                        var sw = Stopwatch.StartNew();
                        string result = ProcessKey(key);
                        sw.Stop();

                        Console.WriteLine($"[KeySender] {key} -> {result} ({sw.ElapsedMilliseconds}ms)");

                        byte[] response = Encoding.ASCII.GetBytes(result + "\n");
                        stream.Write(response, 0, response.Length);
                    }
                    
                    // Also handle messages without newline (for simple clients)
                    if (buffer.Length > 0 && !buffer.ToString().Contains("\n"))
                    {
                        string key = buffer.ToString().Trim();
                        if (!string.IsNullOrEmpty(key))
                        {
                            var sw = Stopwatch.StartNew();
                            string result = ProcessKey(key);
                            sw.Stop();

                            Console.WriteLine($"[KeySender] {key} -> {result} ({sw.ElapsedMilliseconds}ms)");

                            byte[] response = Encoding.ASCII.GetBytes(result + "\n");
                            stream.Write(response, 0, response.Length);
                            buffer.Clear();
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[KeySender] Client error: {ex.Message}");
            }
            finally
            {
                client.Close();
            }
        }

        static string ProcessKey(string key)
        {
            try
            {
                // Special commands
                if (key == "PING") return "PONG";
                if (key == "VERSION") return VERSION;
                if (key == "FOCUS") return FocusMSFS() ? "OK" : "ERROR: Could not focus MSFS";
                if (key == "STATUS") return GetStatus();

                // Focus MSFS first (cache window handle for 5 seconds)
                if ((DateTime.Now - lastWindowCheck).TotalSeconds > 5)
                {
                    msfsWindow = FindMSFSWindow();
                    lastWindowCheck = DateTime.Now;
                }

                if (msfsWindow == IntPtr.Zero)
                {
                    Console.WriteLine("[KeySender] ERROR: MSFS window not found");
                    return "ERROR: MSFS not found";
                }

                // Check if MSFS is the foreground window
                IntPtr foreground = GetForegroundWindow();
                Console.WriteLine($"[KeySender] Current foreground: {foreground}, MSFS: {msfsWindow}");
                
                // Focus window
                bool focused = SetForegroundWindow(msfsWindow);
                Console.WriteLine($"[KeySender] SetForegroundWindow result: {focused}");
                
                Thread.Sleep(50); // Give more time for focus

                // Verify focus
                foreground = GetForegroundWindow();
                Console.WriteLine($"[KeySender] After focus - foreground: {foreground}, match: {foreground == msfsWindow}");

                // Send the key
                Console.WriteLine($"[KeySender] Sending key: {key}");
                SendKey(key);
                Console.WriteLine($"[KeySender] Key sent: {key}");
                
                return "OK";
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[KeySender] ERROR: {ex.Message}");
                return $"ERROR: {ex.Message}";
            }
        }

        static string GetStatus()
        {
            msfsWindow = FindMSFSWindow();
            IntPtr foreground = GetForegroundWindow();
            return $"MSFS={msfsWindow}, Foreground={foreground}, Match={msfsWindow == foreground}";
        }

        static IntPtr FindMSFSWindow()
        {
            IntPtr hwnd = IntPtr.Zero;
            foreach (Process p in Process.GetProcesses())
            {
                if (p.ProcessName.Contains("FlightSimulator") && p.MainWindowHandle != IntPtr.Zero)
                {
                    hwnd = p.MainWindowHandle;
                    Console.WriteLine($"[KeySender] Found MSFS: {p.ProcessName} (PID: {p.Id})");
                    break;
                }
            }
            return hwnd;
        }

        static bool FocusMSFS()
        {
            msfsWindow = FindMSFSWindow();
            if (msfsWindow == IntPtr.Zero) return false;
            return SetForegroundWindow(msfsWindow);
        }

        static void SendKey(string keySpec)
        {
            string[] parts = keySpec.ToUpper().Split('+');
            List<ushort> modifiers = new List<ushort>();
            ushort mainKey = 0;

            foreach (string part in parts)
            {
                ushort vk = GetVirtualKey(part.Trim());
                if (vk == 0) throw new Exception($"Unknown key: {part}");

                if (part == "CTRL" || part == "SHIFT" || part == "ALT")
                    modifiers.Add(vk);
                else
                    mainKey = vk;
            }

            // Press modifiers
            foreach (ushort mod in modifiers)
                KeyDown(mod);

            // Press and release main key
            if (mainKey != 0)
            {
                KeyDown(mainKey);
                Thread.Sleep(30);
                KeyUp(mainKey);
            }

            // Release modifiers (reverse order)
            modifiers.Reverse();
            foreach (ushort mod in modifiers)
                KeyUp(mod);
        }

        static ushort GetVirtualKey(string key)
        {
            return key switch
            {
                // Modifiers
                "CTRL" => 0x11,
                "SHIFT" => 0x10,
                "ALT" => 0x12,

                // Function keys
                "F1" => 0x70, "F2" => 0x71, "F3" => 0x72, "F4" => 0x73,
                "F5" => 0x74, "F6" => 0x75, "F7" => 0x76, "F8" => 0x77,
                "F9" => 0x78, "F10" => 0x79, "F11" => 0x7A, "F12" => 0x7B,

                // Navigation
                "BACKSPACE" => 0x08,
                "TAB" => 0x09,
                "ENTER" => 0x0D,
                "SPACE" => 0x20,
                "END" => 0x23,
                "HOME" => 0x24,
                "INSERT" => 0x2D,
                "DELETE" => 0x2E,
                "PAGEUP" => 0x21,
                "PAGEDOWN" => 0x22,

                // Arrow keys
                "LEFT" => 0x25,
                "UP" => 0x26,
                "RIGHT" => 0x27,
                "DOWN" => 0x28,

                // Numpad
                "NUMPAD0" => 0x60, "NUMPAD1" => 0x61, "NUMPAD2" => 0x62,
                "NUMPAD3" => 0x63, "NUMPAD4" => 0x64, "NUMPAD5" => 0x65,
                "NUMPAD6" => 0x66, "NUMPAD7" => 0x67, "NUMPAD8" => 0x68,
                "NUMPAD9" => 0x69,

                // Symbols
                "=" => 0xBB,
                "-" => 0xBD,
                "/" => 0xBF,
                "SLASH" => 0xBF,

                // Letters
                "A" => 0x41, "B" => 0x42, "C" => 0x43, "D" => 0x44,
                "E" => 0x45, "F" => 0x46, "G" => 0x47, "H" => 0x48,
                "I" => 0x49, "J" => 0x4A, "K" => 0x4B, "L" => 0x4C,
                "M" => 0x4D, "N" => 0x4E, "O" => 0x4F, "P" => 0x50,
                "Q" => 0x51, "R" => 0x52, "S" => 0x53, "T" => 0x54,
                "U" => 0x55, "V" => 0x56, "W" => 0x57, "X" => 0x58,
                "Y" => 0x59, "Z" => 0x5A,

                // Numbers
                "0" => 0x30, "1" => 0x31, "2" => 0x32, "3" => 0x33,
                "4" => 0x34, "5" => 0x35, "6" => 0x36, "7" => 0x37,
                "8" => 0x38, "9" => 0x39,

                _ => 0
            };
        }

        static void KeyDown(ushort vk)
        {
            keybd_event((byte)vk, 0, 0, UIntPtr.Zero);
        }

        static void KeyUp(ushort vk)
        {
            keybd_event((byte)vk, 0, 2, UIntPtr.Zero); // KEYEVENTF_KEYUP = 2
        }

        // P/Invoke
        [DllImport("user32.dll")]
        static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll")]
        static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

        [DllImport("user32.dll")]
        static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

        [StructLayout(LayoutKind.Sequential)]
        struct INPUT
        {
            public int type;
            public KEYBDINPUT ki;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct KEYBDINPUT
        {
            public ushort wVk;
            public ushort wScan;
            public uint dwFlags;
            public uint time;
            public IntPtr dwExtraInfo;
            public uint padding1;
            public uint padding2;
        }
    }
}
