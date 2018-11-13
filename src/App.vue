<template>
  <div id="app">
    <div class="logo">
      <img width="200" src="./assets/logo.svg">
    </div>
    <div class="hover-container" v-if="hoveredNode">
      Further information for {{hoveredNode.title || hoveredNode}} shown here...
    </div>
    <div class="chart-container" ref="chart"/>
  </div>
</template>

<script>
import { DataSet, Network } from 'vis'
import NetworkLegend from './components/NetworkLegend'
import 'vis/dist/vis-network.min.css'

const labels = [
  { label: 'Baseline', color: 'red' },
  { label: 'Transition', color: 'green' },
  { label: 'Target', color: 'blue' }
]

export default {
  name: 'App',
  components: { NetworkLegend },
  dataset: require('../test/dataset.json'),
  nodeWidth: 150,
  levelSeparation: 350,
  // non-tracked variable, available at this.$options.nodes
  nodes: undefined,
  // non-tracked variable, available at this.$options.edges
  edges: undefined,
  network: undefined,
  data () {
    return {
      hoveredNode: undefined,
      businessCapabilities: [
        { name: 'Fleet Management', bgColor: '#f44336' },
        { name: 'Accounting & Billing', bgColor: '#9c27b0' },
        { name: 'Legal', bgColor: '#673ab7' },
        { name: 'Purchasing', bgColor: '#3f51b5' },
        { name: 'Real State Management', bgColor: '#2196f3' }
      ],
      zoomLimit: 1,
      options: {
        interaction: { navigationButtons: true, hover: true, selectable: true },
        layout: {
          hierarchical: {
            enabled: true,
            direction: 'LR',
            sortMethod: 'directed',
            levelSeparation: 350,
            nodeSpacing: 100,
            treeSpacing: 100
          }
        },
        nodes: {
          borderWidth: 1,
          borderWidthSelected: 1,
          color: {
            border: 'black',
            background: 'white',
            // highlight: { border: 'black', background: 'green' },
            hover: { border: 'black', background: 'white' }
          },
          font: { face: 'Helvetica', color: 'black', size: 13 },
          shapeProperties: { borderRadius: 4 },
          widthConstraint: { minimum: 150, maximum: 150 },
          heightConstraint: { minimum: 40 },
          labelHighlightBold: false
        },
        edges: {
          color: { color: '#424242', hover: '#212121', highlight: '#212121' },
          arrows: { to: { enabled: true, scaleFactor: 0.7 } },
          shadow: { enabled: true, color: '#424242', x: 3, y: 3, size: 15 },
          smooth: { enabled: false }
        },
        physics: {
          enabled: true
        },
        groups: {
          'BC A': {
            color: {
              background: 'red',
              hover: {
                border: 'black',
                background: 'black'
              }
            },
            font: { color: 'white' }
          },
          'BC B': {
            color: {
              background: 'blue',
              hover: {
                border: 'black',
                background: 'black'
              }
            },
            font: { color: 'white' }
          }
        }
      }
    }
  },
  methods: {
    drawOverlay (ctx) {
      const { levelSeparation, nodeSpacing, treeSpacing } = this.options.layout.hierarchical

      const nodes = this.$options.dataset.nodes
        .reduce((accumulator, node) => {
          if (!accumulator[node.group]) accumulator[node.group] = []
          accumulator[node.group].push(node.id)
          return accumulator
        }, {})
      const bboxes = Object.entries(nodes)
        .reduce((accumulator, [bc, ids]) => {
          const positions = this.$options.network.getPositions(ids)
          const bbox = Object.values(positions)
            .reduce((accumulator, {x, y}) => {
              let [minX, minY, maxX, maxY] = accumulator
              if (minX === undefined || x < minX) minX = x
              if (minY === undefined || y < minY) minY = y
              if (maxX === undefined || x > maxX) maxX = x
              if (maxY === undefined || y > maxY) maxY = y
              return [minX, minY, maxX, maxY]
            }, [undefined, undefined, undefined, undefined])
          accumulator[bc] = bbox
          return accumulator
        }, {})

      bboxes._all = Object.values(bboxes)
        .reduce((accumulator, bbox) => {
          let [minX, minY, maxX, maxY] = accumulator
          const [mX, mY, MX, MY] = bbox
          if (minX === undefined || mX < minX) minX = mX
          if (minY === undefined || mY < minY) minY = mY
          if (maxX === undefined || MX > maxX) maxX = MX
          if (maxY === undefined || MY > maxY) maxY = MY
          return [minX, minY, maxX, maxY]
        }, [undefined, undefined, undefined, undefined])

      // Compute the bounding box that encompasses all business capability trees
      let bbox = bboxes._all
        .map((coord, idx, coords) => idx > 1 ? coord - coords[idx - 2] : coord) // convert minX, minY, maxX, maxY into originX, originY, width, height

      delete bboxes._all

      const [originX, originY, width, height] = bbox
      bbox = [originX - nodeSpacing * 1.5, originY - nodeSpacing, width + nodeSpacing * 3, height + nodeSpacing * 2] // Add padding to the outer container

      // Draw the outer container
      ctx.beginPath()
      ctx.strokeStyle = '#bdbdbd'
      ctx.strokeRect(...bbox)

      const topY = bbox[1]
      Object.entries(bboxes)
        .forEach(([BC, bbox], idx) => {
          let x = bbox[0] - levelSeparation
          let y = (bbox[1] + bbox[3]) / 2 // Center position for BC Row

          // Draw legend for business capability
          ctx.beginPath()
          ctx.font = '24px Helvetica'
          ctx.fillStyle = 'black'
          ctx.fillText(BC, x, y)
          ctx.beginPath()
          ctx.strokeStyle = '#bdbdbd'

          // Add horizontal separators between business capabilities
          const bottomY = bbox[3] + treeSpacing
          const startX = bbox[0] - 1.5 * nodeSpacing
          const endX = bbox[2] + 1.5 * nodeSpacing
          ctx.moveTo(startX, bottomY)
          ctx.lineTo(endX, bottomY)
          ctx.stroke()
          // Add phases to the bottom
          labels.forEach((label, idx, labels) => {
            const x = (-1.5 + idx) * levelSeparation
            ctx.beginPath()
            ctx.font = '16px Helvetica'
            ctx.fillText(label.label, x, bottomY)
            ctx.strokeStyle = '#bdbdbd'
          })
        })

      // Add vertical separator for phases
      labels.forEach((label, idx, labels) => {
        if (idx < labels.length - 1) {
          ctx.fillStyle = label.color
          ctx.beginPath()
          const x = (-0.5 + idx) * levelSeparation
          ctx.moveTo(x, bbox[1])
          const height = bbox[1] + bbox[3]
          ctx.lineTo(x, height)
          ctx.strokeStyle = '#bdbdbd'
          ctx.stroke()
        }
        // Add phases labels
        ctx.beginPath()
        ctx.font = '24px Helvetica'
        ctx.fillStyle = 'black'
        let labelWidth = ctx.measureText(label.label).width
        ctx.fillText(label.label, (idx - 1) * levelSeparation - labelWidth / 2, topY + nodeSpacing / 2)
      })
    }
  },
  mounted () {
    this.$options.nodes = new DataSet(this.$options.dataset.nodes.map(node => { return { ...node, label: node.title, shape: 'box' } }))
    this.$options.edges = new DataSet(this.$options.dataset.edges.map(edge => { return { ...edge } }))
    this.$lx.init()
      .then(setup => {
        this.$lx.ready({})
      })
    this.$options.network = new Network(this.$refs.chart, {nodes: this.$options.nodes, edges: this.$options.edges}, this.options)
    /*
    this.network.on('selectNode', params => {
      if (params.nodes.length === 1) {
        if (this.network.isCluster(params.nodes[0]) === true) {
          this.network.openCluster(params.nodes[0])
        } else {
          this.clusterChildren(params.nodes[0])
        }
      }
    })
    */

    this.$options.network.on('hoverNode', params => {
      if (this.timeout) clearTimeout(this.timeout)
      delete this.timeout
      const nodeID = params.node
      this.hoveredNode = this.$options.network.body.data.nodes.get(nodeID) || nodeID
    })

    this.$options.network.on('blurNode', params => {
      this.timeout = setTimeout(() => {
        this.hoveredNode = undefined
      }, 1000)
    })

    this.$options.network.on('beforeDrawing', this.drawOverlay)

    /*
    this.$options.network.on('zoom', ({ direction, scale, pointer }) => {
      if (scale <= this.zoomLimit) this.$options.network.moveTo({ direction, pointer, scale: this.zoomLimit })
      this.drawOverlay(this.$options.network.canvas.getContext('2d'))
    })
    */
  }
}
</script>

<style lang="stylus">
  @import './stylus/main'

  #app
    display flex
    flex-flow column
    justify-content center
    align-items center

  .logo
    position fixed
    top 2em
    right 6em
    width 200px
    border-radius 60px
    z-index 9999
    background white

  .chart-container
    width calc(100% - 8em)
    height calc(100vh - 20px)
    border 1px solid #bdbdbd
    position relative
  .actions-container
    position absolute
    top 0
    left 0
    padding 1em
  .hover-container
    position absolute
    top 0
    left 50%
    transform translateX(-50%)
    padding 2em
</style>
