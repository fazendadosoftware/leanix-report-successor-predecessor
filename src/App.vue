<template>
  <div id="app">
    <div id="drawing"/>
    <img class="logo" src="./assets/logo.svg">
    <div class="actions-container">
      <button @click="expandAll">Expand All</button>
      <button @click="clusterByBusinessCapabilities">Cluster By Business Capability</button>
    </div>
    <div class="hover-container" v-if="hoveredNode">
      Further information for {{hoveredNode.title || hoveredNode}} shown here...
    </div>
    <div class="chart-container" ref="chart"/>
  </div>
</template>

<script>
import { DataSet, Network } from 'vis'
import SVG from 'svg.js'
import 'vis/dist/vis-network.min.css'
const chance = require('chance').Chance()

const dataset = require('../test/dataset.json')

const getNodeShape = node => { /* eslint-disable */
  const { title } = node
  const grey800 = '#9e9e9e'

  const canvasDims = [320, 140]
  const borderWidth = 3
  const padding = 20
  const containerDims = canvasDims.map(dim => dim - 2 * borderWidth)

  const canvas = SVG('drawing').size(...canvasDims)
  const defs = canvas.defs()

  const container = canvas.rect(...containerDims)
    .move(borderWidth, borderWidth)
    .stroke({ width: borderWidth, color: '#424242' })
    .radius(10)
    .attr({ fill: 'white' })

  const text = canvas.text(title || '')
    .font({ family: 'Helvetica', size: 35, anchor: 'start' })
    .x(padding)
    .attr({ 'letter-spacing': '2px' })

  const tags = Array.from(Array(4).keys())
    .map(n => {
      return canvas
        // .circle(40)
        .rect(40, 30)
        .radius(5)
        .y(80)
        .x(50 * n + padding)
        .fill(chance.color({format: 'hex'}))
    })

  const element = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(canvas.svg())}`
  canvas.remove()
  return element

  /*
  const shape = svg.newInstance().width(300).height(110)
    .rect({ id: 'outerbox', x: 10, y: 10, rx: 10, ry: 10, width: 280, height: 90, fill: 'white', stroke: grey800, 'stroke-width': 3, opacity: 1, background: 'red' })
    .text({ x: 25, y: 45, 'font-family': `Helvetica`, 'font-size': 35 }, label)
    .rect({ x: 25, y: 70, rx: 5, ry: 5, width: 20, height: 15, fill: 'RED', stroke: 'black' })
    .render()
  // console.log('SAPE', shape)
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(shape)}`
  */
}

// https://jsbin.com/jotafawipu/edit?html,output
export default {
  name: 'App',
  data () {
    return {
      hoveredNode: undefined
    }
  },
  computed: {
    options () {
      return {
        interaction: {
          navigationButtons: true,
          hover: true
        },
        layout: {
          hierarchical: {
            enabled: true,
            direction: 'LR',
            sortMethod: 'directed',
            levelSeparation: 250
          }
        },
        edges: {
          color: {
            color: '#424242',
            hover: '#212121',
            highlight: '#212121'
          },
          arrows: {
            to: {
              enabled: true,
              scaleFactor: 0.7
            }
          },
          arrowStrikethrough: false,
          shadow: {
            enabled: true,
            color: '#424242',
            x: 3,
            y: 3,
            size: 15
          },
          smooth: {
            enabled: true,
            type: 'dynamic',
            roundness: 0.5
          }
        }
      }
    }
  },
  methods: {
    clusterByBusinessCapabilities () {
      const businessCapabilities = dataset.nodes.reduce((accumulator, node) => Array.from(new Set([...accumulator, node.businessCapability])))
      businessCapabilities.forEach(businessCapability => {
        const clusterOptions = {
          joinCondition: childOptions => childOptions.businessCapability === businessCapability,
          processProperties: (clusterOptions, childNodes, childEdges) => {
            clusterOptions.businessCapability = businessCapability
            return clusterOptions
          },
          clusterNodeProperties: { id: `cluster:${businessCapability}`, borderWidth: 3, shape: 'box', label: businessCapability, color: 'red', font: { size: 24, color: 'white' } }
        }
        this.network.cluster(clusterOptions)
      })
    },
    clusterChildren (parentNodeID) {
      const parentNodeProperties = this.network.body.data.nodes.get(parentNodeID)

      const getChildrenIDs = parentNodeID => this.network.getConnectedNodes(parentNodeID, 'to')
        .reduce((accumulator, childID) => Array.from(new Set([...accumulator, childID, ...getChildrenIDs(childID)])), [])

      const childrenIDs = getChildrenIDs(parentNodeID)

      const clusterOptions = {
        joinCondition: nodeOptions => nodeOptions.id === parentNodeID || childrenIDs.includes(nodeOptions.id),
        processProperties: (clusterOptions, childNodes, childEdges) => {
          clusterOptions.label = `${parentNodeProperties.label}`
          clusterOptions.businessCapability = parentNodeProperties.businessCapability
          return clusterOptions
        },
        clusterNodeProperties: { color: 'red', shape: 'box', font: { size: 24, color: 'white' } }
      }
      this.network.cluster(clusterOptions)
    },
    expandAll () {
      this.network.clustering.body.nodeIndices.forEach(id => this.network.isCluster(id) ? this.network.openCluster(id) : undefined)
    }
  },
  mounted () {
    this.$lx.init()
      .then(setup => {
        this.$lx.ready({})
      })
    const nodes = new DataSet(dataset.nodes.map(node => { return { ...node, shape: 'image', image: getNodeShape(node) } }))
    const edges = new DataSet(dataset.edges.map(edge => { return { ...edge } }))
    this.network = new Network(this.$refs.chart, {nodes, edges}, this.options)
    this.network.on('selectNode', params => {
      if (params.nodes.length === 1) {
        if (this.network.isCluster(params.nodes[0]) === true) {
          this.network.openCluster(params.nodes[0])
        } else {
          this.clusterChildren(params.nodes[0])
        }
      }
    })
    this.network.on('hoverNode', params => {
      if (this.timeout) clearTimeout(this.timeout)
      delete this.timeout
      const nodeID = params.node
      this.hoveredNode = this.network.body.data.nodes.get(nodeID) || nodeID
    })
    this.network.on('blurNode', params => {
      this.timeout = setTimeout(() => {
        this.hoveredNode = undefined
      }, 1000)
    })
    this.network.on('beforeDrawing', ctx => {
      console.log(ctx, this.network)
      // console.log('drawn', ctx)
      ctx.strokeText('Hello World', 0, 0)
    })
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
    width 250px
    margin 2rem
    align-self flex-end
    position relative
  .chart-container
    width calc(100% - 8em)
    height calc(100vh - 160px)
    border 1px solid #bdbdbd
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
