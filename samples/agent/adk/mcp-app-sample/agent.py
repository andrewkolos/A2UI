import os
import json
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import uvicorn
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# Minimal HTML for the MCP app showing 2-way communication
# It uses the AppBridge to call a tool on the host.
MCP_APP_HTML = """
<!DOCTYPE html>
<html>
<head>
    <title>MCP Sample App</title>
    <style>
        body { font-family: sans-serif; padding: 10px; }
        button { padding: 8px 16px; background: #137fec; color: white; border: none; border-radius: 4px; cursor: pointer; }
        #status { margin-top: 10px; color: green; }
    </style>
</head>
<body>
    <h3>MCP Sandboxed App</h3>
    <div id="data">Initial Data: <span id="val">None</span></div>
    <br/>
    <button id="actionBtn">Call Agent Tool</button>
    <div id="status"></div>

    <script>
        let hostOrigin = '*';

        window.addEventListener('message', (event) => {
            // Capture the trusted host origin from the first incoming message
            if (hostOrigin === '*' && event.source === window.parent) {
                hostOrigin = event.origin;

                // MCP Handshake AFTER getting the origin securely
                window.parent.postMessage({
                    jsonrpc: "2.0",
                    id: Date.now(),
                    method: "ui/initialize",
                    params: {
                        appCapabilities: {},
                        clientInfo: { name: "Sample App", version: "1.0.0" },
                        protocolVersion: "2026-01-26"
                    }
                }, hostOrigin);
            }
            
            const data = event.data;
            // Handle updates from model context if needed
            if (data && data.method === 'ui/updateModelContext') {
                 if (data.params && data.params.text) {
                     document.getElementById('val').innerText = data.params.text.content || "Updated";
                 }
            }
        });

        document.getElementById('actionBtn').addEventListener('click', async () => {
            document.getElementById('status').innerText = "Calling tool...";
            window.parent.postMessage({
                jsonrpc: "2.0",
                id: Date.now(),
                method: "tools/call",
                params: {
                    name: "trigger_agent_action",
                    arguments: { foo: 'bar' }
                }
            }, hostOrigin);
        });
    </script>
</body>
</html>
"""

@app.post("/a2a")
async def handle_a2a(request: Request):
    body = await request.json()
    print("Received A2A request:", body)
    
    req_id = body.get("id")
    
    # Check if it's a request to load the app or an action
    params = body.get("params", {})
    message = params.get("message", {})
    parts = message.get("parts", [])
    
    req_text = ""
    user_action = {}
    
    if parts:
        part = parts[0]
        if part.get("kind") == "data":
            data = part.get("data", {})
            req_text = data.get("request", "")
            user_action = data.get("userAction", {})
            
    if req_text == "Load MCP App":
        # Return the surface with the McpApp component
        response_data = [
            {
                "beginRendering": {
                    "surfaceId": "mcp-surface",
                    "root": "mcp-app-root"
                }
            },
            {
                "surfaceUpdate": {
                    "surfaceId": "mcp-surface",
                    "components": [
                        {
                            "id": "mcp-app-root",
                            "component": {
                                "McpApp": {
                                    "resourceUri": "custom://mcp-sample-app",
                                    "htmlContent": MCP_APP_HTML,
                                    "allowedTools": ["trigger_agent_action"]
                                }
                            }
                        }
                    ]
                }
            }
        ]
        return JSONResponse(content={
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "kind": "task",
                "status": {
                    "message": {
                        "parts": response_data
                    }
                }
            }
        })
        
    elif user_action.get("name") == "trigger_agent_action":
        # Handle the tool call forwarded by the client
        context = user_action.get("context", {})
        print("Agent handling trigger_agent_action with context:", context)
        
        # Return a response that might update the UI or just confirm
        response_data = [
            {
                "beginRendering": {
                    "surfaceId": "mcp-response-surface",
                    "root": "mcp-response-root"
                }
            },
            {
                "surfaceUpdate": {
                    "surfaceId": "mcp-response-surface",
                    "components": [
                        {
                            "id": "mcp-response-root",
                            "component": {
                                "Text": {
                                    "text": {
                                        "literalString": "Agent processed action: " + json.dumps(context)
                                    }
                                }
                            }
                        }
                    ]
                }
            }
        ]
        print("Agent responding with:", {"jsonrpc": "2.0", "id": req_id, "result": "..."})
        return JSONResponse(content={
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "kind": "task",
                "status": {
                    "message": {
                        "parts": response_data
                    }
                }
            }
        })
        
    # Default fallback
    return JSONResponse(content={
        "jsonrpc": "2.0",
        "id": req_id,
        "result": {
            "kind": "task",
            "status": {
                "message": {
                    "parts": [{"kind": "text", "text": "I'm not sure how to handle that."}]
                }
            }
        }
    })

@app.get("/.well-known/agent-card.json")
async def handle_card():
    return {
        "url": "http://localhost:8000/a2a",
        "endpoint": "http://localhost:8000/a2a"
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
