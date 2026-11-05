// Writes test/results/TEST-RESULTS.md from the JSON results of the API and browser suites.
import fs from "node:fs";
const read = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : []);
const all = [...read("test/results/api.json"), ...read("test/results/web.json")];
const pass = all.filter((r) => r.ok).length;
let md = `# Dakly end-to-end test results\n\nRun: ${new Date().toISOString()}  \nResult: **${pass}/${all.length} passed**\n\nEvery outside provider is the mock in \`test/mock/server.mjs\`.\n`;
let area = "";
for (const r of all) {
  if (r.area !== area) { area = r.area; md += `\n## ${area}\n\n| ID | Use case | Result |\n| --- | --- | --- |\n`; }
  md += `| ${r.id} | ${r.name} | ${r.ok ? "Pass" : "FAIL: " + String(r.error).replace(/\|/g, "/").slice(0, 160)} |\n`;
}
fs.writeFileSync("test/results/TEST-RESULTS.md", md);
console.log(`report: ${pass}/${all.length} -> test/results/TEST-RESULTS.md`);
