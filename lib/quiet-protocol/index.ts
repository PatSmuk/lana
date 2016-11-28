import {
    SocketBuffer
} from "../socket-buffer";

import {
    InitializePacket,
    decodeInitializePacket,
    encodeInitializePacket
} from "./initialize";

import {
    InitializeResponsePacket,
    decodeInitializeResponsePacket,
    encodeInitializeResponsePacket
} from "./initialize-response";

import {
    QueryPacket,
    decodeQueryPacket,
    encodeQueryPacket
} from "./query";

import {
    DirectoryEntry,
    QueryResponsePacket,
    decodeQueryResponsePacket,
    encodeQueryResponsePacket
} from "./query-response";

import {
    StartDownloadPacket,
    decodeStartDownloadPacket,
    encodeStartDownloadPacket
} from "./start-download";

import {
    StartDownloadResponsePacket,
    decodeStartDownloadResponsePacket,
    encodeStartDownloadResponsePacket
} from "./start-download-response";

export {
    DirectoryEntry,
    InitializePacket,
    InitializeResponsePacket,
    QueryPacket,
    QueryResponsePacket,
    StartDownloadPacket,
    StartDownloadResponsePacket,
    encodeInitializePacket,
    encodeInitializeResponsePacket,
    encodeQueryPacket,
    encodeQueryResponsePacket,
    encodeStartDownloadPacket,
    encodeStartDownloadResponsePacket
};

export enum QuietProtocolOpcode {
    INITIALIZE,
    INITIALIZE_RESPONSE,
    QUERY,
    QUERY_RESPONSE,
    START_DOWNLOAD,
    START_DOWNLOAD_RESPONSE,
    STOP_DOWNLOAD
}

export enum QuietProtocolResponseCode {
    OK,
    INITIALIZE_WRONG_VERSION,
    QUERY_DIRECTORY_NOT_FOUND,
    START_DOWNLOAD_FILE_NOT_FOUND
}

export interface QuietProtocolPacket {
    opcode: QuietProtocolOpcode;
}

export const QUIET_PROTOCOL_VERSION = 1;

const decoders: { [opcode: number]: (payload: Buffer) => QuietProtocolPacket } = {
    [QuietProtocolOpcode.INITIALIZE             ]: decodeInitializePacket,
    [QuietProtocolOpcode.INITIALIZE_RESPONSE    ]: decodeInitializeResponsePacket,
    [QuietProtocolOpcode.QUERY                  ]: decodeQueryPacket,
    [QuietProtocolOpcode.QUERY_RESPONSE         ]: decodeQueryResponsePacket,
    [QuietProtocolOpcode.START_DOWNLOAD         ]: decodeStartDownloadPacket,
    [QuietProtocolOpcode.START_DOWNLOAD_RESPONSE]: decodeStartDownloadResponsePacket
};

export async function decodeQuietProtocolPacket(socketBuffer: SocketBuffer): Promise<QuietProtocolPacket | null> {
    const header = await socketBuffer.read(1 + 2);
    if (!header) {
        return null;
    }

    let offset = 0;
    const opcode = header.readUInt8(offset);                          offset += 1;
    const payloadSize = header.readUInt16BE(offset);                  offset += 2;

    const payload = await socketBuffer.read(payloadSize);
    if (!payload) {
        return null;
    }

    const decoder = decoders[opcode];
    if (!decoder) {
        throw new Error(`Unrecognized Quiet LNFSP opcode: ${opcode}`);
    }

    return decoder(payload);
}
