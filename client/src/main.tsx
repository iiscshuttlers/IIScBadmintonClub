import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import './pwa'; // ✅ ADD THIS

createRoot(document.getElementById("root")!).render(<App />);
