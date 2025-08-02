This package adds native MCP capabilities based on Hono. It doesn't aim to support all features just yet, most importantly the resource and tool calling, in a stateless fashion. See progress below.

Based on: https://modelcontextprotocol.io/specification/2025-06-18

---

Transports:

-  [ ] ~~STDIO~~ (not Web Standard)
-  [x] Streamable HTTP

Requests:

-  [x] initialize
-  [x] ping
-  [ ] paginate
-  [x] list resources
-  [x] list resource templates
-  [x] read resource
-  [ ] subscribe
-  [ ] list prompts
-  [ ] get prompt
-  [x] list tools
-  [x] call tool
-  [x] set level (logging)
-  [ ] create message
-  [x] complete (resource)
-  [ ] complete (prompt)
-  [ ] list roots

Notifications:

-  [ ] server
-  [ ] progress
-  [ ] client
-  [ ] cancelled
-  [ ] resource update
-  [x] initialized
-  [ ] logging message
-  [ ] tool list changed
-  [ ] roots list changed
-  [ ] prompt list changed
-  [ ] resource list changed

Tool:

-  [x] create
-  [x] add
-  [x] execute
-  [x] text content
-  [x] inputSchema
-  [x] annotations
-  [ ] outputSchema
-  [ ] audio content
-  [ ] image content
-  [ ] embedded content

Resource:

-  [x] create
-  [x] add
-  [x] execute
-  [x] text content
-  [x] json content
-  [x] binary content
-  [x] annotations
-  [x] dynamic
-  [x] completions: list
-  [x] completions: complete
-  [ ] resource_links

Client:

-  [x] connect
-  [x] ping
-  [x] setLoggingLevel
-  [x] listResources
-  [x] listResourceTemplates
-  [x] readResource
-  [x] callTool
-  [x] listTools
-  [ ] registerCapabilities
-  [ ] assertCapability
-  [ ] getServerCapabilities
-  [ ] getServerVersion
-  [ ] getInstructions
-  [ ] complete
-  [ ] getPrompt
-  [ ] listPrompts
-  [ ] subscribeResource
-  [ ] unsubscribeResource
-  [ ] sendRootsListChanged

---

Additional features:

-  [x] Web Standard only
-  [x] Server Context
