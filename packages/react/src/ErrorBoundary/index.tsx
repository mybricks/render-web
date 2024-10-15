import React from 'react';
import Notification from '../Notification';
import lazyCss from './style.lazy.less';

const css = lazyCss.locals;

interface Props {
  errorTip?: string;
  children?: any;
}
export default class ErrorBoundary extends React.PureComponent<Props> {
  state = {
    hasError: false,
    error: null,
    errorInfo: null
  };
  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error: error?.stack || error?.message || error?.toString?.()
    };
  }

  componentDidCatch(error, errorInfo) {
    this.props.options?.errorHandler?.(error, errorInfo);
    Notification.error(error);
    console.error(error)
    this.setState({
      error: error?.stack || error?.message || error?.toString?.(),
      errorInfo:
        errorInfo?.stack || errorInfo?.message || errorInfo?.toString?.()
    });
  }

  render() {
    const { hasError, error, errorInfo } = this.state;
    const { children, errorTip } = this.props;
    if (!hasError) {
      return children;
    }
    return (
      <div className={css.error}>
        <div>{errorTip || `渲染错误`}</div>
        <div>{error || errorInfo}</div>
      </div>
    );
  }
}
