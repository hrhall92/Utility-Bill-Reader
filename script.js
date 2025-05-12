async function handleFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  document.getElementById("results").innerHTML = "<p><strong>Status:</strong> Processing file…</p>";

  if (file.type === "application/pdf") {
    await processPDF(file);
  } else if (file.type.startsWith("image/")) {
    const reader = new FileReader();
    reader.onload = () => processImage(reader.result);
    reader.readAsDataURL(file);
  } else {
    document.getElementById("results").innerHTML = "<p>Unsupported file type.</p>";
  }
}

async function processPDF(file) {
  const reader = new FileReader();
  reader.onload = async function () {
    const pdfData = new Uint8Array(reader.result);
    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
    const canvas = document.getElementById("pdf-canvas");
    const context = canvas.getContext("2d");
    let combinedText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2 });
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      document.getElementById("results").innerHTML = `<p><strong>Status:</strong> Processing page ${pageNum} of ${pdf.numPages}…</p>`;

      await page.render({ canvasContext: context, viewport }).promise;
      const imageData = canvas.toDataURL("image/png");

      const { data: { text } } = await Tesseract.recognize(imageData, 'eng');
      combinedText += "\n" + text;
    }

    const result = extractData(combinedText);
    displayResult(result, combinedText);
  };
  reader.readAsArrayBuffer(file);
}

function processImage(imageData) {
  Tesseract.recognize(imageData, 'eng')
    .then(({ data: { text } }) => {
      const result = extractData(text);
      displayResult(result, text);
    })
    .catch(err => {
      document.getElementById("results").innerHTML = "<p>Error during OCR.</p>";
      console.error(err);
    });
}

function extractData(text) {
  function find(re, fallback = "N/A") {
    const match = text.match(re);
    return match ? match[1].trim() : fallback;
  }

  return {
    Utility: find(/Utility(?:\s*Name)?[:\-]?\s*(.+)/i),
    Tariff: find(/Tariff[:\-]?\s*(.+)/i),
    Avg_kwh_rate: find(/Average kWh Rate[:\-]?\s*\$?([\d.]+)/i),
    Avg_fixed_mo_costs: find(/Fixed (Monthly )?Cost[:\-]?\s*\$?([\d.]+)/i, "N/A"),
    Avg_monthly_bill: find(/Average Monthly Bill[:\-]?\s*\$?([\d.]+)/i),
    Annual_consumption_kwh: find(/Annual Consumption(?: \(kWh\))?[:\-]?\s*([\d,]+)/i)
  };
}

function displayResult(data, rawText = "") {
  let html = "<h2>Extracted Info</h2>";
  for (const [key, value] of Object.entries(data)) {
    html += `<div class="field"><strong>${key.replaceAll("_", " ")}:</strong> ${value}</div>`;
  }
  document.getElementById("results").innerHTML = html;
}
