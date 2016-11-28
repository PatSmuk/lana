/*
 * Copyright © 2016 Pat Smuk. All rights reserved.
 */

import * as assert from "assert";
import * as net from "net";

export interface SocketBuffer {
    socket: net.Socket;
    read: (bytes: number) => Promise<Buffer | null>;
}

/*
 * Creates a new socket buffer bound to `socket`.
 *
 * All the socket buffer does is allow you to request a certain number of
 *   bytes from the socket, returning a Promise that resolves when enough
 *   bytes have been received to satisfy the request.
 *
 * No requests should be made while another request is pending.
 *
 * Example:
 *
 *     // Create a socket buffer bound to some socket.
 *     const socketBuffer = createSocketBuffer(socket);
 *
 *     // Request 16 bytes and write them back to the socket.
 *     socketBuffer.read(16).then((bytes) => {
 *         // It"s safe to call `socketBuffer.read` again in here.
 *         socketBuffer.socket.write(bytes);
 *         socketBuffer.socket.end();
 *     });
 *
 *     // Can't call `socketBuffer.read` here!
 *
 * The underlying socket can be accessed via `SocketBuffer.socket`.
 */
export function createSocketBuffer(socket: net.Socket): SocketBuffer {
    let buffer = Buffer.allocUnsafe(0),
        bytesBuffered = 0,
        bytesNeeded = 0,
        resolveCallback: ((requestedBytes: Buffer | null) => void) | null = null;

    socket.on("data", (chunk: Buffer): void => {
        // Allocate new Buffer with old Buffer"s data + new data.
        {
            const combinedBuffer = Buffer.allocUnsafe(buffer.length + chunk.length);
            buffer.copy(combinedBuffer, 0);
            chunk.copy(combinedBuffer, buffer.length);
            buffer = combinedBuffer;
        }
        bytesBuffered += chunk.length;

        // If someone needs data right now and we have enough data to
        //   fulfill the request, fulfill it.
        if (resolveCallback !== null && bytesNeeded <= bytesBuffered) {
            const requestBuffer = buffer.slice(0, bytesNeeded);
            buffer = buffer.slice(bytesNeeded, buffer.length);
            bytesBuffered -= bytesNeeded;
            bytesNeeded = 0;

            resolveCallback(requestBuffer);
            resolveCallback = null;
        }
    });

    // When the socket disconnects just return null.
    socket.on("error", (error: any): void => {
        if (resolveCallback !== null) {
            resolveCallback(null);
            resolveCallback = null;
        }
    });

    return {
        socket,

        read(bytes: number): Promise<Buffer | null> {
            assert.equal(
                bytesNeeded, 0,
                "Tried to create a read request while another read request already exists."
            );

            // If we already have enough data in our Buffer, satisfy the request.
            if (bytes <= bytesBuffered) {
                const requestBuffer = buffer.slice(0, bytes);
                buffer = buffer.slice(bytes, buffer.length);
                bytesBuffered -= bytes;

                return Promise.resolve(requestBuffer);
            }

            return new Promise<Buffer | null>((resolve, reject) => {
                bytesNeeded = bytes;
                resolveCallback = resolve;
            });
        }
    };
}
