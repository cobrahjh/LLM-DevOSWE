using System;
using System.Threading;
using Microsoft.FlightSimulator.SimConnect;

namespace ATCBot
{
    // Example integration showing how to use the ATC Bot
    class Program
    {
        private static SimConnect simConnect;
        private static ATCController atcController;
        private static bool running = true;

        // SimConnect data request IDs
        enum DATA_REQUESTS
        {
            AIRCRAFT_POSITION,
        }

        enum DATA_DEFINITIONS
        {
            AIRCRAFT_STATE,
        }

        // Aircraft position structure
        [System.Runtime.InteropServices.StructLayout(
            System.Runtime.InteropServices.LayoutKind.Sequential, 
            CharSet = System.Runtime.InteropServices.CharSet.Ansi, 
            Pack = 1)]
        struct AircraftPosition
        {
            public double latitude;
            public double longitude;
            public double altitude_agl;
            public double ground_velocity;
        }

        static void Main(string[] args)
        {
            Console.WriteLine("=== ATC Bot for MSFS 2024 ===");
            Console.WriteLine("Initializing SimConnect...\n");

            try
            {
                // Connect to MSFS
                simConnect = new SimConnect("ATC Bot", IntPtr.Zero, 0, null, 0);
                
                // Create ATC controller
                atcController = new ATCController(simConnect);

                // Setup SimConnect data requests
                SetupSimConnect();

                // Event handlers
                simConnect.OnRecvOpen += OnRecvOpen;
                simConnect.OnRecvQuit += OnRecvQuit;
                simConnect.OnRecvSimobjectData += OnRecvSimobjectData;

                Console.WriteLine("Connected to MSFS!");
                Console.WriteLine("\nCommands:");
                Console.WriteLine("  load ICAO    - Load airport (e.g., 'load KSEA')");
                Console.WriteLine("  taxi RWY     - Request taxi clearance (e.g., 'taxi 16R')");
                Console.WriteLine("  readback MSG - Simulate pilot readback");
                Console.WriteLine("  status       - Show current status");
                Console.WriteLine("  quit         - Exit\n");

                // Main loop
                while (running)
                {
                    simConnect.ReceiveMessage();
                    Thread.Sleep(100);

                    // Check for user commands
                    if (Console.KeyAvailable)
                    {
                        string input = Console.ReadLine();
                        ProcessCommand(input);
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error: {ex.Message}");
            }
            finally
            {
                simConnect?.Dispose();
            }
        }

        static void SetupSimConnect()
        {
            // Define aircraft state data
            simConnect.AddToDataDefinition(
                DATA_DEFINITIONS.AIRCRAFT_STATE,
                "PLANE LATITUDE",
                "degrees",
                SIMCONNECT_DATATYPE.FLOAT64,
                0.0f,
                SimConnect.SIMCONNECT_UNUSED
            );

            simConnect.AddToDataDefinition(
                DATA_DEFINITIONS.AIRCRAFT_STATE,
                "PLANE LONGITUDE",
                "degrees",
                SIMCONNECT_DATATYPE.FLOAT64,
                0.0f,
                SimConnect.SIMCONNECT_UNUSED
            );

            simConnect.AddToDataDefinition(
                DATA_DEFINITIONS.AIRCRAFT_STATE,
                "PLANE ALT ABOVE GROUND",
                "feet",
                SIMCONNECT_DATATYPE.FLOAT64,
                0.0f,
                SimConnect.SIMCONNECT_UNUSED
            );

            simConnect.AddToDataDefinition(
                DATA_DEFINITIONS.AIRCRAFT_STATE,
                "GROUND VELOCITY",
                "knots",
                SIMCONNECT_DATATYPE.FLOAT64,
                0.0f,
                SimConnect.SIMCONNECT_UNUSED
            );

            simConnect.RegisterDataDefineStruct<AircraftPosition>(DATA_DEFINITIONS.AIRCRAFT_STATE);

            // Request data every second
            simConnect.RequestDataOnSimObject(
                DATA_REQUESTS.AIRCRAFT_POSITION,
                DATA_DEFINITIONS.AIRCRAFT_STATE,
                SimConnect.SIMCONNECT_OBJECT_ID_USER,
                SIMCONNECT_PERIOD.SECOND,
                SIMCONNECT_DATA_REQUEST_FLAG.DEFAULT,
                0, 0, 0
            );
        }

        static void OnRecvOpen(SimConnect sender, SIMCONNECT_RECV_OPEN data)
        {
            Console.WriteLine("SimConnect connection established");
        }

        static void OnRecvQuit(SimConnect sender, SIMCONNECT_RECV data)
        {
            Console.WriteLine("MSFS has quit");
            running = false;
        }

        static void OnRecvSimobjectData(SimConnect sender, SIMCONNECT_RECV_SIMOBJECT_DATA data)
        {
            if ((DATA_REQUESTS)data.dwRequestID == DATA_REQUESTS.AIRCRAFT_POSITION)
            {
                var pos = (AircraftPosition)data.dwData[0];
                
                // Update ATC controller with aircraft state
                atcController.UpdateAircraftState(
                    pos.latitude,
                    pos.longitude,
                    pos.altitude_agl,
                    pos.ground_velocity
                );

                // Check if ATC needs to issue instructions
                string atcMessage = atcController.MonitorTaxi();
                if (atcMessage != null)
                {
                    Console.WriteLine($"\n[ATC]: {atcMessage}");
                }
            }
        }

        static void ProcessCommand(string input)
        {
            if (string.IsNullOrWhiteSpace(input))
                return;

            var parts = input.Trim().ToLower().Split(' ', 2);
            string cmd = parts[0];

            switch (cmd)
            {
                case "load":
                    if (parts.Length > 1)
                    {
                        string icao = parts[1].ToUpper();
                        Console.WriteLine($"Loading airport {icao}...");
                        atcController.LoadAirport(icao);
                    }
                    else
                    {
                        Console.WriteLine("Usage: load ICAO");
                    }
                    break;

                case "taxi":
                    if (parts.Length > 1)
                    {
                        string runway = parts[1].ToUpper();
                        string clearance = atcController.IssueTaxiClearance(runway);
                        Console.WriteLine($"\n[ATC]: {clearance}\n");
                    }
                    else
                    {
                        Console.WriteLine("Usage: taxi RUNWAY");
                    }
                    break;

                case "readback":
                    if (parts.Length > 1)
                    {
                        var result = atcController.ValidateReadback(parts[1]);
                        Console.WriteLine($"\n[ATC]: {result.Response}");
                        if (!result.IsCorrect)
                        {
                            Console.WriteLine("Readback incorrect - please correct");
                        }
                        Console.WriteLine();
                    }
                    else
                    {
                        Console.WriteLine("Usage: readback YOUR_MESSAGE");
                    }
                    break;

                case "status":
                    ShowStatus();
                    break;

                case "quit":
                case "exit":
                    running = false;
                    break;

                default:
                    Console.WriteLine("Unknown command. Type 'help' for commands.");
                    break;
            }
        }

        static void ShowStatus()
        {
            Console.WriteLine("\n=== ATC Bot Status ===");
            Console.WriteLine($"Phase: {atcController.GetCurrentPhase()}");
            Console.WriteLine($"Assigned Runway: {atcController.GetAssignedRunway() ?? "None"}");
            
            var route = atcController.GetCurrentRoute();
            if (route != null && route.Success)
            {
                Console.WriteLine($"Route: {string.Join(" -> ", route.TaxiwayNames)}");
                Console.WriteLine($"Instruction: {route.ATCInstruction}");
            }
            Console.WriteLine();
        }
    }
}
