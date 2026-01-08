import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api.js';

interface TextSnippet {
  text: string;
  position: {
    x: number;
    y: number;
  }
}

export interface Module {
  code: number;
  name: string;
  semester: string;
  cp: number;
  graded: boolean;
  passed: boolean;
  grade: number | null;
}

export interface Exam {
  name: string;
  date: Date;
  graded: boolean;
  passed: boolean;
  percentage: number | null;
}

class SIMDocument {
  constructor(private pdf: PDFDocumentProxy) {}

  private async getTextItemsOfPage(pageNumber: number) {
    const page = await this.pdf.getPage(pageNumber);
    const { items } = await page.getTextContent({ includeMarkedContent: false });

    return items.filter(i => ('str' in i));
  }

  private async getTextItems() {
    const pageCount = this.pdf.numPages;
    
    const promises = [...Array(pageCount).keys()].map(i => this.getTextItemsOfPage(i + 1));
    const pages = await Promise.all(promises);

    return pages.flat();
  }
}
