# PR #748 Review Responses

Here are proposed first-person responses you can paste into each of the review comment threads on GitHub! I've included the reviewer's exact quotes so you can easily match them up.

### 1. General PR Summary Comment (Security & Tests)
**Reviewer via gemini-code-assist:**
> ![medium]
>
> This pull request integrates MCP Apps into A2UI by adding a new `McpAppsCustomComponent`, a double-iframe sandbox for security, and a persistent SSE backend... I've identified critical security issues related to `postMessage` usage that should be addressed. Additionally, there are opportunities to improve maintainability by removing hardcoded URLs... The repository's style guide requires tests for new code... Please consider adding tests...

**Reply:**
> Thanks for the thorough review! I've gone ahead and secured all the `postMessage` boundaries across the stack. Specifically, the client sandbox proxy now strictly enforces `EXPECTED_HOST_ORIGIN` validating against the `document.referrer`, and the inner `floor_plan_server` uses a stateful approach to capture and lock to the exact `hostOrigin` from the frontend handshake rather than blindly broadcasting to `*`. I've also parameterized all hardcoded URLs.
> 
> As for the tests, we currently do not use an automated UI testing framework for the Python ADK backend samples, but I've manually verified the edge cases and failure modes end-to-end to ensure the connection robustly handles errors and rejected tool calls.

---

### 2. `sandbox.ts` Line (null) - Target Origin
**Reviewer via gemini-code-assist:**
> ![high]
> 
> When forwarding messages to the inner iframe, you are using a wildcard `*` as the target origin. While the inner iframe is same-origin in this setup, it is a security best practice to always specify the exact target origin. You should use `OWN_ORIGIN` here to ensure the message is only delivered if the inner iframe's origin matches.

**Reply:**
> Addressed in the latest commit. I realized this was leaking through the proxy, so I swapped the forwarder destination from `*` to `OWN_ORIGIN`.

---

### 3. `floor_plan_server.py` Line (null) - Target Origin Vulnerability
**Reviewer via gemini-code-assist:**
> ![critical]
> 
> The `postMessage` calls on lines 224 and 264 use a wildcard `*` for the target origin, which is a significant security vulnerability. This allows any website to embed this content and intercept the messages. You should restrict the target origin to the specific, expected parent origin. For example, the parent frame could send its origin in an initial message, which this script could then store and use for all subsequent `postMessage` calls.

**Reply:**
> Great point. I implemented exactly what you suggested: The inner iframe logic now defaults `hostOrigin` to `*` only until it receives a `sandbox-init` message from the parent proxy. It captures the `event.origin`, permanently saves it as the `hostOrigin`, and strictly uses that for all subsequent outbound MCP tool calls and the initial `ui/initialize` handshake!

---

### 4. `agent.py` Line (null) - Hardcoded SSE URL
**Reviewer via gemini-code-assist:**
> ![medium]
> 
> The SSE server URL `http://127.0.0.1:8000/sse` is hardcoded. This makes the agent less flexible and harder to configure for different environments (e.g., development, staging, production). It's recommended to extract this into a configurable variable, for instance, loaded from an environment variable.

**Reply:**
> Good catch! I updated the connection logic to grab `FLOOR_PLAN_SERVER_URL` entirely from the `os.environ`. It defaults securely to the local `http://127.0.0.1:8000/sse` for the out-of-the-box demo experience, but can now easily run in deployed or CI environments without code changes.

---

### 5. `agent.py` Line 260 - Broad Exception Handler
**Reviewer via gemini-code-assist:**
> ![medium]
> 
> Catching a broad `Exception` can hide unexpected errors and make debugging more difficult. It's better to catch more specific exceptions that you expect from the network request (e.g., connection errors) and from the logic within the `try` block (like the `ValueError` you're raising). This allows for more granular error handling and logging.

**Reply:**
> Done. I've added a specific catch block for `ValueError` alongside the other connection handlers. If the floor plan server responds with invalid or empty data (like a 404), the agent will now catch it explicitly and gracefully yield a UI error message indicating the failure to load the floor plan, rather than swallowing a broader bug.

---

### 6. `floor_plan_server.py` Line (null) - Hardcoded Static URL
**Reviewer via gemini-code-assist:**
> ![medium]
> 
> The image URL `http://localhost:10004/static/floorplan.png` is hardcoded within the HTML string. This will cause issues when deploying to environments other than local development. This URL should be made configurable, for example by passing it into the HTML template from the Python server, which could in turn read it from an environment variable or configuration file.

**Reply:**
> Fixed. I refactored the floor plan HTML payload injection to dynamically inject an `AGENT_STATIC_URL` variable read from the environment. It replaces `__AGENT_STATIC_URL__` in the template strings, entirely decoupling the static asset delivery from the strict local port mapping.

---

### 7. `mcp-apps-component.ts` Line 190 - Complex Action Arguments
**Reviewer via gemini-code-assist:**
> ![medium]
> 
> The `#dispatchAgentAction` method currently only handles primitive types (`string`, `number`, `boolean`) for action parameters. If an action parameter is a complex object or an array, it will be skipped without an error. To make this more robust, you should consider handling these cases, for example by serializing complex values to a JSON string.

**Reply:**
> This is a great edge case to protect against. I've updated the dispatcher's type checking logic as you suggested. It now gracefully detects complex objects or arrays and stringifies them into a generic `literalString` payload using `JSON.stringify()`. This ensures the backend `context` resolver can still extract those arguments dynamically without the frontend silently dropping them.
