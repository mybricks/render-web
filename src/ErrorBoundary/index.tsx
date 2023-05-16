import React from 'react';
// import css from './style.less';
const css = {};
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
    console.error(error, errorInfo);
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
      <view className={css.error}>
        <view>{errorTip || `渲染错误`}</view>
        <view>{error || errorInfo}</view>
      </view>
    );
  }
}
