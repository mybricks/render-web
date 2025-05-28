import type { Frame, Scene, ComInfo, PinAry } from "../types";
import type { EventBaseConfig } from "../index";
import handleDiagram from "./handleDiagram";

export interface HandleFrameConfig extends EventBaseConfig {
  getComsAutoRun: () => Scene["comsAutoRun"][string];
  getFrameId: () => string | undefined;
  getFrameMap: () => Record<
    string,
    {
      frame: Frame;
      meta: ComInfo | undefined;
    }
  >;
}

interface Result {
  paramPins: PinAry;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

const handleFrame = (frame: Frame, config: HandleFrameConfig) => {
  const frameMap = Object.assign(
    config.getFrameMap(),
    frame.frames.reduce<
      Record<
        string,
        {
          frame: Frame;
          meta: ComInfo | undefined;
        }
      >
    >((pre, cur) => {
      pre[cur.id] = {
        frame: cur,
        meta: config.getComInfo(""),
      };

      return pre;
    }, {}),
  );
  const result: Result[] = frame.diagrams
    .map((diagram) => {
      return handleDiagram(diagram, {
        ...config,
        getFrame: () => {
          return frame;
        },
        getFrameById: (id) => {
          return frameMap[id];
        },
      });
    })
    .filter((i) => i);

  const { coms } = frame;

  Object.entries(coms).forEach(([, { id, frames }]) => {
    frames.forEach((frame) => {
      result.push(
        ...handleFrame(frame, {
          ...config,
          getFrameId: () => {
            return frame.id;
          },
          getComInfo: (comId) => {
            return config.getComInfo(comId || id);
          },
          getFrameMap: () => {
            return frameMap;
          },
        }),
      );
    });
  });

  frame.frames.forEach((frame) => {
    result.push(...handleFrame(frame, config));
  });

  return result;
};

export default handleFrame;
