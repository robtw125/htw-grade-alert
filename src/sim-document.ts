import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { TextItem } from 'pdfjs-dist/types/src/display/api.js';
import { startsWith } from 'zod';

interface TextBlock {
  text: string;
  x: number;
  y: number;
}

interface Exam {
  name: string,
  date: Date,
  grade: string,
}

interface Module {
  name: string,
  semester: string,
  cp: number,
  grade: string,
  exams: Exam[],
}

export default class SIMDocument {
  private static patterns = {
    grade: /^(?:\d{1,3},\d{1,2}(?: %)?|BE|NB|ENB|VB|FV|HF)$/,
    provisionalGrade: /\d,\d(?= \(\w+\))/,
    semester: /WiSe|SoSe \d{4}/
  } as const;

  private static readonly Y_TOLERANCE: number = 3;

  static async fromBase64(base64String: string): Promise<SIMDocument> {
    const pdfData = atob(base64String);
    const loadingTask = getDocument({ data: pdfData });
    const pdf = await loadingTask.promise;

    return new SIMDocument(pdf);
  }

  private constructor(private pdf: PDFDocumentProxy) {}

  private convertToDate(dateString: string): Date {
    const parts = dateString.replace(/\//g, '.').split('.');

    if (parts.length !== 3) {
      throw new Error(`Ungültiges Datumsformat: ${dateString}`);
    }

    const day = parseInt(parts[0]!, 10);

    const month = parseInt(parts[1]!, 10) - 1;
    let year = parseInt(parts[2]!, 10);

    if (year < 100) {
      year += 2000;
    }

    return new Date(year, month, day);
  }

  public async extractModules() {
    const lines = await this.getLines();
    const modules: Module[] = [];
    let module: Module | null = null;

    for(const line of lines) {
      const isGraded = line.some(t => SIMDocument.patterns.grade.test(t));
      const isModule = line.some(t => SIMDocument.patterns.semester.test(t));

      if(!isGraded) continue;
      
      if(isModule) {
        if(line.length < 4)
          continue;

        const name = line[0]!;
        const semester = line[1]!;
        const cp = line[2]!;
        const grade = line[3]!;

        if(module)
          modules.push(module);

        module = { name, semester, cp: parseInt(cp), grade, exams: []}
      } else {
        if(!module) continue;

        if(line.length < 3) continue;

        const name = line[0]!;
        const date = line[1]!;
        const grade = line[2]!;

        module.exams.push({name, date: this.convertToDate(date), grade});
      }
    }

    return modules;
  }

  private async getLines() {
    const pageCount = this.pdf.numPages;
    let lines: string[][] = [];

    for(let i = 1; i <= pageCount; i++) {
      const textBlocks = await this.getTextBlocksOfPage(i);
      const sortedBlocks = this.sortTextBlocks(textBlocks);
      const linesOfPage = await this.groupBlocksToLines(sortedBlocks);
      
      lines = lines.concat(linesOfPage);
    }

    return lines;
  }

  private groupBlocksToLines(blocks: TextBlock[]) {
    const lines: string[][] = [];
    let line: string[] = [];

    let previousBlock: TextBlock | null = null;

    for(const block of blocks) {
      if(previousBlock) {
        const onSameLine = Math.abs(previousBlock.y - block.y) <= SIMDocument.Y_TOLERANCE;

        if(!onSameLine) {
          lines.push(line);
          line = [];
        }
      }

      line.push(block.text);
      previousBlock = block;
    }

    lines.push(line);
    return lines;
  }

  private async getTextBlocksOfPage(pageNumber: number) {
    const page = await this.pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    const textBlocks: TextBlock[] = [];

    for (const item of content.items) {
      const isTextItem = 'str' in item;

      if (!isTextItem) continue;

      const hasValidTransform =
        item.transform.length === 6 &&
        item.transform.some((v) => typeof v === 'number');

      const hasEmptyText = item.str.trim() == '';

      if (!hasValidTransform || hasEmptyText) continue;

      const x = item.transform[4];
      const y = item.transform[5];

      textBlocks.push({ text: item.str.trim(), x: x, y: y });
    }

    return textBlocks;
  }

  private sortTextBlocks(blocks: TextBlock[]) {
    return [...blocks].sort((a, b) => {
      const yDiff = b.y - a.y;

      if(Math.abs(yDiff) > SIMDocument.Y_TOLERANCE)
        return yDiff;

      const xDiff = a.x - b.x
      return xDiff;
    })
  }

  public async getProvisionalGrade() {
    const textBlocks = this.sortTextBlocks(await this.getTextBlocksOfPage(1));

    for(const block of textBlocks) {
      const pattern = SIMDocument.patterns.provisionalGrade;
      const match = block.text.match(pattern);

      if(match !== null && match.length == 1)
        return match[0];
    }
  }
}
