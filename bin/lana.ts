import * as fs from "fs";
import * as readline from "readline";
import { Client as LnfspClient, Peer } from "../lib/lnfsp";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'lana> '
} as readline.ReadLineOptions);

rl.prompt();

rl.on('line', (line: string) => {
    handleCommand(...line.trim().split(" "));
    rl.prompt();
});

rl.on('close', () => {
    process.exit(0);
});

const client = new LnfspClient(process.argv.length > 2 ? process.argv[2] : "Anonymous");
const peers = new Map<number, Peer>();
let nextPeerId = 0;

client.on("newPeer", (peer: Peer) => {
    const id = nextPeerId++;
    console.log(`Found new peer: ${peer.getName()} (${id})`);
    peers.set(id, peer);

    peer.on("disconnect", () => {
        console.log(`Lost peer: ${peer.getName()} (${id})`);
        peers.delete(id);
    });
});

client.start();

function handleCommand(...args: string[]) {
    if (args.length < 1) {
        return;
    }
    const command = args[0];
    if (command === "") {
        return;
    }
    switch (command) {
        case "connect": {
            if (args.length < 3) {
                console.log("Usage: connect <ip> <name>");
                return;
            }
            client.connectToPeer(args[1], args[2]);
            break;
        }
        case "publish": {
            if (args.length < 3) {
                console.log("Usage: publish <fsPath> <virtualPath>");
                return;
            }
            client.publish(args[1], args[2]);
            break;
        }
        case "unpublish": {
            if (args.length < 2) {
                console.log("Usage: unpublish <virtualPath>");
                return;
            }
            client.unpublish(args[1]);
            break;
        }
        case "peers": {
            for (const [id, peer] of peers) {
                console.log(` ${id} - ${peer.getName()}`);
            }
            console.log(`${peers.size} peers`);
            break;
        }
        case "ls": {
            if (args.length < 2) {
                console.log("Usage: ls <peerNumber> [<directory>]");
                return;
            }
            const peerNumber = parseInt(args[1]);
            if (isNaN(peerNumber)) {
                console.log("<peerNumber> must be a number");
                return;
            }
            const peer = peers.get(peerNumber);
            if (!peer) {
                console.log("Unknown peer number");
                return;
            }
            let directory = args[2];
            if (!directory) {
                directory = "/";
            }
            peer.queryDirectory(directory).then((contents) => {
                for (const entry of contents) {
                    console.log(`${entry.name} - ${entry.type} (${entry.size})`);
                }
            }).catch((err) => {
                console.log(`Error querying directory: ${err}`);
            });
            break;
        }
        case "download": {
            if (args.length < 3) {
                console.log("Usage: download <peerNumber> <virtualPath> <outputPath>");
                return;
            }
            const peerNumber = parseInt(args[1]);
            if (isNaN(peerNumber)) {
                console.log("<peerNumber> must be a number");
                return;
            }
            const peer = peers.get(peerNumber);
            if (!peer) {
                console.log("Unknown peer number");
                return;
            }

            const outputPath = args[3];

            peer.startDownload(args[2], 0).then((downloadStream) => {
                const outputStream = fs.createWriteStream(outputPath);
                downloadStream.pipe(outputStream);
            }).catch((err) => {
                console.log(`Error downloading file: ${err}`);
            });
            break;
        }
        case "setname": {
            if (args.length < 2) {
                console.log("Usage: setname <name>");
                return;
            }
            client.setName(args[1]);
            break;
        }
        case "exit": {
            process.exit(0);
            break;
        }
        default: {
            console.log(`Unknown command: ${command}`);
            console.log("Options are: add, remove, peers, setname");
            break;
        }
    }
}
