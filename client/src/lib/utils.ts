import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type CopyTextResult = "copied" | "prompt";

export async function copyTextToClipboard(
  text: string,
): Promise<CopyTextResult> {
  const fallbackCopy = () => {
    if (typeof document === "undefined" || !document.body) {
      throw new Error("Clipboard unavailable");
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    textarea.style.pointerEvents = "none";
    textarea.setAttribute("readonly", "");
    document.body.appendChild(textarea);

    const selection = document.getSelection();
    const previousRange =
      selection && selection.rangeCount > 0
        ? selection.getRangeAt(0).cloneRange()
        : null;

    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    const successful = document.execCommand
      ? document.execCommand("copy")
      : false;

    document.body.removeChild(textarea);

    if (previousRange && selection) {
      selection.removeAllRanges();
      selection.addRange(previousRange);
    }

    if (!successful) {
      throw new Error("Fallback copy failed");
    }
  };

  const isWindowDefined = typeof window !== "undefined";
  const isLocalhost =
    isWindowDefined &&
    ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
  const isSecureEnvironment = isWindowDefined
    ? (window.isSecureContext ?? isLocalhost)
    : false;

  const canUseClipboardApi =
    typeof navigator !== "undefined" &&
    !!navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function" &&
    (isWindowDefined ? isSecureEnvironment : true);

  if (canUseClipboardApi) {
    try {
      await navigator.clipboard.writeText(text);
      return "copied";
    } catch {
      // fall through to fallback
    }
  }

  try {
    fallbackCopy();
    return "copied";
  } catch (error) {
    if (isWindowDefined && typeof window.prompt === "function") {
      window.prompt("Copy the text below", text);
      return "prompt";
    }
    throw error;
  }
}
