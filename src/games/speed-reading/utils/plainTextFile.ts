export const MAX_TEXT_FILE_BYTES = 10 * 1024 * 1024;

export interface CustomReadingText {
  name: string;
  text: string;
  bytes: number;
}

function checkSize(size: number) {
  if (size > MAX_TEXT_FILE_BYTES) throw new Error("El archivo supera el límite de 10 MB.");
  if (size === 0) throw new Error("El archivo está vacío.");
}

// TXT has no signature of its own. Reject known containers, decode strictly, and inspect all characters.
export function decodePlainText(bytes: Uint8Array): string {
  checkSize(bytes.byteLength);
  const signatures = [
    [0x89, 0x50, 0x4e, 0x47], [0xff, 0xd8, 0xff], // PNG, JPEG
    [0x47, 0x49, 0x46, 0x38], [0x52, 0x49, 0x46, 0x46], // GIF, RIFF
    [0x50, 0x4b, 0x03, 0x04], [0x50, 0x4b, 0x05, 0x06], [0x50, 0x4b, 0x07, 0x08],
    [0x1f, 0x8b], [0x37, 0x7a, 0xbc, 0xaf], [0x52, 0x61, 0x72, 0x21],
    [0xd0, 0xcf, 0x11, 0xe0], [0x7f, 0x45, 0x4c, 0x46], // Office, ELF
    [0x4f, 0x67, 0x67, 0x53], [0x66, 0x4c, 0x61, 0x43], [0x49, 0x44, 0x33],
    [0x77, 0x4f, 0x46, 0x46], [0x77, 0x4f, 0x46, 0x32],
  ];
  if (signatures.some(signature => signature.every((value, index) => bytes[index] === value))) {
    throw new Error("El contenido del archivo no es texto plano, aunque se llame .txt.");
  }
  let encoding = "utf-8";
  if (bytes[0] === 0xff && bytes[1] === 0xfe) encoding = "utf-16le";
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) encoding = "utf-16be";
  let text: string;
  try {
    text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    throw new Error("El archivo contiene datos binarios o una codificación no admitida. Guarda el TXT como UTF-8 o UTF-16 con BOM.");
  }
  // NUL and control bytes inside the document are rejected, even after an otherwise valid text prefix.
  // eslint-disable-next-line no-control-regex -- These characters are deliberately detected to reject binary content.
  if (/[\u0000-\u0008\u000b\u000e-\u001f\u007f-\u009f]/u.test(text)) {
    throw new Error("El archivo contiene caracteres de control o datos binarios; no es un TXT válido.");
  }
  if (/^\s*(?:%PDF-|%!PS|\{\\rtf\d*\b|<\?xml\b|<!doctype\s+html\b|<html\b|<svg\b)/iu.test(text)) {
    throw new Error("El archivo contiene un documento con otro formato. Expórtalo como texto plano (.txt).");
  }
  if (!text.trim()) throw new Error("El archivo no contiene texto para leer.");
  return text;
}

export async function readPlainTextFile(file: Pick<File, "name" | "size" | "arrayBuffer">): Promise<CustomReadingText> {
  if (!/\.txt$/iu.test(file.name)) throw new Error("Selecciona un archivo con extensión .txt.");
  checkSize(file.size);
  const bytes = new Uint8Array(await file.arrayBuffer());
  return { name: file.name, bytes: bytes.byteLength, text: decodePlainText(bytes) };
}
