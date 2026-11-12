import type { AttachmentDocumentType } from "@/types";

export const DOCUMENT_TYPES: { value: AttachmentDocumentType; label: string }[] = [
  { value: "client_brief", label: "Client brief" },
  { value: "requirement", label: "Requirement document" },
  { value: "brd", label: "BRD / FRD" },
  { value: "proposal", label: "Proposal" },
  { value: "quotation", label: "Quotation / estimate" },
  { value: "sow", label: "Statement of work (SOW)" },
  { value: "nda", label: "NDA / agreement" },
  { value: "contract", label: "Contract" },
  { value: "invoice", label: "Invoice / PO" },
  { value: "other", label: "Other client document" },
];

export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
export const ATTACHMENT_ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx"] as const;
export const ATTACHMENT_ACCEPT =
  ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function documentTypeLabel(value: AttachmentDocumentType | string) {
  return DOCUMENT_TYPES.find((d) => d.value === value)?.label ?? value;
}

export function getFileExtension(name: string) {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx).toLowerCase() : "";
}

export function validateAttachmentFile(file: File): string | null {
  const ext = getFileExtension(file.name);
  if (!ATTACHMENT_ALLOWED_EXTENSIONS.includes(ext as (typeof ATTACHMENT_ALLOWED_EXTENSIONS)[number])) {
    return "Only PDF, DOC, and DOCX files are allowed.";
  }
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return "File must be less than 5 MB.";
  }
  if (file.size <= 0) {
    return "Selected file is empty.";
  }
  return null;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

export function openAttachmentFile(fileDataUrl: string | undefined, fileType: string) {
  if (!fileDataUrl) return false;
  if (fileType === "application/pdf" || fileDataUrl.startsWith("data:application/pdf")) {
    window.open(fileDataUrl, "_blank", "noopener,noreferrer");
    return true;
  }
  // DOC/DOCX: open via temporary download-style blob in a new tab when possible
  window.open(fileDataUrl, "_blank", "noopener,noreferrer");
  return true;
}

export function downloadAttachmentFile(
  fileDataUrl: string | undefined,
  filename: string,
  fileType: string
) {
  if (!fileDataUrl) return false;
  const link = document.createElement("a");
  link.href = fileDataUrl;
  link.download = filename || "document";
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  void fileType;
  return true;
}
