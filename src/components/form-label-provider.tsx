"use client";

import { useEffect } from "react";

function normalizeLabel(text: string | null | undefined) {
  if (!text) return "";
  return text.replace(/\s+/g, " ").trim();
}

function getLabelText(label: HTMLLabelElement | null) {
  if (!label) return "";
  const clone = label.cloneNode(true) as HTMLLabelElement;
  clone.querySelectorAll("input,select,textarea,button,svg").forEach((node) => node.remove());
  return normalizeLabel(clone.textContent);
}

function titleCaseFromToken(token: string) {
  const cleaned = token
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2");
  return normalizeLabel(cleaned)
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : part))
    .join(" ");
}

function resolveControlLabel(control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  if (control.hasAttribute("aria-label") || control.hasAttribute("aria-labelledby")) {
    return "";
  }

  if (control.id) {
    const explicitLabel = document.querySelector(`label[for="${CSS.escape(control.id)}"]`);
    if (explicitLabel instanceof HTMLLabelElement) {
      const text = getLabelText(explicitLabel);
      if (text) return text;
    }
  }

  const wrappedLabel = control.closest("label");
  if (wrappedLabel instanceof HTMLLabelElement) {
    const text = getLabelText(wrappedLabel);
    if (text) return text;
  }

  const placeholder = control.getAttribute("placeholder");
  if (placeholder && normalizeLabel(placeholder)) return normalizeLabel(placeholder);

  if (control.name && normalizeLabel(control.name)) return titleCaseFromToken(control.name);
  if (control.id && normalizeLabel(control.id)) return titleCaseFromToken(control.id);

  if (control instanceof HTMLInputElement) {
    const type = control.type.toLowerCase();
    if (type === "checkbox") return "Checkbox";
    if (type === "radio") return "Radio option";
  }

  return control.tagName === "SELECT" ? "Select option" : "Form field";
}

function applyMissingControlLabels(root: ParentNode) {
  const controls = root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    "input:not([type='hidden']), select, textarea"
  );

  for (const control of controls) {
    const label = resolveControlLabel(control);
    if (label) {
      control.setAttribute("aria-label", label);
    }
  }
}

export function FormLabelProvider() {
  useEffect(() => {
    applyMissingControlLabels(document);

    let rafId = 0;
    const observer = new MutationObserver((mutations) => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      rafId = window.requestAnimationFrame(() => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node instanceof HTMLElement) {
              applyMissingControlLabels(node);
            }
          }
        }
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      observer.disconnect();
    };
  }, []);

  return null;
}
