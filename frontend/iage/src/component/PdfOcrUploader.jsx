// PdfToImagesUploader.tsx
import { useState } from "react";

export default function PdfToImagesUploader() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const [extractedText, setExtractedText] = useState("");

  const handleFileChange = (e) => {
    const files = e?.target?.files || null;
    if (files && files[0]) {
      setFile(files[0]);
      setMessage("");
      setProgress(0);
      setExtractedText("");
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage("Please select a PDF first!");
      return;
    }

    setLoading(true);
    setMessage("");
    setProgress(0);

    const formData = new FormData();
    formData.append("pdf", file);

    try {
      const BACKEND_URL = "http://localhost:3000/ocr";
      const response = await fetch(BACKEND_URL, { method: "POST", body: formData });

      if (!response.ok) {
        let errMsg = "Conversion failed";
        try {
          const errJson = await response.json();
          errMsg = errJson.error || errJson.message || errMsg;
        } catch {}
        throw new Error(errMsg);
      }

      const contentType = response.headers.get("content-type") || "";

      // ✔ Correct: Don't detect application/octet-stream (causes deployment bugs)
      if (contentType.includes("application/zip")) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${file.name.replace(/\.pdf$/i, "")}-images.zip`;
        a.click();
        window.URL.revokeObjectURL(url);

        setMessage(`Success! ${file.name} → ZIP downloaded`);
        setProgress(100);
      } else {
        const data = await response.json();
        console.log("Backend response:", data); // Debug log

        if (data.success) {
          const textToShow = data.extractedText || data.text || "";
          console.log("Setting extractedText:", textToShow.substring(0, 100)); // Debug log
          setExtractedText(textToShow);

          setMessage(
            data.totalPages
              ? `Extracted text from ${data.totalPages} pages!`
              : `Extracted text from ${file.name}`
          );

          setProgress(100);

          // Auto-download ZIP from base64
          if (data.downloadZip) {
            const a = document.createElement("a");
            a.href = data.downloadZip;
            a.download = `${file.name.replace(/\.pdf$/i, "")}-ocr-images.zip`;
            a.click();
          }
        } else {
          throw new Error(data.error || "Conversion failed");
        }
      }
    } catch (err) {
      const errMsg = err?.message || String(err);
      setMessage(`Error: ${errMsg}`);
      console.error(err);
    } finally {
      setLoading(false);
      setFile(null);

      const input = document.getElementById("pdf-input");
      if (input) input.value = "";
    }
  };

  return (
    <div
      style={{
        maxWidth: "500px",
        margin: "50px auto",
        padding: "30px",
        border: "2px dashed #4f46e5",
        borderRadius: "16px",
        textAlign: "center",
        fontFamily: "system-ui, sans-serif",
        background: "#f8faff",
      }}
    >
      <h1 style={{ color: "#4f46e5" }}>PDF OCR Text Extractor</h1>
      <p>Upload a PDF → Extract all text with OCR</p>

      <div style={{ margin: "30px 0" }}>
        <input
          id="pdf-input"
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          disabled={loading}
          style={{
            padding: "12px",
            fontSize: "16px",
            width: "100%",
            border: "2px solid #ddd",
            borderRadius: "8px",
          }}
        />
      </div>

      {file && (
        <div style={{ marginBottom: "20px", color: "#1f2937" }}>
          Selected: <strong>{file.name}</strong>{" "}
          ({(file.size / 1024 / 1024).toFixed(2)} MB)
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || loading}
        style={{
          padding: "14px 32px",
          fontSize: "18px",
          fontWeight: "bold",
          background: loading ? "#9333ea" : "#4f46e5",
          color: "white",
          border: "none",
          borderRadius: "8px",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading || !file ? 0.7 : 1,
          transition: "all 0.3s",
        }}
      >
        {loading ? "Processing..." : "Extract Text from PDF"}
      </button>

      {loading && (
        <div style={{ marginTop: "20px" }}>
          <div
            style={{
              width: "100%",
              background: "#e0e0e0",
              borderRadius: "8px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "20px",
                width: `${progress}%`,
                background: "#4f46e5",
                transition: "width 0.4s",
              }}
            />
          </div>
          <p>Processing your PDF...</p>
        </div>
      )}

      {message && (
        <div
          style={{
            marginTop: "20px",
            padding: "12px",
            borderRadius: "8px",
            background: message.includes("Success") ? "#d4edda" : "#f8d7da",
            color: message.includes("Success") ? "#155724" : "#721c24",
            border: `1px solid ${
              message.includes("Success") ? "#c3e6cb" : "#f5c6cb"
            }`,
          }}
        >
          {message}
        </div>
      )}

      {extractedText && (
        <div style={{ marginTop: 20 }}>
          <h3>Extracted Text</h3>
          <textarea
            readOnly
            value={extractedText}
            rows={12}
            style={{
              width: "100%",
              padding: 12,
              fontSize: 14,
              borderRadius: 8,
              border: "1px solid #ccc",
            }}
          />
        </div>
      )}

      <footer style={{ marginTop: "40px", color: "#666", fontSize: "14px" }}>
        Powered by <strong>Tesseract.js</strong> + Express + React (2025)
      </footer>
    </div>
  );
}
