import * as fs from "fs";
import * as readline from "readline";
import { Client as LnfspClient, Peer } from "../lib/lnfsp";

function pad(pad: string, str: string, padLeft: boolean) {
    if (padLeft) {
        return (pad + str).slice(-pad.length);
    } else {
        return (str + pad).substring(0, pad.length);
    }
}

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
    console.log(`\n  Found new peer: ${peer.getName()} (${id})\n`);
    rl.prompt();
    peers.set(id, peer);

    peer.on("disconnect", () => {
        console.log(`\n  Lost peer: ${peer.getName()} (${id})\n`);
        rl.prompt();
        peers.delete(id);
    });
});

client.start();
rl.prompt();

const commands: { [commandName: string]: {
    usage: string,
    description: string,
    requiredArgs: number,
    handler: (args: string[]) => void
} } = {
    connect: {
        usage: "connect <ip> <port>",
        description: "Manually connect to a peer via <ip> and <port>.",
        requiredArgs: 2,
        handler: handleConnectCommand
    },
    disconnect: {
        usage: "disconnect <peerNumber>",
        description: "Manually disconnect from a peer.",
        requiredArgs: 1,
        handler: handleDisconnectCommand
    },
    download: {
        usage: "download <peerNumber> <virtualPath> <outputPath>",
        description: "Download a file from a peer and write it to <outputPath>.",
        requiredArgs: 3,
        handler: handleDownloadCommand
    },
    exit: {
        usage: "exit",
        description: "Exit the program.",
        requiredArgs: 0,
        handler: handleExitCommand
    },
    help: {
        usage: "help [<command>]",
        description: "Show list of commands, or show info for a specific command.",
        requiredArgs: 0,
        handler: handleHelpCommand
    },
    ls: {
        usage: "ls <peerNumber> [<directory>]",
        description: "List contents of a directory on a peer,\n  or their root directory if no directory is specified.",
        requiredArgs: 1,
        handler: handleLsCommand
    },
    peers: {
        usage: "peers",
        description: "List all peers you are connected to.",
        requiredArgs: 0,
        handler: handlePeersCommand
    },
    publish: {
        usage: "publish <fsPath> <virtualPath>",
        description: "Publish a file or directory for peers to download.",
        requiredArgs: 2,
        handler: handlePublishCommand
    },
    setname: {
        usage: "setname <name>",
        description: "Change the name that you will be identified as to new peers.",
        requiredArgs: 1,
        handler: handleSetnameCommand
    },
    unpublish: {
        usage: "unpublish <virtualPath>",
        description: "Stop publishing a file or directory.",
        requiredArgs: 1,
        handler: handleUnpublishCommand
    }
};

function handleCommand(...args: string[]) {
    if (args.length < 1) {
        rl.prompt();
        return;
    }

    const commandName = args[0];
    if (commandName === "") {
        rl.prompt();
        return;
    }

    const command = commands[commandName];
    if (!command) {
        console.log(`  Error: Unknown command: ${commandName}`);
        handleHelpCommand([]);
        return;
    }

    if (args.length < command.requiredArgs + 1) {
        console.log(`  Error: Missing ${command.requiredArgs - (args.length - 1)} arguments.\n`);
        console.log(`  Usage: ${command.usage}\n`);
        rl.prompt();
        return;
    }

    command.handler(args.slice(1));
}

function handleConnectCommand(args: string[]) {
    client.connectToPeer(args[0], parseInt(args[1]));
    rl.prompt();
}

function handleDisconnectCommand(args: string[]) {
    const peerNumber = parseInt(args[0]);
    if (isNaN(peerNumber)) {
        console.log("  <peerNumber> must be a number\n");
        console.log(`  Usage: ${commands["disconnect"].usage}`);
        rl.prompt();
        return;
    }
    const peer = peers.get(peerNumber);
    if (!peer) {
        console.log("  Unknown peer number\n");
        console.log(`  Usage: ${commands["disconnect"].usage}`);
        rl.prompt();
        return;
    }
    peer.disconnect();
}

