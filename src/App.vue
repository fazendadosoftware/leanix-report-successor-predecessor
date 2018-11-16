<template>
  <div id="app">
    <div class="logo">
      <img src="../static/DEL_PRI_PMS368_weiss_neu.svg">
    </div>
    <div class="actions-container">
      <transition-group name="fade" class="btn-group">
        <div class="btn btn-default" :key="'reload'" @click="refreshNetwork(true)">
          <font-awesome-icon icon="sync-alt" :spin="loading"/>
          Reload
        </div>
      </transition-group>
    </div>
    <div class="hover-container" v-if="hoveredNode">
      Further information for {{hoveredNode.title || hoveredNode}} shown here...
    </div>
    <div class="chart-container" ref="chart"/>
  </div>
</template>

<script>
import { getReportConfiguration } from './helpers/leanixReporting'
import Fuse from 'fuse.js'
import { Network } from 'vis'
import 'vis/dist/vis-network.min.css'

export default {
  name: 'App',
  // non-tracked variable, available at this.$options.nodes
  nodes: undefined,
  // non-tracked variable, available at this.$options.edges
  edges: undefined,
  network: undefined,
  data () {
    return {
      filter: {},
      bbox: [0, 0, 0, 0], // network bbox [originX, originY, width, height]
      tagGroup: undefined,
      loading: false,
      hoveredNode: undefined,
      zoomLimit: 1,
      options: {
        interaction: {
          dragNodes: false,
          navigationButtons: true,
          hover: false,
          selectable: false
        },
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
        physics: {
          enabled: true,
          hierarchicalRepulsion: {
            nodeDistance: 100,
            centralGravity: 0.1
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
        }
      }
    }
  },
  computed: {
    tags () {
      return this.tagGroup && this.tagGroup.tags ? this.tagGroup.tags : []
    }
  },
  methods: {
    async refreshNetwork (spin) {
      spin ? this.loading = true : this.$lx.showSpinner()
      const { nodes, edges, groups, tagGroup, businessCapabilities } = await this.loadDatasetFromWorkspace()
      spin ? this.loading = false : this.$lx.hideSpinner()

      this.businessCapabilities = businessCapabilities

      if (this.$options.network) this.$options.network.destroy()
      delete this.$options.network

      this.tagGroup = tagGroup
      this.options.groups = groups
      this.$options.nodes = nodes
      this.$options.edges = edges

      this.$options.network = new Network(this.$refs.chart, {nodes: this.$options.nodes, edges: this.$options.edges}, this.options)

      /*
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
      */

      this.$options.network.on('beforeDrawing', this.drawOverlay)
    },
    drawOverlay (ctx) {
      const legendColor = '#616161' // grey-700
      const gridColor = '#e0e0e0' // grey-200
      const labels = this.tags.map(tag => tag.name) // Tag labels to be rendered inside each box...

      const { levelSeparation, nodeSpacing } = this.options.layout.hierarchical

      const nodes = this.$options.nodes
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
      // bbox = [originX - levelSeparation / 2, originY - nodeSpacing, width + levelSeparation, height + nodeSpacing * 2] // Add padding to the outer container
      bbox = [originX - levelSeparation / 2, originY - nodeSpacing / 2, width + levelSeparation, height + nodeSpacing]

      // Add vertical separator for phases
      let _width
      let endX
      labels.forEach((label, idx, labels) => {
        ctx.fillStyle = legendColor
        const x = (-1.5 + idx) * levelSeparation
        ctx.moveTo(x, bbox[1])
        const height = bbox[1] + bbox[3]
        ctx.lineTo(x, height)
        ctx.strokeStyle = gridColor
        ctx.stroke()
        if (idx === 0) _width = x
        else if (idx === labels.length - 1) {
          _width = x - _width + levelSeparation
          endX = x
        }
      })

      bbox[2] = _width

      this.bbox = bbox

      // Draw the outer container
      ctx.strokeStyle = gridColor
      ctx.strokeRect(...bbox)

      Object.entries(bboxes)
        .forEach(([BC, bbox], idx) => {
          // Draw legend for business capability
          ctx.font = '22px Helvetica'
          ctx.fillStyle = legendColor

          const label = this.businessCapabilities.hasOwnProperty(BC) ? this.businessCapabilities[BC].name : BC

          let x = bbox[0] - levelSeparation / 2 - ctx.measureText(label).width - 20
          let y = (bbox[1] + bbox[3]) / 2 // Center position for BC Row

          ctx.fillText(label, x, y)

          // Add horizontal separators between business capabilities
          ctx.strokeStyle = gridColor
          const bottomY = bbox[3] + nodeSpacing / 2
          const startX = bbox[0] - levelSeparation / 2
          // const endX = bbox[2] + levelSeparation / 2
          ctx.moveTo(startX, bottomY)
          ctx.lineTo(endX, bottomY)
          ctx.stroke()

          // Add phases to the bottom
          labels.forEach((label, idx, labels) => {
            const paddingX = 10
            const paddingY = 10
            ctx.font = 'bold 12px Helvetica'
            const x = (idx - 1.5) * levelSeparation - ctx.measureText(label).width - paddingX
            const y = bottomY - paddingY
            ctx.fillText(label, x, y)
          })
        })
    },
    async loadDatasetFromWorkspace () {
      const tagGroupSeachTerm = 'transition phase'

      const fetchTagGroupQuery = `
        fragment Tag on Tag {id name color status}

        fragment TagGroup on TagGroup {
          id name shortName description mode mandatory restrictToFactSheetTypes
          tags{asList{...Tag}}
        }

        {op:allTagGroups{edges{node{...TagGroup}}}}
      `

      const sortByName = (a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0

      const tagGroup = await this.$lx.executeGraphQL(fetchTagGroupQuery)
        .then(res => {
          const tagGroups = res.op.edges
            .map(edge => edge.node)
            .filter(node => !node.restrictToFactSheetTypes.length || node.restrictToFactSheetTypes.indexOf('Application') > -1)

          const fuse = new Fuse(tagGroups, { shouldSort: true, threshold: 0.2, keys: ['name'] })
          const results = fuse.search(tagGroupSeachTerm)
          // if (!results.length) { throw Error(`could not find tagGroup "${tagGroupSeachTerm}"`) }
          if (!results.length) return
          const tagGroup = results[0]
          tagGroup.tags = tagGroup.tags.asList.sort(sortByName) // sort tags by name
          return tagGroup
        })

      const tagHierarchy = tagGroup.tags.map(tag => tag.id)
      const fetchApplicationsQuery = `
        query($filter:FilterInput){op:allFactSheets(filter:$filter)
          {
            edges{
              node{
                id name tags {id name color}
                ...on Application{
                  successors:relToSuccessor{edges{node{factSheet{id}}}}
                  businessCapabilities:relApplicationToBusinessCapability{edges{node{factSheet{id name}}}}
                }
            }
          }
        }
      }`
      const applications = await this.$lx.executeGraphQL(fetchApplicationsQuery, { filter: this.filter })
        .then(res => res.op.edges.map(edge => edge.node).reduce((accumulator, application) => { return { ...accumulator, [application.id]: application } }, {}))

      const allowedBusinessCapabilities = this.filter.facetFilters
        .filter(facet => facet.facetKey === 'relApplicationToBusinessCapability')
        .reduce((accumulator, facet) => Array.from(new Set([...accumulator, ...facet.keys])), [])

      const allowedTags = this.filter.facetFilters
        .filter(facet => facet.facetKey === tagGroup.name)
        .reduce((accumulator, facet) => Array.from(new Set([...accumulator, ...facet.keys])), [])

      const businessCapabilities = Object.values(applications)
        .reduce((accumulator, application) => {
          application.businessCapabilities.edges
            .map(edge => edge.node.factSheet)
            .forEach(bc => {
              if (!accumulator.hasOwnProperty(bc.id)) accumulator[bc.id] = { name: bc.name }
            })
          return accumulator
        }, {})

      const nodes = Object.values(applications)
        .reduce((accumulator, application) => {
          const businessCapabilities = application.businessCapabilities.edges
            .map(edge => edge.node.factSheet.id)
            .filter(bcId => allowedBusinessCapabilities.length ? allowedBusinessCapabilities.indexOf(bcId) > -1 : true)

          const successors = application.successors.edges.map(edge => edge.node.factSheet.id)

          const tags = (application.tags || [])
            .filter(tag => allowedTags.length ? allowedTags.indexOf(tag.id) > -1 : true)

          const levels = tags.map(tag => tagHierarchy.indexOf(tag.id))
          const nodes = businessCapabilities
            .map(bc => levels.map(level => {
              delete application.businessCapabilities
              delete application.tags
              return {
                ...application,
                group: bc,
                level,
                successors,
                label: application.name,
                id: `${bc}:${application.id}:${level}`,
                factSheetId: application.id
              }
            }))
            .reduce((accumulator, node) => Array.from([...accumulator, ...node]))

          return Array.from([...accumulator, ...nodes])
        }, [])

      const nodeIDs = nodes.map(node => node.id)

      const edges = nodes
        .reduce((accumulator, node, idx, nodes) => {
          const successorTags = nodes
            .filter(_node => _node.group === node.group && _node.factSheetId === node.factSheetId && _node.level === node.level + 1)
            .map(_node => { return { from: node.id, to: _node.id, arrow: 'to' } })
          const successorRelations = node.successors
            .filter(successorFactSheetId => nodeIDs.indexOf(`${node.group}:${successorFactSheetId}:${node.level + 1}`))
            .map(successorFactSheetId => { return { from: node.id, to: `${node.group}:${successorFactSheetId}:${node.level + 1}` } })

          return Array.from([...accumulator, ...successorTags, ...successorRelations])
        }, [])

      const groupOptions = [
        { background: '#f44336', color: '#ffffff' },
        { background: '#e91e63', color: '#ffffff' },
        { background: '#9c27b0', color: '#ffffff' },
        { background: '#673ab7', color: '#ffffff' }
      ]

      const groups = nodes
        .reduce((accumulator, node) => Array.from([...new Set([...accumulator, node.group])]), [])
        .reduce((accumulator, group, idx) => {
          const _group = groupOptions[idx % groupOptions.length]

          accumulator[group] = {
            shape: 'box',
            borderWidth: 1,
            borderWidthSelected: 1,
            color: {
              border: 'black',
              background: _group.background,
              // highlight: { border: 'black', background: 'green' },
              hover: { border: 'black', background: '#78909c' }
            },
            font: { face: 'Helvetica', color: _group.color, size: 13 },
            shapeProperties: { borderRadius: 4 },
            widthConstraint: { minimum: 150, maximum: 150 },
            heightConstraint: { minimum: 40 },
            labelHighlightBold: false
          }
          return accumulator
        }, {})
      const dataset = { nodes, edges, groups, tagGroup, businessCapabilities }
      return dataset
    },
    setFilter (filter) {
      this.filter = {
        facetFilters: filter.facets,
        fullTextSearch: filter.fullTextSearchTerm,
        ids: filter.directHits.map(hit => hit.id)
      }
      this.refreshNetwork()
    }
  },
  async mounted () {
    this.$lx.init()
      .then(setup => {
        const config = getReportConfiguration({setup, facetFiltersChangedCallback: this.setFilter})
        this.$lx.ready(config)
      })
    // this.$options.network = new Network(this.$refs.chart, {nodes: this.$options.nodes, edges: this.$options.edges}, this.options)
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
  @import './stylus/material-color'

  #app
    display flex
    flex-flow column
    justify-content center
    align-items center

  .logo
    position fixed
    top 2em
    right 70px
    width 300px
    border-radius 10px
    z-index 9999
    background white
    padding 0.5em
    & > img
      width 300px
    @media screen and (max-width: 800px)
      right 60px
      width 150px
      & > img
        width 150px

  .actions-container
    position absolute
    top 0
    left 0
    noselect

  .chart-container
    width calc(100% - 8em)
    height calc(100vh - 20px)
    border 1px solid #bdbdbd
    position relative

  .actions-container
    position absolute
    top 0
    left 0
    padding-top 1.5em
    padding-left 5.5em
    z-index 9999

  .hover-container
    position absolute
    top 0
    left 50%
    transform translateX(-50%)
    padding 2em

  .btn
    display: inline-block
    margin-bottom: 0
    font-weight: 400
    text-align: center
    vertical-align: middle
    -ms-touch-action: manipulation
    touch-action: manipulation
    cursor: pointer
    background-image: none
    border: 1px solid transparent
    white-space: nowrap
    font-size: 12px
    line-height: 1.428571429
    border-radius: 3px
    padding 1px 5px
    &[disabled]
      transition opacity 0.6 ease
      opacity 0.3
      cursor default
    transition background 0.2s
    /*
    &:hover
      background clr-grey-100
    &:active
      background clr-grey-300
    */

  .btn-default
    color: #333
    background-color: #fff
    border-color: #ccc

  .fade-enter-active, .fade-leave-active
    transition opacity .5s
  .fade-enter, .fade-leave-to /* .fade-leave-active below version 2.1.8 */
    opacity 0

  .btn-group
    > .btn
      margin-right 5px
</style>
