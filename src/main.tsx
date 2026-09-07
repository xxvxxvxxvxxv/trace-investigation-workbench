import { TraceBrand } from "./components/TraceBrand";
import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "./App";
import { seed } from "./data/seed";
import "./styles/app.css";
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <div className="boot">
        <h1>Workspace could not open</h1>
        <p>{this.state.error}</p>
        <p>
          Check that browser storage is available. Your existing data has not been
          intentionally cleared.
        </p>
        <button onClick={() => location.reload()}>Reload</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(
  <div className="boot">
    <TraceBrand />
    Opening local workspace…
  </div>,
);
seed()
  .then(() =>
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <HashRouter>
            <App />
          </HashRouter>
        </ErrorBoundary>
      </React.StrictMode>,
    ),
  )
  .catch((error) =>
    root.render(
      <div className="boot">
        <h1>Local storage unavailable</h1>
        <p>{String(error)}</p>
        <p>Allow IndexedDB and reload TRACE.</p>
      </div>,
    ),
  );
