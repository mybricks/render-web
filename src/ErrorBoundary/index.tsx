import React from 'react';
import Notification from '../Notification';
import css from './style.less';
import View from '../View';

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
    Notification.error(error);
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
      <View className={css.error}>
        <View>{errorTip || `渲染错误`}</View>
        <View>{error || errorInfo}</View>
      </View>
    );
  }
}
