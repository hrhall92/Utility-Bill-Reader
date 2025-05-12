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
    displayResult(result);
  };
  reader.readAsArrayBuffer(file);
}

function processImage(imageData) {
  Tesseract.recognize(imageData, 'eng')
    .then(({ data: { text } }) => {
      const result = extractData(text);
      displayResult(result);
    })
    .catch(err => {
      document.getElementById("results").innerHTML = "<p>Error during OCR.</p>";
      console.error(err);
    });
}

function extractData(text) {
  function findWithFallback(keywords) {
    for (let kw of keywords) {
      const regex = new RegExp(kw + '[:\-\s]*\$?([\d,.a-zA-Z ]+)', 'i');
      const match = text.match(regex);
      if (match) return match[1].trim();
    }
    return "N/A";
  }

  return {
    Utility: findWithFallback(["Utility Name", "Utility"]),
    Tariff: findWithFallback(["Tariff", "Rate Plan", "Plan"]),
    Avg_kwh_rate: findWithFallback(["Average kWh Rate", "kWh Rate", "Rate per kWh"]),
    Avg_fixed_mo_costs: findWithFallback(["Fixed Monthly Cost", "Monthly Fee", "Base Charge", "Fixed Cost"]),
    Avg_monthly_bill: findWithFallback(["Average Monthly Bill", "Monthly Bill", "Bill Total"]),
    Annual_consumption_kwh: findWithFallback(["Annual Consumption", "Annual Usage", "Total kWh", "Yearly kWh"])
  };
}

function displayResult(data) {
  const jsonOutput = JSON.stringify(data, null, 2);
  document.getElementById("results").innerHTML = "<h2>Data Extracted</h2><pre>" + jsonOutput + "</pre>";
  document.getElementById("gpt-json").textContent = jsonOutput;
}
