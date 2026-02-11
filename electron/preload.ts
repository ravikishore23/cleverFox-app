import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("cleverfox", {
  ping: () => ipcRenderer.invoke("app:ping"),
  pickDirectory: () => ipcRenderer.invoke("fs:pickDirectory"),
  mkdirp: (dirPath: string) => ipcRenderer.invoke("fs:mkdirp", dirPath),
  readTextFile: (filePath: string) =>
    ipcRenderer.invoke("fs:readTextFile", filePath),
  writeTextFile: (filePath: string, content: string) =>
    ipcRenderer.invoke("fs:writeTextFile", filePath, content),
  openPath: (targetPath: string) =>
    ipcRenderer.invoke("shell:openPath", targetPath),
  openExternal: (url: string) => ipcRenderer.invoke("shell:openExternal", url),
  run: (
    command: string,
    args: string[] = [],
    options?: { cwd?: string; timeoutMs?: number },
  ) => ipcRenderer.invoke("proc:run", command, args, options),
});
