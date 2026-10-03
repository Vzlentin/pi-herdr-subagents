/**
 * Parent → child messages without touching the terminal.
 *
 * The parent writes one JSON file per message into the child's inbox; the child
 * (subagent-done.ts) polls it and delivers each message with pi.sendUserMessage.
 * No pane ids, no shell quoting, no bracketed-paste surprises.
 *
 * The inbox sits next to the child's activity file:
 *   <artifactDir>/subagent-activity/<id>.json  →  <artifactDir>/subagent-inbox/<id>/
 */
import { mkdirSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

export interface InboxMessage {
  text: string;
  from?: string;
  sentAt: number;
}

export function getSubagentInboxDir(activityFile: string): string {
  return join(dirname(dirname(activityFile)), "subagent-inbox", basename(activityFile, ".json"));
}

export function writeInboxMessage(dir: string, message: InboxMessage): string {
  mkdirSync(dir, { recursive: true });
  const base = join(dir, `${message.sentAt}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`);
  writeFileSync(`${base}.tmp`, JSON.stringify(message), "utf8");
  renameSync(`${base}.tmp`, `${base}.json`); // atomic: the reader never sees half a message
  return `${base}.json`;
}

/** Read and delete every complete message, oldest first. */
export function drainInbox(dir: string): InboxMessage[] {
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  } catch {
    return [];
  }
  const out: InboxMessage[] = [];
  for (const f of files) {
    const path = join(dir, f);
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8"));
      unlinkSync(path);
      if (typeof parsed?.text === "string" && parsed.text.trim()) out.push(parsed);
    } catch {
      // Unreadable or already taken: skip.
    }
  }
  return out;
}
