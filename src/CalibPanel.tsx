import {
  Immutable,
  MessageEvent,
  PanelExtensionContext,
  SettingsTreeAction,
  Topic,
} from "@foxglove/extension";
import { ReactElement, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

type PanelConfig = {
  panelTitle: string;
  lidarTopic: string;
  imageTopic: string;
};

const DEFAULT_CONFIG: PanelConfig = {
  panelTitle: "lidar-cam-calib",
  lidarTopic: "/lidar/points",
  imageTopic: "/camera/image",
};

function getInitialConfig(initialState: unknown): PanelConfig {
  if (typeof initialState !== "object" || initialState == undefined) {
    return DEFAULT_CONFIG;
  }

  const state = initialState as Record<string, unknown>;
  return {
    panelTitle:
      typeof state.panelTitle === "string" ? state.panelTitle : DEFAULT_CONFIG.panelTitle,
    lidarTopic:
      typeof state.lidarTopic === "string" ? state.lidarTopic : DEFAULT_CONFIG.lidarTopic,
    imageTopic:
      typeof state.imageTopic === "string" ? state.imageTopic : DEFAULT_CONFIG.imageTopic,
  };
}

function CalibPanel({ context }: { context: PanelExtensionContext }): ReactElement {
  const [config, setConfig] = useState<PanelConfig>(() => getInitialConfig(context.initialState));
  const [topics, setTopics] = useState<undefined | Immutable<Topic[]>>();
  const [messages, setMessages] = useState<undefined | Immutable<MessageEvent[]>>();
  const [renderDone, setRenderDone] = useState<(() => void) | undefined>();

  useLayoutEffect(() => {
    context.onRender = (renderState, done) => {
      setRenderDone(() => done);
      setTopics(renderState.topics);
      setMessages(renderState.currentFrame);
    };

    context.watch("topics");
    context.watch("currentFrame");

  }, [context]);

  useEffect(() => {
    const selectedTopics = [...new Set([config.lidarTopic, config.imageTopic])]
      .filter((topic) => topic.length > 0)
      .map((topic) => ({ topic }));
    context.subscribe(selectedTopics);
  }, [config.imageTopic, config.lidarTopic, context]);

  useEffect(() => {
    context.saveState(config);
    context.setDefaultPanelTitle(config.panelTitle.trim() || undefined);
  }, [config, context]);

  const topicOptions = useMemo(
    () => [
      { label: "Sélectionner un topic", value: undefined },
      ...(topics ?? []).map((topic) => ({ label: topic.name, value: topic.name })),
    ],
    [topics],
  );

  useEffect(() => {
    const actionHandler = (action: SettingsTreeAction): void => {
      if (action.action !== "update") {
        return;
      }

      const [section, field] = action.payload.path;
      if (section !== "general" || typeof action.payload.value !== "string") {
        return;
      }

      if (field === "panelTitle") {
        setConfig((previous) => ({ ...previous, panelTitle: action.payload.value as string }));
      } else if (field === "lidarTopic") {
        setConfig((previous) => ({ ...previous, lidarTopic: action.payload.value as string }));
      } else if (field === "imageTopic") {
        setConfig((previous) => ({ ...previous, imageTopic: action.payload.value as string }));
      }
    };

    context.updatePanelSettingsEditor({
      actionHandler,
      nodes: {
        general: {
          label: "Configuration",
          fields: {
            panelTitle: {
              label: "Nom du panneau",
              input: "string",
              value: config.panelTitle,
            },
            lidarTopic: {
              label: "Topic LiDAR",
              input: "select",
              value: config.lidarTopic,
              options: topicOptions,
            },
            imageTopic: {
              label: "Topic caméra",
              input: "select",
              value: config.imageTopic,
              options: topicOptions,
            },
          },
        },
      },
    });
  }, [config, context, topicOptions]);

  useEffect(() => {
    renderDone?.();
  }, [renderDone]);

  // Pull out the latest message per topic of interest, if any arrived this frame
  const lidarMsg = messages?.find((m) => m.topic === config.lidarTopic);
  const imageMsg = messages?.find((m) => m.topic === config.imageTopic);

  const lidarTopicKnown = (topics ?? []).some((t) => t.name === config.lidarTopic);
  const imageTopicKnown = (topics ?? []).some((t) => t.name === config.imageTopic);

  return (
    <div style={{ padding: "1rem", fontFamily: "sans-serif" }}>
      <h2>{config.panelTitle || "lidar-cam-calib"} — data check</h2>
      <p>Verifying that both topics are available and messages are arriving.</p>

      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #888" }}>Topic</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #888" }}>Found in topic list</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #888" }}>Message this frame</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{config.lidarTopic || "Non sélectionné"}</td>
            <td>{lidarTopicKnown ? "yes" : "no"}</td>
            <td>{lidarMsg ? "yes" : "—"}</td>
          </tr>
          <tr>
            <td>{config.imageTopic || "Non sélectionné"}</td>
            <td>{imageTopicKnown ? "yes" : "no"}</td>
            <td>{imageMsg ? "yes" : "—"}</td>
          </tr>
        </tbody>
      </table>

      {lidarMsg ? (
        <div style={{ marginTop: "1rem" }}>
          <h3>Lidar message preview</h3>
          <pre style={{ fontSize: "12px", overflow: "auto", maxHeight: "150px" }}>
            {JSON.stringify(
              {
                frame_id: (lidarMsg.message as Record<string, unknown>).frame_id,
                point_stride: (lidarMsg.message as Record<string, unknown>).point_stride,
                data_length:
                  typeof (lidarMsg.message as Record<string, unknown>).data === "string"
                    ? ((lidarMsg.message as Record<string, unknown>).data as string).length
                    : undefined,
              },
              null,
              2,
            )}
          </pre>
        </div>
      ) : undefined}

      {imageMsg ? (
        <div style={{ marginTop: "1rem" }}>
          <h3>Image message preview</h3>
          <pre style={{ fontSize: "12px", overflow: "auto", maxHeight: "150px" }}>
            {JSON.stringify(
              {
                frame_id: (imageMsg.message as Record<string, unknown>).frame_id,
                format: (imageMsg.message as Record<string, unknown>).format,
                data_length:
                  typeof (imageMsg.message as Record<string, unknown>).data === "string"
                    ? ((imageMsg.message as Record<string, unknown>).data as string).length
                    : undefined,
              },
              null,
              2,
            )}
          </pre>
        </div>
      ) : undefined}
    </div>
  );
}

export function initCalibPanel(context: PanelExtensionContext): () => void {
  const root = createRoot(context.panelElement);
  root.render(<CalibPanel context={context} />);

  return () => {
    root.unmount();
  };
}