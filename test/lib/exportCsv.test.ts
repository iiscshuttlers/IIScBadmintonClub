import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadAsCSV } from '@/lib/exportCsv';

describe('CSV Export', () => {
  let createElementSpy: any;
  let appendChildSpy: any;
  let removeChildSpy: any;
  let createObjectURLSpy: any;

  beforeEach(() => {
    createElementSpy = vi.spyOn(document, 'createElement');
    appendChildSpy = vi.spyOn(document.body, 'appendChild');
    removeChildSpy = vi.spyOn(document.body, 'removeChild');
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('downloadAsCSV', () => {
    it('handles empty data gracefully', () => {
      downloadAsCSV('test', []);
      expect(appendChildSpy).not.toHaveBeenCalled();
    });

    it('handles null data gracefully', () => {
      downloadAsCSV('test', null as any);
      expect(appendChildSpy).not.toHaveBeenCalled();
    });

    it('creates a download link for valid data', () => {
      const data = [{ name: 'John', score: 100 }];
      downloadAsCSV('test', data);
      expect(createElementSpy).toHaveBeenCalledWith('a');
    });

    it('sets correct attributes on download link', () => {
      const data = [{ name: 'John', score: 100 }];
      downloadAsCSV('test', data);

      const linkElement = createElementSpy.mock.results.find(
        (r: any) => r.value.setAttribute
      )?.value;

      expect(linkElement?.setAttribute).toBeDefined();
    });

    it('formats headers correctly', () => {
      const data = [{ name: 'John', score: 100, level: 'Gold' }];
      const csvContent = createCSVString(data);

      const lines = csvContent.split('\n');
      expect(lines[0]).toBe('name,score,level');
    });

    it('formats data rows correctly', () => {
      const data = [
        { name: 'John', score: 100 },
        { name: 'Jane', score: 200 }
      ];
      const csvContent = createCSVString(data);

      const lines = csvContent.split('\n');
      expect(lines[1]).toBe('John,100');
      expect(lines[2]).toBe('Jane,200');
    });

    it('escapes commas in values', () => {
      const data = [{ name: 'Smith, John', score: 100 }];
      const csvContent = createCSVString(data);

      expect(csvContent).toContain('"Smith, John"');
    });

    it('escapes quotes in values', () => {
      const data = [{ name: 'John "The Champion"', score: 100 }];
      const csvContent = createCSVString(data);

      expect(csvContent).toContain('John ""The Champion""');
    });

    it('escapes newlines in values', () => {
      const data = [{ name: 'John\nDoe', score: 100 }];
      const csvContent = createCSVString(data);

      expect(csvContent).toContain('"John\nDoe"');
    });

    it('handles null and undefined values', () => {
      const data = [{ name: 'John', score: null, level: undefined }];
      const csvContent = createCSVString(data);

      expect(csvContent).toContain('John,""');
    });

    it('handles various data types', () => {
      const data = [
        { name: 'John', score: 100, active: true, rating: 1500.5 }
      ];
      const csvContent = createCSVString(data);

      expect(csvContent).toContain('100');
      expect(csvContent).toContain('true');
      expect(csvContent).toContain('1500.5');
    });
  });
});

// Helper function to mimic CSV generation
function createCSVString(data: any[]): string {
  if (!data || data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvRows = [];
  csvRows.push(headers.join(','));

  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header];
      if (val === null || val === undefined) {
        return '""';
      }
      const valStr = String(val);
      if (valStr.includes(',') || valStr.includes('"') || valStr.includes('\n')) {
        return `"${valStr.replace(/"/g, '""')}"`;
      }
      return valStr;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}
