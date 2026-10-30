import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import Landing from "./pages/Landing";
import Game from "./pages/Game";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/play" element={<Game />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="top-center" richColors theme="dark" toastOptions={{ style: { fontFamily: "Cinzel, serif", border: "1px solid #c8961f", background: "#1a0f07", color: "#fdf1cf" } }} />
    </BrowserRouter>
  );
}

export default App;
