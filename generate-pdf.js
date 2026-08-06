const { marked } = require("marked");
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

async function generatePDF() {
  const mdPath = path.join(__dirname, "WHITEPAPER.md");
  const logoPath = path.join(__dirname, "concord.png");
  const pdfPath = path.join(__dirname, "CONCORD_Whitepaper.pdf");
  
  console.log("Reading whitepaper...");
  const md = fs.readFileSync(mdPath, "utf-8");
  
  // Convert logo to base64
  const logoBase64 = fs.readFileSync(logoPath).toString("base64");
  const logoSrc = `data:image/png;base64,${logoBase64}`;
  
  // Replace relative logo reference with base64
  const mdWithLogo = md.replace("![CONCORD](concord.png)", `![CONCORD](${logoSrc})`);
  
  console.log("Converting Markdown to HTML...");
  
  // Custom renderer for better PDF output
  const renderer = new marked.Renderer();
  
  // Make headings more professional
  renderer.heading = (text, level) => {
    const sizes = ["2.2em", "1.7em", "1.35em", "1.15em", "1em", "0.9em"];
    const margins = ["24px 0 16px", "20px 0 12px", "16px 0 10px", "14px 0 8px", "12px 0 6px", "10px 0 4px"];
    const border = level <= 2 ? 'border-bottom: 1px solid #333; padding-bottom: 8px;' : '';
    return `<h${level} style="font-size:${sizes[level-1]};margin:${margins[level-1]};color:#1a1a2e;font-family:'Segoe UI',sans-serif;${border}">${text}</h${level}>`;
  };
  
  const htmlContent = marked.parse(mdWithLogo, { renderer });
  
  const fullHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>CONCORD — The Living Treaty Protocol — Whitepaper</title>
  <style>
    @page {
      margin: 1.8cm 1.5cm;
      size: A4;
    }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      font-size: 11pt;
      line-height: 1.65;
      color: #1a1a2e;
      max-width: 100%;
    }
    h1 { font-size: 2em; margin: 20px 0 14px; color: #0f0f23; border-bottom: 2px solid #2563eb; padding-bottom: 8px; }
    h2 { font-size: 1.5em; margin: 18px 0 10px; color: #1a1a2e; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
    h3 { font-size: 1.25em; margin: 14px 0 8px; color: #2563eb; }
    h4 { font-size: 1.1em; margin: 12px 0 6px; color: #333; }
    p { margin: 8px 0; }
    code {
      background: #f0f0f5;
      padding: 2px 5px;
      border-radius: 3px;
      font-family: 'JetBrains Mono', 'Cascadia Code', 'Fira Code', monospace;
      font-size: 9.5pt;
    }
    pre {
      background: #1a1a2e;
      color: #e0e0e0;
      padding: 14px 18px;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 9pt;
      line-height: 1.45;
      margin: 12px 0;
    }
    pre code { background: none; color: inherit; padding: 0; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 9.5pt;
    }
    th {
      background: #2563eb;
      color: white;
      padding: 8px 12px;
      text-align: left;
      font-weight: 600;
    }
    td {
      padding: 7px 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    tr:nth-child(even) td { background: #f8f9fb; }
    blockquote {
      border-left: 3px solid #2563eb;
      margin: 14px 0;
      padding: 8px 16px;
      background: #f0f4ff;
      color: #333;
    }
    strong { color: #0f0f23; }
    img { max-width: 200px; display: block; margin: 20px auto; }
    ul, ol { margin: 8px 0; padding-left: 22px; }
    li { margin: 3px 0; }
    hr { border: none; border-top: 1px solid #ddd; margin: 24px 0; }
    .page-break { page-break-before: always; }
    
    /* Mermaid placeholder styling */
    .mermaid-placeholder {
      background: #f8f9fb;
      border: 1px dashed #ccc;
      border-radius: 6px;
      padding: 20px;
      margin: 16px 0;
      text-align: center;
      color: #666;
      font-style: italic;
    }
  </style>
</head>
<body>
${htmlContent}
</body>
</html>`;

  console.log("Launching browser for PDF generation...");
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(fullHTML, { waitUntil: "networkidle0" });
  
  console.log("Generating PDF...");
  await page.pdf({
    path: pdfPath,
    format: "A4",
    margin: { top: "1.5cm", bottom: "1.5cm", left: "1.5cm", right: "1.5cm" },
    printBackground: true,
    displayHeaderFooter: false,
  });
  
  await browser.close();
  
  const stats = fs.statSync(pdfPath);
  console.log(`\n✅ PDF generated: ${pdfPath}`);
  console.log(`   Size: ${(stats.size / 1024).toFixed(1)} KB`);
  console.log(`   Pages: ~${Math.ceil(stats.size / 15000)} (estimated)`);
}

generatePDF().catch(err => {
  console.error("PDF generation failed:", err.message);
  process.exit(1);
});
