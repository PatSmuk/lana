import * as assert from "assert";

import {
    LoudProtocolOpcode,
    LoudProtocolPacket
} from "./index";

export interface QueryPacket extends LoudProtocolPacket {
    senderName: string;
}

export function encodeQueryPacket(senderName: string): Buffer {
    const payloadSize = senderName.length;
    const packet = Buffer.allocUnsafe(1 + 2 + payloadSize);

    let offset = 0;
    packet.writeUInt8(LoudProtocolOpcode.QUERY, offset);            offset += 1;
    packet.writeUInt16BE(payloadSize, offset);                      offset += 2;

    packet.write(senderName, offset);                               offset += senderName.length;

    return packet;
}

export function decodeQueryPacket(packet: Buffer): QueryPacket {
    assert(
        packet.length > 0,
        "Expected payload length to be at least 1 byte, got ${packet.length}"
    );

    const senderName = packet.toString();

    return {
        opcode: LoudProtocolOpcode.QUERY,
        senderName
    };
}
