import * as assert from "assert";

import {
    QuietProtocolOpcode,
    QuietProtocolPacket,
    QuietProtocolResponseCode
} from "./index";

export interface QueryResponsePacket extends QuietProtocolPacket {
    token: number;
    responseCode: QuietProtocolResponseCode;
    contents?: DirectoryEntry[];
}

export interface DirectoryEntry {
    type: "file" | "directory";
    name: string;
    size: number;
}

enum FileType {
    FILE,
    DIRECTORY
}

export function encodeQueryResponsePacket(token: number, responseCode: QuietProtocolResponseCode, contents?: DirectoryEntry[]): Buffer {
    if (responseCode !== QuietProtocolResponseCode.OK) {
        const payloadSize = 4 + 2;
        const packet = Buffer.allocUnsafe(1 + 2 + payloadSize);

        let offset = 0;
        packet.writeUInt8(QuietProtocolOpcode.QUERY_RESPONSE, offset);  offset += 1;
        packet.writeUInt16BE(payloadSize, offset);                  offset += 2;

        packet.writeUInt32BE(token, offset);                        offset += 4;
        packet.writeUInt16BE(responseCode, offset);                 offset += 2;

        return packet;
    }
    else {
        assert(contents !== undefined, "Expected contents if response code is OK");

        let payloadSize = 4 + 2 + 2;
        for (const entry of contents!) {
            payloadSize += 1 + 1 + entry.name.length + 4;
        }
        const packet = Buffer.allocUnsafe(1 + 2 + payloadSize);

        let offset = 0;
        packet.writeUInt8(QuietProtocolOpcode.QUERY_RESPONSE, offset);  offset += 1;
        packet.writeUInt16BE(payloadSize, offset);                  offset += 2;

        packet.writeUInt32BE(token, offset);                        offset += 4;
        packet.writeUInt16BE(responseCode, offset);                 offset += 2;
        packet.writeUInt16BE(contents!.length, offset);             offset += 2;

        for (const entry of contents!) {
            if (entry.type === "file") {
                packet.writeUInt8(FileType.FILE, offset);           offset += 1;
            }
            else if (entry.type === "directory") {
                packet.writeUInt8(FileType.DIRECTORY, offset);      offset += 1;
            }
            else {
                throw new Error(`Expected type to be 'file' or 'directory', got ${entry.type}`);
            }

            packet.writeUInt8(entry.name.length, offset);           offset += 1;
            packet.write(entry.name, offset);                       offset += entry.name.length;
            packet.writeUInt32BE(entry.size, offset);               offset += 4;
        }

        return packet;
    }
}

export function decodeQueryResponsePacket(packet: Buffer): QueryResponsePacket {
    assert(
        packet.length >= 4 + 2,
        `Expected payload length to be at least 6 bytes, got ${packet.length}`
    );

    let offset = 0;
    const token = packet.readUInt32BE(offset);                      offset += 4;
    const responseCode = packet.readUInt16BE(offset);               offset += 2;

    if (responseCode !== QuietProtocolResponseCode.OK) {
        return {
            opcode: QuietProtocolOpcode.QUERY_RESPONSE,
            token,
            responseCode
        };
    }

    const contents: DirectoryEntry[] = [];
    const entryCount = packet.readUInt16BE(offset);                 offset += 2;

    for (let i = 0; i < entryCount; i++) {
        assert(
            packet.length - offset >= 1 + 1 + 1 + 4,
            `Expected at least 7 more bytes, only got ${packet.length - offset}`
        );
        const type = packet.readUInt8(offset);                      offset += 1;
        const nameLength = packet.readUInt8(offset);                offset += 1;
        const name = packet.slice(offset, offset + nameLength).toString();  offset += nameLength;
        const size = packet.readUInt32BE(offset);                   offset += 4;

        assert(
            type === FileType.FILE || type === FileType.DIRECTORY,
            `Expected type to be ${FileType.FILE} or ${FileType.DIRECTORY}, got ${type}`
        );

        contents.push({
            type: type === FileType.FILE ? "file" : "directory",
            name,
            size
        });
    }

    return {
        opcode: QuietProtocolOpcode.QUERY_RESPONSE,
        token,
        responseCode,
        contents
    };
}
