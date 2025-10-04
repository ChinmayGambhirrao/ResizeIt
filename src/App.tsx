import { useEffect, useMemo, useRef, useState } from "react";

type OutputFormat = "png" | "jpeg" | "webp";
type FitMode = "cover" | "contain";

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [maintainAspect, setMaintainAspect] = useState<boolean>(true);
  const [fit, setFit] = useState<FitMode>("cover");
  const [width, setWidth] = useState<number>(512);
  const [height, setHeight] = useState<number>(512);
  const [format, setFormat] = useState<OutputFormat>("png");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  useEffect(() => {
    if (!file || !imageUrl) return;
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const targetW = Math.max(1, Math.min(8000, Math.floor(width)));
      const targetH = Math.max(1, Math.min(8000, Math.floor(height)));
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Clear
      ctx.clearRect(0, 0, targetW, targetH);

      const srcW = img.width;
      const srcH = img.height;

      if (!maintainAspect) {
        // Stretch
        ctx.drawImage(img, 0, 0, srcW, srcH, 0, 0, targetW, targetH);
        return;
      }

      // Maintain aspect: cover or contain
      const srcAR = srcW / srcH;
      const dstAR = targetW / targetH;
      let drawW = 0, drawH = 0, dx = 0, dy = 0;
      if (fit === "cover") {
        if (srcAR > dstAR) {
          // wider than target: height matches, width overflows
          drawH = targetH;
          drawW = Math.ceil(targetH * srcAR);
          dx = Math.floor((targetW - drawW) / 2);
          dy = 0;
        } else {
          // taller than target: width matches, height overflows
          drawW = targetW;
          drawH = Math.ceil(targetW / srcAR);
          dx = 0;
          dy = Math.floor((targetH - drawH) / 2);
        }
      } else {
        // contain
        if (srcAR > dstAR) {
          // wider than target: width matches, height letterboxed
          drawW = targetW;
          drawH = Math.floor(targetW / srcAR);
          dx = 0;
          dy = Math.floor((targetH - drawH) / 2);
        } else {
          // taller than target: height matches, width pillarboxed
          drawH = targetH;
          drawW = Math.floor(targetH * srcAR);
          dx = Math.floor((targetW - drawW) / 2);
          dy = 0;
        }
      }
      ctx.drawImage(img, 0, 0, srcW, srcH, dx, dy, drawW, drawH);
    };
    img.src = imageUrl;
  }, [file, imageUrl, width, height, maintainAspect, fit]);

  async function handleGenerate() {
    if (!file) {
      alert("Please upload a file first");
      return;
    }

    const formData = new FormData();
    formData.append("logo", file);
    formData.append("outputs", JSON.stringify([{ width, height, format }]));
    formData.append("maintainAspect", String(maintainAspect));
    if (maintainAspect) formData.append("fit", fit);
    // Force single image download on backend
    formData.append("single", "true");

    // Direct URL to your Render backend
    const res = await fetch("https://your-backend-url.onrender.com/resize", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => "Failed to resize");
      alert(msg || "Failed to resize");
      return;
    }

    const contentType = res.headers.get("content-type") || "";
    const disp = res.headers.get("content-disposition") || "";
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;

    // Prefer filename from Content-Disposition if exposed
    const match = /filename=([^;]+)/i.exec(disp || "");
    let downloadName: string | null = null;
    if (match) {
      downloadName = match[1].replace(/\"/g, "");
    }

    // Fallbacks: infer by content-type or user selection
    if (!downloadName) {
      const base = (file.name || "image").replace(/\.[^.]+$/, "");
      if (contentType.includes("application/zip")) {
        downloadName = `${base}_resized.zip`;
      } else if (contentType.includes("image/")) {
        downloadName = `${base}_${width}x${height}.${format}`;
      } else {
        // last resort
        downloadName = `${base}_${width}x${height}`;
      }
    }

    a.download = downloadName;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-6">
      <div className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-md space-y-4">
        <h1 className="text-2xl text-black font-bold text-center">ResizeIt</h1>

        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full text-black border p-2 rounded"
        />

        <div className="flex items-center space-x-3">
          <label className="flex items-center space-x-2 text-black">
            <input
              type="checkbox"
              checked={maintainAspect}
              onChange={(e) => setMaintainAspect(e.target.checked)}
            />
            <span>Maintain aspect ratio</span>
          </label>
          {maintainAspect && (
            <select
              className="border rounded p-2 text-black"
              value={fit}
              onChange={(e) => setFit(e.target.value as FitMode)}
            >
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
            </select>
          )}
        </div>

        <div className="grid grid-cols-12 gap-2 items-center">
          <input
            type="number"
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            placeholder="Width"
            className="col-span-4 border text-black p-2 rounded"
            min={1}
            max={8000}
          />
          <input
            type="number"
            value={height}
            onChange={(e) => setHeight(Number(e.target.value))}
            placeholder="Height"
            className="col-span-4 border text-black p-2 rounded"
            min={1}
            max={8000}
          />
          <select
            className="col-span-4 border p-2 rounded text-black"
            value={format}
            onChange={(e) => setFormat(e.target.value as OutputFormat)}
          >
            <option value="png">PNG</option>
            <option value="jpeg">JPEG</option>
            <option value="webp">WebP</option>
          </select>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-black">Preview</h2>
          <canvas ref={canvasRef} className="w-full border rounded bg-white" />
        </div>

        <button
          onClick={handleGenerate}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
        >
          Generate & Download
        </button>
      </div>
      
      {/* Footer */}
      <div className="mt-8 text-center">
      
        <p className="text-gray-600 text-sm">
          Designed and developed by{" "}
          <a href="https://github.com/ChinmayGambhirrao"> <span className="font-semibold text-gray-800">Chinmay Gambhirrao ♡</span></a>
        </p>
      </div>
    </div>
  );
}

export default App;