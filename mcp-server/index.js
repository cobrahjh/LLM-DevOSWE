#!/usr/bin/env node
/**
 * SimConnect MCP Server
 * 
 * This MCP server connects to Microsoft Flight Simulator via SimConnect
 * and exposes tools that Claude can use to:
 * - Read aircraft state (altitude, speed, heading, etc.)
 * - Send commands (toggle lights, set autopilot, etc.)
 * - Get flight information
 * 
 * Add to Claude Desktop config (claude_desktop_config.json):
 * {
 *   "mcpServers": {
 *     "simconnect": {
 *       "command": "node",
 *       "args": ["C:/LLM-DevOSWE/SimWidget Engine/mcp-server/index.js"]
 *     }
 *   }
 * }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

// SimConnect mock for development (replace with real node-simconnect when running)
let simconnect = null;
let connected = false;
let simVars = {};

// Simulated data for testing without MSFS running
const mockSimVars = {
  'INDICATED ALTITUDE': { value: 35000, unit: 'feet' },
  'AIRSPEED INDICATED': { value: 280, unit: 'knots' },
  'HEADING INDICATOR': { value: 270, unit: 'degrees' },
  'VERTICAL SPEED': { value: 0, unit: 'feet per minute' },
  'AUTOPILOT MASTER': { value: 1, unit: 'bool' },
  'AUTOPILOT HEADING LOCK': { value: 1, unit: 'bool' },
  'AUTOPILOT HEADING LOCK DIR': { value: 270, unit: 'degrees' },
  'AUTOPILOT ALTITUDE LOCK': { value: 1, unit: 'bool' },
  'AUTOPILOT ALTITUDE LOCK VAR': { value: 35000, unit: 'feet' },
  'FUEL TOTAL QUANTITY': { value: 15000, unit: 'gallons' },
  'FUEL TOTAL CAPACITY': { value: 25000, unit: 'gallons' },
  'GENERAL ENG COMBUSTION:1': { value: 1, unit: 'bool' },
  'TITLE': { value: 'Boeing 737-800', unit: 'string' },
  'LIGHT NAV': { value: 1, unit: 'bool' },
  'LIGHT BEACON': { value: 1, unit: 'bool' },
  'LIGHT STROBE': { value: 1, unit: 'bool' },
  'GEAR HANDLE POSITION': { value: 0, unit: 'bool' },
  'FLAPS HANDLE PERCENT': { value: 0, unit: 'percent' },
  'SIM ON GROUND': { value: 0, unit: 'bool' }
};

// Use mock data for now
simVars = mockSimVars;
connected = true;

// Create MCP Server
const server = new Server(
  { name: 'simconnect-mcp', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {} } }
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'get_aircraft_state',
      description: 'Get the current state of the aircraft including altitude, speed, heading, autopilot status, fuel, and more. Use this to understand the current flight situation.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      }
    },
    {
      name: 'get_simvar',
      description: 'Get a specific simulator variable value. Common simvars: INDICATED ALTITUDE (feet), AIRSPEED INDICATED (knots), HEADING INDICATOR (degrees), VERTICAL SPEED (feet per minute), AUTOPILOT MASTER (bool), FUEL TOTAL QUANTITY (gallons), etc.',
      inputSchema: {
        type: 'object',
        properties: {
          simvar: { type: 'string', description: 'The simvar name (e.g., "INDICATED ALTITUDE")' },
          unit: { type: 'string', description: 'The unit (e.g., "feet", "knots", "bool")' }
        },
        required: ['simvar']
      }
    },
    {
      name: 'send_command',
      description: 'Send a command to the simulator. Common commands: TOGGLE_NAV_LIGHTS, TOGGLE_BEACON_LIGHTS, STROBES_TOGGLE, LANDING_LIGHTS_TOGGLE, PARKING_BRAKES, GEAR_TOGGLE, AP_MASTER, AP_PANEL_HEADING_HOLD, AP_PANEL_ALTITUDE_HOLD, AP_NAV1_HOLD, FLAPS_INCR, FLAPS_DECR',
      inputSchema: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The K: event name (e.g., "TOGGLE_NAV_LIGHTS")' },
          value: { type: 'number', description: 'Optional value to send with the command', default: 0 }
        },
        required: ['command']
      }
    },
    {
      name: 'set_autopilot_altitude',
      description: 'Set the autopilot altitude bug to a specific value in feet',
      inputSchema: {
        type: 'object',
        properties: {
          altitude: { type: 'number', description: 'Target altitude in feet' }
        },
        required: ['altitude']
      }
    },
    {
      name: 'set_autopilot_heading',
      description: 'Set the autopilot heading bug to a specific value in degrees',
      inputSchema: {
        type: 'object',
        properties: {
          heading: { type: 'number', description: 'Target heading in degrees (0-360)' }
        },
        required: ['heading']
      }
    },
    {
      name: 'set_autopilot_speed',
      description: 'Set the autopilot airspeed hold value in knots',
      inputSchema: {
        type: 'object',
        properties: {
          speed: { type: 'number', description: 'Target airspeed in knots' }
        },
        required: ['speed']
      }
    },
    {
      name: 'toggle_lights',
      description: 'Toggle specific aircraft lights on or off',
      inputSchema: {
        type: 'object',
        properties: {
          light: { 
            type: 'string', 
            enum: ['nav', 'beacon', 'strobe', 'landing', 'taxi', 'all'],
            description: 'Which light to toggle'
          }
        },
        required: ['light']
      }
    }
  ]
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  switch (name) {
    case 'get_aircraft_state': {
      const state = {
        connected: connected,
        aircraft: simVars['TITLE']?.value || 'Unknown',
        position: {
          altitude: Math.round(simVars['INDICATED ALTITUDE']?.value || 0),
          airspeed: Math.round(simVars['AIRSPEED INDICATED']?.value || 0),
          heading: Math.round(simVars['HEADING INDICATOR']?.value || 0),
          verticalSpeed: Math.round(simVars['VERTICAL SPEED']?.value || 0)
        },
        autopilot: {
          master: simVars['AUTOPILOT MASTER']?.value ? 'ON' : 'OFF',
          heading: simVars['AUTOPILOT HEADING LOCK']?.value ? 'ON' : 'OFF',
          headingBug: Math.round(simVars['AUTOPILOT HEADING LOCK DIR']?.value || 0),
          altitude: simVars['AUTOPILOT ALTITUDE LOCK']?.value ? 'ON' : 'OFF',
          altitudeSetting: Math.round(simVars['AUTOPILOT ALTITUDE LOCK VAR']?.value || 0)
        },
        systems: {
          gear: simVars['GEAR HANDLE POSITION']?.value ? 'DOWN' : 'UP',
          flaps: Math.round(simVars['FLAPS HANDLE PERCENT']?.value || 0) + '%',
          onGround: simVars['SIM ON GROUND']?.value ? 'YES' : 'NO'
        },
        lights: {
          nav: simVars['LIGHT NAV']?.value ? 'ON' : 'OFF',
          beacon: simVars['LIGHT BEACON']?.value ? 'ON' : 'OFF',
          strobe: simVars['LIGHT STROBE']?.value ? 'ON' : 'OFF'
        },
        fuel: {
          quantity: Math.round(simVars['FUEL TOTAL QUANTITY']?.value || 0),
          capacity: Math.round(simVars['FUEL TOTAL CAPACITY']?.value || 0),
          percentage: Math.round(((simVars['FUEL TOTAL QUANTITY']?.value || 0) / (simVars['FUEL TOTAL CAPACITY']?.value || 1)) * 100)
        },
        engine: {
          running: simVars['GENERAL ENG COMBUSTION:1']?.value ? 'YES' : 'NO'
        }
      };
      
      return {
        content: [{ type: 'text', text: JSON.stringify(state, null, 2) }]
      };
    }
    
    case 'get_simvar': {
      const simvar = args.simvar;
      const data = simVars[simvar];
      
      if (data) {
        return {
          content: [{ type: 'text', text: `${simvar}: ${data.value} ${data.unit || ''}` }]
        };
      } else {
        return {
          content: [{ type: 'text', text: `SimVar "${simvar}" not found or not being tracked` }]
        };
      }
    }
    
    case 'send_command': {
      const command = args.command;
      const value = args.value || 0;
      
      // In real implementation, this would send via SimConnect
      console.error(`[MCP] Sending command: K:${command} = ${value}`);
      
      return {
        content: [{ type: 'text', text: `Command sent: K:${command} with value ${value}` }]
      };
    }
    
    case 'set_autopilot_altitude': {
      const altitude = args.altitude;
      console.error(`[MCP] Setting AP altitude to ${altitude} ft`);
      simVars['AUTOPILOT ALTITUDE LOCK VAR'] = { value: altitude, unit: 'feet' };
      
      return {
        content: [{ type: 'text', text: `Autopilot altitude set to ${altitude} feet` }]
      };
    }
    
    case 'set_autopilot_heading': {
      const heading = args.heading % 360;
      console.error(`[MCP] Setting AP heading to ${heading}°`);
      simVars['AUTOPILOT HEADING LOCK DIR'] = { value: heading, unit: 'degrees' };
      
      return {
        content: [{ type: 'text', text: `Autopilot heading bug set to ${heading}°` }]
      };
    }
    
    case 'set_autopilot_speed': {
      const speed = args.speed;
      console.error(`[MCP] Setting AP speed to ${speed} kts`);
      
      return {
        content: [{ type: 'text', text: `Autopilot speed set to ${speed} knots` }]
      };
    }
    
    case 'toggle_lights': {
      const light = args.light;
      const commands = {
        nav: 'TOGGLE_NAV_LIGHTS',
        beacon: 'TOGGLE_BEACON_LIGHTS',
        strobe: 'STROBES_TOGGLE',
        landing: 'LANDING_LIGHTS_TOGGLE',
        taxi: 'TOGGLE_TAXI_LIGHTS'
      };
      
      if (light === 'all') {
        console.error('[MCP] Toggling all lights');
        return {
          content: [{ type: 'text', text: 'Toggled all exterior lights' }]
        };
      } else if (commands[light]) {
        console.error(`[MCP] Toggling ${light} lights`);
        return {
          content: [{ type: 'text', text: `Toggled ${light} lights` }]
        };
      }
      
      return {
        content: [{ type: 'text', text: `Unknown light type: ${light}` }]
      };
    }
    
    default:
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }]
      };
  }
});

// Define resources (for reading aircraft state as a resource)
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: 'simconnect://aircraft/state',
      name: 'Aircraft State',
      description: 'Current aircraft state including position, autopilot, systems, fuel',
      mimeType: 'application/json'
    }
  ]
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  
  if (uri === 'simconnect://aircraft/state') {
    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(simVars, null, 2)
      }]
    };
  }
  
  throw new Error(`Unknown resource: ${uri}`);
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[MCP] SimConnect MCP Server running');
}

main().catch(console.error);
