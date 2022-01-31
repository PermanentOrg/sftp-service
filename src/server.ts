import { readFileSync } from 'fs';
import { Server } from 'ssh2';
import type {
  Connection,
  ServerConfig,
} from 'ssh2';
import { logger } from './logger';
import { SshConnectionHandler } from './classes/SshConnectionHandler';

const hostKeys = [];
if (typeof process.env.SSH_HOST_KEY_PATH == 'string') {
  hostKeys.push(readFileSync(process.env.SSH_HOST_KEY_PATH));
}

const serverConfig: ServerConfig = {
  hostKeys,
};

const connectionListener = ( client: Connection ): void => {
  logger.verbose('New connection');
  const connectionHandler = new SshConnectionHandler();
  client.on('authentication', connectionHandler.onAuthentication);
  client.on('close', connectionHandler.onClose);
  client.on('end', connectionHandler.onEnd);
  client.on('error', connectionHandler.onError);
  client.on('handshake', connectionHandler.onHandshake);
  client.on('ready', connectionHandler.onReady);
  client.on('rekey', connectionHandler.onRekey);
  client.on('request', connectionHandler.onRequest);
  client.on('session', connectionHandler.onSession);
  client.on('tcpip', connectionHandler.onTcpip);
};

const server = new Server(
  serverConfig,
  connectionListener,
);

export { server };
