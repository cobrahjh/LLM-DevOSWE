using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.Remoting;
using EasyHook;

namespace SimWidgetDX12Injector
{
    class Program
    {
        static void Main(string[] args)
        {
            Console.WriteLine();
            Console.WriteLine("╔══════════════════════════════════════════════════════════╗");
            Console.WriteLine("║   SimWidget DirectX 12 Overlay Injector (MSFS 2024)      ║");
            Console.WriteLine("╚══════════════════════════════════════════════════════════╝");
            Console.WriteLine();
            
            // Find MSFS 2024 process
            Process msfsProcess = FindMSFSProcess();
            
            if (msfsProcess == null)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("[ERROR] Microsoft Flight Simulator 2024 is not running!");
                Console.ResetColor();
                Console.WriteLine();
                Console.WriteLine("Please start MSFS 2024 first, then run this injector.");
                Console.WriteLine();
                Console.WriteLine("Press any key to exit...");
                Console.ReadKey();
                return;
            }
            
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine(string.Format("[OK] Found MSFS: {0} (PID: {1})", msfsProcess.ProcessName, msfsProcess.Id));
            Console.ResetColor();
            
            // Get hook DLL path
            string hookDllPath = Path.Combine(
                AppDomain.CurrentDomain.BaseDirectory,
                "SimWidgetDX12.dll"
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
                
                string channelName = null;
                RemoteHooking.IpcCreateServer<InjectorInterface>(ref channelName, WellKnownObjectMode.Singleton);
                
                Console.WriteLine("[INFO] IPC Channel: " + channelName);
                Console.WriteLine("[INFO] Injecting DX12 hook into MSFS 2024...");
                
                RemoteHooking.Inject(
                    msfsProcess.Id,
                    InjectionOptions.DoNotRequireStrongName,
                    hookDllPath,
                    hookDllPath,
                    channelName
                );
                
                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine();
                Console.WriteLine("╔══════════════════════════════════════════════════════════╗");
                Console.WriteLine("║         DX12 Overlay Injected Successfully!              ║");
                Console.WriteLine("╚══════════════════════════════════════════════════════════╝");
                Console.ResetColor();
                Console.WriteLine();
                Console.WriteLine("The SimWidget overlay should now be visible in MSFS 2024.");
                Console.WriteLine();
                Console.WriteLine("Log file: " + Path.Combine(Path.GetTempPath(), "SimWidgetDX12.log"));
                Console.WriteLine();
                Console.WriteLine("Keep this window open. Press any key to detach...");
                Console.ReadKey();
            }
            catch (Exception ex)
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("[ERROR] Injection failed: " + ex.Message);
                Console.ResetColor();
                Console.WriteLine();
                Console.WriteLine("Possible causes:");
                Console.WriteLine("  - Run as Administrator");
                Console.WriteLine("  - Anti-virus blocking");
                Console.WriteLine("  - Game anti-cheat");
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
            string[] names = new string[]
            {
                "FlightSimulator2024",
                "FlightSimulator",
                "Microsoft.FlightSimulator"
            };
            
            foreach (var name in names)
            {
                var procs = Process.GetProcessesByName(name);
                if (procs.Length > 0)
                    return procs[0];
            }
            
            // Try by window title
            foreach (var proc in Process.GetProcesses())
            {
                try
                {
                    if (proc.MainWindowTitle.Contains("Microsoft Flight Simulator"))
                        return proc;
                }
                catch { }
            }
            
            return null;
        }
    }
    
    public class InjectorInterface : MarshalByRefObject
    {
        public void Log(string msg)
        {
            Console.WriteLine("[Hook] " + msg);
        }
    }
}
