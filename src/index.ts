import { dirname, resolve } from 'node:path';
import pino from 'pino';
import { BridgeApp } from './bridge.js';
import { CodexProvider } from './codex/codexProvider.js';
import { loadConfig, parseArgs } from './config.js';
import { HermesClient } from './hermes/hermesClient.js';
import { SessionStore } from './store/sessionStore.js';

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });

async function main() {
  const { configPath } = parseArgs(process.argv.slice(2));
  const absoluteConfigPath = resolve(configPath);
  const config = await loadConfig(absoluteConfigPath);
  const baseDir = dirname(absoluteConfigPath);
  const store = new SessionStore(resolve(baseDir, 'state.json'));
  const hermes = new HermesClient(config.hermes);
  await hermes.connect();

  const app = new BridgeApp(config, store, hermes, new CodexProvider(), resolve(baseDir, 'runs'));
  log.info({ configPath: absoluteConfigPath }, 'codex-qq-bridge started');

  while (true) {
    try {
      const messages = await hermes.waitMessages();
      for (const message of messages) {
        void app.handleMessage(message).catch((error) => log.error({ error }, 'failed to handle message'));
      }
    } catch (error) {
      log.error({ error }, 'Hermes polling failed');
      await new Promise((resolveRetry) => setTimeout(resolveRetry, 3000));
    }
  }
}

main().catch((error) => {
  log.fatal({ error }, 'codex-qq-bridge crashed');
  process.exitCode = 1;
});
