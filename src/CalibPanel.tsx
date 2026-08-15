import { Immutable, MessageEvent, PanelExtensionContext, Topic } from "@foxglove/extension";
import { ReactElement, useEffect, useLayoutEffect, useState } from "react";
import { createRoot } from "react-dom/client";

const LIDAR_TOPIC = "/lidar/points";
const IMAGE_TOPIC = "/camera/image";

function CalibPanel({ context }: { context: PanelExtensionContext }): ReactElement {
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

    context.subscribe([{ topic: LIDAR_TOPIC }, { topic: IMAGE_TOPIC }]);
  }, [context]);

  useEffect(() => {
    renderDone?.();
  }, [renderDone]);

  // Pull out the latest message per topic of interest, if any arrived this frame
  const lidarMsg = messages?.find((m) => m.topic === LIDAR_TOPIC);
  const imageMsg = messages?.find((m) => m.topic === IMAGE_TOPIC);

  const lidarTopicKnown = (topics ?? []).some((t) => t.name === LIDAR_TOPIC);
  const imageTopicKnown = (topics ?? []).some((t) => t.name === IMAGE_TOPIC);

  return (
    <div style={{ padding: "1rem", fontFamily: "sans-serif" }}>
      <h2>lidar-cam-calib — data check</h2>
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
            <td>{LIDAR_TOPIC}</td>
            <td>{lidarTopicKnown ? "yes" : "no"}</td>
            <td>{lidarMsg ? "yes" : "—"}</td>
          </tr>
          <tr>
            <td>{IMAGE_TOPIC}</td>
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