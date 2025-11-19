// server.js - PDF OCR Text Extraction (Railway-ready, no ZIP)
import express from "express";
import multer from "multer";
import { pdf } from "pdf-to-img";
import cors from "cors";
import fs from "fs";
import { createWorker } from "tesseract.js";

const app = express();
app.use(cors());
app.use(express.json());

// Multer Upload
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF allowed"));
  },
});

app.get("/", (req, res) => {
  res.send(`
    <h2>PDF to Text (OCR)</h2>
    <form action="/ocr" method="post" enctype="multipart/form-data">
      <input type="file" name="pdf" accept=".pdf" required />
      <br><br>
      <button type="submit">Extract Text</button>
    </form>
  `);
});

// MAIN ENDPOINT
app.post("/ocr", upload.single("pdf"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No PDF uploaded" });

  const pdfPath = req.file.path;

  let worker;

  try {
    // Tesseract Worker
    worker = await createWorker("eng", 1, {
      logger: (m) => console.log(m.status || "", m.progress),
    });

    const pagesText = [];
    let pageNumber = 1;

    // Convert PDF → Images
    const document = await pdf(pdfPath, { scale: 3.5 });

    try {
      for await (const imageBuffer of document) {
        console.log(`Processing page ${pageNumber}...`);
        
        const {
          data: { text, confidence },
        } = await worker.recognize(imageBuffer);

        pagesText.push({
          page: pageNumber,
          text: text.trim(),
          confidence: Number(confidence.toFixed(2)),
        });

        console.log(
          `Page ${pageNumber} OCR done – Confidence: ${confidence.toFixed(2)}%`
        );

        pageNumber++;
      }
    } catch (pdfError) {
      console.error(`PDF conversion stopped at page ${pageNumber}:`, pdfError.message);
      // Continue with whatever pages we got
    }
    
    console.log(`Total pages processed: ${pagesText.length}`);

    if (worker) {
      await worker.terminate();
      console.log("Tesseract worker terminated");
    }

    if (pagesText.length === 0) {
      throw new Error("No pages could be processed");
    }

    // Combine all text
    const fullText = pagesText
      .map((p) => p.text)
      .join("\n\n--- Page Break ---\n\n");
    
    console.log(`Full text length: ${fullText.length} characters`);

    // Response JSON (text only, no ZIP)
    const responseData = {
      success: true,
      filename: req.file.originalname,
      totalPages: pagesText.length,
      extractedText: fullText,
      pages: pagesText,
      message: "OCR completed successfully!",
    };
    
    console.log(`Sending response with ${responseData.totalPages} pages, text length: ${responseData.extractedText.length}`);
    res.json(responseData);

  } catch (error) {
    console.error("OCR Error:", error);
    if (worker) await worker.terminate();
    res.status(500).json({ error: "OCR failed", details: error.message });
  } finally {
    // Delete uploaded PDF always
    fs.unlink(pdfPath, () => {});
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`PDF OCR Server running on http://localhost:${PORT}`);
  console.log(`POST /ocr → Extract text from PDF`);
});
