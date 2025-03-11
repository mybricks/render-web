import type { ToJSON, Scene, ComInfo } from "./types";
import { handleSlot } from "./ui";
import { handleFrame } from "./event";

type Result = Array<{
  scene: Scene;
  ui: ReturnType<typeof handleSlot>;
  event: ReturnType<typeof handleFrame>;
}>;

export interface UiBaseConfig {
  getComInfo: (comId: string) => ComInfo;
  getParentComInfo: () => ComInfo | undefined;
}

export interface EventBaseConfig {
  getSceneId: () => string;
  getSceneType: () => Scene["type"];
  getComInfo: (comId: string) => ComInfo;
}

const toCode = (tojson: ToJSON): Result => {
  console.log("tojson => ", tojson);
  const result: Result = [];
  tojson.scenes.forEach((scene) => {
    const ui = handleSlot(scene.slot, {
      getComInfo: (comId) => {
        return scene.coms[comId];
      },
      getParentComInfo: () => {
        return undefined;
      },
    });

    const frame = tojson.frames.find((frame) => frame.id === scene.id)!;
    const event = handleFrame(frame, {
      getSceneId: () => {
        return scene.id;
      },
      getComsAutoRun: () => {
        return scene.comsAutoRun["_rootFrame_"];
      },
      getSceneType: () => {
        return scene.type;
      },
      getComInfo: (comId) => {
        return scene.coms[comId];
      },
    });

    result.push({
      scene,
      ui,
      event,
    });
  });

  return result;
};

export default toCode;
