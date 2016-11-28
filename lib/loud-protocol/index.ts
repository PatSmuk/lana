import * as assert from "assert";

import {
    SocketBuffer
} from "../socket-buffer";

import {
    QueryPacket,
    decodeQueryPacket,
    encodeQueryPacket
} from "./query";

import {
    QueryResponsePacket,
    decodeQueryResponsePacket,
    encodeQueryResponsePacket
} from "./query-response";

export {
    QueryPacket,
    QueryResponsePacket,
    encodeQueryPacket,
    encodeQueryResponsePacket
};

export enum LoudProtocolOpcode {
    QUERY,
    QUERY_RESPONSE
}

export interface LoudProtocolPacket {
    opcode: LoudProtocolOpcode;
}

const decoders = {
    [LoudProtocolOpcode.QUERY           ]: decodeQueryPacket,
    [LoudProtocolOpcode.QUERY_RESPONSE  ]: decodeQueryResponsePacket
};

export function decodeLoudProtocolPacket(packet: Buffer): LoudProtocolPacket {
    assert(packet.length >= 1);

    const opcode = packet.readUInt8(0);
    const payload = packet.slice(1);

    const decoder = decoders[opcode];
    if (!decoder) {
        throw new Error(`Unrecognized Loud LNFSP opcode: ${opcode}`);
    }

    return decoder(payload);
}
