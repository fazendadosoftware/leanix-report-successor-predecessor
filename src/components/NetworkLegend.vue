<script>
import Vue from 'vue'
import SVG from 'svg.js'

// eslint-disable-next-line
const setLegend = (el, bcs) => { /* eslint-disable */
  const grey800 = '#9e9e9e'

  const canvasDims = [200, 50 + 30 * bcs.length]
  const borderWidth = 1
  const padding = 10
  const containerDims = canvasDims.map(dim => dim - 2 * borderWidth)

  const canvas = SVG(el).size(...canvasDims)

  const container = canvas.rect(...containerDims)
    .x(borderWidth)
    .y(borderWidth)
    .stroke({ width: borderWidth, color: '#424242' })
    .attr({ fill: 'white' })

  const legend = canvas.text('Business Capabilities:')
    .x(padding)
    .y(padding)
    .font({ family: 'Helvetica', size: 14, anchor: 'start', weight: 'bold' })

  let labels = []

  bcs.forEach((bc, idx) => {
    const box = canvas
      .rect(30, 20)
      .x(padding)
      .y(4 * legend.y() + padding + idx * 30)
      .radius(5).attr({ fill: bc.bgColor })
      .style({
        cursor: 'pointer'
      })
      .click(function () {
        const label = labels[idx]
        if (bc.enabled === undefined) bc.enabled = true
        bc.enabled = !bc.enabled
        label.attr('text-decoration', label.attr('text-decoration') === 'none' ? 'line-through' : 'none')
        // this.fill({ color: bc.enabled ? bc.bgColor : 'grey' })
      })

    const label = canvas
      .text(add => {
        add.tspan(bc.name)
      })
      .font({ family: 'Helvetica' })
      .attr({ 'text-decoration': 'none' })
      .x(box.x() + box.width() + padding)
      .y(4 * legend.y() + padding + idx * 30)

    let addEllipsis
    while (container.bbox().x2 - label.bbox().x2 < -30) {
      const slice = label.text().slice(0, -1).trim()
      label.text(slice)
        .x(box.x() + box.width() + padding)
        .y(4 * legend.y() + padding + idx * 30)
      addEllipsis = true
    }
    if (addEllipsis) {
      label.text(`${label.text()}...`)
    }
    labels.push(label)
  })

  const element = canvas.svg()
  // canvas.remove()
  return element
}

export default Vue.extend({
  props: ['businessCapabilities'],
  chance: require('chance').Chance(),
  /*
  data () {
    return {
      name: 'Paulo',
      bcs: [
        { name: 'Fleet Management', bgColor: '#f44336' },
        { name: 'Accounting & Billing', bgColor: '#9c27b0' },
        { name: 'Legal', bgColor: '#673ab7' },
        { name: 'Purchasing', bgColor: '#3f51b5' },
        { name: 'Real State Management', bgColor: '#2196f3' }
      ]
    }
  },
  */
  render: function (createElement) {
    return createElement('div', {
      attr: {
        id: 'network-legend'
      },
      class: ['legend-container']
    })
  },
  mounted () {
    this.labels = setLegend(this.$el, this.businessCapabilities)
  }
})
</script>

<style lang="stylus" scoped>
.legend-container
  position absolute
  top 0
  left 0
  padding 1em
</style>
