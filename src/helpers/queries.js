export default class Queries {
  constructor (_lx) {
    this.lx = _lx || lx
    if (!this.lx) throw Error('LX object not found!')
    this.opportunityCostTagGroup = undefined
  }

  async fetchOpportunityCostTagGroup () {
    const query = `{op:allTagGroups{edges{node{id name restrictToFactSheetTypes tags {edges {node {id name}}}}}}}`
    return this.lx.executeGraphQL(query).then(res => {
      const tagGroups = res.op.edges
        .map(edge => edge.node)
        .filter(
          node =>
            !node.restrictToFactSheetTypes.length ||
            node.restrictToFactSheetTypes.indexOf('BusinessCapability') > -1
        )
      const options = {
        shouldSort: true,
        threshold: 0.2,
        keys: ['name']
      }
      const fuse = new Fuse(tagGroups, options)
      const results = fuse.search('opportunity cost')
      if (!results.length) { throw Error(`could not find tagGroup "opportunity costs"`) }
      const opportunityCostsTagGroup = results[0]
      opportunityCostsTagGroup.tags = opportunityCostsTagGroup.tags.edges.map(
        edge => edge.node
      )
      this.opportunityCostTagGroup = opportunityCostsTagGroup
      return opportunityCostsTagGroup
    })
  }

  async fetchBusinessCapabilities ({filter = {}, xKPIBuckets = 4} = {}) {
    // Tag names used to quantity opportunity cost - yKPI
    const tagNames = ['low', 'medium', 'high', 'very high']
    const sortByOpportunityCostTagName = (a, b) => {
      return tagNames.indexOf(b) - tagNames.indexOf(a)
    }

    if (!this.opportunityCostTagGroup) await this.fetchOpportunityCostTagGroup()
    const projectFragment = `{id name lifecycle{asString phases{phase startDate}} budgetOpEx budgetCapEx tags{id name tagGroup{id}}}`
    const projectsFragment = `projects:relBusinessCapabilityToProject{edges{node{factSheet{...on Project${projectFragment}}}}}`
    const businessCapabilityFragment = `...on BusinessCapability{id name ${projectsFragment}}`
    const query = `query($filter:FilterInput){op:allFactSheets(filter:$filter){edges{node{${businessCapabilityFragment}}}}}`
    return this.lx.executeGraphQL(query, {filter})
      .then(res => {
        const businessCapabilities = res.op.edges
          .map(edge => {
            const projects = edge.node.projects.edges
              .map(edge => edge.node.factSheet)
              .filter(project => {
                const isInPlanningPhase = project.lifecycle.asString === 'plan'
                const hasTagOpportunityCost = project.tags.filter(tag => tag.tagGroup.id === this.opportunityCostTagGroup.id).length
                return isInPlanningPhase && hasTagOpportunityCost
              })
            return {...edge.node, projects}
          })
          .filter(businessCapability => businessCapability.projects.length)
          .map(businessCapability => {
            // Compute the opportunity cost for a business capability, given the related projects
            businessCapability.opportunityCost = businessCapability.projects
              .map(project => project.tags
                .filter(tag => tag.tagGroup.id === this.opportunityCostTagGroup.id)
                .map(tag => tag.name)
                .sort(sortByOpportunityCostTagName)
                .shift()
              )
              .sort(sortByOpportunityCostTagName)
              .shift()
            // Compute the total cost for a business capability
            const xKPI = businessCapability.projects
              .reduce((accumulator, project) => {
                const {budgetCapEx, budgetOpEx} = project
                const deltaDays = project.lifecycle.phases
                  .filter(phase => phase.phase === 'plan')
                  .reduce((accumulator, phase) => {
                    const startDate = new Date(phase.startDate)
                    const today = new Date()
                    const timeDiff = Math.abs(today.getTime() - startDate.getTime())
                    const diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24))
                    accumulator += diffDays
                    return accumulator
                  }, 0)
                accumulator += (budgetCapEx + budgetOpEx) / deltaDays
                return accumulator
              }, 0)
            const sumBudgets = businessCapability.projects
              .reduce((accumulator, project) => {
                const {budgetCapEx, budgetOpEx} = project
                accumulator += (budgetCapEx + budgetOpEx)
                return accumulator
              }, 0)
            return {...businessCapability, xKPI, sumBudgets}
          })
        const maxXKPI = Math.max(...businessCapabilities.map(businessCapability => businessCapability.xKPI))
        businessCapabilities
          .map(businessCapability => {
            // Normalize xKPI
            businessCapability.xKPIValue = businessCapability.xKPI
            businessCapability.xKPI = Math.round((businessCapability.xKPI / maxXKPI) * (xKPIBuckets - 1))
            businessCapability.yKPI = tagNames.indexOf(businessCapability.opportunityCost)
            return businessCapability
          })
        businessCapabilities.maxXKPI = maxXKPI
        businessCapabilities.xKPIBuckets = xKPIBuckets
        businessCapabilities.yKPIBuckets = tagNames.length
        businessCapabilities.yKPIBucketNames = tagNames
        return businessCapabilities
      })
  }

  async fetchProjectsIndex () {
    const projectFragment = `...on Project{id externalId{externalId} name lifecycle{asString phases{phase startDate}} budgetOpEx budgetCapEx tags{id name tagGroup{id}}}`
    const query = `{op:allFactSheets(factSheetType:Project){edges{node{${projectFragment}}}}}`
    return this.lx.executeGraphQL(query)
      .then(res => {
        return res.op.edges
          .map(edge => { const node = edge.node; node.externalId = node.externalId ? node.externalId.externalId : undefined; return node })
          .reduce((accumulator, node) => {
            accumulator[node.externalId] = node
            return accumulator
          }, {})
      })
  }
}
