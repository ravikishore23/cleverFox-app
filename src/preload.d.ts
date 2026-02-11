export {};

declare global {
  interface Window {
    cleverfox: {
      ping: () => Promise<string>;
      pickDirectory: () => Promise<string | null>;
      mkdirp: (
        dirPath: string,
      ) => Promise<{ ok: true } | { ok: false; error: string }>;
      readTextFile: (
        filePath: string,
      ) => Promise<{ ok: true; data: string } | { ok: false; error: string }>;
      writeTextFile: (
        filePath: string,
        content: string,
      ) => Promise<{ ok: true } | { ok: false; error: string }>;
      openPath: (
        targetPath: string,
      ) => Promise<{ ok: true } | { ok: false; error: string }>;
      openExternal: (
        url: string,
      ) => Promise<{ ok: true } | { ok: false; error: string }>;
      run: (
        command: string,
        args?: string[],
        options?: { cwd?: string; timeoutMs?: number },
      ) => Promise<
        | { ok: true; code: number | null; stdout: string; stderr: string }
        | { ok: false; error: string }
      >;
    };
  }
}
