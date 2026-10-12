import { Component, type ErrorInfo, type ReactNode } from "react";
export class ViewportBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("3D viewport failed", error, info.componentStack);
  }
  render() {
    return this.state.failed ? (
      <div className="viewport-error">
        <h2>3D rendering is unavailable</h2>
        <p>
          Enable hardware acceleration in your browser, then reload. Your editor
          controls remain available; save your scene before reloading.
        </p>
      </div>
    ) : (
      this.props.children
    );
  }
}
