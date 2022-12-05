import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import css from './style.less';

enum TypeEnum {
  Error = 'error',
  Warning = 'warning'
}
interface InfoProps {
  _tid?: string;
  content: string;
  type: TypeEnum;
}

const containerDomNodeId = '__fz-debug-info-container__';
let containerDomNode: Element | null =
  document.getElementById(containerDomNodeId);

let globalControl: {
  add: (item: InfoProps) => void;
  remove: (id?: string) => void;
};
let tid = 0;
const getToastId = () => `__fz-toast-id-${++tid}__`;

const useInfoQueue = () => {
  const [queue, setQueue] = useState<InfoProps[]>([]);
  const add = (item: InfoProps) => {
    const _tid = getToastId();
    item = Object.assign({ _tid }, item);
    setQueue((v) => [...v, item]);
  };
  const remove = (tid) => {
    setQueue((v) => v.filter((el) => el._tid !== tid));
  };
  globalControl = {
    add,
    remove
  };
  return [queue];
};

const ItemStyleMap = {
  [TypeEnum.Error]: css.errorItem,
  [TypeEnum.Warning]: css.warningItem
};
const ToastContainer = ({ initToast }) => {
  const [queue] = useInfoQueue();
  useEffect(() => {
    if (initToast) {
      globalControl.add(initToast);
    }
  }, []);

  return (
    <div className={css.container}>
      {queue.map((item) => (
        <div
          key={item._tid}
          className={`${css.item} ${ItemStyleMap[item.type]}`}
        >
          <svg
            className={css.closeIcon}
            viewBox="0 0 1045 1024"
            xmlns="http://www.w3.org/2000/svg"
            onClick={() => globalControl.remove(item._tid)}
          >
            <path
              d="M282.517333 213.376l-45.354666 45.162667L489.472 512 237.162667 765.461333l45.354666 45.162667L534.613333 557.354667l252.096 253.269333 45.354667-45.162667-252.288-253.44 252.288-253.482666-45.354667-45.162667L534.613333 466.624l-252.096-253.226667z"
              fill="#555555"
            ></path>
          </svg>
          {item.content}
        </div>
      ))}
    </div>
  );
};

const dispatchToast = (toast: string, type: TypeEnum) => {
  let item = { content: '', type };
  if (typeof toast === 'string') {
    item.content = toast;
  } else {
    try {
      item.content = JSON.stringify(toast);
    } catch (e) {
      console.error('dispatchToastError', e, { toast });
    }
  }
  if (!item.content) {
    return;
  }

  if (containerDomNode) {
    globalControl.add(item);
  } else {
    containerDomNode = document.createElement('div');
    containerDomNode.setAttribute('id', containerDomNodeId);
    document.body.appendChild(containerDomNode);
    ReactDOM.render(<ToastContainer initToast={item} />, containerDomNode);
  }
};

export default {
  error: (v) => dispatchToast(v?.stack || v?.message || v, TypeEnum.Error)
};
