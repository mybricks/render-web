<script>
import Main from "./Main.vue";
import MultiScene from "./MultiScene.vue";

console.log(`%c ${'@mybricks/render-web-vue'} %c@${'0.0.1'}`, `color:#FFF;background:#fa6400`, ``, ``);

export default {
  functional: true,
  render (h, { props }) {
    // console.log('render json: ', JSON.parse(JSON.stringify(props.json)))
    const scenes = Array.isArray(props.json.scenes);
    const component = scenes ? MultiScene : Main;

    return h(component, { props }, []);
  }
};
</script>