import * as readline from "readline";
import { Client as LnfspClient } from "../lib/lnfsp";

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

function handleCommand(...args: string[]) {
    if (args.length < 1) {
        return;
    }
    const command = args[0];
    switch (command) {
        case "publish": {
            if (args.length < 3) {

            }
            break;
        }
        case "unpublish": {
            if (args.length < 2) {
                console.log("Usage: setname <name>");
                return;
            }
            break;
        }
        case "peers": {
            break;
        }
        case "connect": {
            if (args.length < 2) {
                console.log("Usage: setname <name>");
                return;
            }
            break;
        }
        case "ls": {
            if (args.length < 2) {
                console.log("Usage: setname <name>");
                return;
            }
            break;
        }
        case "download": {
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
        default: {
            console.log(`Unknown command: ${command}`);
            console.log("Options are: add, remove, peers, setname");
            break;
        }
    }
}
