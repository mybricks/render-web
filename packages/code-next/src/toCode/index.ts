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
  extensionEvents: Array<{ meta: Scene; events: Result[0]["event"] }>;
  globalFxs: Result[0]["event"];
  globalVars: Result[0]["event"];
} => {
  tojson = transformToJSON(tojson);

  // 注入全局fxframe，根据ioProxy.id查询
  const frameMap = tojson.frames
    .filter((frame) => {
      return frame.type === "globalFx";
    })
    .reduce<
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
        meta: undefined,
      };

      return pre;
    }, {});

  const extensionEvents = tojson.frames
    .filter((frame) => {
      return ["extension-config", "extension-api", "extension-bus"].includes(
        frame.type,
      );
    })
    .reduce(
      (pre, frame) => {
        const scene = tojson.global.fxFrames.find((fxFrame) => {
          return fxFrame.id === frame.id;
        })!;

        pre.push({
          meta: scene,
          events: handleFrame(frame, {
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
              return frameMap;
            },
          }),
        });

        return pre;
      },
      [] as Array<{ meta: Scene; events: Result[0]["event"] }>,
    );

  const globalFxs = tojson.frames
    .filter((frame) => {
      return frame.type === "globalFx";
    })
    .reduce(
      (pre, frame) => {
        const scene = tojson.global.fxFrames.find((fxFrame) => {
          return fxFrame.id === frame.id;
        })!;

        pre.push(
          ...handleFrame(frame, {
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
              return frameMap;
            },
          }),
        );

        return pre;
      },
      [] as Result[0]["event"],
    );

  const globalScene = {
    ...tojson.scenes[0],
    coms: tojson.global.comsReg,
  };

  const globalVarFrames = {
    ...tojson.frames.find((frame) => frame.type === "global"),
    frames: [],
    coms: {},
  } as Frame;

  const globalVars = handleFrame(globalVarFrames, {
    getScene: () => {
      return globalScene;
    },
    getSceneId: () => {
      return globalScene.id;
    },
    getComsAutoRun: () => {
      return globalScene.comsAutoRun["_rootFrame_"];
    },
    getSceneType: () => {
      return globalScene.type;
    },
    getComInfo: (comId) => {
      return globalScene.coms[comId];
    },
    getFrameId: () => undefined,
    getFrameMap: () => {
      return frameMap;
    },
  });

  const scenes: ReturnType<typeof handleScene>[] = [];
  const modules: ReturnType<typeof handleScene>[] = [];

  tojson.scenes.forEach((scene) => {
    const frame = tojson.frames.find((frame) => frame.id === scene.id)!;
    if (scene.type === "module") {
      modules.push(handleScene({ scene, frame, frameMap }));
    } else {
      scenes.push(handleScene({ scene, frame, frameMap }));
    }
  });

  return {
    scenes,
    modules,
    extensionEvents,
    globalFxs,
    globalVars,
  };
};

export default toCode;

const handleScene = (params: {
  scene: Scene;
  frame: Frame;
  frameMap: Record<
    string,
    {
      frame: Frame;
      meta: ComInfo | undefined;
    }
  >;
}) => {
  const { scene, frame } = params;
  const ui = handleSlot(scene.slot, {
    getComInfo: (comId) => {
      return scene.coms[comId];
    },
    getParentComInfo: () => {
      return undefined;
    },
  });

  // [TODO] 观察下什么情况下frame是undefined
  const event = frame
    ? handleFrame(frame, {
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
          return params.frameMap;
        },
      })
    : [];

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
      frame.type === "root" && frame.frames.length ? frame.frames : [frame],
    ),
  };
};
