import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installPlausibleAnalytics } from "@/lib/analytics";

installPlausibleAnalytics();

createRoot(document.getElementById("root")!).render(<App />);
