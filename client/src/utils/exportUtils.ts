import * as XLSX from "xlsx";
import { toPng } from "html-to-image";
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

export const exportElementToPDF = async (element: HTMLElement, filename: string, backgroundColor: string = "#ffffff", style?: any) => {
  try {
    toast.loading("Generating PDF...", { id: "export-elem-pdf" });
    const dataUrl = await toPng(element, { 
      backgroundColor,
      pixelRatio: 2,
      style
    });
    
    const width = element.scrollWidth;
    const height = element.scrollHeight;
    
    const pdf = new jsPDF({
      orientation: width > height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [width, height]
    });
    
    pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
    
    if (Capacitor.isNativePlatform()) {
      const base64 = pdf.output('datauristring');
      const path = `${filename}.pdf`;
      const result = await Filesystem.writeFile({
        path,
        data: base64,
        directory: Directory.Cache
      });
      await Share.share({ title: "Export PDF", url: result.uri });
      toast.dismiss("export-elem-pdf");
      return;
    }
    
    pdf.save(`${filename}.pdf`);
    toast.dismiss("export-elem-pdf");
  } catch (err) {
    console.error(err);
    toast.error("Failed to generate PDF", { id: "export-elem-pdf" });
  }
};
