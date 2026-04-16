/**
 * Export the cheatsheet content div to a downloadable PDF file.
 * Uses html2canvas to capture the rendered DOM and jsPDF to create the PDF.
 */
export async function exportCheatsheetPDF(teamTitle: string): Promise<void> {
  const element = document.getElementById("cheatsheet-content");
  if (!element) return;

  // Dynamically import to avoid SSR issues
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  // Temporarily expand all collapsed sections for PDF capture
  const collapsedSections = element.querySelectorAll<HTMLElement>("[data-collapsed='true']");
  collapsedSections.forEach((el) => {
    el.style.maxHeight = "none";
    el.style.opacity = "1";
    el.style.overflow = "visible";
    el.style.padding = "1.5rem";
  });

  const canvas = await html2canvas(element, {
    backgroundColor: "#0a0a0f",
    scale: 2,
    useCORS: true,
    logging: false,
  });

  // Restore collapsed sections
  collapsedSections.forEach((el) => {
    el.style.maxHeight = "";
    el.style.opacity = "";
    el.style.overflow = "";
    el.style.padding = "";
  });

  const imgData = canvas.toDataURL("image/png");
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;

  // Use landscape A4, scale image to fit width
  const pdf = new jsPDF({
    orientation: imgWidth > imgHeight ? "landscape" : "portrait",
    unit: "px",
    format: [imgWidth, imgHeight],
  });

  pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);

  const filename = `${teamTitle.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "-")}-cheatsheet.pdf`;
  pdf.save(filename);
}
