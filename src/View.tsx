export default function (props) {

  let _props = {
    ...props
  };

  delete _props.platform;
  delete _props.children;

  switch (props.platform) {
    case "mp":
      return (<view {..._props}>{props.children}</view>);
    case "web":
    default:
      return (<div {..._props}>{props.children}</div>);
  }
}