import got from "got";
import type { Exam, Module } from "./document.js";

interface PushoverRecipient {
  userKey: string;
  deviceName?: string | undefined;
}

interface PushoverMessage {
  title: string;
  content: string;
}

export default class PushoverClient {
  constructor(private baseUrl: string, private apiKey: string) {}

  async pushMessage(recipient: PushoverRecipient, message: PushoverMessage) {
    const endpoint = "messages.json";
    const url = new URL(endpoint, this.baseUrl);

    const data: {
      token: string;
      user: string;
      device?: string;
      title: string;
      message: string;
    } = {
      token: this.apiKey,
      user: recipient.userKey,
      title: message.title,
      message: message.content,
    };

    if (recipient.deviceName) data.device = recipient.deviceName;

    await got.post(url, { form: data });
  }

  public static generateGradeAlert(
    moduleDelta: Module[],
    examDelta: Exam[]
  ): PushoverMessage {
    const title = "HTW Grade Alert 🎓";
    const lines: string[] = [];

    if (moduleDelta.length > 0) {
      lines.push("📋 Neue Modulergebnisse:");
      for (const m of moduleDelta) {
        const info = m.grade
          ? `Note: **${m.grade.toString().replace(".", ",")}**`
          : `Status: **${
              m.status === "passed" ? "Bestanden (BE)" : "Nicht bestanden"
            }**`;
        lines.push(`• [${m.code}] ${m.name}: ${info}`);
      }
    }

    if (examDelta.length > 0) {
      if (lines.length > 0) lines.push("");
      lines.push("📝 Neue Teilnoten / Prüfungen:");
      for (const e of examDelta) {
        const detail =
          e.percentage !== null
            ? `**${e.percentage.toString().replace(".", ",")}%**`
            : e.passed
            ? "Bestanden"
            : "Nicht bestanden";
        lines.push(`• ${e.name}: ${detail}`);
      }
    }

    return {
      title,
      content:
        lines.length > 0
          ? lines.join("\n")
          : "Keine relevanten Änderungen gefunden.",
    };
  }
}
