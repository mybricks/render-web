<script>
import Render from "./Render.vue"
export default {
  functional: true,
  props: {
    env: Object,
    data: Object,
    inputs: Object,
    outputs: Object
  },
  render(h, { props }) {
    const json = props.env.getModuleJSON(props.data.definedId)

    return h(Render, { props: props.env.renderModule(json, {
      ref: (refs) => {
        const { inputs, outputs } = json

        inputs.forEach(({ id }) => {
          props.inputs[id]((value) => {
            refs.inputs[id](value)
          })
        })

        outputs.forEach(({ id }) => {
          refs.outputs(id, props.outputs[id])
        })

        const configs = props.data.configs

        for (let id in configs) {
          refs.inputs[id](configs[id])
        }

        refs.run()
      },
      disableAutoRun: true
    })})
  }
};
</script>
