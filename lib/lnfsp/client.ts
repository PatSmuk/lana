import * as dgram from "dgram";
import { EventEmitter } from "events";
import * as fs from "fs";
import * as net from "net";
import * as path from "path";

import {
    LoudProtocolOpcode,
    LoudProtocolPacket,
    QueryPacket as LoudQueryPacket,
    QueryResponsePacket,
    decodeLoudProtocolPacket,
    encodeQueryPacket,
    encodeQueryResponsePacket as encodeLoudQueryResponsePacket
} from "../loud-protocol";

import {
    InitializePacket,
    QueryPacket as QuietQueryPacket,
    QuietProtocolOpcode,
    QuietProtocolPacket,
    QuietProtocolResponseCode,
    StartDownloadPacket,
    encodeInitializeResponsePacket,
    encodeQueryResponsePacket as encodeQuietQueryResponsePacket,
    encodeStartDownloadResponsePacket,
    decodeQuietProtocolPacket
} from "../quiet-protocol";

import {
    createSocketBuffer
} from "../socket-buffer";

import {
    Peer
} from "./peer";

interface FileEntry {
    type: "file";
    name: string;
    size: number;
    fsPath: string;
}

interface DirectoryEntry {
    type: "directory";
    name: string;
    size: number;
    contents: FileOrDirectoryEntry[];
}

type FileOrDirectoryEntry = FileEntry | DirectoryEntry;

const LOUD_ADDRESS = "224.0.0.16";
const LOUD_PORT = 8085;
const QUIET_PORT = 8086;

export class Client extends EventEmitter {
    private name: string;
    private root: FileOrDirectoryEntry[];
    private loudSocket: dgram.Socket;
    private quietServer: net.Server;
    private peers = new Set<string>();

    constructor(name: string) {
        super();
        this.name = name;
        this.root = [];
    }

    start(): void {
        // Open a UDP socket, bind to the predefined multicast port,
        //   add a message handler, and query for peers.
        this.loudSocket = dgram.createSocket("udp4");
        this.loudSocket.bind(LOUD_PORT);
        this.loudSocket.addMembership(LOUD_ADDRESS);

        this.loudSocket.on("message", (message: Buffer, rinfo: dgram.RemoteInfo) => {
            this.handleLoudPacket(decodeLoudProtocolPacket(message), rinfo.address);
        });
        this.loudSocket.on("error", (err) => {
            console.log(`Failed to bind dgram socket: ${err}`);
        });

        this.loudSocket.send(encodeQueryPacket(this.name), LOUD_PORT, LOUD_ADDRESS);

        // Listen for TCP connections on `port` with a Quiet LNFSP handler.
        this.quietServer = net.createServer();
        this.quietServer.listen(QUIET_PORT);

        this.quietServer.on("connection", async (socket: net.Socket) => {
            const socketBuffer = createSocketBuffer(socket);
            for (;;) {
                const packet = await decodeQuietProtocolPacket(socketBuffer);
                if (!packet) {
                    break;
                }
                this.handleQuietPacket(packet, socket);
            }
        });
        this.quietServer.on("error", (err) => {
            console.log(`Failed to bind tcp socket: ${err}`);
        });
    }

    publish(fsPath: string, virtualPath: string): void {
        // Find the array that holds the contents of the directory that
        //   we're trying to put this thing into.
        let directoryContents = this.root;
        for (const step of virtualPath.split("/").slice(1)) {
            for (const entry of directoryContents) {
                let foundDirectory = false;
                if (entry.name === step) {
                    if (entry.type !== "directory") {
                        return;
                    }
                    foundDirectory = true;
                    directoryContents = entry.contents;
                    break;
                }
                if (!foundDirectory) {
                    return;
                }
            }
        }

        // Now put this thing into the array.
        this.publishInDirectory(fsPath, directoryContents);
    }

    private publishInDirectory(fsPath: string, directoryContents: FileOrDirectoryEntry[]) {
        console.log(`Publishing ${fsPath}`);
        fs.stat(fsPath, (err, stats) => {
            if (err) {
                console.log(`Could not stat ${fsPath}: ${err}`);
                return;
            }
            if (stats.isFile()) {
                directoryContents.push({
                    type: "file",
                    name: path.parse(fsPath).base,
                    size: stats.size,
                    fsPath
                });
            }
            else if (stats.isDirectory()) {
                fs.readdir(fsPath, (err, contents) => {
                    if (err) {
                        console.log(`Could not readdir ${fsPath}: ${err}`)
                        return;
                    }
                    const directoryEntry: DirectoryEntry = {
                        type: "directory",
                        name: path.parse(fsPath).base,
                        size: contents.length,
                        contents: []
                    };
                    directoryContents.push(directoryEntry);
                    for (const item in contents) {
                        this.publishInDirectory(path.join(fsPath, item), directoryEntry.contents);
                    }
                });
            }
        });
    }

