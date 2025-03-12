import type { Frame, Scene } from "../types";
import type { EventBaseConfig } from "../index";
import handleDiagram from "./handleDiagram";

export interface HandleFrameConfig extends EventBaseConfig {
  getComsAutoRun: () => Scene["comsAutoRun"][string];
}

const handleFrame = (frame: Frame, config: HandleFrameConfig) => {
  const result = frame.diagrams
    .map((diagram) => {
      return handleDiagram(diagram, {
        ...config,
        getFrame: () => {
          return frame;
        },
        getFrameById: (id) => {
          return frame.frames.find((frame) => frame.id === id)!;
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
          getComInfo: (comId) => {
            return config.getComInfo(comId || id);
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
