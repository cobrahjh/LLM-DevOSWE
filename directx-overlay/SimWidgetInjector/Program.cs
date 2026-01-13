using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.Remoting;
using EasyHook;

namespace SimWidgetInjector
{
    class Program
    {
        static void Main(string[] args)
        {
            Console.WriteLine();
            Console.WriteLine("╔══════════════════════════════════════════════════════════╗");
            Console.WriteLine("║       SimWidget DirectX Overlay Injector v1.0            ║");
            Console.WriteLine("╚══════════════════════════════════════════════════════════╝");
            Console.WriteLine();
            
            // Find MSFS process
            Process msfsProcess = FindMSFSProcess();
            
            if (msfsProcess == null)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("[ERROR] Microsoft Flight Simulator is not running!");
                Console.ResetColor();
                Console.WriteLine();
                Console.WriteLine("Please start MSFS first, then run this injector.");
                Console.WriteLine();
                Console.WriteLine("Press any key to exit...");
                Console.ReadKey();
                return;
            }
            
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine(string.Format("[OK] Found MSFS process: {0} (PID: {1})", msfsProcess.ProcessName, msfsProcess.Id));
            Console.ResetColor();
            
            // Get the hook DLL path
            string hookDllPath = Path.Combine(
                AppDomain.CurrentDomain.BaseDirectory,
                "SimWidgetOverlay.dll"
            );
            
            if (!File.Exists(hookDllPath))
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("[ERROR] Hook DLL not found: " + hookDllPath);
                Console.ResetColor();
                Console.WriteLine();
                Console.WriteLine("Press any key to exit...");
                Console.ReadKey();
                return;
            }
            
            Console.WriteLine("[INFO] Hook DLL: " + hookDllPath);
            Console.WriteLine();
            
            try
            {
                Console.WriteLine("[INFO] Creating IPC channel...");
                
                // Create IPC channel for communication
                string channelName = null;
                RemoteHooking.IpcCreateServer<InjectorInterface>(ref channelName, WellKnownObjectMode.Singleton);
                
                Console.WriteLine("[INFO] IPC Channel: " + channelName);
                Console.WriteLine("[INFO] Injecting into MSFS...");
                
                // Inject the hook DLL
                RemoteHooking.Inject(
                    msfsProcess.Id,
                    InjectionOptions.DoNotRequireStrongName,
                    hookDllPath,  // 32-bit (not used)
                    hookDllPath,  // 64-bit
                    channelName   // Parameter passed to hook
                );
                
                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine();
                Console.WriteLine("╔══════════════════════════════════════════════════════════╗");
                Console.WriteLine("║           Overlay Injected Successfully!                 ║");
                Console.WriteLine("╚══════════════════════════════════════════════════════════╝");
                Console.ResetColor();
                Console.WriteLine();
                Console.WriteLine("The SimWidget overlay should now be visible in MSFS.");
                Console.WriteLine("Press F10 to toggle visibility.");
                Console.WriteLine();
                Console.WriteLine("Keep this window open to maintain the overlay.");
                Console.WriteLine("Press any key to detach and exit...");
                Console.ReadKey();
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("[ERROR] Injection failed: " + ex.Message);
                Console.ResetColor();
                Console.WriteLine();
                Console.WriteLine("Possible causes:");
                Console.WriteLine("  - Anti-virus blocking injection");
                Console.WriteLine("  - MSFS running as admin (run this as admin too)");
                Console.WriteLine("  - Game anti-cheat interference");
                Console.WriteLine();
                Console.WriteLine("Full error:");
                Console.WriteLine(ex.ToString());
                Console.WriteLine();
                Console.WriteLine("Press any key to exit...");
                Console.ReadKey();
            }
        }
        
        static Process FindMSFSProcess()
        {
            // Try different process names for MSFS
            string[] processNames = new string[]
            {
                "FlightSimulator",      // Steam/MS Store
                "Microsoft.FlightSimulator",
                "FlightSimulator2020",
                "msfs",
                "FS2020"
            };
            
            foreach (var name in processNames)
            {
                var processes = Process.GetProcessesByName(name);
                if (processes.Length > 0)
                {
                    return processes[0];
                }
            }
            
            // Also try to find by window title
            foreach (var process in Process.GetProcesses())
            {
                try
                {
                    if (process.MainWindowTitle.Contains("Microsoft Flight Simulator"))
                    {
                        return process;
                    }
                }
                catch { }
            }
            
            return null;
        }
    }
    
    /// <summary>
    /// Interface for IPC communication between injector and hook
    /// </summary>
    public class InjectorInterface : MarshalByRefObject
    {
        public void Log(string message)
        {
            Console.WriteLine("[Hook] " + message);
        }
        
        public void OnError(string error)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine("[Hook Error] " + error);
            Console.ResetColor();
        }
    }
}
