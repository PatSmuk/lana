import * as assert from "assert";

import {
    QUIET_PROTOCOL_VERSION,
    QuietProtocolOpcode,
    QuietProtocolPacket
} from "./index";

export interface InitializePacket extends QuietProtocolPacket {
    versionMatched: boolean;
}

export function encodeInitializePacket(): Buffer {
    const payloadSize = 2;
    const packet = Buffer.allocUnsafe(1 + 2 + payloadSize);

    let offset = 0;
    packet.writeUInt8(QuietProtocolOpcode.INITIALIZE, offset);      offset += 1;
    packet.writeUInt16BE(payloadSize, offset);                      offset += 2;

    packet.writeUInt16BE(QUIET_PROTOCOL_VERSION, offset);           offset += 2;

    return packet;
}

export function decodeInitializePacket(packet: Buffer): InitializePacket {
    assert(
        packet.length === 2,
        "Expected payload length to be 2, got ${packet.length}"
    );

    let offset = 0;
    const version = packet.readUInt16BE(offset);                    offset += 2;

    return {
        opcode: QuietProtocolOpcode.INITIALIZE,
        versionMatched: version === QUIET_PROTOCOL_VERSION
    };
}
