using System;
using System.Runtime.InteropServices;
using Microsoft.FlightSimulator.SimConnect;

namespace ATCBot
{
    // SimConnect facility data loader for airport taxiway graphs
    public class FacilityDataLoader
    {
        private SimConnect simConnect;
        private TaxiGraph graph;
        private bool isLoading = false;

        // Request IDs
        private enum DATA_REQUESTS
        {
            FACILITY_AIRPORT,
            FACILITY_TAXI_POINT,
            FACILITY_TAXI_PATH,
            FACILITY_TAXI_PARKING,
            FACILITY_RUNWAY
        }

        // Definition IDs
        private enum DATA_DEFINITIONS
        {
            AIRPORT_DEF,
            TAXI_POINT_DEF,
            TAXI_PATH_DEF,
            TAXI_PARKING_DEF,
            RUNWAY_DEF
        }

        // Facility data structures matching SimConnect API
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi, Pack = 1)]
        public struct FacilityTaxiPoint
        {
            public int Index;
            public double Latitude;
            public double Longitude;
            public int Type; // 0=normal, 1=hold_short, 2=ils_hold_short
            public int Orientation;
        }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi, Pack = 1)]
        public struct FacilityTaxiPath
        {
            public int StartPoint;
            public int EndPoint;
            public int Type; // 0=taxiway, 1=runway, 2=parking
            public int RunwayNumber;
            public int RunwayDesignator;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 8)]
            public string Name;
            public byte DrawSurface;
            public byte DrawDetail;
            public float Width;
        }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi, Pack = 1)]
        public struct FacilityTaxiParking
        {
            public int Index;
            public double Latitude;
            public double Longitude;
            public float Heading;
            public float Radius;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 12)]
            public string Name;
            public int Type; // Gate, ramp, cargo, etc
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 6)]
            public string Number;
        }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi, Pack = 1)]
        public struct FacilityRunway
        {
            public int PrimaryIndex;
            public int SecondaryIndex;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 4)]
            public string PrimaryNumber;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 4)]
            public string SecondaryNumber;
            public double PrimaryLatitude;
            public double PrimaryLongitude;
            public double SecondaryLatitude;
            public double SecondaryLongitude;
        }

        public FacilityDataLoader(SimConnect sc, TaxiGraph tg)
        {
            simConnect = sc;
            graph = tg;
            
            // Register event handlers
            simConnect.OnRecvFacilityData += OnRecvFacilityData;
            simConnect.OnRecvFacilityDataEnd += OnRecvFacilityDataEnd;
        }

        public void RequestAirportData(string icao)
        {
            if (isLoading)
            {
                Console.WriteLine("[FacilityLoader] Already loading data");
                return;
            }

            Console.WriteLine($"[FacilityLoader] Requesting facility data for {icao}");
            isLoading = true;

            try
            {
                // Define what facility data we want
                DefineFacilityData();

                // Request the airport facility data
                simConnect.RequestFacilityData(
                    DATA_DEFINITIONS.AIRPORT_DEF,
                    DATA_REQUESTS.FACILITY_AIRPORT,
                    icao
                );
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[FacilityLoader] Error requesting data: {ex.Message}");
                isLoading = false;
            }
        }

        private void DefineFacilityData()
        {
            // Define airport facility data structure
            // This tells SimConnect what data we want to receive

            // Airport definition (entry point)
            simConnect.AddToFacilityDefinition(
                DATA_DEFINITIONS.AIRPORT_DEF,
                "OPEN AIRPORT"
            );

            // Taxi points (nodes in the graph)
            simConnect.AddToFacilityDefinition(
                DATA_DEFINITIONS.AIRPORT_DEF,
                "OPEN TAXI_POINT"
            );
            simConnect.AddToFacilityDefinition(
                DATA_DEFINITIONS.AIRPORT_DEF,
                "INDEX"
            );
            simConnect.AddToFacilityDefinition(
                DATA_DEFINITIONS.AIRPORT_DEF,
                "LATITUDE"
            );
            simConnect.AddToFacilityDefinition(
                DATA_DEFINITIONS.AIRPORT_DEF,
                "LONGITUDE"
            );
            simConnect.AddToFacilityDefinition(
                DATA_DEFINITIONS.AIRPORT_DEF,
                "CLOSE TAXI_POINT"
            );

            // Taxi paths (edges in the graph)
            simConnect.AddToFacilityDefinition(
                DATA_DEFINITIONS.AIRPORT_DEF,
                "OPEN TAXI_PATH"
            );
            simConnect.AddToFacilityDefinition(
                DATA_DEFINITIONS.AIRPORT_DEF,
                "START_POINT"
            );
            simConnect.AddToFacilityDefinition(
                DATA_DEFINITIONS.AIRPORT_DEF,
                "END_POINT"
            );
            simConnect.AddToFacilityDefinition(
                DATA_DEFINITIONS.AIRPORT_DEF,
                "NAME"
            );
            simConnect.AddToFacilityDefinition(
                DATA_DEFINITIONS.AIRPORT_DEF,
                "CLOSE TAXI_PATH"
            );

            // Parking spots
            simConnect.AddToFacilityDefinition(
                DATA_DEFINITIONS.AIRPORT_DEF,
                "OPEN TAXI_PARKING"
            );
            simConnect.AddToFacilityDefinition(
                DATA_DEFINITIONS.AIRPORT_DEF,
                "INDEX"
            );
            simConnect.AddToFacilityDefinition(
                DATA_DEFINITIONS.AIRPORT_DEF,
                "LATITUDE"
            );
            simConnect.AddToFacilityDefinition(
                DATA_DEFINITIONS.AIRPORT_DEF,
                "LONGITUDE"
            );
            simConnect.AddToFacilityDefinition(
                DATA_DEFINITIONS.AIRPORT_DEF,
                "NUMBER"
            );
            simConnect.AddToFacilityDefinition(
                DATA_DEFINITIONS.AIRPORT_DEF,
                "CLOSE TAXI_PARKING"
            );

            // Runways (for hold short points)
            simConnect.AddToFacilityDefinition(
                DATA_DEFINITIONS.AIRPORT_DEF,
                "OPEN RUNWAY"
            );
            simConnect.AddToFacilityDefinition(
                DATA_DEFINITIONS.AIRPORT_DEF,
                "PRIMARY_NUMBER"
            );
            simConnect.AddToFacilityDefinition(
                DATA_DEFINITIONS.AIRPORT_DEF,
                "SECONDARY_NUMBER"
            );
            simConnect.AddToFacilityDefinition(
                DATA_DEFINITIONS.AIRPORT_DEF,
                "PRIMARY_LATITUDE"
            );
            simConnect.AddToFacilityDefinition(
                DATA_DEFINITIONS.AIRPORT_DEF,
                "PRIMARY_LONGITUDE"
            );
            simConnect.AddToFacilityDefinition(
                DATA_DEFINITIONS.AIRPORT_DEF,
                "CLOSE RUNWAY"
            );

            simConnect.AddToFacilityDefinition(
                DATA_DEFINITIONS.AIRPORT_DEF,
                "CLOSE AIRPORT"
            );
        }

        private void OnRecvFacilityData(SimConnect sender, SIMCONNECT_RECV_FACILITY_DATA data)
        {
            try
            {
                switch ((DATA_REQUESTS)data.dwRequestID)
                {
                    case DATA_REQUESTS.FACILITY_TAXI_POINT:
                        var taxiPoint = (FacilityTaxiPoint)data.Data[0];
                        ProcessTaxiPoint(taxiPoint);
                        break;

                    case DATA_REQUESTS.FACILITY_TAXI_PATH:
                        var taxiPath = (FacilityTaxiPath)data.Data[0];
                        ProcessTaxiPath(taxiPath);
                        break;

                    case DATA_REQUESTS.FACILITY_TAXI_PARKING:
                        var parking = (FacilityTaxiParking)data.Data[0];
                        ProcessParking(parking);
                        break;

                    case DATA_REQUESTS.FACILITY_RUNWAY:
                        var runway = (FacilityRunway)data.Data[0];
                        ProcessRunway(runway);
                        break;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[FacilityLoader] Error processing data: {ex.Message}");
            }
        }

        private void OnRecvFacilityDataEnd(SimConnect sender, SIMCONNECT_RECV_FACILITY_DATA_END data)
        {
            Console.WriteLine($"[FacilityLoader] Facility data complete");
            isLoading = false;
            
            // Save the graph to cache
            graph.SaveCache();
        }

        private void ProcessTaxiPoint(FacilityTaxiPoint point)
        {
            var node = new TaxiNode
            {
                Index = point.Index,
                Lat = point.Latitude,
                Lon = point.Longitude,
                Type = point.Type switch
                {
                    1 => "hold_short",
                    2 => "ils_hold_short",
                    _ => "normal"
                }
            };

            graph.AddNode(node);
            Console.WriteLine($"[FacilityLoader] Added taxi point {point.Index}");
        }

        private void ProcessTaxiPath(FacilityTaxiPath path)
        {
            string name = path.Name?.Trim() ?? "Unknown";
            
            graph.AddEdge(
                path.StartPoint,
                path.EndPoint,
                name
            );

            Console.WriteLine($"[FacilityLoader] Added taxi path {path.StartPoint} -> {path.EndPoint} ({name})");
        }

        private void ProcessParking(FacilityTaxiParking parking)
        {
            var node = new TaxiNode
            {
                Index = parking.Index,
                Lat = parking.Latitude,
                Lon = parking.Longitude,
                Type = "parking",
                Name = $"Gate {parking.Number}"
            };

            graph.AddNode(node);
            Console.WriteLine($"[FacilityLoader] Added parking {parking.Number} at index {parking.Index}");
        }

        private void ProcessRunway(FacilityRunway runway)
        {
            // Add runway threshold nodes
            var primaryNode = new TaxiNode
            {
                Index = runway.PrimaryIndex,
                Lat = runway.PrimaryLatitude,
                Lon = runway.PrimaryLongitude,
                Type = "runway",
                Name = runway.PrimaryNumber
            };

            var secondaryNode = new TaxiNode
            {
                Index = runway.SecondaryIndex,
                Lat = runway.SecondaryLatitude,
                Lon = runway.SecondaryLongitude,
                Type = "runway",
                Name = runway.SecondaryNumber
            };

            graph.AddNode(primaryNode);
            graph.AddNode(secondaryNode);

            Console.WriteLine($"[FacilityLoader] Added runway {runway.PrimaryNumber}/{runway.SecondaryNumber}");
        }
    }
}
