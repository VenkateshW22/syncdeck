import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { toast } from "sonner";

// Helper utilities to parse and convert oklch and oklab colors to rgb for html2canvas compatibility
function oklabToRgbString(L: number, a: number, b: number, alpha: number): string {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855414 * b;

  const l_3 = l_ * l_ * l_;
  const m_3 = m_ * m_ * m_;
  const s_3 = s_ * s_ * s_;

  const r = +4.0767416621 * l_3 - 3.3077115913 * m_3 + 0.2309699292 * s_3;
  const g = -1.2684380046 * l_3 + 2.6097574011 * m_3 - 0.3413193965 * s_3;
  const b_ = -0.0041960863 * l_3 - 0.7034186147 * m_3 + 1.7076147010 * s_3;

  const gamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

  const r_srgb = Math.max(0, Math.min(255, Math.round(gamma(r) * 255)));
  const g_srgb = Math.max(0, Math.min(255, Math.round(gamma(g) * 255)));
  const b_srgb = Math.max(0, Math.min(255, Math.round(gamma(b_) * 255)));

  return alpha === 1
    ? `rgb(${r_srgb}, ${g_srgb}, ${b_srgb})`
    : `rgba(${r_srgb}, ${g_srgb}, ${b_srgb}, ${alpha})`;
}

function parseOklch(colorStr: string): string | null {
  const cleanStr = colorStr.replace(/,/g, " ").replace(/\s+/g, " ").trim();
  const match = cleanStr.match(/oklch\s*\(([^)]+)\)/i);
  if (!match) return null;

  const content = match[1].trim();
  const parts = content.split("/");
  const mainValues = parts[0].trim().split(/\s+/);
  const alphaValue = parts[1] ? parts[1].trim() : null;

  if (mainValues.length < 3) return null;
  const [lStr, cStr, hStr] = mainValues;

  const L = lStr.endsWith("%") ? parseFloat(lStr) / 100 : parseFloat(lStr);
  const C = parseFloat(cStr);
  let H = parseFloat(hStr);
  if (hStr.endsWith("rad")) {
    H = parseFloat(hStr) * (180 / Math.PI);
  } else if (hStr.endsWith("turn")) {
    H = parseFloat(hStr) * 360;
  }

  const alpha = alphaValue ? (alphaValue.endsWith("%") ? parseFloat(alphaValue) / 100 : parseFloat(alphaValue)) : 1;
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  return oklabToRgbString(L, a, b, alpha);
}

function parseOklab(colorStr: string): string | null {
  const cleanStr = colorStr.replace(/,/g, " ").replace(/\s+/g, " ").trim();
  const match = cleanStr.match(/oklab\s*\(([^)]+)\)/i);
  if (!match) return null;

  const content = match[1].trim();
  const parts = content.split("/");
  const mainValues = parts[0].trim().split(/\s+/);
  const alphaValue = parts[1] ? parts[1].trim() : null;

  if (mainValues.length < 3) return null;
  const [lStr, aStr, bStr] = mainValues;

  const L = lStr.endsWith("%") ? parseFloat(lStr) / 100 : parseFloat(lStr);
  const a = parseFloat(aStr);
  const b = parseFloat(bStr);
  const alpha = alphaValue ? (alphaValue.endsWith("%") ? parseFloat(alphaValue) / 100 : parseFloat(alphaValue)) : 1;

  return oklabToRgbString(L, a, b, alpha);
}

export function convertOklchOklabToRgb(str: string): string {
  if (typeof str !== "string") return str;
  let result = str;
  result = result.replace(/oklch\s*\([^)]+\)/gi, (match) => {
    try {
      return parseOklch(match) || match;
    } catch {
      return match;
    }
  });
  result = result.replace(/oklab\s*\([^)]+\)/gi, (match) => {
    try {
      return parseOklab(match) || match;
    } catch {
      return match;
    }
  });
  return result;
}

export async function generateSessionPdf(roomId: string | undefined): Promise<void> {
  const el = document.getElementById("pdf-content");
  if (!el) return;

  const originalGetComputedStyle = window.getComputedStyle;

  try {
    const cleanColor = (val: any): any => {
      if (typeof val === "string" && (val.includes("oklch") || val.includes("oklab"))) {
        return convertOklchOklabToRgb(val);
      }
      return val;
    };

    // Wrap the main window's getComputedStyle to catch color definitions queried by html2canvas
    window.getComputedStyle = function (elt, pseudoElt) {
      const style = originalGetComputedStyle(elt, pseudoElt);
      return new Proxy(style, {
        get(target, prop) {
          if (prop === "getPropertyValue") {
            return function (propertyName: string) {
              const val = target.getPropertyValue(propertyName);
              return cleanColor(val);
            };
          }
          const val = (target as any)[prop];
          if (typeof val === "function") {
            return val.bind(target);
          }
          return cleanColor(val);
        },
      });
    };

    const loadingToast = toast.loading("Generating PDF...");
    const isDark = document.documentElement.classList.contains("dark");

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: isDark ? "#0f172a" : "#ffffff",
      logging: false,
      onclone: (clonedDoc) => {
        // 1. Replace oklch/oklab in all stylesheet style tags in the cloned document
        const styleTags = clonedDoc.getElementsByTagName("style");
        for (let i = 0; i < styleTags.length; i++) {
          const tag = styleTags[i];
          if (tag.innerHTML) {
            tag.innerHTML = convertOklchOklabToRgb(tag.innerHTML);
          }
        }

        // 2. Replace oklch/oklab in inline styles of elements
        const allElements = clonedDoc.getElementsByTagName("*");
        for (let i = 0; i < allElements.length; i++) {
          const element = allElements[i] as HTMLElement;
          if (element.style) {
            for (let j = 0; j < element.style.length; j++) {
              const styleName = element.style[j];
              const styleVal = element.style.getPropertyValue(styleName);
              if (styleVal && (styleVal.includes("oklch") || styleVal.includes("oklab"))) {
                element.style.setProperty(styleName, convertOklchOklabToRgb(styleVal));
              }
            }
          }
        }

        // 3. Dynamic computed style overrides to prevent getComputedStyle from returning oklch/oklab colors
        const clonedWindow = clonedDoc.defaultView;
        if (clonedWindow) {
          const originalGetComputedStyleCloned = clonedWindow.getComputedStyle;
          clonedWindow.getComputedStyle = function (elt, pseudoElt) {
            const style = originalGetComputedStyleCloned(elt, pseudoElt);
            return new Proxy(style, {
              get(target, prop) {
                if (prop === "getPropertyValue") {
                  return function (propertyName: string) {
                    const val = target.getPropertyValue(propertyName);
                    return cleanColor(val);
                  };
                }
                const val = (target as any)[prop];
                if (typeof val === "function") {
                  return val.bind(target);
                }
                return cleanColor(val);
              },
            });
          };
        }
      },
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.9);
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Session_Report_${roomId || "Unknown"}.pdf`);
    toast.dismiss(loadingToast);
    toast.success("PDF generated successfully");
  } catch (e: any) {
    console.error("PDF Error", e);
    toast.dismiss();
    toast.error(`Failed to generate PDF: ${e.message || "Unknown error"}`);
  } finally {
    window.getComputedStyle = originalGetComputedStyle;
  }
}
