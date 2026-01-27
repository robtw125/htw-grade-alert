import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";

import type { TextItem } from "pdfjs-dist/types/src/display/api.js";
import type { ModuleStatus } from "./db/schema/index.js";
import * as z from "zod";

interface TextElement {
  content: string;
  position: {
    x: number;
    y: number;
  };
  fontSize: number;
}

type Line = TextElement[];

export interface Module {
  code: number;
  name: string;
  semester: string;
  cp: number;
  status: ModuleStatus;
  grade: number | null;
  exams: Exam[];
}

export interface Exam {
  name: string;
  date: Date;
  passed: boolean;
  percentage: number | null;
}

type Transform = [number, number, number, number, number, number];

function assertArrayIsTransform(array: any[]): asserts array is Transform {
  if (array.length !== 6 || array.some((v) => typeof v !== "number"))
    throw new Error("Invalid PDF transform matrix: Expected 6 numbers");
}

export default class SIMDocument {
  private static Y_TOLERANCE = 3;

  private static patterns = {
    TITLE: /^\[\w+-(?<code>\d+)] (?<name>.*)/,
    DATE_STRING: /^(?<day>\d{2})[\/\.](?<month>\d{2})[\/\.](?<year>\d{4})$/,
    SEMESTER: /(?:WiSe|SoSe) \d{4}/,
    CP: /^\d{1,2}$/,
    GRADE_OR_PERCENTAGE: /\d{1,2},\d{1,2}/,
    PASSED: /^BE|VB|FV|HF$/,
    NOT_PASSED: /^NB|ENB|VB|FV$/,
  } as const;

  static async fromBase64(base64String: string): Promise<SIMDocument> {
    const pdfData = atob(base64String);
    const loadingTask = getDocument({ data: pdfData });
    const pdf = await loadingTask.promise;

    return new SIMDocument(pdf);
  }

  private constructor(private pdf: PDFDocumentProxy) {}

  //TODO: include the page number into the yPosition
  private mapToTextElement(textItem: TextItem): TextElement {
    assertArrayIsTransform(textItem.transform);

    const content = textItem.str.trim();
    const fontSize = textItem.transform[3];
    const xPosition = textItem.transform[4];
    const yPosition = textItem.transform[5];

    return {
      content,
      position: {
        x: xPosition,
        y: yPosition,
      },
      fontSize,
    };
  }

  private async getTextElements(pageNumber: number): Promise<TextElement[]> {
    const page = await this.pdf.getPage(pageNumber);
    const { items } = await page.getTextContent({
      includeMarkedContent: false,
    });

    return items
      .filter((i) => "str" in i)
      .map((i) => this.mapToTextElement(i))
      .filter((e) => e.content !== "");
  }

  private sortTextElements(elements: TextElement[]): TextElement[] {
    return [...elements].sort((a, b) => {
      const yDiff = b.position.y - a.position.y;

      if (Math.abs(yDiff) > SIMDocument.Y_TOLERANCE) return yDiff;

      const xDiff = a.position.x - b.position.x;
      return xDiff;
    });
  }

  private async getLinesOfPage(pageNumber: number): Promise<Line[]> {
    const textElements = await this.getTextElements(pageNumber);
    const sortedTextElements = this.sortTextElements(textElements);

    const lines: Line[] = [];
    let currentLine: Line = [];

    for (const element of sortedTextElements) {
      const previousElement = currentLine[currentLine.length - 1];

      if (
        previousElement &&
        Math.abs(previousElement.position.y - element.position.y) >
          SIMDocument.Y_TOLERANCE
      ) {
        currentLine = [];
      }

      if (currentLine.length === 0) {
        lines.push(currentLine);
      }

      currentLine.push(element);
    }

    return lines;
  }

  private getTitleElement(line: Line) {
    return line.find((e) => SIMDocument.patterns.TITLE.test(e.content));
  }

  private async getLines(): Promise<Line[]> {
    const pageCount = this.pdf.numPages;
    const lines: Line[] = [];

    for (let i = 1; i <= pageCount; i++) {
      const linesOfPage = await this.getLinesOfPage(i);
      lines.push(...linesOfPage);
    }

    return lines;
  }

  private static parseGermanFloat(text: string) {
    return parseFloat(text.replace(",", "."));
  }

  private static parseGermanDateString(text: string): Date | null {
    const match = text.match(SIMDocument.patterns.DATE_STRING);

    if (!match?.groups) return null;

    const year = parseInt(match.groups.year!, 10);
    const month = parseInt(match.groups.month!, 10) - 1;
    const day = parseInt(match.groups.day!, 10);

    const date = new Date(year, month, day);

    return isNaN(date.getTime()) ? null : date;
  }

