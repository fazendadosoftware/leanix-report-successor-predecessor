<template>
  <div id="app">
    <img class="logo" src="./assets/logo.svg">
    <div class="actions-container">
      <button @click="expandAll">Expand All</button>
      <button @click="clusterByBusinessCapabilities">Cluster By Business Capability</button>
    </div>
    <div class="hover-container" v-if="hoveredNode">
      Further information for {{hoveredNode.label || hoveredNode}} shown here...
    </div>
    <div class="chart-container" ref="chart"/>
  </div>
</template>

<script>
import { DataSet, Network } from 'vis'
import 'vis/dist/vis-network.min.css'
const dataset = require('../test/dataset.json')

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
    const nodes = new DataSet(dataset.nodes.map(node => { return { ...node, shape: 'box', font: { size: 24 } } }))
    const edges = new DataSet(dataset.edges.map(edge => { return { ...edge, arrows: 'to' } }))
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
  }
}
</script>

<style lang="stylus" scoped>
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
