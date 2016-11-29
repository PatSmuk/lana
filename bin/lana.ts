import * as fs from "fs";
import * as readline from "readline";
import { Client as LnfspClient, Peer } from "../lib/lnfsp";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'lana> '
} as readline.ReadLineOptions);

rl.on('line', (line: string) => {
    handleCommand(...line.trim().split(" "));
});

rl.on('close', () => {
    process.exit(0);
});

const client = new LnfspClient(process.argv.length > 2 ? process.argv[2] : "Anonymous");
const peers = new Map<number, Peer>();
let nextPeerId = 0;

client.on("newPeer", (peer: Peer) => {
    const id = nextPeerId++;
    console.log(`\nFound new peer: ${peer.getName()} (${id})`);
    rl.prompt();
    peers.set(id, peer);

    peer.on("disconnect", () => {
        console.log(`\nLost peer: ${peer.getName()} (${id})`);
        rl.prompt();
        peers.delete(id);
    });
});

client.start();
rl.prompt();

function handleCommand(...args: string[]) {
    if (args.length < 1) {
        rl.prompt();
        return;
    }
    const command = args[0];
    if (command === "") {
        rl.prompt();
        return;
    }
    switch (command) {
        case "connect": {
            if (args.length < 3) {
                console.log("Usage: connect <ip> <port>\n");
                rl.prompt();
                return;
            }
            client.connectToPeer(args[1], parseInt(args[2]));
            rl.prompt();
            break;
        }
        case "disconnect": {
            if (args.length < 2) {
                console.log("Usage: disconnect <peerNumber>\n");
                rl.prompt();
                return;
            }
            const peerNumber = parseInt(args[1]);
            if (isNaN(peerNumber)) {
                console.log("<peerNumber> must be a number\n");
                rl.prompt();
                return;
            }
            const peer = peers.get(peerNumber);
            if (!peer) {
                console.log("Unknown peer number\n");
                rl.prompt();
                return;
            }
            peer.disconnect();
            break;
        }
        case "publish": {
            if (args.length < 3) {
                console.log("Usage: publish <fsPath> <virtualPath>\n");
                rl.prompt();
                return;
            }
            client.publish(args[1], args[2]);
            rl.prompt();
            break;
        }
        case "unpublish": {
            if (args.length < 2) {
                console.log("Usage: unpublish <virtualPath>\n");
                rl.prompt();
                return;
            }
            client.unpublish(args[1]);
            break;
        }
        case "peers": {
            for (const [id, peer] of peers) {
                console.log(`  - ${id}: ${peer.getName()}`);
            }
            console.log(`\n${peers.size} peers\n`);
            rl.prompt();
            break;
        }
        case "ls": {
            if (args.length < 2) {
                console.log("Usage: ls <peerNumber> [<directory>]\n");
                rl.prompt();
                return;
            }
            const peerNumber = parseInt(args[1]);
            if (isNaN(peerNumber)) {
                console.log("<peerNumber> must be a number\n");
                rl.prompt();
                return;
            }
            const peer = peers.get(peerNumber);
            if (!peer) {
                console.log("Unknown peer number\n");
                rl.prompt();
                return;
            }

            let directory = args[2];
            if (!directory) {
                directory = "/";
            }

            peer.queryDirectory(directory).then((contents) => {
                for (const entry of contents) {
                    const name = (entry.name + "                                        ").substring(0, 40);
                    const type = entry.type === "file" ? "FILE" : "DIR ";
                    const size = entry.size + " " + (entry.type === "file" ? "bytes" : "files");
                    console.log(`  - ${name} ${type} ${size}`);
                }
                console.log(`\n${contents.length} entries\n`);
                rl.prompt();
            }).catch((err) => {
                console.log(`Error querying directory: ${err}\n`);
                rl.prompt();
            });
            break;
        }
        case "download": {
            if (args.length < 3) {
                console.log("Usage: download <peerNumber> <virtualPath> <outputPath>\n");
                rl.prompt();
                return;
            }
            const peerNumber = parseInt(args[1]);
            if (isNaN(peerNumber)) {
                console.log("<peerNumber> must be a number\n");
                rl.prompt();
                return;
            }
            const peer = peers.get(peerNumber);
            if (!peer) {
                console.log("Unknown peer number\n");
                rl.prompt();
                return;
            }

            const outputPath = args[3];

            peer.startDownload(args[2], 0).then((downloadStream) => {
                console.log(`Download of ${args[2]} started`);
                const outputStream = fs.createWriteStream(outputPath);
                downloadStream.pipe(outputStream);

                downloadStream.on("end", () => {
                    console.log(`Download of ${args[2]} finished\n`);
                    rl.prompt();
                });
            }).catch((err) => {
                console.log(`Error downloading file: ${err}\n`);
                rl.prompt();
            });
            break;
        }
        case "setname": {
            if (args.length < 2) {
                console.log("Usage: setname <name>\n");
                rl.prompt();
                return;
            }
            client.setName(args[1]);
            rl.prompt();
            break;
        }
        case "exit": {
            process.exit(0);
            break;
        }
        case "help": {
            console.log("Commands are: add, connect, disconnect, download, exit, help, ls, peers, publish, setname, unpublish\n");
            rl.prompt();
            break;
        }
        default: {
            console.log(`Unknown command: ${command}`);
            console.log("Commands are: add, connect, disconnect, download, exit, help, ls, peers, publish, setname, unpublish\n");
            rl.prompt();
            break;
        }
    }
}
