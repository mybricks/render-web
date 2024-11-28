import React, { isValidElement, cloneElement, createContext, useContext, Component, forwardRef, useMemo } from "react";
import type { PropsWithChildren, ReactElement } from "react";

const REACT_ELEMENT_TYPE = Symbol.for('react.element');
const REACT_PORTAL_TYPE = Symbol.for('react.portal');
const REACT_FRAGMENT_TYPE = Symbol.for('react.fragment');
const REACT_STRICT_MODE_TYPE = Symbol.for('react.strict_mode');
const REACT_PROFILER_TYPE = Symbol.for('react.profiler');
const REACT_PROVIDER_TYPE = Symbol.for('react.provider');
const REACT_CONTEXT_TYPE = Symbol.for('react.context');
const REACT_FORWARD_REF_TYPE = Symbol.for('react.forward_ref');
const REACT_SUSPENSE_TYPE = Symbol.for('react.suspense');
const REACT_SUSPENSE_LIST_TYPE = Symbol.for('react.suspense_list');
const REACT_MEMO_TYPE = Symbol.for('react.memo');
const REACT_LAZY_TYPE = Symbol.for('react.lazy');
const REACT_OFFSCREEN_TYPE = Symbol.for('react.offscreen');

const proKey = `data-com-key`

const Context = createContext<{_key: string | null}>({ _key: null });
const Provider = Context.Provider;

const Next = ({ children }: PropsWithChildren) => {
  if (isValidElement(children)) {
    const { type } = children;
    const typeString = Object.prototype.toString.call(type);

    switch (typeString) {
      case "[object String]":
        return <StringNext>{children}</StringNext>;
      case "[object Object]":
        return <ObjectNext>{children}</ObjectNext>;
      case "[object Function]":
        return <FunctionNext>{children}</FunctionNext>;
      case "[object Symbol]":
        return <SymbolNext>{children}</SymbolNext>
      default:
        console.log("Next 未处理: ", typeString, children);
        return children;
    }
  }
  return children;
}

const Render = forwardRef((({ children }: PropsWithChildren, ref) => {
  if (Array.isArray(children)) {
    return children.map((child, index) => {
      return <Render key={index}>{child}</Render>;
    })
  }

  if (isValidElement(children)) {
    const { props, key: childrenKey } = children;
    const { _key: _contextKey } = useContext(Context);
    let _key = props[proKey] || _contextKey;

    if (childrenKey) {
      _key = _key ? `${_key}_${childrenKey}` : childrenKey;
    }

    if (_key && _key !== _contextKey) {
      if (_contextKey?.startsWith(_key)) {
        _key = _contextKey;
      }
      // 有新的key，使用Provider注入，断开上层嵌套
      return (
        <Provider value={{ _key }}>
          <Next>{cloneElement(children, {
            [proKey]: _key,
          })}</Next>
        </Provider>
      )
    }

    return <Next>{children}</Next>
  }

  return children;
}) as any)

export default Render;

interface NextProps {
  children: ReactElement | any;
}

const StringNext = ({ children }: NextProps) => {
  const { _key } = useContext(Context)
  const { props } = children;
  const { children: nextChildren } = props;
  const next = cloneElement(children, {
    [proKey]:_key,
    children: nextChildren ? <Render>{nextChildren}</Render> : null
  })

  return next;
}

const ObjectNext = ({ children }: NextProps) => {
  const { type } = children;

  switch ((type as any)["$$typeof"]) {
    case REACT_FORWARD_REF_TYPE:
      return <ForwardRefNext>{children}</ForwardRefNext>;
    case REACT_PROVIDER_TYPE:
      return <ProviderNext>{children}</ProviderNext>;
    case REACT_MEMO_TYPE:
      return <MemoNext>{children}</MemoNext>;
    default:
      console.log("ObjectNext 未处理: ", children)
      return children;
  }
}

const ForwardRefNext = ({ children }: NextProps) => {
  const { props, ref, type } = children as any;
  const next = type.render(props, ref)

  if (next && !Array.isArray(next)) {
    return cloneElement(next, {
      children: next.props.children ? <Render>{next.props.children}</Render> : null
    })
  }

  return (
    <Render>
      {next}
    </Render>
  )
}

const ProviderNext = ({ children }: NextProps) => {
  const { props } = children as any;
  const { children: nextChildren } = props;

  if (nextChildren) {
    return cloneElement(children, {
      children: <Render>{nextChildren}</Render>
    })
  }

  return children;
}

const MemoNext = ({ children }: NextProps) => {
  const { type, props } = children as any;

  if (typeof type.type === 'function') {
    const next = type.type(props)
    return <Render>{next}</Render>
  } if (type.type["$$typeof"] === REACT_FORWARD_REF_TYPE) {
    const next = type.type.render(props, children.ref)

    return <Render>{next}</Render>
  } else {
    console.log("MemoNext 未处理: ", children);
  }

  return children;
}

const FunctionNext = ({ children }: NextProps) => {
  const { type, props } = children as any;

  if ((type as any).prototype instanceof Component) {
    // class组件
    const Next = useMemo(() => {
      return ClassNext(children.type);
    }, [])
    
    return <Next {...props}/>
  }

  return <Render>{type(props)}</Render>
}

const ClassNext = (Component: any) => {
  return class WrapComponent extends Component {
    constructor(props: any) {
      super(props);
    }

    render(){
      const children = super.render();
      if (!children) {
        return children;
      }
      const { props } = children;
      const { children: nextChildren } = props;

      if (nextChildren) {
        return cloneElement(children, {
          children: <Render>{nextChildren}</Render>
        })
      }

      return children;
    }
  } as any;
}

const SymbolNext = ({ children }: NextProps) =>  {
  const { props } = children;
  const { children: nextChildren } = props;

  if (nextChildren) {
    return cloneElement(children, {
      children: <Render>{nextChildren}</Render>
    })
  }

  return children;
}

