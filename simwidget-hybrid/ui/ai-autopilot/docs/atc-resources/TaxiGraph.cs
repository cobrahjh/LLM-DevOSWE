using System;
using System.Collections.Generic;
using System.Linq;
using System.IO;
using System.Text.Json;
using Microsoft.FlightSimulator.SimConnect;

namespace ATCBot
{
    // Graph node representing a taxiway point
    public class TaxiNode
    {
        public int Index { get; set; }
        public double Lat { get; set; }
        public double Lon { get; set; }
        public string Type { get; set; } // "normal", "parking", "runway"
        public string Name { get; set; } // Taxiway name if available
    }

    // Graph edge representing a taxiway path
    public class TaxiEdge
    {
        public int FromNode { get; set; }
        public int ToNode { get; set; }
        public double Distance { get; set; } // Meters
        public string TaxiwayName { get; set; }
        public bool IsClosed { get; set; } // For construction/NOTAMs
    }

    public class TaxiGraph
    {
        private Dictionary<int, TaxiNode> nodes = new Dictionary<int, TaxiNode>();
        private Dictionary<int, List<TaxiEdge>> edges = new Dictionary<int, List<TaxiEdge>>();
        private Dictionary<int, string> taxiwayNames = new Dictionary<int, string>();
        private string airportICAO;
        
        private const string CACHE_DIR = "C:\\DevClaude\\ATC-Bot\\airports";

        public TaxiGraph(string icao)
        {
            airportICAO = icao;
            Directory.CreateDirectory(CACHE_DIR);
        }

        // Load from cache or query SimConnect
        public bool LoadAirport(SimConnect simConnect)
        {
            string cachePath = Path.Combine(CACHE_DIR, $"{airportICAO}.graph.json");
            
            // Try cache first
            if (File.Exists(cachePath))
            {
                try
                {
                    var json = File.ReadAllText(cachePath);
                    var cached = JsonSerializer.Deserialize<CachedGraph>(json);
                    nodes = cached.Nodes;
                    edges = cached.Edges;
                    taxiwayNames = cached.TaxiwayNames;
                    Console.WriteLine($"[TaxiGraph] Loaded {airportICAO} from cache: {nodes.Count} nodes");
                    return true;
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[TaxiGraph] Cache load failed: {ex.Message}");
                }
            }

            // Query from SimConnect
            return QueryFromSimConnect(simConnect, cachePath);
        }

        private bool QueryFromSimConnect(SimConnect simConnect, string cachePath)
        {
            Console.WriteLine($"[TaxiGraph] Querying {airportICAO} from SimConnect...");
            
            // This is a placeholder - actual implementation requires SimConnect facility data API
            // The real implementation would:
            // 1. Define facility data structure
            // 2. Request airport facility data with TAXI_POINT, TAXI_PATH, TAXI_PARKING
            // 3. Parse the returned data into nodes/edges
            // 4. Cache the result
            
            // For now, return false to indicate we need the full SimConnect integration
            return false;
        }

        // Find nearest node to aircraft position
        public int FindNearestNode(double lat, double lon)
        {
            int nearest = -1;
            double minDist = double.MaxValue;

            foreach (var node in nodes.Values)
            {
                double dist = HaversineDistance(lat, lon, node.Lat, node.Lon);
                if (dist < minDist)
                {
                    minDist = dist;
                    nearest = node.Index;
                }
            }

            return nearest;
        }

        // Find node by runway designation (e.g., "24R")
        public int FindRunwayNode(string runway)
        {
            foreach (var node in nodes.Values)
            {
                if (node.Type == "runway" && node.Name == runway)
                    return node.Index;
            }
            return -1;
        }

        // A* pathfinding algorithm
        public List<int> FindPath(int startNode, int endNode)
        {
            if (!nodes.ContainsKey(startNode) || !nodes.ContainsKey(endNode))
                return null;

            var openSet = new HashSet<int> { startNode };
            var cameFrom = new Dictionary<int, int>();
            var gScore = new Dictionary<int, double>();
            var fScore = new Dictionary<int, double>();

            foreach (var node in nodes.Keys)
            {
                gScore[node] = double.MaxValue;
                fScore[node] = double.MaxValue;
            }

            gScore[startNode] = 0;
            fScore[startNode] = Heuristic(startNode, endNode);

            while (openSet.Count > 0)
            {
                // Get node with lowest fScore
                int current = openSet.OrderBy(n => fScore[n]).First();

                if (current == endNode)
                {
                    return ReconstructPath(cameFrom, current);
                }

                openSet.Remove(current);

                // Check all neighbors
                if (edges.ContainsKey(current))
                {
                    foreach (var edge in edges[current])
                    {
                        if (edge.IsClosed) continue; // Skip closed taxiways

                        int neighbor = edge.ToNode;
                        double tentativeGScore = gScore[current] + edge.Distance;

                        if (tentativeGScore < gScore[neighbor])
                        {
                            cameFrom[neighbor] = current;
                            gScore[neighbor] = tentativeGScore;
                            fScore[neighbor] = gScore[neighbor] + Heuristic(neighbor, endNode);

                            if (!openSet.Contains(neighbor))
                                openSet.Add(neighbor);
                        }
                    }
                }
            }

            return null; // No path found
        }

