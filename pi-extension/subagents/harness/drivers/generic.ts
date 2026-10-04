import type {
  HarnessDriver,
  SubagentLaunchContext,
  BuiltHarnessCommand,
  SubagentResultContext,
  HarnessResult,
} from "../types.ts";
import type { ResolvedRuntimePlan } from "../../runtime-routing.ts";
import { extractPaneSummary } from "../pane-summary.ts";

export class GenericHarnessDriver implements HarnessDriver {
  readonly id: string;
  readonly name: string;
  readonly hasActivitySnapshots = false;
  readonly supportsTurnInterrupt = false;

  constructor(cliId = "generic", displayName?: string) {
    this.id = cliId;
    this.name = displayName ?? cliId;
  }

  formatModel(runtimePlan: Pick<ResolvedRuntimePlan, "model" | "modelId" | "provider">): string {
    return runtimePlan.modelId;
  }

  buildCommand(context: SubagentLaunchContext): BuiltHarnessCommand {
    const {
      params,
      agentDefs,
      effectiveModel,
      effectiveCwd,
      surface,
      shellQuote,
      inheritsConversationContext,
      roleBlock,
      modeHint,
      summaryInstruction,
    } = context;

    const fullTask = inheritsConversationContext
      ? params.task
      : `${roleBlock ?? ""}\n\n${modeHint ?? ""}\n\n${params.task}\n\n${summaryInstruction ?? ""}`;

    const template = agentDefs?.commandTemplate;
    let commandBody: string;

    if (template) {
      const quotedTask = shellQuote(fullTask);
      const replacements: Record<string, string> = {
        model: effectiveModel ? shellQuote(effectiveModel) : "",
        task: quotedTask,
        prompt: quotedTask,
        cwd: effectiveCwd ? shellQuote(effectiveCwd) : ".",
        name: shellQuote(params.name),
        id: shellQuote(params.id),
      };
      // One pass keeps placeholders and dollar patterns in values literal.
      commandBody = template.replace(/\{(model|task|prompt|cwd|name|id)\}/g, (_match, key: string) => replacements[key]);
    } else {
      const binary = this.id === "generic" ? (agentDefs?.cli ?? "subagent") : this.id;
      const cmdParts: string[] = [binary];

      if (effectiveModel) {
        cmdParts.push("--model", shellQuote(effectiveModel));
      }

      const sp = params.systemPrompt ?? agentDefs?.body;
      if (sp) {
        cmdParts.push("--system-prompt", shellQuote(sp));
      }

      cmdParts.push(shellQuote(fullTask));
      commandBody = cmdParts.join(" ");
    }

    const cdPrefix = effectiveCwd ? `cd ${shellQuote(effectiveCwd)} && ` : "";
    const command = `${cdPrefix}${commandBody}; echo '__SUBAGENT_DONE_'$?'__'`;

    return {
      command,
      cli: this.id,
      launchScriptPreamble: [
        `# ${this.name} subagent launch script for ${params.name}`,
        `# Generated: ${new Date().toISOString()}`,
        `# Surface: ${surface}`,
      ],
    };
  }

  async extractResult(context: SubagentResultContext): Promise<HarnessResult | null> {
    return { summary: extractPaneSummary(context, this.name) };
  }
}
