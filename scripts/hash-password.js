const { randomBytes, scryptSync } = require("node:crypto");

if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
  console.error("Jalankan skrip ini langsung di terminal interaktif.");
  process.exit(1);
}

let password = "";
process.stderr.write("Kata sandi (tidak ditampilkan): ");
process.stdin.setRawMode(true);
process.on("exit", () => process.stdin.setRawMode(false));
process.stdin.resume();
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  for (const char of chunk) {
    if (char === "\u0003") process.exit(130);
    if (char === "\r" || char === "\n") {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stderr.write("\n");
      if (password.length < 12) {
        console.error("Gunakan sedikitnya 12 karakter.");
        process.exitCode = 1;
        return;
      }
      const salt = randomBytes(16).toString("hex");
      console.log(`${salt}:${scryptSync(password, salt, 64).toString("hex")}`);
      password = "";
      return;
    }
    if (char === "\u007f" || char === "\b") password = password.slice(0, -1);
    else if (char >= " " && password.length < 1024) password += char;
  }
});
