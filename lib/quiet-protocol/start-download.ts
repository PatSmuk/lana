import * as assert from "assert";

import {
    QuietProtocolOpcode,
    QuietProtocolPacket
} from "./index";

export interface StartDownloadPacket extends QuietProtocolPacket {
    token: number;
    filePath: string;
    startOffset: number;
}

export function encodeStartDownloadPacket(token: number, filePath: string, startOffset: number): Buffer {
    const payloadSize = 4 + 4 + 2 + filePath.length;
    const packet = Buffer.allocUnsafe(1 + 2 + payloadSize);

    let offset = 0;
    packet.writeUInt8(QuietProtocolOpcode.START_DOWNLOAD, offset);  offset += 1;
    packet.writeUInt16BE(payloadSize, offset);                      offset += 2;

    packet.writeUInt32BE(token, offset);                            offset += 4;
    packet.writeUInt32BE(startOffset, offset);                      offset += 4;
    packet.writeUInt16BE(filePath.length, offset);                  offset += 2;
    packet.write(filePath, offset);                                 offset += filePath.length;

    return packet;
}

export function decodeStartDownloadPacket(packet: Buffer): StartDownloadPacket {
    assert(
        packet.length >= 4 + 4 + 2,
        `decodeStartDownloadPacket: Expected payload length to be at least 6 bytes, got ${packet.length}`
    );

    let offset = 0;
    const token = packet.readUInt32BE(offset);                      offset += 4;
    const startOffset = packet.readUInt32BE(offset);                offset += 4;
    const filePathLength = packet.readUInt16BE(offset);             offset += 2;
    const filePath = packet.slice(offset).toString();               offset += filePathLength;

    return {
        opcode: QuietProtocolOpcode.START_DOWNLOAD,
        token,
        filePath,
        startOffset
    };
}