  //TODO: refactor this hot mess
  public async parse() {
    const lines = await this.getGradeRelevantLines();

    const modules = [];

    let currentModule: Module | null = null;
    let exams: Exam[] = [];

    for (const line of lines) {
      const title = SIMDocument.getTextMatchOfLine(
        line,
        SIMDocument.patterns.TITLE
      );

      if (!title) continue;

      const { code, name } = this.parseTitle(title);

      if (!(code && name)) continue;

      const semester = SIMDocument.getTextMatchOfLine(
        line,
        SIMDocument.patterns.SEMESTER
      );

      const gradeOrPercentage = SIMDocument.getTextMatchOfLine(
        line,
        SIMDocument.patterns.GRADE_OR_PERCENTAGE
      );
      const passed = SIMDocument.getTextMatchOfLine(
        line,
        SIMDocument.patterns.PASSED
      );
      const notPassed = SIMDocument.getTextMatchOfLine(
        line,
        SIMDocument.patterns.NOT_PASSED
      );

      const isGraded = gradeOrPercentage || passed || notPassed ? true : false;

      const isModule = semester ? true : false;

      if (isModule) {
        if (currentModule) {
          let cmGraded = currentModule.status != "in_progress";

          if ((cmGraded && exams.length > 1) || (!cmGraded && exams.length > 0))
            currentModule.exams = exams;

          if (cmGraded || (!cmGraded && exams.length > 0))
            modules.push(currentModule);
        }

        exams = [];

        if (!semester) {
          currentModule = null;
          continue;
        }

        const cp = parseFloat(
          SIMDocument.getTextMatchOfLine(line, SIMDocument.patterns.CP) ?? "0"
        );

        let status: ModuleStatus = "in_progress";

        if (passed || gradeOrPercentage) {
          status = "passed";
        } else {
          if (notPassed) {
            status = "failed";
          }
        }

        currentModule = {
          code: code,
          name: name,
          semester: semester,
          cp,
          status,
          grade: gradeOrPercentage
            ? SIMDocument.parseGermanFloat(gradeOrPercentage)
            : null,
          exams: [],
        };
      } else {
        if (!isGraded || !currentModule || currentModule.code != code) continue;

        const dateString = SIMDocument.getTextMatchOfLine(
          line,
          SIMDocument.patterns.DATE_STRING
        );

        if (!dateString) continue;

        const date = SIMDocument.parseGermanDateString(dateString);

        if (!date) continue;

        let exam = {
          name,
          date,
          passed: passed || gradeOrPercentage ? true : false,
          percentage: gradeOrPercentage
            ? SIMDocument.parseGermanFloat(gradeOrPercentage)
            : null,
        };

        exams.push(exam);
      }
    }

    if (currentModule) {
      let cmGraded = currentModule.status != "in_progress";

      if ((cmGraded && exams.length > 1) || (!cmGraded && exams.length > 0))
        currentModule.exams = exams;

      if (cmGraded || (!cmGraded && exams.length > 0))
        modules.push(currentModule);
    }

    return modules;
  }

  private static getTextMatchOfLine(
    line: Line,
    pattern: RegExp
  ): string | null {
    const textElement = line.find((e) => pattern.test(e.content));
    return textElement?.content ?? null;
  }

  parseTitle(title: string) {
    const match = SIMDocument.patterns.TITLE.exec(title);

    if (!match?.groups) throw new Error("Invalid title!");

    const { code, name } = match.groups;

    if (!code || !name) return { code: null, name: null };

    return { code: parseFloat(code), name };
  }

  //TODO: check for y-diff (max)
  //needs another way to append text, since this is invalidating the position on the TextElement
  public async getGradeRelevantLines() {
    const totalLines = await this.getLines();
    const relevantLines: Line[] = [];

    let currentTitleElement: TextElement | null = null;

    for (const line of totalLines) {
      const titleElement = line.find((e) =>
        SIMDocument.patterns.TITLE.test(e.content)
      );

      if (titleElement) {
        currentTitleElement = titleElement;
        relevantLines.push(line);
        continue;
      } else {
        if (!currentTitleElement || line.length !== 1) continue;
        const { name } = this.parseTitle(currentTitleElement.content);

        if (!name) continue;

        const overhangElement = line[0];

        if (
          !overhangElement ||
          overhangElement.fontSize != currentTitleElement.fontSize ||
          overhangElement.content.includes(name) ||
          overhangElement.position.x !== currentTitleElement.position.x
        )
          continue;

        currentTitleElement.content += " " + overhangElement.content;
      }
    }

    return relevantLines;
  }
}
