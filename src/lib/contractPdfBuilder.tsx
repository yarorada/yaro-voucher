// Branded contract PDF generator using existing ContractPdfTemplate.
// Mounts the template off-screen, waits for QR codes, then exports via html2pdf.js.

import { createRoot } from "react-dom/client";
import { ContractPdfTemplate } from "@/components/ContractPdfTemplate";

export async function generateContractPdfBlob(contract: any): Promise<{ blob: Blob; fileName: string }> {
  const html2pdf = (await import("html2pdf.js")).default;

  const mountNode = document.createElement("div");
  mountNode.style.position = "fixed";
  mountNode.style.left = "-10000px";
  mountNode.style.top = "0";
  mountNode.style.width = "794px";
  mountNode.style.pointerEvents = "none";
  mountNode.style.opacity = "0";
  mountNode.style.background = "#ffffff";
  document.body.appendChild(mountNode);

  const root = createRoot(mountNode);

  try {
    root.render(<ContractPdfTemplate contract={contract} />);

    // Wait for QR codes to be ready (up to 5 seconds), mirroring ContractDetail
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 5000);
      const check = () => {
        const el = mountNode.querySelector("#contract-pdf-content");
        if (el?.getAttribute("data-qr-ready") === "true") {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(check, 200);
        }
      };
      check();
    });

    // Extra paint frame so layout settles
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

    const element = mountNode.querySelector("#contract-pdf-content") as HTMLElement | null;
    if (!element) throw new Error("Nepodařilo se připravit PDF smlouvy");

    const fileName = `Smlouva_${contract?.contract_number || "export"}.pdf`;
    const opt = {
      margin: [10, 10, 10, 10] as [number, number, number, number],
      filename: fileName,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        letterRendering: true,
        backgroundColor: "#ffffff",
        onclone: (clonedDoc: Document) => {
          clonedDoc.documentElement.classList.remove("dark");
          const clonedElement = clonedDoc.getElementById("contract-pdf-content");
          if (clonedElement) {
            clonedElement.style.backgroundColor = "#ffffff";
            clonedElement.style.color = "#000000";
            clonedElement.style.display = "block";
            const logos = clonedElement.querySelectorAll(".logo-dark-mode");
            logos.forEach((el) => {
              (el as HTMLElement).style.filter = "none";
            });
          }
        },
      },
      jsPDF: { unit: "mm" as const, format: "a4" as const, orientation: "portrait" as const },
      pagebreak: { mode: ["avoid-all", "css", "legacy"] as Array<"avoid-all" | "css" | "legacy">, avoid: ["[data-pdf-section]"] },
    };

    const blob = (await html2pdf().set(opt).from(element).outputPdf("blob")) as Blob;
    return { blob, fileName };
  } finally {
    root.unmount();
    mountNode.remove();
  }
}
