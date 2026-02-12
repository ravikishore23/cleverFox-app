import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { Provider } from "@/components/ui/provider";

import "@fontsource/passero-one/400.css";
import "@fontsource/inika/700.css";
import "@fontsource/mochiy-pop-one/400.css";
import "@fontsource/fredoka/700.css";

import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";

import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider>
      <App />
    </Provider>
  </StrictMode>,
);