    unpublish(path: string): void {
        const result = this.findEntry(path);
        if (!result) {
            console.log(`Couldn't find ${path}`);
            return;
        }
        const [_, directoryContents, i] = result!;
        directoryContents.splice(i, 1);
    }

    private findEntry(path: string): [FileOrDirectoryEntry, FileOrDirectoryEntry[], number] | null {
        let directoryContents = this.root;
        const virtualPathSteps = path.split("/");
        for (const step of virtualPathSteps.slice(1, -1)) {
            for (const entry of directoryContents) {
                let foundDirectory = false;
                if (entry.name === step) {
                    if (entry.type !== "directory") {
                        return null;
                    }
                    foundDirectory = true;
                    directoryContents = entry.contents;
                    break;
                }
                if (!foundDirectory) {
                    return null;
                }
            }
        }

        const entryName = virtualPathSteps[virtualPathSteps.length - 1];
        for (let i = 0; i < directoryContents.length; i++) {
            if (directoryContents[i].name === entryName) {
                return [directoryContents[i], directoryContents, i];
            }
        }
        return null;
    }

    setName(name: string): void {
        this.name = name;
    }

    private handleLoudPacket(packet: LoudProtocolPacket, senderIp: string) {
        console.log(`LOUD: Got packet ${LoudProtocolOpcode[packet.opcode]}`);
        switch (packet.opcode) {
            case LoudProtocolOpcode.QUERY: {
                // When we receive a query, send a response and open a connection.
                this.loudSocket.send(encodeLoudQueryResponsePacket(this.name), LOUD_PORT, LOUD_ADDRESS);
                this.connectToPeer(senderIp, (packet as LoudQueryPacket).senderName);
                break;
            }
            case LoudProtocolOpcode.QUERY_RESPONSE: {
                // When we receive a response, connect if we aren't already.
                this.connectToPeer(senderIp, (packet as QueryResponsePacket).senderName);
                break;
            }
        }
    }

    connectToPeer(ip: string, name: string) {
        if (this.peers.has(ip)) {
            return;
        }
        this.peers.add(ip);
        const peer = new Peer(ip, QUIET_PORT, name);
        peer.on("error", () => {
            this.peers.delete(ip);
        });
        peer.on("disconnect", () => {
            this.peers.delete(ip);
        });
        peer.on("connect", () => {
            this.emit("newPeer", peer);
        });
    }

    private handleQuietPacket(packet: QuietProtocolPacket, sender: net.Socket) {
        console.log(`QUIET: Got packet ${QuietProtocolOpcode[packet.opcode]}`);
        switch (packet.opcode) {
            case QuietProtocolOpcode.INITIALIZE: {
                const { versionMatched } = packet as InitializePacket;
                if (!versionMatched) {
                    sender.write(encodeInitializeResponsePacket(QuietProtocolResponseCode.INITIALIZE_WRONG_VERSION));
                    sender.destroy();
                    return;
                }
                sender.write(encodeInitializeResponsePacket(QuietProtocolResponseCode.OK));
                break;
            }
            case QuietProtocolOpcode.QUERY: {
                const { directoryPath, token } = packet as QuietQueryPacket;

                const result = this.findEntry(directoryPath);
                if (!result) {
                    sender.write(encodeQuietQueryResponsePacket(token, QuietProtocolResponseCode.QUERY_DIRECTORY_NOT_FOUND));
                    return;
                }

                const directory = result![0];
                if (directory.type !== "directory") {
                    sender.write(encodeQuietQueryResponsePacket(token, QuietProtocolResponseCode.QUERY_DIRECTORY_NOT_FOUND));
                    return;
                }

                sender.write(encodeQuietQueryResponsePacket(token, QuietProtocolResponseCode.OK, directory.contents));
                break;
            }
            case QuietProtocolOpcode.START_DOWNLOAD: {
                const { token, filePath, startOffset } = packet as StartDownloadPacket;

                const result = this.findEntry(filePath);
                if (!result) {
                    sender.write(encodeStartDownloadResponsePacket(token, QuietProtocolResponseCode.START_DOWNLOAD_FILE_NOT_FOUND));
                    return;
                }

                const file = result![0];
                if (file.type !== "file") {
                    sender.write(encodeStartDownloadResponsePacket(token, QuietProtocolResponseCode.START_DOWNLOAD_FILE_NOT_FOUND));
                    return;
                }

                const server = net.createServer();
                server.listen(undefined as any);
                server.on("connection", (socket) => {
                    const stream = fs.createReadStream(file.fsPath);
                    stream.pipe(socket);
                    server.close();
                });

                sender.write(encodeStartDownloadResponsePacket(token, QuietProtocolResponseCode.START_DOWNLOAD_FILE_NOT_FOUND, server.address().port));
                break;
            }
        }
    }
}
