// Section 6: PDF export, the primary print path on mobile (iOS Safari's
// print flow opens a share-sheet preview rather than a real print dialog,
// so a downloadable file is the better default there). Captures the
// off-screen PrintableLineupCard DOM node with html2canvas, then paginates
// the resulting image across as many jsPDF pages as it needs.
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

export async function downloadLineupPdf(node, filename) {
  if (!node) return;
  const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#ffffff" });
  const imgData = canvas.toDataURL("image/png");

  const pdf = new jsPDF("p", "pt", "letter");
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pdfWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;
  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pdfHeight;

  while (heightLeft > 0) {
    position -= pdfHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;
  }

  pdf.save(filename);
}

// A short, shareable card (the starting lineup, not the full multi-page
// report) gets its own export: one PDF page sized exactly to the captured
// image instead of a Letter page, so opening it in a group chat shows the
// card itself with no blank margin below a short card. Page format and
// image are both specified in the same "px" unit as the canvas, so they
// fill each other exactly regardless of how jsPDF's px-to-DPI assumption
// works internally - the scale factor cancels out on both sides.
export async function downloadCardPdf(node, filename) {
  if (!node) return;
  const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#ffffff" });
  const pdf = new jsPDF({
    orientation: canvas.width >= canvas.height ? "l" : "p",
    unit: "px",
    format: [canvas.width, canvas.height],
  });
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, canvas.width, canvas.height);
  pdf.save(filename);
}
