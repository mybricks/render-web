import type { ToJSON, Scene, Frame, ComInfo } from "./types";
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
  getScene: () => Scene;
  getSceneId: () => string;
  getSceneType: () => Scene["type"];
  getComInfo: (comId: string) => ComInfo;
}

const toCode = (
  tojson: ToJSON,
): {
  scenes: Result;
  modules: Result;
} => {
  tojson = transformToJSON(tojson);

  const scenes = tojson.scenes.map((scene) => {
    const frame = tojson.frames.find((frame) => frame.id === scene.id)!;
    return handleScene({ scene, frame });
  });

  const modules = Object.entries(tojson.modules || []).map(
    ([, { json: scene }]) => {
      const frame = tojson.frames.find((frame) => frame.id === scene.id)!;
      return handleScene({ scene, frame });
    },
  );

  return {
    scenes,
    modules,
  };
};

export default toCode;

const handleScene = (params: { scene: Scene; frame: Frame }) => {
  const { scene, frame } = params;
  const ui = handleSlot(scene.slot, {
    getComInfo: (comId) => {
      return scene.coms[comId];
    },
    getParentComInfo: () => {
      return undefined;
    },
  });
  const event = handleFrame(frame, {
    getScene: () => {
      return scene;
    },
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
    getFrameId: () => undefined,
    getFrameMap: () => {
      return {};
    },
  });

  return {
    scene,
    ui,
    event,
  };
};

const transformToJSON = (tojson: ToJSON) => {
  const { type } = tojson;

  if (type === "spa") {
    return tojson;
  }

  // mpa

  return {
    ...tojson,
    frames: tojson.frames.flatMap((frame) =>
      frame.type === "root" ? frame.frames : [frame],
    ),
  };
};
