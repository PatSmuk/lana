import * as assert from "assert";
import { EventEmitter } from "events";
import * as net from "net";
import { Readable } from "stream";

import {
    DirectoryEntry,
    InitializeResponsePacket,
    QueryResponsePacket,
    QuietProtocolOpcode,
    QuietProtocolPacket,
    QuietProtocolResponseCode,
    StartDownloadResponsePacket,
    decodeQuietProtocolPacket,
    encodeInitializePacket,
    encodeQueryPacket,
    encodeStartDownloadPacket
} from "../quiet-protocol";

import {
    SocketBuffer,
    createSocketBuffer
} from "../socket-buffer";

export class Peer extends EventEmitter {
    private name: string;
    private ip: string;
    private connected = false;
    private socket: net.Socket;
    private nextQueryToken = 0;
    private nextDownloadToken = 0;
    private pendingQueries = new Map<number, [(entries: DirectoryEntry[]) => void, (err: any) => void]>();
    private pendingDownloads = new Map<number, [(downloadStream: NodeJS.ReadableStream) => void, (err: any) => void]>();
    private downloadSockets = new Map<number, net.Socket>();

    constructor(ip: string, port: number, name: string) {
        super();
        this.name = name;
        this.ip = ip;

        this.socket = net.connect(port, ip);
        this.socket.on("error", (err) => {
            if (!this.connected) {
                this.emit("error", err);
            }
        });
        this.socket.on("close", () => {
            this.emit("disconnect");
        });
        this.socket.on("connect", async () => {
            console.log(`Connected to peer at ${this.ip}`);
            this.socket.write(encodeInitializePacket());

            const socketBuffer = createSocketBuffer(this.socket);
            try {
                for (;;) {
                    const packet = await decodeQuietProtocolPacket(socketBuffer);
                    if (!packet) {
                        break;
                    }
                    this.handleQuietProtocolPacket(packet);
                }
            }
            catch (err) {
                console.error(`QUIET(peer): Error while decoding/handling packet: ${err}`);
            }
        });
    }

    queryDirectory(path: string): Promise<DirectoryEntry[]> {
        return new Promise<DirectoryEntry[]>((resolve, reject) => {
            const token = this.nextQueryToken++;
            this.socket.write(encodeQueryPacket(path, token));
            this.pendingQueries.set(token, [resolve, reject]);
        });
    }

    startDownload(path: string, startOffset: number): Promise<NodeJS.ReadableStream> {
        return new Promise<NodeJS.ReadableStream>((resolve, reject) => {
            const token = this.nextDownloadToken++;
            this.socket.write(encodeStartDownloadPacket(token, path, startOffset));
            this.pendingDownloads.set(token, [resolve, reject]);
        });
    }

    stopDownload(token: number): void {
        if (this.downloadSockets.has(token)) {
            this.downloadSockets.get(token)!.destroy();
        }
        else if (this.pendingDownloads.has(token)) {
            this.pendingDownloads.delete(token);
        }
    }

    getName(): string {
        return this.name;
    }

    private handleQuietProtocolPacket(packet: QuietProtocolPacket): void {
        console.log(`QUIET(peer): Got packet ${QuietProtocolOpcode[packet.opcode]}`);
        switch (packet.opcode) {
            case QuietProtocolOpcode.INITIALIZE_RESPONSE: {
                const { responseCode } = packet as InitializeResponsePacket;

                if (responseCode !== QuietProtocolResponseCode.OK) {
                    console.error(`Failed to open connection to peer (error code ${responseCode})`);
                    return;
                }

                this.connected = true;
                this.emit("connect");
                break;
            }
            case QuietProtocolOpcode.QUERY_RESPONSE: {
                const { token, responseCode, contents } = packet as QueryResponsePacket;
                if (!this.pendingQueries.has(token)) {
                    return;
                }
                const [resolve, reject] = this.pendingQueries.get(token)!;
                this.pendingQueries.delete(token);

                if (responseCode !== QuietProtocolResponseCode.OK) {
                    console.error(`Query failed (error code ${responseCode})`);
                    reject(new Error(`Query failed (error code ${responseCode})`));
                    return;
                }

                assert(contents);
                resolve(contents!);
                break;
            }
            case QuietProtocolOpcode.START_DOWNLOAD_RESPONSE: {
                const { token, responseCode, port } = packet as StartDownloadResponsePacket;
                if (!this.pendingDownloads.has(token)) {
                    return;
                }
                const [resolve, reject] = this.pendingDownloads.get(token)!;
                this.pendingDownloads.delete(token);

                if (responseCode !== QuietProtocolResponseCode.OK) {
                    console.error(`Download failed (error code ${responseCode})`);
                    reject(new Error(`Download failed (error code ${responseCode})`));
                    return;
                }

                assert(port);
                const socket = net.connect(port!, this.ip);
                let connected = false;
                socket.on("connect", () => {
                    connected = true;
                    this.downloadSockets.set(token, socket);
                    resolve(socket as NodeJS.ReadableStream);
                });
                socket.on("error", (err) => {
                    if (!connected) {
                        reject(err);
                    }
                });
                socket.on("close", () => {
                    this.downloadSockets.delete(token);
                });

                break;
            }
            default: {
                console.error("Unrecognized opcode: ${packet.opcode}");
                break;
            }
        }
    }
}
