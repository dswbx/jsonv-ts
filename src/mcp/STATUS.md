This package adds native MCP capabilities based on Web Standards. It doesn't aim to support all features just yet, most importantly the resource and tool calling, in a stateless fashion. See progress below.

Based on: https://modelcontextprotocol.io/specification/2025-06-18

---

## Base

### Capabilities

-  [x] logging
-  [ ] prompts
-  [x] resources
-  [x] tools
-  [x] completions (resource)
-  [ ] completions (prompt)
-  [ ] sampling
-  [ ] ~~roots~~
-  [ ] experimental

### Misc

-  [x] set logging level
-  [ ] instructions (initialize)
-  [ ] timeouts

### Transports

-  [ ] ~~STDIO~~
-  [x] HTTP
-  [ ] Streamable HTTP (stateful)
-  [ ] WebSocket

### Utilities

-  [x] ping
-  [ ] cancellation
-  [ ] progress
-  [ ] pagination

## Tools

-  [x] tools list
-  [ ] tools list cursor
-  [ ] tools list changed
-  [x] tools call
-  [x] tools call isError

### Tool Features

-  [x] details: name, title, description, inputSchema, annotations
-  [ ] outputSchema
-  [ ] result annotations
-  [x] result: text
-  [ ] result: image
-  [ ] result: audio
-  [ ] resource links

### Tool Nonstandard / Extra Features:

-  [x] result: json

## Resources

-  [x] resources list
-  [x] resources templates list
-  [x] resources read
-  [ ] resources subscribe
-  [ ] resources unsubscribe
-  [x] resources list changed

## Prompts

-  [ ] prompts list
-  [ ] prompts get

## Security & Authorization

-  [ ] OAuth 2.1 Resource Server
-  [ ] resource indicators
-  [ ] user consent workflows
-  [ ] token validation
-  [ ] rate limiting
-  [ ] session management
-  [ ] error reporting (security)

## Notifications

-  [x] notifications/initialized
-  [ ] notifications/cancelled
-  [ ] notifications/message
-  [ ] notifications/progress
-  [ ] notifications/prompts/list_changed
-  [ ] notifications/resources/list_changed
-  [ ] notifications/resources/updated
-  [ ] ~~notifications/roots/list_changed~~
-  [ ] notifications/tools/list_changed

## Client

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
-  [ ] ~~sendRootsListChanged~~
-  [ ] sampling createMessage

### Additional features

-  [x] add request init (e.g. for Authorization)
-  [ ] sampling create message
-  [ ] sampling message notification
-  [ ] model selection
-  [ ] sampling parameters
-  [ ] streaming responses
-  [ ] ~~roots list~~
-  [ ] ~~roots list changed notification~~

## Nonstandard / Extra Features:

-  [x] Web Standard only
-  [x] Server Context
