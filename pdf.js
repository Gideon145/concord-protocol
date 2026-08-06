const { marked } = require("marked");
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

async function main() {
  const inputFile = process.argv[2] || "WHITEPAPER_V2.md";
  const outputFile = inputFile.replace(".md", ".pdf");
  
  console.log(`Reading ${inputFile}...`);
  let md = fs.readFileSync(path.join(__dirname, inputFile), "utf-8");
  
  const logoPath = path.join(__dirname, "concord.png");
  if (fs.existsSync(logoPath)) {
    const logo = fs.readFileSync(logoPath).toString("base64");
    md = md.replace("![CONCORD](concord.png)", `![CONCORD](data:image/png;base64,${logo})`);
  }
  
  console.log("Converting to HTML...");
  const html = await marked.parse(md);
  
  const full = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>CONCORD Whitepaper</title>
<style>
@page { margin: 1.5cm 1.3cm; size: A4; }
body { font-family: 'Segoe UI', system-ui, sans-serif; font-size: 9.5pt; line-height: 1.55; color: #1a1a2e; }
h1 { font-size: 1.8em; border-bottom: 2px solid #2563eb; padding-bottom: 6px; margin-top: 0; }
h2 { font-size: 1.3em; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-top: 22px; }
h3 { font-size: 1.1em; color: #2563eb; margin-top: 16px; }
h4 { font-size: 1em; color: #333; }
p { margin: 6px 0; }
code { background: #f0f0f5; padding: 1px 4px; border-radius: 2px; font-size: 8.5pt; font-family: 'Cascadia Code', monospace; }
pre { background: #1a1a2e; color: #e0e0e0; padding: 10px 14px; border-radius: 4px; font-size: 8pt; line-height: 1.4; overflow-x: auto; }
pre code { background: none; color: inherit; padding: 0; }
table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 8.5pt; }
th { background: #2563eb; color: #fff; padding: 6px 10px; text-align: left; font-weight: 600; }
td { padding: 5px 10px; border-bottom: 1px solid #e5e7eb; }
tr:nth-child(even) td { background: #f8f9fb; }
blockquote { border-left: 3px solid #2563eb; margin: 10px 0; padding: 6px 14px; background: #f0f4ff; }
strong { color: #0f0f23; }
img { max-width: 180px; display: block; margin: 14px auto; }
ul, ol { margin: 6px 0; padding-left: 20px; }
li { margin: 2px 0; }
hr { border: none; border-top: 1px solid #ddd; margin: 18px 0; }
</style></head><body>${html}</body></html>`;
  
  console.log("Generating PDF...");
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(full, { waitUntil: "networkidle0" });
  await page.pdf({
    path: path.join(__dirname, outputFile),
    format: "A4",
    margin: { top: "1.3cm", bottom: "1.3cm", left: "1.3cm", right: "1.3cm" },
    printBackground: true,
  });
  await browser.close();
  
  const stats = fs.statSync(path.join(__dirname, outputFile));
  console.log(`\nDone: ${outputFile} (${(stats.size / 1024).toFixed(0)} KB)`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
