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
        interaction: { navigationButtons: true, hover: true },
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
      // const { levelSeparation, treeSpacing } = this.$options
      const { levelSeparation, nodeSpacing, treeSpacing } = this.options.layout.hierarchical
      console.log('spe', levelSeparation, treeSpacing)

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

      console.log('bboxes', bboxes)

      // DRAW THE GRID
      let bbox = bboxes._all
        .map((coord, idx, coords) => idx > 1 ? coord - coords[idx - 2] : coord) // convert minX, minY, maxX, maxY into originX, originY, width, height
      const [originX, originY, width, height] = bbox
      bbox = [originX - nodeSpacing, originY - nodeSpacing / 2, width + nodeSpacing * 2, height + nodeSpacing]
      console.log('bbox', bbox)
      ctx.beginPath()
      ctx.strokeStyle = 'rgb(200,0,0)'
      ctx.strokeRect(...bbox)

      let topY
      Object.entries(bboxes)
        .forEach(([BC, bbox], idx) => {
          let x = bbox[0] - levelSeparation
          let y = (bbox[1] + bbox[3]) / 2

          ctx.beginPath()
          ctx.font = '28px Helvetica'
          ctx.fillStyle = 'black'
          ctx.fillText(BC, x, y)
          ctx.beginPath()
          ctx.strokeStyle = '#bdbdbd'

          y = bbox[1] - treeSpacing / 2
          if (idx === 0) topY = y
          ctx.moveTo(-ctx.canvas.clientWidth / 2 + levelSeparation, y)
          ctx.lineTo(ctx.canvas.clientWidth / 2 + levelSeparation, y)
          ctx.stroke()
        })
      /*
      ctx.beginPath()
      ctx.moveTo(-ctx.canvas.clientWidth / 2 + levelSeparation, y)
      ctx.lineTo(ctx.canvas.clientWidth / 2 + levelSeparation, y)
      ctx.stroke()
      */
      // const viewport = this.$options.network.getViewPosition()
      // const scale = this.$options.network.getScale()

      // const offsetTop = -ctx.canvas.clientHeight / 2
      // const labelPaddingTop = 50
      // const labelOffsetTop = labelPaddingTop + viewport.y
      // const labelTop = (offsetTop + labelOffsetTop) * scale

      const labels = [
        { label: 'Baseline', color: 'red' },
        { label: 'Transition', color: 'green' },
        { label: 'Target', color: 'blue' },
        { label: 'Level 4', color: 'black' },
        { label: 'Level 5', color: 'grey' }
      ]

      labels.forEach((label, idx, labels) => {
        ctx.fillStyle = label.color
        if (idx < labels.length) {
          ctx.beginPath()
          const x = (-1.5 + idx) * levelSeparation
          ctx.moveTo(x, topY)

          ctx.lineTo(x, ctx.canvas.height)
          ctx.strokeStyle = '#bdbdbd'
          ctx.stroke()
        }

        ctx.beginPath()
        const x = (-1.5 + labels.length) * levelSeparation
        ctx.moveTo(x, topY)

        ctx.lineTo(x, ctx.canvas.height)
        ctx.strokeStyle = '#bdbdbd'
        ctx.stroke()

        // ctx.fill()
        ctx.beginPath()
        ctx.font = '32px Helvetica'
        ctx.fillStyle = 'black'
        let labelWidth = ctx.measureText(label.label).width
        ctx.fillText(label.label, (idx - 1) * levelSeparation - labelWidth / 2, topY - nodeSpacing / 2)
        // ctx.fillText(label.label, (idx - 1) * levelSeparation - labelWidth / 2, -ctx.canvas.height / 2) // Fixed Top
        // ctx.fillText(label.label, (idx - 1) * levelSeparation - labelWidth / 2, labelTop) // Moving top
        // ctx.addHitRegion({id: label.label})
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

    this.$options.network.on('afterDrawing', this.drawOverlay)

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
  @import './stylus/material-shadows'

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
    padding 0.5em
    z-index 9999
    background white
    z-depth-4dp()

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
