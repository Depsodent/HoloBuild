import { useLeftStore, type LeftTab } from "./leftStore";
import { SceneCollection } from "../components/ui/SceneCollection";
import { useTrackingStore } from "../vision/trackingStore";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  ChevronDown,
  Minus,
  Camera,
  SlidersHorizontal,
} from "lucide-react";
import { WebcamPreview } from "../components/camera/WebcamPreview";
import { ObjectInspector } from "../components/ui/ObjectInspector";
import { Toolbar } from "../components/ui/Toolbar";
import { GestureDiagnostics } from "../components/ui/GestureDiagnostics";
import { ResizeHandle } from "./ResizeHandle";
import {
  fitCameraHeight,
  cameraHeightRange,
  fitSidebars,
  useWorkspaceLayout,
} from "./layoutStore";

export function WorkspaceLayout({ children }: { children: ReactNode }) {
  const { tab, setTab } = useLeftStore();
  const tracking = useTrackingStore((s) => s.status);
  const root = useRef<HTMLDivElement>(null);
  const { layout, update } = useWorkspaceLayout();
  const [bounds, setBounds] = useState({
    width: window.innerWidth,
    height: window.innerHeight - 128,
  });
  const drawer = layout.mobileDrawer;
  const setDrawer = useCallback(
    (mobileDrawer: "left" | "right" | null) => update({ mobileDrawer }),
    [update],
  );
  useEffect(() => {
    if (!root.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setBounds({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawer(null);
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
    };
  }, [setDrawer]);
  const small = bounds.width < 780;
  const leftCollapsed = small ? drawer !== "left" : layout.leftCollapsed;
  const rightCollapsed = small ? drawer !== "right" : layout.rightCollapsed;
  const widths = fitSidebars(
    bounds.width,
    leftCollapsed ? 44 : layout.leftWidth,
    rightCollapsed ? 60 : layout.rightWidth,
  );
  const cameraHeight = fitCameraHeight(bounds.height - 36, layout.cameraHeight);
  const cameraRange = cameraHeightRange(bounds.height - 36);
  const cameraRow = !layout.cameraDocked
    ? 42
    : layout.cameraMinimized
      ? 54
      : layout.inspectorMinimized
        ? bounds.height - 80
        : cameraHeight;
  return (
    <div
      ref={root}
      className={`workspace adaptive-workspace ${small ? "small-workspace" : ""}`}
      style={
        {
          "--left-width": `${leftCollapsed ? 44 : widths.left}px`,
          "--right-width": `${rightCollapsed ? 60 : widths.right}px`,
          "--left-drawer": `${Math.min(layout.leftWidth, bounds.width - 60)}px`,
          "--right-drawer": `${Math.min(layout.rightWidth, bounds.width - 44)}px`,
          "--camera-height": `${cameraRow}px`,
        } as CSSProperties
      }
    >
      <aside
        className={`workspace-left ${leftCollapsed ? "collapsed" : ""}`}
        aria-label="Gesture and object sidebar"
      >
        <div className="sidebar-heading">
          <span>INPUT & INSPECTOR</span>
          <button
            aria-label={
              leftCollapsed ? "Expand left sidebar" : "Collapse left sidebar"
            }
            title={
              leftCollapsed ? "Expand left sidebar" : "Collapse left sidebar"
            }
            onClick={() =>
              small
                ? setDrawer(leftCollapsed ? "left" : null)
                : update({ leftCollapsed: !leftCollapsed })
            }
          >
            {leftCollapsed ? (
              <PanelLeftOpen size={17} />
            ) : (
              <PanelLeftClose size={17} />
            )}
          </button>
        </div>
        <div className="left-rail" hidden={!leftCollapsed}>
          <button
            aria-label="Show Gesture Input"
            title="Show Gesture Input"
            onClick={() => {
              if (small) setDrawer("left");
              else update({ leftCollapsed: false });
              setTab("gesture");
              update({ cameraMinimized: false });
            }}
          >
            <Camera size={17} />
          </button>
          <button
            aria-label="Show Object Inspector"
            title="Show Object Inspector"
            onClick={() => {
              if (small) setDrawer("left");
              else update({ leftCollapsed: false });
              setTab("inspector");
              update({ inspectorMinimized: false });
            }}
          >
            <SlidersHorizontal size={17} />
          </button>
        </div>
        <div className="left-navigation" hidden={leftCollapsed}>
          <div role="tablist" aria-label="Left workspace categories">
            {(["gesture", "inspector", "collection"] as LeftTab[]).map(
              (name, index) => (
                <button
                  key={name}
                  id={`left-tab-${name}`}
                  role="tab"
                  aria-selected={tab === name}
                  aria-controls={`left-panel-${name}`}
                  tabIndex={tab === name ? 0 : -1}
                  onClick={() => setTab(name)}
                  onKeyDown={(e) => {
                    const tabs: LeftTab[] = [
                      "gesture",
                      "inspector",
                      "collection",
                    ];
                    let next = index;
                    if (e.key === "ArrowRight") next = (index + 1) % 3;
                    else if (e.key === "ArrowLeft") next = (index + 2) % 3;
                    else if (e.key === "Home") next = 0;
                    else if (e.key === "End") next = 2;
                    else return;
                    e.preventDefault();
                    setTab(tabs[next]);
                    document.getElementById(`left-tab-${tabs[next]}`)?.focus();
                  }}
                >
                  {name[0].toUpperCase() + name.slice(1)}
                </button>
              ),
            )}
          </div>
          {(tracking === "running" || tracking === "starting") &&
            tab !== "gesture" && (
              <div className="sidebar-camera-status">
                <span>Camera · {tracking}</span>
                <button
                  aria-label="Stop sidebar camera"
                  onClick={() =>
                    window.dispatchEvent(new Event("holobuild:stop-camera"))
                  }
                >
                  Stop Camera
                </button>
              </div>
            )}
        </div>
        <div
          className="left-split left-tab-content"
          style={{
            gridTemplateRows:
              tab === "gesture"
                ? `${cameraRow}px ${layout.cameraDocked && !layout.cameraMinimized ? 7 : 0}px minmax(0,1fr)`
                : "minmax(0,1fr)",
          }}
        >
          <div
            id="left-panel-gesture"
            role="tabpanel"
            aria-labelledby="left-tab-gesture"
            className={`camera-dock ${tab !== "gesture" && layout.cameraDocked ? "inactive-camera-tab" : ""}`}
            style={
              tab !== "gesture"
                ? layout.cameraDocked
                  ? { position: "absolute" }
                  : { display: "contents" }
                : undefined
            }
          >
            {!layout.cameraDocked && tab === "gesture" && (
              <button
                className="dock-placeholder"
                aria-label="Restore docked Gesture Input"
                onClick={() => update({ cameraDocked: true })}
              >
                <Camera size={15} /> Dock Gesture Input
              </button>
            )}
            <WebcamPreview />
          </div>
          {layout.cameraDocked &&
          !layout.cameraMinimized &&
          tab === "gesture" ? (
            <ResizeHandle
              label="Resize Gesture Input height"
              orientation="horizontal"
              value={cameraHeight}
              min={cameraRange.min}
              max={cameraRange.max}
              onResize={(cameraHeight) => update({ cameraHeight })}
            />
          ) : (
            <div />
          )}
          <section
            hidden={tab !== "inspector"}
            id="left-panel-inspector"
            role="tabpanel"
            aria-labelledby="left-tab-inspector"
            className={`inspector-section ${layout.inspectorMinimized ? "minimized" : ""}`}
            aria-label="Object Inspector panel"
          >
            <div className="panel-section-heading">
              <strong>Object Inspector</strong>
              <button
                aria-label={
                  layout.inspectorMinimized
                    ? "Expand Object Inspector"
                    : "Minimize Object Inspector"
                }
                onClick={() =>
                  update({ inspectorMinimized: !layout.inspectorMinimized })
                }
              >
                {layout.inspectorMinimized ? (
                  <ChevronDown size={15} />
                ) : (
                  <Minus size={15} />
                )}
              </button>
            </div>
            <div
              className="inspector-scroll"
              hidden={layout.inspectorMinimized}
            >
              <ObjectInspector />
            </div>
          </section>
          <div
            hidden={tab !== "collection"}
            id="left-panel-collection"
            role="tabpanel"
            aria-labelledby="left-tab-collection"
            className="inspector-scroll"
          >
            <SceneCollection />
          </div>
        </div>
      </aside>
      <ResizeHandle
        label="Resize left sidebar"
        orientation="vertical"
        value={widths.left}
        min={280}
        max={Math.min(
          440,
          bounds.width - (rightCollapsed ? 60 : widths.right) - 312,
        )}
        onResize={(leftWidth) => update({ leftWidth, leftCollapsed: false })}
      />
      {children}
      <ResizeHandle
        label="Resize right sidebar"
        orientation="vertical"
        value={widths.right}
        min={166}
        max={Math.min(
          360,
          bounds.width - (leftCollapsed ? 44 : widths.left) - 312,
        )}
        direction={-1}
        onResize={(rightWidth) => update({ rightWidth, rightCollapsed: false })}
      />
      <aside
        className={`workspace-right ${rightCollapsed ? "collapsed" : ""} ${widths.right < 205 ? "narrow" : ""}`}
        aria-label="Construction tools sidebar"
      >
        <div className="sidebar-heading">
          <span>CONSTRUCTION</span>
          <button
            aria-label={
              rightCollapsed
                ? "Expand construction tools"
                : "Collapse construction tools"
            }
            title={
              rightCollapsed
                ? "Expand construction tools"
                : "Collapse construction tools"
            }
            onClick={() =>
              small
                ? setDrawer(rightCollapsed ? "right" : null)
                : update({ rightCollapsed: !rightCollapsed })
            }
          >
            {rightCollapsed ? (
              <PanelRightOpen size={17} />
            ) : (
              <PanelRightClose size={17} />
            )}
          </button>
        </div>
        <Toolbar compact={rightCollapsed} />
      </aside>
      <GestureDiagnostics />
    </div>
  );
}
