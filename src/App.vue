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
    <div class="tag-group-name">{{tagGroupName}}</div>
    <div v-if="warningMsg" class="warning-container">
      <span class="header">
        <font-awesome-icon icon="exclamation-triangle"/>
        Warning
      </span>
      <span>{{warningMsg}}</span>
    </div>
  </div>
</template>

<script>
import Color from 'color'
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
      warningMsg: '',
      tagGroupName: 'transition phase',
      filter: {},
      bbox: [0, 0, 0, 0], // network bbox [originX, originY, width, height]
      tagGroup: undefined,
      loading: false,
      hoveredNode: undefined,
      zoomLimit: 1,
      options: {
        interaction: {
          dragNodes: true,
          navigationButtons: true,
          hover: false,
          selectable: true
        },
        layout: {
          hierarchical: {
            enabled: true,
            direction: 'LR',
            sortMethod: 'directed',
            levelSeparation: 350,
            nodeSpacing: 100,
            treeSpacing: 400
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
          font: { face: 'Helvetica, sans-serif', color: 'black', size: 13 },
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
      if (!this.filter.facetFilters) {
        this.filter = { facetFilters: [{ facetKey: 'FactSheetTypes', keys: [ 'Application' ] }] }
      }

      spin ? this.loading = true : this.$lx.showSpinner()
      try {
        const { nodes, edges, groups, tagGroup, businessCapabilities } = await this.loadDatasetFromWorkspace()
        this.warningMsg = ''
        this.businessCapabilities = businessCapabilities

        if (this.$options.network) this.$options.network.destroy()
        delete this.$options.network

        this.tagGroup = tagGroup
        this.options.groups = groups
        this.$options.nodes = nodes
        this.$options.edges = edges

        this.$options.network = new Network(this.$refs.chart, {nodes: this.$options.nodes, edges: this.$options.edges}, this.options)
        this.$options.network.on('beforeDrawing', this.drawOverlay)
      } catch (err) {
        this.warningMsg = err.toString()
        console.error(err)
      }

      spin ? this.loading = false : this.$lx.hideSpinner()

      // this.clusterAllByBusinessCapability()

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
    },
    drawOverlay (ctx) {
      const legendColor = '#757575' // grey-600
      const gridColor = '#f5f5f5' // grey-100
      const labels = this.tags.map(tag => tag.name) // Tag labels to be rendered inside each box...

      const { levelSeparation, nodeSpacing } = this.options.layout.hierarchical

      const nodes = this.$options.nodes
        .reduce((accumulator, node) => {
          if (!accumulator[node.group]) accumulator[node.group] = []
          accumulator[node.group].push(node.id)
          return accumulator
        }, {})

      const bboxes = Object.entries(nodes)
        // .filter(([bc, ids]) => bc.split(':')[0] !== 'bc')
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
      bbox = [originX + levelSeparation / 2, originY - nodeSpacing / 2, width + levelSeparation, height + nodeSpacing]

      // Add vertical separator for phases
      let _width
      let endX

      labels.forEach((label, idx, labels) => {
        const x = bbox[0] + (idx + 1) * levelSeparation
        if (idx < labels.length - 1) {
          ctx.moveTo(x, bbox[1])
          const height = bbox[1] + bbox[3]
          ctx.lineTo(x, height)
          ctx.strokeStyle = gridColor
          ctx.stroke()
        }
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
      // ctx.lineWidth = 10
      ctx.strokeRect(...bbox)

      Object.entries(bboxes)
        .filter(([bc, bbox]) => bc.split(':')[0] !== 'bc')
        .forEach(([BC, bbox], idx, bboxes) => {
          // Add horizontal separators between business capabilities7
          const bottomY = bbox[3] + nodeSpacing / 2
          const startX = this.bbox[0]
          if (idx < bboxes.length - 1) {
            ctx.strokeStyle = gridColor
            ctx.moveTo(startX, bottomY)
            ctx.lineTo(endX, bottomY)
            ctx.stroke()
          }
          // Add phases to the bottom
          labels.forEach((label, idx, labels) => {
            const paddingX = 10
            const paddingY = 10
            ctx.font = 'bold 12px Helvetica, sans-serif'
            const x = this.bbox[0] + (idx + 1) * levelSeparation - ctx.measureText(label).width - paddingX
            const y = bottomY - paddingY
            ctx.fillStyle = legendColor
            ctx.fillText(label, x, y)
          })
        })
    },
    async loadBusinessCapabilityIndex () {
      const query = `{
        op:allFactSheets(factSheetType:BusinessCapability){
          edges{node{id type name level ...on BusinessCapability{parent:relToParent{edges{node{factSheet{id}}}}}}}
        }
      }`
      let bcIndex = await this.$lx.executeGraphQL(query)
        .then(res => res.op.edges
          .map(edge => edge.node)
          .reduce((accumulator, node) => { return { ...accumulator, [node.id]: node } }, {}))

      const getBCRootParent = (bc, bcIndex) => {
        const parent = typeof bc.parent === 'string' ? bc.parent : bc.parent.edges.map(edge => edge.node.factSheet.id).shift()
        return parent ? getBCRootParent(bcIndex[parent], bcIndex) : bc
      }

      const childIndex = Object.values(bcIndex)
        .filter(bc => bc.level > 1)
        .map(bc => {
          let { parent } = bc
          parent = (parent.edges.map(edge => edge.node.factSheet).shift() || {}).id
          return { ...bc, parent }
        })
        .map(bc => { return { ...bc, parent: getBCRootParent(bc, bcIndex) } })
        .reduce((accumulator, bc) => {
          return { ...accumulator, [bc.id]: bc.parent }
        }, {})

      return { ...bcIndex, ...childIndex }
    },
    async loadDatasetFromWorkspace () {
      const bcIndex = await this.loadBusinessCapabilityIndex()

      const tagGroupSearchTerm = this.tagGroupName || 'transition phase'

      const fetchTagGroupQuery = `
        {op:allTagGroups{edges{node{
          id name shortName description mode mandatory restrictToFactSheetTypes
          tags{asList{id name color status}}
        }}}}
      `

      const sortByName = (a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0

      const tagGroup = await this.$lx.executeGraphQL(fetchTagGroupQuery)
        .then(res => {
          const tagGroups = res.op.edges
            .map(edge => edge.node)
            .filter(node => !node.restrictToFactSheetTypes.length || node.restrictToFactSheetTypes.indexOf('Application') > -1)

          const fuse = new Fuse(tagGroups, { shouldSort: true, threshold: 0.2, keys: ['name'] })
          const results = fuse.search(tagGroupSearchTerm)
          if (!results.length) { throw Error(`could not find tagGroup "${tagGroupSearchTerm}"`) }
          // if (!results.length) return
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
                id type name tags {id name color tagGroup{id}}
                ...on Application{
                  successors:relToSuccessor{edges{node{factSheet{id}}}}
                  businessCapabilities:relApplicationToBusinessCapability{edges{node{factSheet{id type name}}}}
                }
            }
          }
        }
      }`
      const applications = await this.$lx.executeGraphQL(fetchApplicationsQuery, { filter: this.filter })
        .then(res => res.op.edges
          .map(edge => edge.node)
          .filter(application => {
            // filter for applications that contain at least a tag from tagGroup
            const tagGroups = application.tags
              .filter(tag => tag.tagGroup)
              .map(tag => tag.tagGroup.id)
              .reduce((accumulator, tagGroupID) => Array.from([...new Set([...accumulator, tagGroupID])]), [])
            const hasTagFromTagGroup = tagGroups.indexOf(tagGroup.id) > -1

            return hasTagFromTagGroup
          })
          .reduce((accumulator, application) => { return { ...accumulator, [application.id]: application } }, {}))

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
              if (!accumulator.hasOwnProperty(bc.id)) accumulator[bc.id] = bc
            })
          return accumulator
        }, {})

      let nodes = Object.values(applications)
        .reduce((accumulator, application) => {
          const businessCapabilities = application.businessCapabilities.edges
            .map(edge => edge.node.factSheet.id)
            .map(bcId => bcIndex[bcId].id)
            .filter(bcId => allowedBusinessCapabilities.length ? allowedBusinessCapabilities.indexOf(bcId) > -1 : true)

          const successors = application.successors.edges.map(edge => edge.node.factSheet.id)

          const tags = (application.tags || [])
            .filter(tag => allowedTags.length ? allowedTags.indexOf(tag.id) > -1 : true)

          const levels = tags
            .filter(tag => tagHierarchy.indexOf(tag.id) > -1)
            .map(tag => tagHierarchy.indexOf(tag.id) + 1) // leave Level 0 for BC root node

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
            .reduce((accumulator, nodes) => {
              nodes.forEach(node => { accumulator[node.id] = node })
              return accumulator
            }, {})

          return { ...accumulator, ...nodes }
        }, {})

      const bcNodes = Object.values(businessCapabilities)
        .map(bc => bcIndex[bc.id])
        .filter(bc => allowedBusinessCapabilities.length ? allowedBusinessCapabilities.indexOf(bc.id) > -1 : true)
        .reduce((accumulator, bc) => {
          bc = {
            ...bc,
            label: bc.name,
            group: `bc:${bc.id}`,
            level: 0,
            type: 'BusinessCapability'
          }
          return { ...accumulator, [bc.id]: bc }
        }, {})

      nodes = Array.from([...Object.values(nodes), ...Object.values(bcNodes)])

      const nodeIDs = nodes.map(node => node.id)

      const edges = nodes
        .reduce((accumulator, node, idx, nodes) => {
          let rootNodeToApps = []
          if (node.type === 'BusinessCapability') {
            rootNodeToApps = Object.values(nodes
              .filter(_node => _node.group === node.id && _node.id !== node.id)
              .reduce((accumulator, node) => {
                if (!accumulator[node.factSheetId] || accumulator[node.factSheetId].level > node.level) accumulator[node.factSheetId] = node
                return accumulator
              }, {}))
              .map(node => { return { from: node.group, to: node.id, arrow: 'to', dashes: true, color: { opacity: 0.3, dashes: true } } })
          }

          const successorByTag = nodes
            // .filter(_node => _node.group === node.group && _node.factSheetId === node.factSheetId && _node.level === node.level + 1)
            .filter(_node => _node.type !== 'BusinessCapability' && _node.group === node.group && _node.factSheetId === node.factSheetId && _node.level > node.level)
            .sort((a, b) => a.level - b.level) // sort nodes by level - ascending
            .map(_node => { return { from: node.id, to: _node.id, arrow: 'to' } })
            .shift()

          let successorRelations = []
          // if node is the last from tag hierarchy, establish a relation with the successor application
          let isLast = (nodes
            .filter(_node => _node.type !== 'BusinessCapability' && _node.group === node.group && _node.factSheetId === node.factSheetId)
            .sort((a, b) => b.level - a.level)
            .shift() || {}).level === node.level

          if (isLast) {
            successorRelations = (node.successors || [])
              .filter(successorFactSheetId => nodeIDs.indexOf(`${node.group}:${successorFactSheetId}:${node.level + 1}`))
              .map(successorFactSheetId => { return { from: node.id, to: `${node.group}:${successorFactSheetId}:${node.level + 1}` } })
          }

          accumulator = Array.from([...accumulator, ...successorRelations, ...rootNodeToApps])
          if (successorByTag) accumulator.push(successorByTag)
          return accumulator
        }, [])

      const groupOptions = [
        { background: '#f44336', color: '#ffffff' },
        { background: '#e91e63', color: '#ffffff' },
        { background: '#9c27b0', color: '#ffffff' },
        { background: '#673ab7', color: '#ffffff' }
      ]

      const appGroups = nodes
        .filter(node => node.group.split(':')[0] !== 'bc')
        .reduce((accumulator, node) => Array.from([...new Set([...accumulator, node.group])]), [])
        .reduce((accumulator, group, idx) => {
          const _group = groupOptions[idx % groupOptions.length]
          const groupMetadata = businessCapabilities[group]

          accumulator[group] = {
            ...groupMetadata,
            shape: 'box',
            borderWidth: 1,
            borderWidthSelected: 1,
            color: {
              border: 'black',
              background: _group.background,
              highlight: { border: 'black', background: '#78909c' },
              hover: { border: 'black', background: '#78909c' }
            },
            font: { face: 'Helvetica, sans-serif', color: _group.color, size: 13 },
            shapeProperties: { borderRadius: 4 },
            widthConstraint: 150,
            heightConstraint: { minimum: 40 },
            labelHighlightBold: false
          }
          return accumulator
        }, {})

      const bcGroups = nodes
        .filter(node => node.group.split(':')[0] === 'bc')
        .reduce((accumulator, node) => Array.from([...new Set([...accumulator, node.group])]), [])
        .reduce((accumulator, group, idx) => {
          const _group = groupOptions[idx % groupOptions.length]
          const groupMetadata = businessCapabilities[group]

          accumulator[group] = {
            ...groupMetadata,
            shape: 'box',
            borderWidth: 1,
            borderWidthSelected: 1,
            color: {
              border: 'black',
              background: Color(_group.background).alpha(0.9).string(),
              highlight: { border: 'black', background: '#78909c' },
              hover: { border: 'black', background: '#78909c' }
            },
            font: { face: 'Helvetica, sans-serif', color: _group.color, size: 18 },
            shapeProperties: { borderRadius: 4 },
            labelHighlightBold: false,
            widthConstraint: 200,
            heightConstraint: { minimum: 80 }
          }
          return accumulator
        }, {})

      const groups = {...appGroups, ...bcGroups}
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
        this.tagGroupName = setup.config.tagGroupName || 'transition phase'
        const config = getReportConfiguration({setup, facetFiltersChangedCallback: this.setFilter})
        this.$lx.ready(config)
        if (process.env.NODE_ENV === 'development') this.refreshNetwork()
      })
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
    $img-width=200px
    position fixed
    top 2em
    left 70px
    width $img-width
    border-radius 10px
    // z-index 9999
    background white
    padding 0.5em
    & > img
      width $img-width
    @media screen and (max-width: 800px)
      right 60px
      width 150px
      & > img
        width 150px

  .chart-container
    width calc(100% - 8em)
    height calc(100vh - 20px)
    border 1px solid #bdbdbd
    position relative

  .actions-container
    position absolute
    top 0
    right 0
    padding-top 1.5em
    padding-right 5.5em
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

  .tag-group-name
    position fixed
    bottom: 0
    left 50%
    transform translateX(-50%)
    padding 10px
    font-style italic
    font-size 9px

  .warning-container
    position fixed
    top 50%
    left 50%
    transform translate(-50%)
    display flex
    flex-flow column
    align-items center
    color clr-amber-900
    font-size 1.5em
    .header
      font-size 3em
      margin-bottom 1em
</style>
