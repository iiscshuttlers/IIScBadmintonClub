import * as XLSX from "xlsx";
import { toPng, toJpeg } from "html-to-image";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

export const exportToExcel = async (filename: string, sheets: { name: string, data: any[][] }[], email: boolean = false, subject: string = "", body: string = "") => {
  const wb = XLSX.utils.book_new();
  sheets.forEach(sheet => {
    const ws = XLSX.utils.aoa_to_sheet(sheet.data);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.substring(0, 31)); // excel sheet name max 31 chars
  });
  
  if (Capacitor.isNativePlatform()) {
    try {
      const base64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
      const path = `${filename}.xlsx`;
      const result = await Filesystem.writeFile({
        path,
        data: base64,
        directory: Directory.Cache
      });
      await Share.share({
        title: subject || "Export Excel",
        text: body || undefined,
        url: result.uri,
        dialogTitle: 'Share Export'
      });
      return;
    } catch (e) {
      console.error(e);
      toast.error("Failed to share file natively.");
    }
  }

  XLSX.writeFile(wb, `${filename}.xlsx`);
  if (email && !Capacitor.isNativePlatform()) {
    triggerMailtoFallback(subject, body);
  }
};

const createHiddenTableElement = (sheets: { name: string, data: any[][] }[]): HTMLElement => {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.top = "0";
  container.style.left = "0";
  container.style.zIndex = "-9999";
  container.style.width = "1000px";
  container.style.backgroundColor = "#ffffff";
  container.style.color = "#000000";
  container.style.padding = "40px";
  container.style.fontFamily = "sans-serif";

  let html = "";
  for (const sheet of sheets) {
    html += `<h2 style="font-size: 24px; font-weight: bold; margin-top: 20px; margin-bottom: 10px; color: #1e293b;">${sheet.name}</h2>`;
    html += `<table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px; text-align: left;">`;
    
    sheet.data.forEach((row, rowIndex) => {
      const isHeader = rowIndex === 0 || (rowIndex === 1 && sheet.name !== "Setup");
      html += `<tr>`;
      row.forEach((cell) => {
        const style = isHeader 
          ? "border: 1px solid #cbd5e1; padding: 12px 8px; background-color: #f8fafc; font-weight: bold; color: #0f172a;" 
          : "border: 1px solid #cbd5e1; padding: 10px 8px; color: #334155;";
        html += `<td style="${style}">${cell ?? ""}</td>`;
      });
      html += `</tr>`;
    });
    
    html += `</table>`;
  }
  
  container.innerHTML = html;
  return container;
};

const withExportElement = async <T,>(sheets: { name: string, data: any[][] }[], fn: (el: HTMLElement) => Promise<T>): Promise<T> => {
  const el = createHiddenTableElement(sheets);
  document.body.appendChild(el);
  try {
    // Wait for layout
    await new Promise(r => setTimeout(r, 100));
    return await fn(el);
  } finally {
    document.body.removeChild(el);
  }
};

