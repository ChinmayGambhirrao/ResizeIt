import { useState } from "react";

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [width, setWidth] = useState<number>(512);
  const [height, setHeight] = useState<number>(512);

  const handleUpload = async () => {
    if(!file) {
      alert("Please upload a file first");
      return;
    }

    const formData = new FormData();
    formData.append("logo", file);
    formData.append("width", width.toString());
    formData.append("height", height.toString());

    const res = await fetch("http://localhost:5000/resize", {
      method: "POST",
      body: formData,
    })

    if(!res.ok) {
      alert("Failed to resize");
      return;
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `logo_${width}x${height}.png`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

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

        <div className="flex space-x-4">
          <input
            type="number"
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            placeholder="Width"
            className="w-1/2 border text-black p-2 rounded"
          />
          <input
            type="number"
            value={height}
            onChange={(e) => setHeight(Number(e.target.value))}
            placeholder="Height"
            className="w-1/2 border p-2 rounded text-black"
          />
        </div>

        <button
          onClick={handleUpload}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
        >
          Resize & Download
        </button>
      </div>
    </div>
  );
}

export default App;