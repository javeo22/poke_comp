/**
 * Export the cheatsheet content div to PDF using browser print dialog.
 * Applies print-specific styles to hide everything except the cheatsheet.
 */
export function exportCheatsheetPDF(teamTitle: string): void {
  // Create a print-specific style element
  const style = document.createElement("style");
  style.id = "cheatsheet-print-styles";
  style.textContent = `
    @media print {
      /* Hide everything except the cheatsheet content */
      body > *:not(main),
      main > *:not(#cheatsheet-content),
      nav,
      footer,
      .no-print,
      button {
        display: none !important;
      }

      /* Reset background for print */
      html, body {
        background: #0a0a0f !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }

      #cheatsheet-content {
        padding: 0 !important;
        margin: 0 !important;
      }

      /* Force backgrounds to print */
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      @page {
        size: landscape;
        margin: 0.5cm;
      }
    }
  `;

  document.head.appendChild(style);

  // Set document title for the PDF filename
  const originalTitle = document.title;
  document.title = `${teamTitle} - Cheat Sheet`;

  window.print();

  // Cleanup after print dialog closes
  document.title = originalTitle;
  const printStyle = document.getElementById("cheatsheet-print-styles");
  if (printStyle) printStyle.remove();
}
