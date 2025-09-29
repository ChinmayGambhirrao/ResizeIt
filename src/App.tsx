import { useEffect, useMemo, useRef, useState } from "react";

type OutputFormat = "png" | "jpeg" | "webp";
type FitMode = "cover" | "contain";

type OutputSpec = {
  width: number;
  height: number;
  format: OutputFormat;
};

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [token, setToken] = useState<string>("");

  const [maintainAspect, setMaintainAspect] = useState<boolean>(true);
  const [fit, setFit] = useState<FitMode>("cover");

  const [outputs, setOutputs] = useState<OutputSpec[]>([
    { width: 512, height: 512, format: "png" },
  ]);

  const [previewIndex, setPreviewIndex] = useState<number>(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  useEffect(() => {
    if (!file || !imageUrl) return;
    const spec = outputs[previewIndex];
    if (!spec) return;
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const targetW = Math.max(1, Math.min(8000, Math.floor(spec.width)));
      const targetH = Math.max(1, Math.min(8000, Math.floor(spec.height)));
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
  }, [file, imageUrl, outputs, previewIndex, maintainAspect, fit]);

  function updateOutput(index: number, patch: Partial<OutputSpec>) {
    setOutputs((prev) => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  }

  function addOutput() {
    setOutputs((prev) => [...prev, { width: 512, height: 512, format: "png" }]);
    setPreviewIndex(outputs.length);
  }

  function removeOutput(index: number) {
    setOutputs((prev) => prev.filter((_, i) => i !== index));
    setPreviewIndex((i) => Math.max(0, Math.min(i, outputs.length - 2)));
  }

  async function handleGenerate() {
    if (!file) {
      alert("Please upload a file first");
      return;
    }

    if (outputs.length === 0) {
      alert("Please add at least one output");
      return;
    }

    const formData = new FormData();
    formData.append("logo", file);
    formData.append("outputs", JSON.stringify(outputs));
    formData.append("maintainAspect", String(maintainAspect));
    if (maintainAspect) formData.append("fit", fit);

    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch("http://localhost:5000/resize", {
      method: "POST",
      headers,
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
    if (contentType.includes("application/zip")) {
      // ZIP name comes from server
      const match = /filename=([^;]+)/i.exec(disp || "");
      a.download = match ? match[1].replace(/\"/g, "") : "resized.zip";
    } else {
      // Single output: prefer server-provided filename, otherwise synthesize
      const match = /filename=([^;]+)/i.exec(disp || "");
      if (match) {
        a.download = match[1].replace(/\"/g, "");
      } else {
        const base = (file.name || "image").replace(/\.[^.]+$/, "");
        const o = outputs[0];
        a.download = `${base}_${o.width}x${o.height}.${o.format}`;
      }
    }
    a.click();
    window.URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-6">
      <div className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-2xl space-y-4">
        <h1 className="text-2xl text-black font-bold text-center">ResizeIt</h1>

        <div className="space-y-2">
          <label className="block text-sm text-black">JWT (if required)</label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste Bearer token"
            className="w-full text-black border p-2 rounded"
          />
        </div>

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

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-black">Outputs</h2>
            <button onClick={addOutput} className="bg-green-600 text-white px-3 py-1 rounded">Add</button>
          </div>
          {outputs.map((o, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input
                type="number"
                value={o.width}
                onChange={(e) => updateOutput(i, { width: Number(e.target.value) })}
                placeholder="Width"
                className="col-span-3 border text-black p-2 rounded"
                min={1}
                max={8000}
              />
              <input
                type="number"
                value={o.height}
                onChange={(e) => updateOutput(i, { height: Number(e.target.value) })}
                placeholder="Height"
                className="col-span-3 border text-black p-2 rounded"
                min={1}
                max={8000}
              />
              <select
                className="col-span-3 border p-2 rounded text-black"
                value={o.format}
                onChange={(e) => updateOutput(i, { format: e.target.value as OutputFormat })}
              >
                <option value="png">PNG</option>
                <option value="jpeg">JPEG</option>
                <option value="webp">WebP</option>
              </select>
              <div className="col-span-3 flex items-center justify-end space-x-2">
                <button
                  onClick={() => setPreviewIndex(i)}
                  className={`px-3 py-1 rounded ${previewIndex === i ? "bg-blue-600 text-white" : "bg-gray-200 text-black"}`}
                >
                  Preview
                </button>
                {outputs.length > 1 && (
                  <button onClick={() => removeOutput(i)} className="bg-red-600 text-white px-3 py-1 rounded">Remove</button>
                )}
              </div>
            </div>
          ))}
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
    </div>
  );
}

export default App;