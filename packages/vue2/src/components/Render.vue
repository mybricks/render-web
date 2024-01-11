<script>
import Main from "./Main.vue";
import MultiScene from "./MultiScene.vue";

class Context {
  _refsMap = {}

  setRefs(id, refs) {
    this._refsMap[id] = refs
  }

  getRefsMap() {
    return this._refsMap
  }
}

export default {
  functional: true,
  render (h, { props }) {
    const { json, opts } = props
    if (!json) {
      return null
    }
    if (!opts.env._context) {
      opts.env._context = new Context()
    }
    // console.log('render json: ', JSON.parse(JSON.stringify(props.json)))
    const scenes = Array.isArray(json.scenes);
    const component = scenes ? MultiScene : Main;
    if (!scenes && json.type === 'module') {
      props.root = false
    }

    return h(component, { props }, []);
  }
};
</script>