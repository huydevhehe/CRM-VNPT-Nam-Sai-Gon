import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { pathToFileURL } from "node:url";

/** Máy chủ chưa cài LibreOffice (hoặc không chạy được) nên không đổi được DOCX sang PDF. */
export class PdfConverterUnavailableError extends Error {}

export const PDF_UNAVAILABLE_MESSAGE =
  "Máy chủ chưa cài LibreOffice nên chưa xuất được PDF. Bạn vẫn có thể tải file Word (DOCX).";

const CONVERT_TIMEOUT_MS = 90_000;

const WINDOWS_CANDIDATES = [
  "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
  "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
];
const POSIX_CANDIDATES = [
  "/usr/bin/soffice",
  "/usr/bin/libreoffice",
  "/usr/local/bin/soffice",
  "/opt/libreoffice/program/soffice",
  "/snap/bin/libreoffice",
  "/Applications/LibreOffice.app/Contents/MacOS/soffice",
];

function isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

/**
 * Tìm `soffice`. Nếu đặt biến môi trường SOFFICE_PATH thì chỉ dùng đúng đường dẫn đó
 * (không có thì coi như chưa cài — dùng để cố ý tắt PDF hoặc chỉ định bản cài riêng).
 */
export function resolveSofficePath(env: NodeJS.ProcessEnv = process.env): string | null {
  const explicit = env.SOFFICE_PATH?.trim();
  if (explicit) return isFile(explicit) ? explicit : null;

  const exeNames = process.platform === "win32" ? ["soffice.exe", "soffice.com"] : ["soffice", "libreoffice"];
  for (const dir of (env.PATH ?? "").split(path.delimiter).filter(Boolean)) {
    for (const name of exeNames) {
      const full = path.join(dir, name);
      if (isFile(full)) return full;
    }
  }

  const candidates = process.platform === "win32" ? WINDOWS_CANDIDATES : POSIX_CANDIDATES;
  return candidates.find(isFile) ?? null;
}

export function isPdfConversionAvailable(): boolean {
  return resolveSofficePath() !== null;
}

// LibreOffice dùng chung một profile nên không chạy song song được: xếp hàng từng lượt.
let queue: Promise<unknown> = Promise.resolve();

function runSoffice(soffice: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(soffice, args, { timeout: CONVERT_TIMEOUT_MS, windowsHide: true }, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(`LibreOffice lỗi khi đổi sang PDF: ${stderr?.toString().trim() || error.message}`));
        return;
      }
      resolve();
    });
  });
}

async function convertOnce(docx: Buffer, soffice: string): Promise<Buffer> {
  const workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "vnpt-pdf-"));
  const profileDir = path.join(os.tmpdir(), "vnpt-soffice-profile");
  try {
    const inputPath = path.join(workDir, "document.docx");
    await fs.promises.writeFile(inputPath, docx);
    await runSoffice(soffice, [
      `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
      "--headless",
      "--norestore",
      "--nolockcheck",
      "--convert-to",
      "pdf",
      "--outdir",
      workDir,
      inputPath,
    ]);
    const outputPath = path.join(workDir, "document.pdf");
    if (!isFile(outputPath)) {
      throw new Error("LibreOffice không tạo được file PDF");
    }
    return await fs.promises.readFile(outputPath);
  } finally {
    // Không giữ file PDF/DOCX tạm sau mỗi yêu cầu.
    await fs.promises.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** Đổi DOCX (đã render) sang PDF bằng LibreOffice headless. Ném PdfConverterUnavailableError nếu chưa cài. */
export async function convertDocxToPdf(docx: Buffer): Promise<Buffer> {
  const soffice = resolveSofficePath();
  if (!soffice) {
    throw new PdfConverterUnavailableError(PDF_UNAVAILABLE_MESSAGE);
  }
  const job = queue.then(() => convertOnce(docx, soffice));
  queue = job.catch(() => undefined);
  return job;
}