function handleDownloadCommand(args: string[]) {
    const peerNumber = parseInt(args[0]);
    if (isNaN(peerNumber)) {
        console.log("  <peerNumber> must be a number\n");
        console.log(`  Usage: ${commands["download"].usage}`);
        rl.prompt();
        return;
    }
    const peer = peers.get(peerNumber);
    if (!peer) {
        console.log("  Unknown peer number\n");
        console.log(`  Usage: ${commands["download"].usage}`);
        rl.prompt();
        return;
    }

    const outputPath = args[2];

    peer.startDownload(args[1], 0).then((downloadStream) => {
        console.log(`  Download of ${args[1]} started\n`);
        const outputStream = fs.createWriteStream(outputPath);
        downloadStream.pipe(outputStream);

        downloadStream.on("end", () => {
            console.log(`  Download of ${args[1]} finished\n`);
            rl.prompt();
        });
    }).catch((err) => {
        console.log(`  Error downloading file: ${err}\n`);
        rl.prompt();
    });
}

function handleExitCommand(args: string[]) {
    process.exit(0);
}

function handleHelpCommand(args: string[]) {
    const allCommands = Object.keys(commands).join(', ');
    if (args.length === 0) {
        console.log(`  Commands are: ${allCommands}\n`);
        console.log(`  Enter "help <command>" for more info on a command.\n`);
    }
    else {
        const commandName = args[0];
        const command = commands[commandName];
        if (command) {
            console.log("  " + command.usage + "\n");
            console.log("  " + command.description + "\n");
        }
        else {
            console.log(`  Unknown commands: ${commandName}\n`);
            console.log(`  Commands are: ${allCommands}\n`);
        }
    }
    rl.prompt();
}

function handleLsCommand(args: string[]) {
    const peerNumber = parseInt(args[0]);
    if (isNaN(peerNumber)) {
        console.log("  <peerNumber> must be a number\n");
        console.log(`  Usage: ${commands["ls"].usage}\n`);
        rl.prompt();
        return;
    }
    const peer = peers.get(peerNumber);
    if (!peer) {
        console.log(`  Unknown peer number: ${peerNumber}\n`);
        console.log(`  Usage: ${commands["ls"].usage}\n`);
        rl.prompt();
        return;
    }

    let directory = args[1];
    if (!directory) {
        directory = "/";
    }

    peer.queryDirectory(directory).then((contents) => {
        let namePadding = "    ";
        {
            let maxLength = 0;
            for (const entry of contents) {
                while (entry.name.length > maxLength) {
                    namePadding += " ";
                    maxLength++;
                }
            }
        }
        let sizePadding = " ";
        {
            let maxLength = 0;
            for (const entry of contents) {
                while (entry.size.toString().length > maxLength) {
                    sizePadding += " ";
                    maxLength++;
                }
            }
        }
        if (contents.length > 0) {
            console.log(`    ${pad(namePadding, "NAME", false)} TYPE ${pad(sizePadding, "SIZE", true)}\n`);
            for (const entry of contents) {
                const name = pad(namePadding, entry.name, false);
                const type = entry.type === "file" ? "FILE" : "DIR ";
                const size = pad(sizePadding, entry.size.toString(), true) + " " + (entry.type === "file" ? "bytes" : "files");
                console.log(`    ${name} ${type} ${size}`);
            }
        }
        console.log(`\n  ${contents.length} entries\n`);
        rl.prompt();
    }).catch((err) => {
        console.log(`Error querying directory: ${err}\n`);
        rl.prompt();
    });
}

function handlePeersCommand(args: string[]) {
    if (peers.size > 0) {
        console.log(`    ID  NAME\n`);
        for (const [id, peer] of peers) {
            console.log(`    ${pad("  ", id+"", true)}  ${peer.getName()}`);
        }
    }
    console.log(`\n  ${peers.size} peers\n`);
    rl.prompt();
}

function handlePublishCommand(args: string[]) {
    client.publish(args[0], args[1]);
    console.log(`  Path ${args[0]} added to directory as ${args[1]}\n`);
    rl.prompt();
}

function handleSetnameCommand(args: string[]) {
    client.setName(args[0]);
    console.log(`  Name changed to "${args[0]}"\n`);
    rl.prompt();
}

function handleUnpublishCommand(args: string[]) {
    client.unpublish(args[0]);
    console.log(`  Path ${args[0]} removed from directory\n`);
    rl.prompt();
}
