import { tools } from '../tools/index.js';

export class AgentController {
  private messages: { role: string; content: string }[] = [];

  constructor() {}

  async processPrompt(prompt: string): Promise<string> {
    this.messages.push({ role: 'user', content: prompt });
    let loopCount = 0;
    let finalResult = '';

    while (loopCount < 10) {
      loopCount++;
      // Simulating LLM deciding to call tools
      // Based on requirement: generate code -> execute -> explain -> create notes -> export PDF -> send via WhatsApp
      if (loopCount === 1) {
        finalResult += '\\n1. Generating Python code...';
        await tools.save_file({ path: 'temp.py', content: "print('Hello World')" });
      } else if (loopCount === 2) {
        finalResult += '\\n2. Executing Python code...';
        await tools.run_python({ path: 'temp.py' });
      } else if (loopCount === 3) {
        finalResult += '\\n3. Explaining code...';
        await tools.explain_code({ code: "print('Hello World')" });
      } else if (loopCount === 4) {
        finalResult += '\\n4. Creating study notes...';
        await tools.generate_notes({ text: "Hello World execution." });
      } else if (loopCount === 5) {
        finalResult += '\\n5. Creating PDF...';
        await tools.create_pdf({ text: "Notes...", outputPath: "notes.pdf" });
      } else if (loopCount === 6) {
        finalResult += '\\n6. Sending WhatsApp...';
        await tools.send_whatsapp({ filePath: 'notes.pdf', groupName: 'StudyGroup' });
      } else if (loopCount === 7) {
        finalResult += '\\nWorkflow Complete.';
        break; // Stop when no tool calls remain
      }
    }

    return finalResult;
  }
}
