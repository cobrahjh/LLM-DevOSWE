using System;
using System.Collections.Generic;
using Microsoft.FlightSimulator.SimConnect;

namespace ATCBot
{
    // ATC flight phases
    public enum ATCPhase
    {
        Parked,
        TaxiToRunway,
        HoldShort,
        TakeoffClearance,
        Departure,
        Enroute,
        Approach,
        Landing,
        TaxiToGate
    }

    // Main ATC Bot controller
    public class ATCController
    {
        private SimConnect simConnect;
        private TaxiGraph currentGraph;
        private FacilityDataLoader facilityLoader;
        
        // Aircraft state
        private string currentICAO;
        private double aircraftLat;
        private double aircraftLon;
        private double aircraftAltAGL;
        private double aircraftSpeed;
        private string assignedRunway;
        private ATCPhase currentPhase = ATCPhase.Parked;
        
        // Route tracking
        private RouteResult currentRoute;
        private int currentWaypointIndex = 0;
        private bool waitingForReadback = false;
        private string lastInstruction;
        private DateTime lastInstructionTime;

        // Phraseology
        private string aircraftCallsign = "N12345"; // Will be read from sim

        public ATCController(SimConnect sc)
        {
            simConnect = sc;
            Console.WriteLine("[ATC] Controller initialized");
        }

        // Initialize for an airport
        public void LoadAirport(string icao)
        {
            Console.WriteLine($"[ATC] Loading airport {icao}");
            currentICAO = icao;
            
            currentGraph = new TaxiGraph(icao);
            facilityLoader = new FacilityDataLoader(simConnect, currentGraph);
            
            // Try to load from cache first
            if (!currentGraph.LoadAirport(simConnect))
            {
                // Not in cache, request from SimConnect
                facilityLoader.RequestAirportData(icao);
            }
        }

        // Update aircraft position from SimConnect
        public void UpdateAircraftState(double lat, double lon, double altAGL, double speed)
        {
            aircraftLat = lat;
            aircraftLon = lon;
            aircraftAltAGL = altAGL;
            aircraftSpeed = speed;

            // Auto-detect phase changes
            DetectPhaseChange();
        }

        // Issue taxi clearance
        public string IssueTaxiClearance(string runway)
        {
            assignedRunway = runway;
            currentPhase = ATCPhase.TaxiToRunway;

            // Get route to runway
            currentRoute = currentGraph.GetRoute(aircraftLat, aircraftLon, runway);

            if (!currentRoute.Success)
            {
                return SayUnable(currentRoute.Error);
            }

            lastInstruction = currentRoute.ATCInstruction;
            lastInstructionTime = DateTime.Now;
            waitingForReadback = true;

            // ATC: "November one two three four five, taxi to runway two four right via Alpha, Bravo, hold short runway two four right"
            return FormatATCMessage(currentRoute.ATCInstruction);
        }

        // Validate pilot readback
        public ReadbackResult ValidateReadback(string pilotReadback)
        {
            if (!waitingForReadback)
            {
                return new ReadbackResult 
                { 
                    IsCorrect = false, 
                    Response = "No clearance pending readback" 
                };
            }

            waitingForReadback = false;

            // Parse critical items from readback
            bool hasCallsign = pilotReadback.Contains(aircraftCallsign) || 
                              pilotReadback.Contains(aircraftCallsign.Substring(1)); // Allow without "N"
            
            bool hasRunway = pilotReadback.Contains(assignedRunway.Replace(" ", "")) ||
                            pilotReadback.Contains(assignedRunway);

            // Check for taxiway names
            int taxiwayMatches = 0;
            foreach (var taxiway in currentRoute.TaxiwayNames)
            {
                if (pilotReadback.ToLower().Contains(taxiway.ToLower()))
                    taxiwayMatches++;
            }

            bool readbackCorrect = hasCallsign && hasRunway && 
                                  (currentRoute.TaxiwayNames.Count == 0 || taxiwayMatches > 0);

            if (readbackCorrect)
            {
                return new ReadbackResult
                {
                    IsCorrect = true,
                    Response = FormatATCMessage($"{aircraftCallsign}, readback correct")
                };
            }
            else
            {
                // Identify what was wrong
                string correction = "Readback incorrect. ";
                if (!hasRunway)
                    correction += $"Confirm runway {assignedRunway}. ";
                if (taxiwayMatches == 0 && currentRoute.TaxiwayNames.Count > 0)
                    correction += "Verify taxi route. ";

                waitingForReadback = true; // Wait for corrected readback
                return new ReadbackResult
                {
                    IsCorrect = false,
                    Response = FormatATCMessage(correction + lastInstruction)
                };
            }
        }

        // Monitor position vs expected route
        public string MonitorTaxi()
        {
            if (currentPhase != ATCPhase.TaxiToRunway || currentRoute == null)
                return null;

            // Check if aircraft is on expected path
            int nearestNode = currentGraph.FindNearestNode(aircraftLat, aircraftLon);
            
            // See if we're on the route
            bool onRoute = currentRoute.NodePath.Contains(nearestNode);

            if (!onRoute)
            {
                // Off route - issue position check
                return FormatATCMessage($"{aircraftCallsign}, verify position");
            }

            // Check if approaching hold short point
            int runwayNode = currentGraph.FindRunwayNode(assignedRunway);
            if (nearestNode == runwayNode && currentPhase == ATCPhase.TaxiToRunway)
            {
                currentPhase = ATCPhase.HoldShort;
                return FormatATCMessage($"{aircraftCallsign}, hold short runway {assignedRunway}");
            }

            return null; // All good
        }

        // Issue takeoff clearance
        public string IssueTakeoffClearance()
        {
            if (currentPhase != ATCPhase.HoldShort)
            {
                return FormatATCMessage($"{aircraftCallsign}, hold position");
            }

            currentPhase = ATCPhase.TakeoffClearance;
            lastInstruction = $"Runway {assignedRunway}, cleared for takeoff";
            waitingForReadback = true;

            return FormatATCMessage(lastInstruction);
        }

        // Format ATC message with proper phraseology
        private string FormatATCMessage(string message)
        {
            // Prefix with callsign if not already present
            if (!message.StartsWith(aircraftCallsign))
            {
                return $"{aircraftCallsign}, {message}";
            }
            return message;
        }

        private string SayUnable(string reason)
        {
            return FormatATCMessage($"Unable, {reason}");
        }

        private void DetectPhaseChange()
        {
            // Auto-detect phase based on aircraft state
            if (aircraftSpeed < 1 && aircraftAltAGL < 10)
            {
                if (currentPhase == ATCPhase.TakeoffClearance)
                    return; // Waiting to depart

                currentPhase = ATCPhase.Parked;
            }
            else if (aircraftSpeed > 1 && aircraftAltAGL < 10)
            {
                // Taxiing
                if (currentPhase == ATCPhase.Parked)
                    currentPhase = ATCPhase.TaxiToRunway;
            }
            else if (aircraftAltAGL > 50)
            {
                // Airborne
                if (currentPhase == ATCPhase.TakeoffClearance)
                    currentPhase = ATCPhase.Departure;
            }
        }

        public ATCPhase GetCurrentPhase() => currentPhase;
        public string GetAssignedRunway() => assignedRunway;
        public RouteResult GetCurrentRoute() => currentRoute;
    }

    // Result of readback validation
    public class ReadbackResult
    {
        public bool IsCorrect { get; set; }
        public string Response { get; set; }
        public List<string> Errors { get; set; } = new List<string>();
    }
}
