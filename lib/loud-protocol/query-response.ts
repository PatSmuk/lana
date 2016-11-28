import * as assert from "assert";

import {
    LoudProtocolOpcode,
    LoudProtocolPacket
} from "./index";

export interface QueryResponsePacket extends LoudProtocolPacket {
    senderName: string;
}

export function encodeQueryResponsePacket(senderName: string): Buffer {
    const payloadSize = senderName.length;
    const packet = Buffer.allocUnsafe(1 + 2 + payloadSize);

    let offset = 0;
    packet.writeUInt8(LoudProtocolOpcode.QUERY_RESPONSE, offset);   offset += 1;
    packet.writeUInt16BE(payloadSize, offset);                      offset += 2;

    packet.write(senderName, offset);                               offset += senderName.length;

    return packet;
}

export function decodeQueryResponsePacket(packet: Buffer): QueryResponsePacket {
    assert(
        packet.length > 0,
        "Expected payload length to be at least 1 byte, got ${packet.length}"
    );

    const senderName = packet.toString();

    return {
        opcode: LoudProtocolOpcode.QUERY_RESPONSE,
        senderName
    };
}
