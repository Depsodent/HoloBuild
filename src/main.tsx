import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/index.css";
import "./workspace/workspace.css";
if (
  import.meta.env.DEV &&
  new URLSearchParams(location.search).has("testInput")
) {
  void import("./dev/testBridge").then((module) => module.installTestBridge());
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
