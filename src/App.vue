<template>
  <div id="app">
    <div id="drawing" ref="drawing"/>
    <!--
    <div class="actions-container">
      <button @click="expandAll">Expand All</button>
      <button @click="clusterByBusinessCapabilities">Cluster By Business Capability</button>
    </div>
    -->
    <div class="hover-container" v-if="hoveredNode">
      Further information for {{hoveredNode.title || hoveredNode}} shown here...
    </div>
    <div class="chart-container" ref="chart"/>
  </div>
</template>

<script>
import { DataSet, Network } from 'vis'
import SVG from 'svg.js'
import NetworkLegend from './components/NetworkLegend'
import 'vis/dist/vis-network.min.css'

const dataset = require('../test/dataset.json')

const getNodeShape = (node, businessCapabilities) => { /* eslint-disable */
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

  const tags = businessCapabilities
    .filter(() => Math.random() > 0.5)
    .map((businessCapability, i) => {
      return canvas
        // .circle(40)
        .rect(40, 30)
        .radius(5)
        .y(80)
        .x(50 * i + padding)
        .fill(businessCapability.bgColor)
    })

  const element = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(canvas.svg())}`
  canvas.remove()
  return element
}

const options = {
  interaction: { navigationButtons: true, hover: true },
  layout: {
    hierarchical: { enabled: true, direction: 'LR', sortMethod: 'directed', levelSeparation: 250 }
  },
  edges: {
    color: { color: '#424242', hover: '#212121', highlight: '#212121' },
    arrows: {
      to: { enabled: true, scaleFactor: 0.7 }
    },
    arrowStrikethrough: false,
    shadow: { enabled: true, color: '#424242', x: 3, y: 3, size: 15 },
    smooth: { enabled: true, type: 'dynamic', roundness: 0.5 }
  }
}

export default {
  name: 'App',
  components: { NetworkLegend },
  dataset: require('../test/dataset.json'),
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
      ]
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
    const instance = new NetworkLegend({
      propsData: { businessCapabilities: this.businessCapabilities }
    })
    instance.$mount()

    this.$options.nodes = new DataSet(this.$options.dataset.nodes.map(node => { return { ...node, shape: 'image', image: getNodeShape(node, this.businessCapabilities) } })),
    this.$options.edges = new DataSet(this.$options.dataset.edges.map(edge => { return { ...edge } })),
    this.$lx.init()
      .then(setup => {
        this.$lx.ready({})
      })
    this.$options.network = new Network(this.$refs.chart, {nodes: this.$options.nodes, edges: this.$options.edges}, options)
    this.$refs.chart.appendChild(instance.$el)
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
    /*
    this.$options.network.on('beforeDrawing', ctx => {
      // console.log(ctx, this.$options.network)
      ctx.strokeText('Hello World', 0, 0)
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
