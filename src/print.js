// Section 6: export paths for the two off-screen printable nodes. The full
// coach's report (PrintableLineupCard, multi-page) stays a PDF via
// downloadLineupPdf, the primary print path on mobile (iOS Safari's print
// flow opens a share-sheet preview rather than a real print dialog, so a
// downloadable file is the better default there). The short shareable
// starting-lineup card goes out as an image instead (see
// shareLineupCardImage below) since that card is meant to end up as a photo
// in a group chat or in Photos, not as a PDF.
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

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// Hands the card to iOS's native share sheet as a PNG, which has a one-tap
// "Save Image" straight to Photos - no PDF, no screenshot. Falls back to a
// plain PNG download when file sharing isn't available (desktop browsers,
// older Safari) or when the user's device rejects the share for a reason
// other than cancelling it.
export async function shareLineupCardImage(node, filename) {
  if (!node) return;
  const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#ffffff" });
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  const file = new File([blob], filename, { type: "image/png" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (err) {
      if (err?.name === "AbortError") return;
    }
  }

  downloadBlob(blob, filename);
}