        // Convert node path to taxiway name instructions
        public List<string> ConvertToInstructions(List<int> nodePath)
        {
            if (nodePath == null || nodePath.Count < 2)
                return new List<string>();

            var instructions = new List<string>();
            string currentTaxiway = null;

            for (int i = 0; i < nodePath.Count - 1; i++)
            {
                int fromNode = nodePath[i];
                int toNode = nodePath[i + 1];

                // Find edge between these nodes
                if (edges.ContainsKey(fromNode))
                {
                    var edge = edges[fromNode].FirstOrDefault(e => e.ToNode == toNode);
                    if (edge != null && !string.IsNullOrEmpty(edge.TaxiwayName))
                    {
                        if (edge.TaxiwayName != currentTaxiway)
                        {
                            instructions.Add(edge.TaxiwayName);
                            currentTaxiway = edge.TaxiwayName;
                        }
                    }
                }
            }

            return instructions;
        }

        // Get full route from current position to runway
        public RouteResult GetRoute(double currentLat, double currentLon, string targetRunway)
        {
            int startNode = FindNearestNode(currentLat, currentLon);
            int endNode = FindRunwayNode(targetRunway);

            if (startNode == -1 || endNode == -1)
            {
                return new RouteResult 
                { 
                    Success = false, 
                    Error = "Cannot find start or end position" 
                };
            }

            var path = FindPath(startNode, endNode);
            if (path == null)
            {
                return new RouteResult 
                { 
                    Success = false, 
                    Error = "No valid route found" 
                };
            }

            var taxiways = ConvertToInstructions(path);
            return new RouteResult
            {
                Success = true,
                NodePath = path,
                TaxiwayNames = taxiways,
                ATCInstruction = FormatATCInstruction(taxiways, targetRunway)
            };
        }

        private string FormatATCInstruction(List<string> taxiways, string runway)
        {
            if (taxiways.Count == 0)
                return $"Taxi to runway {runway}";

            string via = string.Join(", ", taxiways);
            return $"Taxi to runway {runway} via {via}, hold short runway {runway}";
        }

        private List<int> ReconstructPath(Dictionary<int, int> cameFrom, int current)
        {
            var path = new List<int> { current };
            while (cameFrom.ContainsKey(current))
            {
                current = cameFrom[current];
                path.Insert(0, current);
            }
            return path;
        }

        private double Heuristic(int node1, int node2)
        {
            var n1 = nodes[node1];
            var n2 = nodes[node2];
            return HaversineDistance(n1.Lat, n1.Lon, n2.Lat, n2.Lon);
        }

        // Haversine distance in meters
        private double HaversineDistance(double lat1, double lon1, double lat2, double lon2)
        {
            const double R = 6371000; // Earth radius in meters
            double dLat = ToRadians(lat2 - lat1);
            double dLon = ToRadians(lon2 - lon1);

            double a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                       Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2)) *
                       Math.Sin(dLon / 2) * Math.Sin(dLon / 2);

            double c = 2 * Math.Asin(Math.Sqrt(a));
            return R * c;
        }

        private double ToRadians(double degrees)
        {
            return degrees * Math.PI / 180.0;
        }

        // Save graph to cache
        public void SaveCache()
        {
            try
            {
                string cachePath = Path.Combine(CACHE_DIR, $"{airportICAO}.graph.json");
                var cached = new CachedGraph
                {
                    ICAO = airportICAO,
                    Nodes = nodes,
                    Edges = edges,
                    TaxiwayNames = taxiwayNames,
                    CacheDate = DateTime.UtcNow
                };

                var json = JsonSerializer.Serialize(cached, new JsonSerializerOptions 
                { 
                    WriteIndented = true 
                });
                File.WriteAllText(cachePath, json);
                Console.WriteLine($"[TaxiGraph] Cached {airportICAO}: {nodes.Count} nodes");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[TaxiGraph] Cache save failed: {ex.Message}");
            }
        }

        // Add node (for manual construction or testing)
        public void AddNode(TaxiNode node)
        {
            nodes[node.Index] = node;
        }

        // Add edge (bidirectional)
        public void AddEdge(int from, int to, string taxiwayName, double distance = -1)
        {
            if (distance < 0)
            {
                distance = HaversineDistance(
                    nodes[from].Lat, nodes[from].Lon,
                    nodes[to].Lat, nodes[to].Lon
                );
            }

            var edge = new TaxiEdge
            {
                FromNode = from,
                ToNode = to,
                TaxiwayName = taxiwayName,
                Distance = distance,
                IsClosed = false
            };

            if (!edges.ContainsKey(from))
                edges[from] = new List<TaxiEdge>();
            
            edges[from].Add(edge);

            // Add reverse edge for bidirectional travel
            var reverseEdge = new TaxiEdge
            {
                FromNode = to,
                ToNode = from,
                TaxiwayName = taxiwayName,
                Distance = distance,
                IsClosed = false
            };

            if (!edges.ContainsKey(to))
                edges[to] = new List<TaxiEdge>();
            
            edges[to].Add(reverseEdge);
        }
    }

    // Cache structure for JSON serialization
    public class CachedGraph
    {
        public string ICAO { get; set; }
        public Dictionary<int, TaxiNode> Nodes { get; set; }
        public Dictionary<int, List<TaxiEdge>> Edges { get; set; }
        public Dictionary<int, string> TaxiwayNames { get; set; }
        public DateTime CacheDate { get; set; }
    }

    // Result structure for route queries
    public class RouteResult
    {
        public bool Success { get; set; }
        public string Error { get; set; }
        public List<int> NodePath { get; set; }
        public List<string> TaxiwayNames { get; set; }
        public string ATCInstruction { get; set; }
    }
}
