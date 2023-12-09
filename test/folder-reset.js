"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const dir = process.argv[2];
if (fs.existsSync(dir)) {
    console.log('deleting folder:' + dir);
    fs.rmSync(dir, { recursive: true });
}
console.log('creating folder:' + dir);
fs.mkdirSync(dir);
//# sourceMappingURL=folder-reset.js.map