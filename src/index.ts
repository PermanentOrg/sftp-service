import "./instrument";
import { server } from "./server";
import { logger } from "./logger";
import type { ListenOptions } from "net";

const listenOptions: ListenOptions = {
	port: Number.parseInt(process.env.SSH_PORT ?? "22", 10),
	host: process.env.SSH_HOST ?? "127.0.0.1",
};

server.listen(listenOptions, () =>
	logger.info(
		`Listening for SSH requests on ${listenOptions.host ?? ""}:${String(listenOptions.port)}`,
	),
);