export const exportToImage = async (sheets: { name: string, data: any[][] }[], filename: string, email: boolean = false, subject: string = "", body: string = "") => {
  if (!sheets || sheets.length === 0) { toast.error("No data to export"); return; }
  
  try {
    toast.loading("Generating Image...", { id: "export-img" });
    
    const nativeUris: string[] = [];
    
    const triggerDownload = async (dataUrl: string, outName: string) => {
      if (Capacitor.isNativePlatform()) {
        const path = `${outName}.png`;
        const result = await Filesystem.writeFile({
          path,
          data: dataUrl,
          directory: Directory.Cache
        });
        nativeUris.push(result.uri);
        return;
      }
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${outName}.png`;
      a.click();
    };

    if (sheets.length === 1) {
      const dataUrl = await withExportElement(sheets, (el) => toPng(el, { 
        backgroundColor: "#ffffff",
        style: { margin: "0" },
        pixelRatio: 2
      }));
      await triggerDownload(dataUrl, filename);
    } else {
      toast.success(`Generating ${sheets.length} images. Please allow multiple downloads if prompted.`, { duration: 6000 });
      for (let i = 0; i < sheets.length; i++) {
        const sheet = sheets[i];
        const dataUrl = await withExportElement([sheet], (el) => toPng(el, { 
          backgroundColor: "#ffffff",
          style: { margin: "0" },
          pixelRatio: 2
        }));
        const sheetSafeName = sheet.name.replace(/[^a-zA-Z0-9]/g, '_');
        await triggerDownload(dataUrl, `${filename}_${sheetSafeName}`);
        
        if (i < sheets.length - 1 && !Capacitor.isNativePlatform()) {
          await new Promise(r => setTimeout(r, 1200)); // Delay to prevent popup blockers
        }
      }
    }
    
    if (Capacitor.isNativePlatform() && nativeUris.length > 0) {
      await Share.share({ title: subject || "Export Image", text: body || undefined, files: nativeUris });
    }
    
    toast.dismiss("export-img");
    
    if (email && !Capacitor.isNativePlatform()) {
      triggerMailtoFallback(subject, body);
    }
  } catch (err) {
    console.error(err);
    toast.error("Failed to generate image", { id: "export-img" });
  }
};

export const exportToPDF = async (sheets: { name: string, data: any[][] }[], filename: string, email: boolean = false, subject: string = "", body: string = "") => {
  if (!sheets || sheets.length === 0) { toast.error("No data to export"); return; }
  
  try {
    toast.loading("Generating PDF...", { id: "export-pdf" });
    
    const pages = [];
    for (let i = 0; i < sheets.length; i++) {
      const pageData = await withExportElement([sheets[i]], async (el) => {
        const url = await toPng(el, { 
          backgroundColor: "#ffffff",
          pixelRatio: 2
        });
        return { dataUrl: url, width: Math.max(el.scrollWidth, 100), height: Math.max(el.scrollHeight, 100) };
      });
      pages.push(pageData);
    }
    
    if (pages.length === 0) throw new Error("No pages generated");
    
    const pdf = new jsPDF({
      orientation: pages[0].width > pages[0].height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [pages[0].width, pages[0].height]
    });
    
    pdf.addImage(pages[0].dataUrl, 'PNG', 0, 0, pages[0].width, pages[0].height);
    
    for (let i = 1; i < pages.length; i++) {
      pdf.addPage([pages[i].width, pages[i].height], pages[i].width > pages[i].height ? 'landscape' : 'portrait');
      pdf.addImage(pages[i].dataUrl, 'PNG', 0, 0, pages[i].width, pages[i].height);
    }

    
    if (Capacitor.isNativePlatform()) {
      const base64 = pdf.output('datauristring');
      const path = `${filename}.pdf`;
      const result = await Filesystem.writeFile({
        path,
        data: base64,
        directory: Directory.Cache
      });
      await Share.share({ title: subject || "Export PDF", text: body || undefined, url: result.uri });
      toast.dismiss("export-pdf");
      return;
    }

    pdf.save(`${filename}.pdf`);
    toast.dismiss("export-pdf");
    
    if (email && !Capacitor.isNativePlatform()) {
      triggerMailtoFallback(subject, body);
    }
  } catch (err) {
    console.error(err);
    toast.error("Failed to generate PDF", { id: "export-pdf" });
  }
};

const triggerMailtoFallback = (subject: string, body: string) => {
  toast.success("File downloaded! You can now attach it to the email draft.", { duration: 5000 });
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body + "\n\n(Please attach the downloaded file here)")}`;
};

export const exportElementToImage = async (element: HTMLElement, filename: string, backgroundColor: string = "#ffffff", style?: any) => {
  try {
    toast.loading("Generating Image...", { id: "export-elem-img" });
    const dataUrl = await toPng(element, { 
      backgroundColor,
      pixelRatio: 2,
      style
    });
    
    if (Capacitor.isNativePlatform()) {
      const path = `${filename}.png`;
      const result = await Filesystem.writeFile({
        path,
        data: dataUrl,
        directory: Directory.Cache
      });
      await Share.share({ title: "Export Image", url: result.uri });
      toast.dismiss("export-elem-img");
      return;
    }
    
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${filename}.png`;
    a.click();
    toast.dismiss("export-elem-img");
  } catch (err) {
    console.error(err);
    toast.error("Failed to generate image", { id: "export-elem-img" });
  }
};

export const exportElementToJpeg = async (element: HTMLElement, filename: string, backgroundColor: string = "#ffffff", style?: any) => {
  try {
    toast.loading("Generating JPG...", { id: "export-elem-jpg" });
    const dataUrl = await toJpeg(element, { 
      backgroundColor,
      quality: 0.95,
      pixelRatio: 2,
      style
    });
    
    if (Capacitor.isNativePlatform()) {
      const path = `${filename}.jpg`;
      const result = await Filesystem.writeFile({
        path,
        data: dataUrl,
        directory: Directory.Cache
      });
      await Share.share({ title: "Export Image", url: result.uri });
      toast.dismiss("export-elem-jpg");
      return;
    }
    
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${filename}.jpg`;
    a.click();
    toast.dismiss("export-elem-jpg");
  } catch (err) {
    console.error(err);
    toast.error("Failed to generate JPG", { id: "export-elem-jpg" });
  }
};

export const exportElementToPDF = async (
  element: HTMLElement,
  filename: string,
  backgroundColor: string = "#ffffff",
  style?: any,
  pages: number = 1
) => {
  try {
    toast.loading("Generating PDF...", { id: "export-elem-pdf" });
    const dataUrl = await toPng(element, { 
      backgroundColor,
      pixelRatio: 2,
      style
    });
    
    const width = element.scrollWidth;
    const height = element.scrollHeight;

    if (pages <= 1) {
      const pdf = new jsPDF({
        orientation: width > height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [width, height]
      });
      // Force solid white background
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, width, height, 'F');
      pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
      await savePdf(pdf, filename);
      toast.dismiss("export-elem-pdf");
      return;
    }

    // Multi-page slicing logic
    const img = new Image();
    img.src = dataUrl;
    await new Promise((resolve) => {
      img.onload = resolve;
    });

    const pixelRatio = 2;
    // PADDING(16) + LABEL_H(26) = 42px header in DOM space
    const headerDOM = 42;
    // Bottom padding = 16px in DOM space
    const footerDOM = 16;
    
    const headerPx = headerDOM * pixelRatio;
    const footerPx = footerDOM * pixelRatio;
    
    const totalImgHeight = img.height;
    const imgWidth = img.width;
    const treePx = totalImgHeight - headerPx - footerPx;
    const slicePx = treePx / pages;
    
    // In DOM space (for PDF dimensions):
    const sliceDOM = slicePx / pixelRatio;
    const pageDOMHeight = headerDOM + sliceDOM + footerDOM;

    const pdf = new jsPDF({
      orientation: width > pageDOMHeight ? 'landscape' : 'portrait',
      unit: 'px',
      format: [width, pageDOMHeight]
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Failed to get 2d context");

    canvas.width = imgWidth;
    canvas.height = headerPx + slicePx + footerPx;

    for (let i = 0; i < pages; i++) {
      if (i > 0) {
        pdf.addPage([width, pageDOMHeight], width > pageDOMHeight ? 'landscape' : 'portrait');
      }
      
      // Clear canvas with white
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw Header
      ctx.drawImage(img, 0, 0, imgWidth, headerPx, 0, 0, imgWidth, headerPx);
      // Draw Tree Slice
      const sourceY = headerPx + i * slicePx;
      ctx.drawImage(img, 0, sourceY, imgWidth, slicePx, 0, headerPx, imgWidth, slicePx);
      // Draw Footer
      const sourceFooterY = headerPx + treePx;
      ctx.drawImage(img, 0, sourceFooterY, imgWidth, footerPx, 0, headerPx + slicePx, imgWidth, footerPx);
      
      const partDataUrl = canvas.toDataURL('image/png', 1.0);
      
      // Force solid white background in PDF
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, width, pageDOMHeight, 'F');
      
      // Add the sliced image (mapping DOM width/height)
      pdf.addImage(partDataUrl, 'PNG', 0, 0, width, pageDOMHeight);
    }

    await savePdf(pdf, filename);
    toast.dismiss("export-elem-pdf");
  } catch (err) {
    console.error(err);
    toast.error("Failed to generate PDF", { id: "export-elem-pdf" });
  }
};

async function savePdf(pdf: any, filename: string) {
  if (Capacitor.isNativePlatform()) {
    const base64 = pdf.output('datauristring');
    const path = `${filename}.pdf`;
    const result = await Filesystem.writeFile({
      path,
      data: base64,
      directory: Directory.Cache
    });
    await Share.share({ title: "Export PDF", url: result.uri });
    return;
  }
  pdf.save(`${filename}.pdf`);
}
