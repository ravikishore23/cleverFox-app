import { agent } from "../localAgent.js";
import { makeProvider } from "../providers/index.js";
import path from "path";
import fs from "fs/promises";
import PDFDocument from "pdfkit";
import pdfParse from "pdf-parse";
import { NoteModel } from "../../models/Note.js";
import { ScheduleEventModel } from "../../models/ScheduleEvent.js";
import { TaskModel } from "../../models/Task.js";
import { connectMongo, isMongoConnected } from "../../db/mongo.js";
import { performWebSearch } from "../../utils/webSearch.js";
function getMimeTypeByExt(ext) {
    switch (ext.toLowerCase()) {
        case ".pdf":
            return "application/pdf";
        case ".md":
            return "text/markdown";
        case ".html":
            return "text/html";
        case ".json":
            return "application/json";
        case ".csv":
            return "text/csv";
        case ".txt":
        default:
            return "text/plain";
    }
}
async function writePdfFile(filePath, title, body) {
    await new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50, size: "A4" });
        const chunks = [];
        doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        doc.on("end", async () => {
            try {
                await fs.writeFile(filePath, Buffer.concat(chunks));
                resolve();
            }
            catch (err) {
                reject(err);
            }
        });
        doc.on("error", reject);
        doc.fontSize(18).text(title || "Generated Document", { underline: false });
        doc.moveDown(1);
        doc.fontSize(11).text(body || "(empty)", { align: "left" });
        doc.end();
    });
}
function detectRequestedFormat(text) {
    const lower = text.toLowerCase();
    // If the user seems to be negating the intent, bail out of the heuristic early
    if (/\b(?:don'?t|do not|no|stop|cancel|instead of)\b.*?\b(?:want|need|make|create|generate|pdf|csv|json|html|md|txt|text)\b/i.test(lower)) {
        return null;
    }
    if (/(\bmake\b|\bcreate\b|\bgenerate\b|\bexport\b|\bsave\b).*?(\bpdf\b|\.pdf\b)/i.test(lower))
        return "pdf";
    if (/(\bmake\b|\bcreate\b|\bgenerate\b|\bexport\b|\bsave\b).*?(\bcsv\b|\.csv\b)/i.test(lower))
        return "csv";
    if (/(\bmake\b|\bcreate\b|\bgenerate\b|\bexport\b|\bsave\b).*?(\bjson\b|\.json\b)/i.test(lower))
        return "json";
    if (/(\bmake\b|\bcreate\b|\bgenerate\b|\bexport\b|\bsave\b).*?(\bhtml\b|\.html\b)/i.test(lower))
        return "html";
    if (/(\bmake\b|\bcreate\b|\bgenerate\b|\bexport\b|\bsave\b).*?(\bmarkdown\b|\bmd\b|\.md\b)/i.test(lower))
        return "md";
    if (/(\bmake\b|\bcreate\b|\bgenerate\b|\bexport\b|\bsave\b).*?(\btext\b|\btxt\b|\.txt\b)/i.test(lower))
        return "txt";
    return null;
}
/* ------------------------------------------------------------------ */
/*  Known Apps                                                         */
/* ------------------------------------------------------------------ */
const KNOWN_APPS = {
    notepad: "notepad",
    "vs code": "code",
    vscode: "code",
    "visual studio code": "code",
    code: "code",
    explorer: "explorer",
    "file explorer": "explorer",
    "file manager": "explorer",
    chrome: "chrome",
    "google chrome": "chrome",
    firefox: "firefox",
    edge: "msedge",
    "microsoft edge": "msedge",
    brave: "brave",
    terminal: "wt",
    "windows terminal": "wt",
    cmd: "cmd",
    powershell: "powershell",
    calculator: "calc",
    calc: "calc",
    paint: "mspaint",
    snipping: "SnippingTool",
    "snipping tool": "SnippingTool",
    word: "winword",
    excel: "excel",
    powerpoint: "powerpnt",
    outlook: "outlook",
    teams: "ms-teams",
    discord: "discord",
    spotify: "spotify",
    vlc: "vlc",
    obs: "obs64",
    "task manager": "taskmgr",
    taskmgr: "taskmgr",
    settings: "ms-settings:",
    control: "control",
    "control panel": "control",
};
/* ------------------------------------------------------------------ */
/*  Code Config — extensions & runners for each language               */
/* ------------------------------------------------------------------ */
const CODE_EXTENSIONS = {
    python: "py",
    javascript: "js",
    typescript: "ts",
    java: "java",
    "c++": "cpp",
    "c#": "cs",
    c: "c",
    go: "go",
    rust: "rs",
    html: "html",
    css: "css",
    sql: "sql",
    bash: "sh",
    powershell: "ps1",
    ruby: "rb",
    php: "php",
    swift: "swift",
    kotlin: "kt",
    dart: "dart",
    lua: "lua",
    r: "r",
    scala: "scala",
};
const CODE_RUNNERS = {
    python: { cmd: "python", buildArgs: (f) => [f] },
    javascript: { cmd: "node", buildArgs: (f) => [f] },
    typescript: { cmd: "npx", buildArgs: (f) => ["tsx", f] },
    go: { cmd: "go", buildArgs: (f) => ["run", f] },
    ruby: { cmd: "ruby", buildArgs: (f) => [f] },
    php: { cmd: "php", buildArgs: (f) => [f] },
    bash: { cmd: "bash", buildArgs: (f) => [f] },
    powershell: { cmd: "powershell", buildArgs: (f) => ["-File", f] },
    r: { cmd: "Rscript", buildArgs: (f) => [f] },
};
/* Supported languages for regex matching */
const SUPPORTED_LANGS = [
    "python",
    "javascript",
    "typescript",
    "java",
    "c\\+\\+",
    "c#",
    "c",
    "go",
    "rust",
    "html",
    "css",
    "sql",
    "bash",
    "powershell",
    "ruby",
    "php",
    "swift",
    "kotlin",
    "dart",
    "lua",
    "r",
    "scala",
];
const LANGS_PATTERN = SUPPORTED_LANGS.join("|");
function detectIntent(text) {
    const lower = text.toLowerCase().trim();
    /* ── Code writing detection (comprehensive) ────────────────── */
    let writeCode = false;
    let codeLanguage = "";
    let codeTopic = "";
    // 1) "write/create/generate [lang] code/script/program for/to/that [topic]"
    const m1 = lower.match(new RegExp(`(?:write|create|generate|make|build|develop)\\s+(?:a\\s+)?(?:some\\s+)?(?:the\\s+)?(${LANGS_PATTERN})\\s+(?:code|script|program|function|class|module|app|application|file|project)\\s+(?:for|to|that|which)\\s+(.+?)$`, "i"));
    if (m1) {
        writeCode = true;
        codeLanguage = m1[1];
        codeTopic = m1[2].trim();
    }
    // 2) "write code/script for [topic]" (no language → default python)
    if (!writeCode) {
        const m2 = lower.match(/(?:write|create|generate|make|build|develop)\s+(?:a\s+)?(?:some\s+)?(?:the\s+)?(?:code|script|program|function|app)\s+(?:for|to|that|which)\s+(.+?)$/i);
        if (m2) {
            writeCode = true;
            codeLanguage = "python";
            codeTopic = m2[1].trim();
        }
    }
    // 3) "write a function/class/api/server that [topic]"
    if (!writeCode) {
        const m3 = lower.match(/(?:write|create|generate|make|build)\s+(?:a\s+)?(?:some\s+)?(function|class|module|api|server|website|webpage|component|library|tool|utility|helper)\s+(?:for|to|that|which|called|named)\s+(.+?)$/i);
        if (m3) {
            writeCode = true;
            codeLanguage = "python";
            codeTopic = `a ${m3[1]} that ${m3[2].trim()}`;
        }
    }
    // 4) "code a [topic]" / "code for [topic]" / "code me [topic]"
    if (!writeCode) {
        const m4 = lower.match(/^code\s+(?:a\s+|for\s+|me\s+)?(.+?)$/i);
        if (m4) {
            writeCode = true;
            codeLanguage = "python";
            codeTopic = m4[1].trim();
        }
    }
    // 5) "[lang] code/script for [topic]" (no verb)
    if (!writeCode) {
        const m5 = lower.match(new RegExp(`^(${LANGS_PATTERN})\\s+(?:code|script|program)\\s+(?:for|to|that)\\s+(.+?)$`, "i"));
        if (m5) {
            writeCode = true;
            codeLanguage = m5[1];
            codeTopic = m5[2].trim();
        }
    }
    // 6) "open vscode and write code for [topic]"
    if (!writeCode) {
        const m6 = lower.match(/(?:open|launch)\s+(?:vscode|vs\s+code|code)\s+(?:and\s+)?(?:write|create|generate)\s+(?:a\s+)?(?:some\s+)?(.+?)$/i);
        if (m6) {
            writeCode = true;
            const rest = m6[1];
            const langHit = rest.match(new RegExp(`(${LANGS_PATTERN})`, "i"));
            codeLanguage = langHit ? langHit[1] : "python";
            codeTopic =
                rest
                    .replace(new RegExp(`(${LANGS_PATTERN})\\s*(?:code|script|program)?\\s*(?:for|to|that)?\\s*`, "i"), "")
                    .trim() || rest;
        }
    }
    // 7) "help me code [topic]" / "can you code [topic]"
    if (!writeCode) {
        const m7 = lower.match(/(?:help\s+me\s+|can\s+you\s+|please\s+)?(?:code|program|develop)\s+(?:a\s+|an\s+|the\s+)?(.+?)$/i);
        if (m7 && m7[1].length > 5) {
            writeCode = true;
            codeLanguage = "python";
            codeTopic = m7[1].trim();
        }
    }
    // Normalize codeLanguage
    if (writeCode) {
        codeLanguage = codeLanguage
            .replace(/\\\+/g, "+")
            .replace(/\\#/g, "#")
            .toLowerCase();
        if (!codeLanguage) {
            const langHit = lower.match(new RegExp(`(${LANGS_PATTERN})`, "i"));
            codeLanguage = langHit
                ? langHit[1].replace(/\\\+/g, "+").replace(/\\#/g, "#").toLowerCase()
                : "python";
        }
    }
    /* ── Obsidian / file save ──────────────────────────────────── */
    const saveToFile = /(?:save|put|write|store|create)\s+(?:it\s+)?(?:to|into|in|on)\s+(?:obsidian|file|note)/i.test(lower) ||
        (/obsidian/i.test(lower) &&
            /(?:save|put|write|store|create|generate|make)/i.test(lower));
    /* ── Read file ─────────────────────────────────────────────── */
    const readFile = /(?:read|show|display|cat)\s+(?:the\s+)?(?:file|content)/i.test(lower);
    /* ── List directory ────────────────────────────────────────── */
    const listDir = /(?:list|show|display|ls|dir)\s+(?:the\s+)?(?:files|directory|folder|dir)/i.test(lower);
    /* ── Run command ───────────────────────────────────────────── */
    const runCommand = /(?:run|execute)\s+(?:the\s+)?(?:command|cmd)/i.test(lower) ||
        /(?:in\s+)?(?:terminal|cmd|shell)\s+(?:run|execute)/i.test(lower);
    /* ── Browser search ────────────────────────────────────────── */
    let browserSearch = false;
    let searchQuery = "";
    let browserName = "chrome";
    const searchMatch = lower.match(/(?:search|google|find|look\s+up|look\s+for)\s+(?:for\s+)?(.+?)\s+(?:in|on|using)\s+(chrome|brave|firefox|edge)/i);
    if (searchMatch) {
        browserSearch = true;
        searchQuery = searchMatch[1].trim();
        browserName = searchMatch[2].toLowerCase();
    }
    if (!browserSearch) {
        const simple = lower.match(/^(?:search|google|find|look\s+up)\s+(?:for\s+)?(.+?)$/i);
        if (simple && !simple[1].includes("in") && !simple[1].includes("on")) {
            browserSearch = true;
            searchQuery = simple[1].trim();
        }
    }
    /* ── Open app / file / folder ──────────────────────────────── */
    let openApp = false;
    let openTarget = "";
    let openLabel = "";
    if (!browserSearch && !writeCode) {
        const openMatch = lower.match(/(?:open|launch|start|run)\s+(?:the\s+)?(?:app\s+|application\s+)?(.+)$/i);
        if (openMatch) {
            const rawTarget = openMatch[1].trim().replace(/[.!?]+$/, "");
            // 1. Check known apps map
            for (const [name, cmd] of Object.entries(KNOWN_APPS)) {
                if (rawTarget === name || rawTarget.includes(name)) {
                    openApp = true;
                    openTarget = cmd;
                    openLabel = name.charAt(0).toUpperCase() + name.slice(1);
                    break;
                }
            }
            // 2. File path
            if (!openApp && /^[a-z]:\\|^\\\\|^\/|\.\//i.test(rawTarget)) {
                openApp = true;
                openTarget = rawTarget;
                openLabel = rawTarget;
            }
            // 3. Well-known folders
            if (!openApp) {
                const wellKnownFolders = {
                    documents: "%USERPROFILE%\\Documents",
                    "my documents": "%USERPROFILE%\\Documents",
                    downloads: "%USERPROFILE%\\Downloads",
                    desktop: "%USERPROFILE%\\Desktop",
                    pictures: "%USERPROFILE%\\Pictures",
                    music: "%USERPROFILE%\\Music",
                    videos: "%USERPROFILE%\\Videos",
                };
                for (const [name, folderPath] of Object.entries(wellKnownFolders)) {
                    if (rawTarget === name || rawTarget.includes(name)) {
                        openApp = true;
                        openTarget = folderPath;
                        openLabel = `${name.charAt(0).toUpperCase() + name.slice(1)} folder`;
                        break;
                    }
                }
            }
        }
    }
    /* ── Extract path, topic, command ──────────────────────────── */
    let targetPath = "";
    const pathMatch = text.match(/(?:in|to|at|from|path)\s+[`"']?([A-Za-z]:\\[^\s`"']+|\/[^\s`"']+)[`"']?/i);
    if (pathMatch)
        targetPath = pathMatch[1];
    // Resolve well-known OS folder names to absolute paths
    if (!targetPath && process.env.USERPROFILE) {
        const home = process.env.USERPROFILE;
        const wellKnownPaths = {
            desktop: `${home}\\Desktop`,
            "my desktop": `${home}\\Desktop`,
            downloads: `${home}\\Downloads`,
            "my downloads": `${home}\\Downloads`,
            documents: `${home}\\Documents`,
            "my documents": `${home}\\Documents`,
            pictures: `${home}\\Pictures`,
            "my pictures": `${home}\\Pictures`,
            music: `${home}\\Music`,
            videos: `${home}\\Videos`,
            "home folder": home,
            "home directory": home,
            "user folder": home,
            "c drive": "C:\\",
            "d drive": "D:\\",
        };
        for (const [name, folderPath] of Object.entries(wellKnownPaths)) {
            if (lower.includes(name)) {
                targetPath = folderPath;
                break;
            }
        }
    }
    let topic = text;
    const stripPhrases = [
        /(?:and\s+)?(?:save|put|write|store)\s+(?:it\s+)?(?:to|into|in|on)\s+(?:obsidian|a?\s*file)/gi,
        /(?:generate|create|write|make)\s+(?:a\s+)?(?:note|guide|instructions?|tutorial|document)\s+(?:about|on|for|of)\s*/gi,
        /(?:generate|create|write|make)\s+/gi,
    ];
    for (const phrase of stripPhrases) {
        topic = topic.replace(phrase, "").trim();
    }
    if (!topic)
        topic = text;
    let command = "";
    const cmdMatch = text.match(/(?:run|execute)\s+(?:command\s+)?[`"']?(.+?)[`"']?\s*$/i);
    if (cmdMatch)
        command = cmdMatch[1].trim();
    return {
        writeCode,
        codeLanguage,
        codeTopic,
        saveToFile,
        readFile,
        listDir,
        openApp,
        openTarget,
        openLabel,
        browserSearch,
        searchQuery,
        browserName,
        runCommand,
        targetPath,
        topic,
        command,
    };
}
/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function topicToFilename(topic) {
    return (topic
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .trim()
        .replace(/\s+/g, "_")
        .slice(0, 50) || "code");
}
/* ------------------------------------------------------------------ */
/*  Phase 1: Propose — analyse workspace, generate code, build plan   */
/* ------------------------------------------------------------------ */
export async function proposeActions(userMessages, vaultPath, codeWorkspace) {
    const provider = makeProvider(process.env);
    const lastUserMsg = [...userMessages]
        .reverse()
        .find((m) => m.role === "user");
    const userText = lastUserMsg?.content || "";
    const intent = detectIntent(userText);
    const requestedFileFormat = detectRequestedFormat(userText);
    const actions = [];
    let generatedContent = "";
    let analysis;
    const lowerUserText = userText.toLowerCase();
    const wantsListNotes = /\b(list|show|display|available|all)\b.*\bnotes?\b/i.test(userText) ||
        /\bnotes?\b.*\b(list|show|display|available)\b/i.test(userText);
    let requestedNoteQuery = "";
    const openNoteMatch = userText.match(/(?:open|read|show)\s+(?:the\s+)?(?:note\s+)?["“]?([^"”]+?)["”]?\s*$/i);
    if (openNoteMatch?.[1]) {
        requestedNoteQuery = openNoteMatch[1].trim();
    }
    else if (/\bnote\b/i.test(userText) &&
        /\b(open|read|show)\b/i.test(userText)) {
        requestedNoteQuery = userText
            .replace(/\b(open|read|show)\b/gi, "")
            .replace(/\b(the|note)\b/gi, "")
            .trim();
    }
    const wantsListTasks = /\b(list|show|display|all)\b.*\btasks?\b/i.test(userText) ||
        /\btasks?\b.*\b(list|show|display)\b/i.test(userText);
    const addTaskMatch = userText.match(/(?:add|create|make)\s+(?:a\s+)?task\s*:?\s*(.+)$/i);
    const taskTitleFromPrompt = addTaskMatch?.[1]?.trim() || "";
    const wantsListSchedule = /\b(list|show|display)\b.*\b(schedule|events?|calendar)\b/i.test(userText) ||
        /\b(schedule|events?|calendar)\b.*\b(list|show|display)\b/i.test(userText);
    /* ── Code Generation ──────────────────────────────────────── */
    if (intent.writeCode && intent.codeTopic) {
        // 1 — Determine target directory
        const targetDir = intent.targetPath ||
            codeWorkspace ||
            (process.env.USERPROFILE
                ? path.join(process.env.USERPROFILE, "Documents", "CleverFox_Code")
                : path.resolve(process.cwd(), "backend", "agent_workspace"));
        // 2 — Analyse the target folder
        analysis = await agent.analyzeFolder(targetDir);
        // 3 — Build folder context for smarter generation
        let folderContext = "";
        if (analysis.exists && analysis.totalFiles > 0) {
            const fileList = analysis.items
                .slice(0, 20)
                .map((i) => `${i.isDirectory ? "📁" : "📄"} ${i.name}`)
                .join("\n");
            folderContext = `\n\nTarget directory "${path.basename(targetDir)}" already contains:\n${fileList}\n\nAvoid naming conflicts with existing files.`;
        }
        else {
            folderContext = `\n\nTarget directory "${path.basename(targetDir)}" is empty or will be created fresh.`;
        }
        // 4 — Generate code via LLM
        const codePrompt = [
            {
                role: "system",
                content: `You are an expert ${intent.codeLanguage} programmer. Write ONLY the raw ${intent.codeLanguage} source code for the user's request.

Rules:
- Do NOT wrap code in markdown code fences (\`\`\`).
- Include proper imports / requires at the top.
- Add clear, concise comments.
- Include basic error handling where appropriate.
- The code must be immediately runnable without modification.
- If the code needs user input, use sensible default values so it runs standalone.${folderContext}`,
            },
            {
                role: "user",
                content: `Write ${intent.codeLanguage} code for: ${intent.codeTopic}`,
            },
        ];
        const out = await provider.chat({ messages: codePrompt });
        let codeContent = out.outputText;
        // Strip markdown fences the LLM might have added anyway
        const fenceRe = /^```[\w]*\n?([\s\S]*?)```\s*$/;
        const fenceMatch = codeContent.match(fenceRe);
        if (fenceMatch)
            codeContent = fenceMatch[1];
        const ext = CODE_EXTENSIONS[intent.codeLanguage] || "txt";
        const filename = topicToFilename(intent.codeTopic) + "." + ext;
        const filePath = path.join(targetDir, filename);
        // Propose: create directory if needed
        if (!analysis.exists) {
            actions.push({
                id: generateId(),
                tool: "create_directory",
                description: `Create workspace folder: ${path.basename(targetDir)}`,
                path: targetDir,
            });
        }
        // Propose: write the code file
        actions.push({
            id: generateId(),
            tool: "write_file",
            description: `Save "${filename}" → ${targetDir}`,
            path: filePath,
            content: codeContent,
        });
        // Propose: open in editor
        actions.push({
            id: generateId(),
            tool: "open_app",
            description: `Open "${filename}" in VS Code`,
            path: filePath,
        });
        // Propose: run the code (if a runner exists for this language)
        const runner = CODE_RUNNERS[intent.codeLanguage];
        if (runner) {
            actions.push({
                id: generateId(),
                tool: "run_command",
                description: `Run: ${runner.cmd} ${filename}`,
                command: runner.cmd,
                args: runner.buildArgs(filePath),
                cwd: targetDir,
            });
        }
        // Build response text
        generatedContent = `I've analysed your workspace and generated **${intent.codeLanguage}** code for **"${intent.codeTopic}"**.\n\n`;
        if (analysis.exists && analysis.totalFiles > 0) {
            generatedContent += `📂 **Workspace:** ${analysis.summary}\n\n`;
        }
        else {
            generatedContent += `📂 A new workspace folder will be created at \`${targetDir}\`.\n\n`;
        }
        generatedContent +=
            "Please review and approve the actions below to **save**, **open**, and **run** your code.";
    }
    /* ── Save to File / Obsidian ────────────────────────────────── */
    if (intent.saveToFile) {
        const targetDir = intent.targetPath || vaultPath || "";
        if (targetDir) {
            analysis = analysis || (await agent.analyzeFolder(targetDir));
            const contentPrompt = [
                {
                    role: "system",
                    content: "You are CleverFox, a study assistant. Generate well-structured Markdown content.\nUse proper headings (##, ###), bullet points, and organized sections.\nDo NOT mention saving, Obsidian, or file operations.",
                },
                {
                    role: "user",
                    content: `Write detailed Markdown content about: ${intent.topic}`,
                },
            ];
            const out = await provider.chat({ messages: contentPrompt });
            generatedContent = out.outputText;
            const filename = topicToFilename(intent.topic) + ".md";
            const filePath = path.join(targetDir, filename);
            let fileContent = generatedContent;
            if (!fileContent.trim().startsWith("#")) {
                fileContent = `# ${intent.topic}\n\n${fileContent}`;
            }
            if (!analysis.exists) {
                actions.push({
                    id: generateId(),
                    tool: "create_directory",
                    description: `Create folder: ${path.basename(targetDir)}`,
                    path: targetDir,
                });
            }
            actions.push({
                id: generateId(),
                tool: "write_file",
                description: `Save "${filename}" to ${path.basename(targetDir)}/`,
                path: filePath,
                content: fileContent,
            });
        }
        else {
            generatedContent +=
                "\n\n⚠️ No Obsidian vault path configured. Set `OBSIDIAN_VAULT_PATH` in `backend/.env`.";
        }
    }
    /* ── Read file ──────────────────────────────────────────────── */
    if (intent.readFile && intent.targetPath) {
        actions.push({
            id: generateId(),
            tool: "read_file",
            description: `Read file: ${intent.targetPath}`,
            path: intent.targetPath,
        });
    }
    /* ── List directory ─────────────────────────────────────────── */
    if (intent.listDir && intent.targetPath) {
        actions.push({
            id: generateId(),
            tool: "list_directory",
            description: `List files in: ${intent.targetPath}`,
            path: intent.targetPath,
        });
    }
    /* ── Open app ───────────────────────────────────────────────── */
    if (intent.openApp && intent.openTarget) {
        actions.push({
            id: generateId(),
            tool: "open_app",
            description: `Open ${intent.openLabel}`,
            path: intent.openTarget,
        });
    }
    /* ── Browser search ─────────────────────────────────────────── */
    if (intent.browserSearch && intent.searchQuery) {
        actions.push({
            id: generateId(),
            tool: "browser_search",
            description: `Search "${intent.searchQuery}" in ${intent.browserName}`,
            searchQuery: intent.searchQuery,
            browserName: intent.browserName,
        });
    }
    /* ── Run command ────────────────────────────────────────────── */
    if (intent.runCommand && intent.command) {
        const parts = intent.command.split(/\s+/);
        actions.push({
            id: generateId(),
            tool: "run_command",
            description: `Run command: ${intent.command}`,
            command: parts[0],
            args: parts.slice(1),
        });
    }
    /* ── Notes intents ─────────────────────────────────────────── */
    if (wantsListNotes) {
        actions.push({
            id: generateId(),
            tool: "list_notes",
            description: "Get list of available notes",
        });
    }
    if (requestedNoteQuery) {
        actions.push({
            id: generateId(),
            tool: "read_note",
            description: `Open note: ${requestedNoteQuery}`,
            noteQuery: requestedNoteQuery,
        });
    }
    if (wantsListTasks) {
        actions.push({
            id: generateId(),
            tool: "list_tasks",
            description: "Get list of tasks",
        });
    }
    if (taskTitleFromPrompt) {
        actions.push({
            id: generateId(),
            tool: "create_task",
            description: `Add task: ${taskTitleFromPrompt}`,
            taskTitle: taskTitleFromPrompt,
        });
    }
    if (wantsListSchedule) {
        actions.push({
            id: generateId(),
            tool: "list_schedule_events",
            description: "Get upcoming schedule events",
        });
    }
    /* ── Fallback: AI OS Planner ─────────────────────────────────── */
    if (actions.length === 0 && !generatedContent && requestedFileFormat) {
        const defaultOutputDir = codeWorkspace ||
            (process.env.USERPROFILE
                ? path.join(process.env.USERPROFILE, "Downloads")
                : path.resolve(process.cwd(), "backend", "agent_workspace"));
        const fileTopic = intent.topic && intent.topic !== userText ? intent.topic : userText;
        const fileBaseName = topicToFilename(fileTopic || "generated_document");
        const ext = requestedFileFormat;
        const fileName = `${fileBaseName}.${ext}`;
        const contentPrompt = [
            {
                role: "system",
                content: `You create polished, complete document content for export.
Return ONLY the raw content text (no markdown code fences).
Include a clear title and section headings when relevant.
If the user asks for tabular data and format is CSV, return valid CSV content.
If the user asks for JSON, return valid JSON.`,
            },
            {
                role: "user",
                content: `Create content for a ${requestedFileFormat.toUpperCase()} file based on this request: ${userText}`,
            },
        ];
        const out = await provider.chat({ messages: contentPrompt });
        const generatedFileContent = out.outputText.trim();
        actions.push({
            id: generateId(),
            tool: "generate_file",
            description: `Generate ${requestedFileFormat.toUpperCase()} file "${fileName}"`,
            fileFormat: requestedFileFormat,
            fileName,
            fileContent: generatedFileContent,
            outputDir: defaultOutputDir,
        });
        generatedContent = `I prepared a ${requestedFileFormat.toUpperCase()} document request. Approve the action below to generate the file, then you’ll get a direct download option in chat.`;
    }
    /* ── Fallback: AI OS Planner ─────────────────────────────────── */
    if (actions.length === 0 && !generatedContent) {
        const plannerPrompt = [
            {
                role: "system",
                content: `You are Fox Agent, an AI operating system assistant running locally on the user's computer. 
Current OS: Windows.
Home Directory: ${process.env.USERPROFILE ? process.env.USERPROFILE.replace(/\\/g, "/") : "C:/Users/Default"}
Current Directory: ${process.cwd().replace(/\\/g, "/")}

You have full access to the file system, network, and terminal. Provide your response as a JSON object containing actions you wish to take.

AVAILABLE TOOLS:
- "list_directory": { "path": string }
- "read_file": { "path": string }
- "write_file": { "path": string, "content": string }
- "run_command": { "command": string, "args": string[], "cwd": string }
- "open_app": { "path": string }
- "browser_search": { "searchQuery": string, "browserName": "chrome"|"edge"|... }
- "create_note": { "noteTitle": string, "noteContent": string }
- "list_notes": {}
- "read_note": { "noteQuery": string }
- "create_task": { "taskTitle": string, "taskDescription"?: string, "taskDueAt"?: string }
- "list_tasks": {}
- "schedule_event": { "eventTitle": string, "eventDate": string, "eventTime": string, "eventDescription": string }
- "list_schedule_events": {}
- "schedule_event": { "eventTitle": string, "eventDate": string, "eventTime": string, "eventDescription": string }
- "generate_file": { "fileFormat": "pdf"|"txt"|"md"|"html"|"json"|"csv", "fileName": string, "fileContent": string, "outputDir": string }

OUTPUT FORMAT:
Return ONLY a valid JSON object matching this schema, with NO markdown formatting (do not wrap in \`\`\`json):
{
  "response": "A message explaining what you are about to do, formatted elegantly in Markdown",
  "actions": [
    {
      "tool": "list_directory",
      "description": "Short description of action",
      "path": "C:/Users/...",
      "command": "npm",
      "args": ["start"],
      "cwd": "C:/..."
    }
  ]
}`,
            },
            ...userMessages,
        ];
        try {
            const out = await provider.chat({ messages: plannerPrompt });
            let rawJson = out.outputText.trim();
            rawJson = rawJson
                .replace(/^```json\n?/i, "")
                .replace(/```$/i, "")
                .trim();
            const plan = JSON.parse(rawJson);
            return {
                response: plan.response || "Here are the actions I'd like to perform:",
                actions: (plan.actions || []).map((a) => ({
                    ...a,
                    id: generateId(),
                })),
            };
        }
        catch (e) {
            // If parsing fails or the LLM didn't return JSON, fallback to standard response
            const out = await provider.chat({
                messages: [
                    {
                        role: "system",
                        content: "You are Fox Agent, an AI operating system assistant. You have full OS access. Provide a helpful response. Always format your responses elegantly in Markdown.",
                    },
                    ...userMessages,
                ],
            });
            return { response: out.outputText, actions: [] };
        }
    }
    return {
        response: generatedContent || "Here are the actions I'd like to perform:",
        analysis,
        actions,
    };
}
/* ------------------------------------------------------------------ */
/*  Phase 2: Execute — run user-approved actions                       */
/* ------------------------------------------------------------------ */
export async function executeActions(actions) {
    const results = [];
    async function ensureDb() {
        await connectMongo();
        if (!isMongoConnected()) {
            throw new Error("Database is unavailable right now. Please check MongoDB connection and try again.");
        }
    }
    for (const action of actions) {
        try {
            let result = "";
            switch (action.tool) {
                case "create_directory": {
                    if (!action.path)
                        throw new Error("create_directory requires path");
                    await agent.createDirectory(action.path);
                    result = `✅ Directory created: ${action.path}`;
                    break;
                }
                case "write_file": {
                    if (!action.path || action.content === undefined)
                        throw new Error("write_file requires path and content");
                    await agent.writeFile(action.path, action.content, true);
                    result = `✅ File saved: ${action.path}`;
                    break;
                }
                case "read_file": {
                    if (!action.path)
                        throw new Error("read_file requires path");
                    const content = await agent.readFile(action.path, true);
                    result =
                        content.length > 3000
                            ? content.slice(0, 3000) + "\n...(truncated)"
                            : content;
                    break;
                }
                case "list_directory": {
                    if (!action.path)
                        throw new Error("list_directory requires path");
                    const items = await agent.listDir(action.path, true);
                    result = items
                        .map((i) => `${i.isDirectory ? "📁" : "📄"} ${i.name}`)
                        .join("\n");
                    break;
                }
                case "open_app": {
                    if (!action.path)
                        throw new Error("open_app requires path");
                    result = await agent.openApp(action.path);
                    break;
                }
                case "browser_search": {
                    if (!action.searchQuery)
                        throw new Error("browser_search requires searchQuery");
                    const webResults = await performWebSearch(action.searchQuery);
                    if (webResults.length === 0) {
                        result = `No web results found for: ${action.searchQuery}`;
                    }
                    else {
                        result = webResults
                            .map((r, index) => `${index + 1}. ${r.title}\n${r.link}\n${r.snippet}`)
                            .join("\n\n");
                    }
                    break;
                }
                case "create_note": {
                    await ensureDb();
                    if (!action.noteTitle || !action.noteContent) {
                        throw new Error("create_note requires noteTitle and noteContent");
                    }
                    const note = await NoteModel.create({
                        title: action.noteTitle,
                        tags: ["ai-generated"],
                        content: action.noteContent,
                        pinned: false,
                        favorite: false,
                    });
                    result = `✅ Note was saved: ${note.title}`;
                    break;
                }
                case "list_notes": {
                    await ensureDb();
                    const notes = await NoteModel.find().lean().limit(10);
                    if (notes.length === 0) {
                        result = "No notes found in the database.";
                    }
                    else {
                        result = notes.map((n) => `- ${n.title}`).join("\n");
                    }
                    break;
                }
                case "read_note": {
                    await ensureDb();
                    const query = String(action.noteQuery || "").trim();
                    if (!query) {
                        throw new Error("read_note requires noteQuery");
                    }
                    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                    let note = await NoteModel.findOne({
                        title: { $regex: new RegExp(`^${escaped}$`, "i") },
                    }).lean();
                    if (!note) {
                        note = await NoteModel.findOne({
                            title: { $regex: new RegExp(escaped, "i") },
                        }).lean();
                    }
                    if (!note) {
                        result = `No note found matching \"${query}\".`;
                    }
                    else {
                        const content = String(note.content || "").trim();
                        const limitedContent = content.length > 6000
                            ? `${content.slice(0, 6000)}\n...(truncated)`
                            : content;
                        result = `# ${note.title}\n\n${limitedContent || "(empty note)"}`;
                    }
                    break;
                }
                case "create_task": {
                    await ensureDb();
                    const title = String(action.taskTitle || "").trim();
                    if (!title)
                        throw new Error("create_task requires taskTitle");
                    const dueAtRaw = String(action.taskDueAt || "").trim();
                    let dueAt;
                    if (dueAtRaw) {
                        const d = new Date(dueAtRaw);
                        if (!Number.isFinite(d.getTime())) {
                            throw new Error("Invalid taskDueAt date format");
                        }
                        dueAt = d;
                    }
                    const task = await TaskModel.create({
                        title,
                        description: action.taskDescription || null,
                        dueAt,
                    });
                    result = `✅ Task added: ${task.title}`;
                    break;
                }
                case "list_tasks": {
                    await ensureDb();
                    const tasks = await TaskModel.find()
                        .sort({ createdAt: -1 })
                        .limit(20)
                        .lean();
                    if (tasks.length === 0) {
                        result = "No tasks found.";
                    }
                    else {
                        result = tasks
                            .map((t) => {
                            const due = t.dueAt
                                ? ` — due ${new Date(t.dueAt).toLocaleString()}`
                                : "";
                            return `- ${t.title} (${t.status})${due}`;
                        })
                            .join("\n");
                    }
                    break;
                }
                case "schedule_event": {
                    await ensureDb();
                    if (!action.eventTitle || !action.eventDate || !action.eventTime) {
                        throw new Error("schedule_event requires eventTitle, eventDate, and eventTime (YYYY-MM-DD and HH:MM formats)");
                    }
                    const startAt = new Date(`${action.eventDate}T${action.eventTime}:00`);
                    const endAt = new Date(startAt.getTime() + 60 * 60 * 1000); // 1 hour by default
                    const ev = await ScheduleEventModel.create({
                        title: action.eventTitle,
                        description: action.eventDescription || "",
                        allDay: false,
                        startAt,
                        endAt,
                    });
                    result = `✅ Event scheduled successfully: ${ev._id} at ${startAt.toLocaleString()}`;
                    break;
                }
                case "list_schedule_events": {
                    await ensureDb();
                    const now = new Date();
                    const events = await ScheduleEventModel.find({
                        startAt: { $gte: now },
                    })
                        .sort({ startAt: 1 })
                        .limit(20)
                        .lean();
                    if (events.length === 0) {
                        result = "No upcoming schedule events found.";
                    }
                    else {
                        result = events
                            .map((e) => `- ${e.title} — ${new Date(e.startAt).toLocaleString()}${e.location ? ` @ ${e.location}` : ""}`)
                            .join("\n");
                    }
                    break;
                }
                case "generate_file": {
                    if (!action.fileFormat || !action.fileName) {
                        throw new Error("generate_file requires fileFormat and fileName");
                    }
                    const outputDir = action.outputDir || process.cwd();
                    await fs.mkdir(outputDir, { recursive: true });
                    const normalizedExt = action.fileFormat.startsWith(".")
                        ? action.fileFormat
                        : `.${action.fileFormat}`;
                    const safeName = action.fileName.endsWith(normalizedExt)
                        ? action.fileName
                        : `${action.fileName}${normalizedExt}`;
                    const targetPath = path.join(outputDir, safeName);
                    const content = action.fileContent || "";
                    if (normalizedExt.toLowerCase() === ".pdf") {
                        await writePdfFile(targetPath, path.parse(safeName).name, content);
                    }
                    else {
                        await fs.writeFile(targetPath, content, "utf-8");
                    }
                    const stat = await fs.stat(targetPath);
                    const mimeType = getMimeTypeByExt(normalizedExt);
                    result = `✅ File generated: ${targetPath}`;
                    results.push({
                        id: action.id,
                        tool: action.tool,
                        success: true,
                        result,
                        generatedFile: {
                            name: safeName,
                            path: targetPath,
                            mimeType,
                            size: stat.size,
                        },
                    });
                    continue;
                }
                case "run_command": {
                    if (!action.command)
                        throw new Error("run_command requires command");
                    if (action.command.toLowerCase() === "pdftotext") {
                        const args = action.args || [];
                        if (args.length < 1) {
                            throw new Error("pdftotext requires an input PDF path");
                        }
                        const inputArg = args[0];
                        const outputArg = args[1];
                        const baseDir = action.cwd || process.cwd();
                        const inputPath = path.isAbsolute(inputArg)
                            ? inputArg
                            : path.resolve(baseDir, inputArg);
                        const pdfBuffer = await fs.readFile(inputPath);
                        const parsed = await pdfParse(pdfBuffer);
                        const extractedText = String(parsed.text || "").trim();
                        if (outputArg && outputArg !== "-") {
                            const outputPath = path.isAbsolute(outputArg)
                                ? outputArg
                                : path.resolve(baseDir, outputArg);
                            await fs.writeFile(outputPath, extractedText, "utf8");
                            result = `✅ Extracted PDF text to: ${outputPath}`;
                        }
                        else {
                            result = extractedText
                                ? extractedText.length > 8000
                                    ? `${extractedText.slice(0, 8000)}\n...(truncated)`
                                    : extractedText
                                : "No readable text was found in this PDF.";
                        }
                        break;
                    }
                    const r = agent.runCommand(action.command, action.args || [], {
                        cwd: action.cwd,
                    });
                    const output = await new Promise((resolve) => {
                        let stdout = "";
                        let stderr = "";
                        r.emitter.on("stdout", (chunk) => {
                            stdout += chunk;
                        });
                        r.emitter.on("stderr", (chunk) => {
                            stderr += chunk;
                        });
                        r.emitter.on("exit", (info) => {
                            resolve((stdout || "(no output)") +
                                (stderr ? `\n\nSTDERR:\n${stderr}` : "") +
                                `\n\nExit code: ${info?.code ?? "unknown"}`);
                        });
                    });
                    result = output;
                    break;
                }
                default:
                    result = `Unknown tool: ${action.tool}`;
            }
            results.push({
                id: action.id,
                tool: action.tool,
                success: true,
                result,
            });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            results.push({
                id: action.id,
                tool: action.tool,
                success: false,
                result: `❌ Error: ${msg}`,
            });
        }
    }
    return results;
}
