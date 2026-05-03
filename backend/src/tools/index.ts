import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import PDFDocument from 'pdfkit';

const execAsync = promisify(exec);

export const tools = {
  save_file: async (args: { path: string; content: string }) => {
    await fs.writeFile(args.path, args.content, 'utf8');
    return `File saved successfully to ${args.path}.`;
  },
  read_file: async (args: { path: string }) => {
    return await fs.readFile(args.path, 'utf8');
  },
  run_python: async (args: { path: string }) => {
    const { stdout, stderr } = await execAsync(`python "${args.path}"`);
    return stdout || stderr;
  },
  open_vscode: async (args: { path: string }) => {
    await execAsync(`code "${args.path}"`);
    return `Opened VS Code at ${args.path}`;
  },
  explain_code: async (args: { code: string }) => {
    return `Explanation: This code executes sequentially. (Simulated AI explanation for code: ${args.code.slice(0, 50)}...)`;
  },
  generate_notes: async (args: { text: string }) => {
    return `# Study Notes\n\n- Simulated auto-generated notes from text: ${args.text.slice(0, 50)}...`;
  },
  create_pdf: async (args: { text: string; outputPath: string }) => {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument();
      const stream = doc.pipe(require('fs').createWriteStream(args.outputPath));
      doc.text(args.text);
      doc.end();
      stream.on('finish', () => resolve(`PDF generated at ${args.outputPath}`));
      stream.on('error', reject);
    });
  },
  send_whatsapp: async (args: { filePath: string; groupName: string }) => {
    return `Simulated WhatsApp send of ${args.filePath} to ${args.groupName}.`;
  }
};
