import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import css from "./style.less";

// 是否显示notification
let showErrorNotification = false;

enum TypeEnum {
  Error = "error",
}
interface InfoProps {
  _nid?: string;
  content: string;
  type: TypeEnum;
}

const containerDomNodeId = "__fz-debug-info-container__";
let containerDomNode: Element | null =
  document.getElementById(containerDomNodeId);

let globalControl: {
  add: (item: InfoProps) => void;
  remove: (id?: string) => void;
};
let nid = 0;
const getNotificationId = () => `__fz-notification-id-${++nid}__`;

const Notification = ({ content, type }) => {
  const [queue, setQueue] = useState<InfoProps[]>([]);
  const add = (item: InfoProps) => {
    const _nid = getNotificationId();
    item = Object.assign({ _nid }, item);
    setQueue((v) => [...v, item]);
  };
  const remove = (nid) => {
    setQueue((v) => v.filter((el) => el._nid !== nid));
  };

  useEffect(() => {
    globalControl = {
      add,
      remove,
    };
    if (content) {
      globalControl.add({ content, type });
    }
  }, []);

  return (
    <div className={css.container}>
      {queue.map((item) => (
        <div key={item._nid} className={css.itemWrap}>
          <div className={`${css.item} ${css.errorItem}`}>
            <svg
              className={css.closeIcon}
              viewBox="0 0 1045 1024"
              xmlns="http://www.w3.org/2000/svg"
              onClick={() => globalControl.remove(item._nid)}
            >
              <path
                d="M282.517333 213.376l-45.354666 45.162667L489.472 512 237.162667 765.461333l45.354666 45.162667L534.613333 557.354667l252.096 253.269333 45.354667-45.162667-252.288-253.44 252.288-253.482666-45.354667-45.162667L534.613333 466.624l-252.096-253.226667z"
                fill="#555555"
              ></path>
            </svg>
            {item.content}
          </div>
        </div>
      ))}
    </div>
  );
};

const showNotification = (message: string | Event, type: TypeEnum) => {
  let item = { content: "", type };
  if (typeof message === "string") {
    item.content = message;
  } else {
    try {
      item.content = JSON.stringify(message);
    } catch (e) {
      console.error("showNotification JSON.stringify Error", e, { message });
    }
  }
  if (!item.content) {
    return;
  }

  if (containerDomNode) {
    globalControl?.add(item);
  } else {
    containerDomNode = document.createElement("div");
    containerDomNode.setAttribute("id", containerDomNodeId);
    document.body.appendChild(containerDomNode);
    ReactDOM.render(
      <Notification content={item.content} type={item.type} />,
      containerDomNode
    );
  }
};

// 无效报错
const ignoreErrors = ["ResizeObserver loop limit exceeded"];
export default {
  init: (isShow?: boolean) => {
    showErrorNotification = isShow !== false;
    if (showErrorNotification) {
      window.onerror = function (message, source, lineno, colno, error) {
        if (typeof message === "string" && ignoreErrors.includes(message)) {
          return;
        }
        console.error(error || message);
        showNotification(
          error?.stack || error?.message || error?.toString?.() || message,
          TypeEnum.Error
        );
        return false;
      };
    }
  },
  error: (err) => {
    if (showErrorNotification) {
      const message = err?.stack || err?.message || err?.toString?.() || err;
      if (typeof message === "string" && ignoreErrors.includes(message)) {
        return;
      }
      showNotification(message, TypeEnum.Error);
    }
  },
};
