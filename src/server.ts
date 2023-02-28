import { readFileSync } from 'fs';
import { Server } from 'ssh2';
import { logger } from './logger';
import {
  SshConnectionHandler,
  PermanentFileSystemManager,
} from './classes';
import type {
  Connection,
  ServerConfig,
} from 'ssh2';

const hostKeys = [];
if (typeof process.env.SSH_HOST_KEY_PATH === 'string') {
  hostKeys.push(readFileSync(process.env.SSH_HOST_KEY_PATH));
}

const serverConfig: ServerConfig = {
  hostKeys,
  debug: (message) => logger.silly(message),
};

const permanentFileSystemManager = new PermanentFileSystemManager();

const connectionListener = (client: Connection): void => {
  logger.verbose('New connection');
  const connectionHandler = new SshConnectionHandler(permanentFileSystemManager);
  client.on('authentication', connectionHandler.onAuthentication.bind(connectionHandler));
  client.on('close', connectionHandler.onClose.bind(connectionHandler));
  client.on('end', connectionHandler.onEnd.bind(connectionHandler));
  client.on('error', connectionHandler.onError.bind(connectionHandler));
  client.on('handshake', connectionHandler.onHandshake.bind(connectionHandler));
  client.on('ready', connectionHandler.onReady.bind(connectionHandler));
  client.on('rekey', connectionHandler.onRekey.bind(connectionHandler));
  client.on('request', connectionHandler.onRequest.bind(connectionHandler));
  client.on('session', connectionHandler.onSession.bind(connectionHandler));
  client.on('tcpip', connectionHandler.onTcpip.bind(connectionHandler));
};

const server = new Server(
  serverConfig,
  connectionListener,
);

export { server };
