import * as assert from "assert";

import {
    QuietProtocolOpcode,
    QuietProtocolPacket
} from "./index";

export interface QueryPacket extends QuietProtocolPacket {
    directoryPath: string;
    token: number;
}

export function encodeQueryPacket(directoryPath: string, token: number): Buffer {
    assert(directoryPath.length >= 1, "Expected directory path to be at least one char long");
    assert(directoryPath[0] === "/", "Expected directory path to start with '/'");

    const payloadSize = 4 + 2 + directoryPath.length;
    const packet = Buffer.allocUnsafe(1 + 2 + payloadSize);

    let offset = 0;
    packet.writeUInt8(QuietProtocolOpcode.QUERY, offset);           offset += 1;
    packet.writeUInt16BE(payloadSize, offset);                      offset += 2;

    packet.writeUInt32BE(token, offset);                            offset += 4;

    packet.writeUInt16BE(directoryPath.length, offset);             offset += 2;
    packet.write(directoryPath, offset);                            offset += directoryPath.length;

    return packet;
}

export function decodeQueryPacket(packet: Buffer): QueryPacket {
    assert(
        packet.length === 4 + 2,
        `Expected payload length to be 6 bytes, got ${packet.length}`
    );

    let offset = 0;
    const token = packet.readUInt32BE(offset);                      offset += 4;
    const directoryPathLength = packet.readUInt16BE(offset);        offset += 2;
    const directoryPath = packet.slice(offset).toString();

    return {
        opcode: QuietProtocolOpcode.QUERY,
        token,
        directoryPath
    };
}
