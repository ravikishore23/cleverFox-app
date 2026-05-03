import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { tools } from '../tools/index.js';
export const mcpServer = new Server({
    name: 'CleverFox Tool Server',
    version: '1.0.0'
}, {
    capabilities: {
        tools: {}
    }
});
// Configure MCP endpoints (simplified initialization logic)
export async function initializeMcp() {
    mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: [
            { name: 'save_file', description: 'Save content to a file', inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } },
            { name: 'read_file', description: 'Read file', inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
            { name: 'run_python', description: 'Run python code', inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
            { name: 'open_vscode', description: 'Open VS Code', inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
            { name: 'explain_code', description: 'Explain code', inputSchema: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] } },
            { name: 'generate_notes', description: 'Generate Notes', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
            { name: 'create_pdf', description: 'Create PDF', inputSchema: { type: 'object', properties: { text: { type: 'string' }, outputPath: { type: 'string' } }, required: ['text', 'outputPath'] } },
            { name: 'send_whatsapp', description: 'Send via WA', inputSchema: { type: 'object', properties: { filePath: { type: 'string' }, groupName: { type: 'string' } }, required: ['filePath', 'groupName'] } }
        ]
    }));
    mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        try {
            if (name in tools) {
                const result = await tools[name](args);
                return { content: [{ type: 'text', text: String(result) }] };
            }
            throw new Error(`Tool ${name} not found`);
        }
        catch (err) {
            return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
        }
    });
    return mcpServer;
}
