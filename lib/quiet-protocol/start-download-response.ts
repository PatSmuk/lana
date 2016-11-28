import * as assert from "assert";

import {
    QuietProtocolOpcode,
    QuietProtocolPacket,
    QuietProtocolResponseCode
} from "./index";

export interface StartDownloadResponsePacket extends QuietProtocolPacket {
    token: number;
    responseCode: QuietProtocolResponseCode;
    port?: number;
}

export function encodeStartDownloadResponsePacket(token: number, responseCode: QuietProtocolResponseCode, port?: number): Buffer {
    const payloadSize = 4 + 2 + (responseCode === QuietProtocolResponseCode.OK ? 2 : 0);
    const packet = Buffer.allocUnsafe(1 + 2 + payloadSize);

    let offset = 0;
    packet.writeUInt8(QuietProtocolOpcode.START_DOWNLOAD_RESPONSE, offset);
    offset += 1;
    packet.writeUInt16BE(payloadSize, offset);                      offset += 2;

    packet.writeUInt32BE(token, offset);                            offset += 4;
    packet.writeUInt16BE(responseCode, offset);                     offset += 2;

    if (responseCode === QuietProtocolResponseCode.OK) {
        assert(port);
        packet.writeUInt16BE(port!, offset);                         offset += 2;
    }

    return packet;
}

export function decodeStartDownloadResponsePacket(packet: Buffer): StartDownloadResponsePacket {
    assert(
        packet.length >= 4 + 2,
        "Expected payload length to be at least 6 bytes, got ${packet.length}"
    );

    let offset = 0;
    const token = packet.readUInt32BE(offset);                      offset += 4;
    const responseCode = packet.readUInt16BE(offset);               offset += 2;

    let port: number | undefined;
    if (responseCode === QuietProtocolResponseCode.OK) {
        assert(packet.length === 4 + 2 + 2);
        port = packet.readUInt16BE(offset);                         offset += 2;
    }

    return {
        opcode: QuietProtocolOpcode.START_DOWNLOAD_RESPONSE,
        token,
        responseCode,
        port
    };
}
