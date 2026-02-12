import { Agent } from '../../agent/agent.js';
import { MessageStream } from '../../agent/message-stream.js';
import type { UIEvent } from '../../agent/message-stream.js';
import type { RoleConfig } from '../../roles/types.js';
import { SettingsStore } from '../../settings/store.js';
import { getSettingsPath } from '../../utils/paths.js';
import { resolveRoleWithSelector } from './role-selection.js';
import { formatTextOutput, formatJsonOutput, StreamJsonWriter } from './print-formatters.js';

export interface PrintOptions {
  print: string;
  role?: string;
  repo?: string;
  rolesDir?: string;
  verbose?: boolean;
  outputFormat?: string;
  maxTurns?: string;
  allowedTools?: string;
  systemPrompt?: string;
  appendSystemPrompt?: string;
}

export async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return '';
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

export function buildPromptWithStdin(prompt: string, stdinContent: string): string {
  if (!stdinContent) return prompt;
  return `<stdin>\n${stdinContent}\n</stdin>\n\n${prompt}`;
}

export function applyRoleOverrides(role: RoleConfig, options: PrintOptions): RoleConfig {
  const modified = {
    ...role,
    frontmatter: { ...role.frontmatter },
    body: role.body,
  };

  if (options.maxTurns) {
    const parsed = parseInt(options.maxTurns, 10);
    if (isNaN(parsed) || parsed <= 0) {
      console.error(`Error: Invalid --max-turns value "${options.maxTurns}": must be a positive integer`);
      process.exit(1);
    }
    modified.frontmatter.maxTurns = parsed;
  }

  if (options.allowedTools?.trim()) {
    modified.frontmatter.tools = options.allowedTools.split(',').map(t => t.trim());
  }

  if (options.systemPrompt) {
    modified.body = options.systemPrompt;
  } else if (options.appendSystemPrompt) {
    modified.body = role.body + '\n\n' + options.appendSystemPrompt;
  }

  return modified;
}

export async function printAction(options: PrintOptions): Promise<void> {
  // 1. Validate --role is required
  if (!options.role) {
    console.error('Error: --role is required when using -p/--print mode');
    process.exit(1);
  }

  // 2. Validate --output-format
  const VALID_FORMATS = ['text', 'json', 'stream-json'];
  const outputFormat = options.outputFormat ?? 'text';
  if (!VALID_FORMATS.includes(outputFormat)) {
    console.error(`Error: Invalid --output-format "${outputFormat}". Must be one of: ${VALID_FORMATS.join(', ')}`);
    process.exit(1);
  }

  // 3. Resolve repo path and settings
  const repoPath = options.repo ?? process.cwd();
  const settingsStore = new SettingsStore(getSettingsPath(repoPath));
  const settings = settingsStore.get();

  // 4. Read stdin
  const stdinContent = await readStdin();
  const prompt = buildPromptWithStdin(options.print, stdinContent);

  // 5. Resolve role (resolveRoleWithSelector with a dummy selector that throws)
  const { role } = await resolveRoleWithSelector(
    options as any,  // PrintOptions is compatible with StartOptions for role/repo/rolesDir
    () => { throw new Error('Interactive role selection is not available in print mode'); },
  );

  // 6. Apply overrides
  const modifiedRole = applyRoleOverrides(role, options);

  // 7. Verbose output to stderr
  if (options.verbose) {
    console.error(`Role: ${modifiedRole.frontmatter.name}`);
    console.error(`Role file: ${modifiedRole.filePath}`);
    console.error(`Max turns: ${modifiedRole.frontmatter.maxTurns}`);
    console.error(`Permission mode: ${modifiedRole.frontmatter.permissionMode}`);
    console.error(`Output format: ${outputFormat}`);
    if (settings.model) console.error(`Model: ${settings.model}`);
    if (settings.language) console.error(`Language: ${settings.language}`);
    if (stdinContent) console.error(`Stdin: ${stdinContent.length} bytes`);
  }

  // 8. Create Agent and MessageStream
  const agent = new Agent(repoPath, settings);
  const messageStream = new MessageStream();

  // 9. Set up streaming output
  const streamWriter = outputFormat === 'stream-json' ? new StreamJsonWriter() : null;
  let sessionId = '';

  agent.on('message', (message) => {
    const events = messageStream.processMessage(message);
    if (!events) return;

    const eventArray = Array.isArray(events) ? events : [events];
    for (const event of eventArray) {
      // Capture sessionId from init events
      if (event.type === 'init') {
        sessionId = event.sessionId;
      }
      // Stream output if stream-json mode
      if (streamWriter) {
        streamWriter.writeEvent(event);
      }
    }
  });

  // 10. Handle SIGINT
  const handleSigint = async () => {
    await agent.interrupt();
    process.exit(130);
  };
  process.on('SIGINT', handleSigint);

  // 11. Execute
  try {
    const result = await agent.execute(prompt, modifiedRole);

    // Flush any remaining stream buffer
    const flushed = messageStream.flushStream();
    if (flushed && streamWriter) {
      streamWriter.writeEvent(flushed);
    }

    // 12. Output result based on format
    if (outputFormat === 'text') {
      const text = formatTextOutput(result);
      if (text) {
        process.stdout.write(text + '\n');
      }
    } else if (outputFormat === 'json') {
      const finalSessionId = sessionId || (streamWriter?.getSessionId() ?? '');
      const totalTokens = messageStream.totalTokens;
      const json = formatJsonOutput(result, finalSessionId, modifiedRole.frontmatter.name, totalTokens);
      process.stdout.write(json + '\n');
    }
    // stream-json: already written via streamWriter during execution

    process.exit(result.success ? 0 : 1);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}
