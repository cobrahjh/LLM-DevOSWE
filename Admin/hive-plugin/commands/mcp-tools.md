# /mcp-tools - List Available MCP Tools

Show all MCP tools available through the MCP Bridge service.

## Instructions

1. Fetch server list from `http://localhost:8860/api/servers`

2. For each server, display:
   - Server name
   - Description
   - Status (online/stopped/error)
   - Available tools

3. Group by category:
   - File Operations (filesystem, git)
   - Data (memory, sqlite)
   - Web (fetch, puppeteer)
   - Communication (github, slack)
   - Utility (time, sequential-thinking)

4. Show total tool count

5. If user asks to use a specific tool, provide the curl command or execute it

## Output Format

```
=== MCP TOOLS AVAILABLE ===

File Operations:
  filesystem (stopped) - File system operations
    Tools: read_file, write_file, list_directory, create_directory,
           move_file, search_files, get_file_info

  git (stopped) - Git version control
    Tools: git_status, git_diff, git_commit, git_add, git_log...

Data:
  memory (stopped) - Persistent knowledge graph
    Tools: create_entities, create_relations, search_nodes, read_graph...

  sqlite (stopped) - SQLite database
    Tools: read_query, write_query, list_tables, describe_table...

...

Total: 79 tools across 10 servers
Active: 0 servers (start with POST /api/servers/{name}/start)

To use a tool:
  curl -X POST http://localhost:8860/api/tool/read_file \
    -H "Content-Type: application/json" \
    -d '{"path": "/path/to/file"}'
```
