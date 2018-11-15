const Fuse = require('fuse.js')

module.exports = class Queries {
  constructor (_lx) {
    this.lx = _lx || lx
    if (!this.lx) throw Error('LX object not found!')
    this.tagGroup = undefined
  }

  async fetchTransitionPhaseTagGroup (tagGroup) {
    const tagGroupSeachTerm = tagGroup.name

    const query = `
      fragment Tag on Tag {id name color status}

      fragment TagGroup on TagGroup {
        id name shortName description mode mandatory restrictToFactSheetTypes
        tags{edges{node{...Tag}}}
      }

      {op:allTagGroups{edges{node{...TagGroup}}}}
    `
    return this.lx.executeGraphQL(query).then(res => {
      const tagGroups = res.op.edges
        .map(edge => edge.node)
        .filter(
          node =>
            !node.restrictToFactSheetTypes.length ||
            node.restrictToFactSheetTypes.indexOf('Application') > -1
        )
      const options = {
        shouldSort: true,
        threshold: 0.2,
        keys: ['name']
      }
      const fuse = new Fuse(tagGroups, options)
      const results = fuse.search(tagGroupSeachTerm)
      // if (!results.length) { throw Error(`could not find tagGroup "${tagGroupSeachTerm}"`) }
      if (!results.length) return
      const tagGroup = results[0]
      tagGroup.tags = tagGroup.tags.edges.map(edge => edge.node)
      this.tagGroup = tagGroup
      return tagGroup
    })
  }

  async deleteTransitionPhaseTagGroupAndTags (transitionPhaseTagGroup) {
    const deleteTagMutation = `mutation($id:ID!){deleteTag(id:$id){id}}`
    const deleteTagGroupMutation = `mutation($id:ID!){deleteTagGroup(id:$id){id}}`

    await Promise.all(transitionPhaseTagGroup.tags.map(tag => this.lx.executeGraphQL(deleteTagMutation, { id: tag.id })))
    await this.lx.executeGraphQL(deleteTagGroupMutation, { id: transitionPhaseTagGroup.id })
  }

  async createTransitionPhaseTagGroupAndTags (tagGroup) {
    let { tags } = tagGroup

    const variables = {
      name: tagGroup.name,
      mode: 'MULTIPLE',
      mandatory: false,
      description: 'Created by report leanix-report-sucessor-predecessor',
      restrictToFactSheetTypes: ['Application'],
      validateOnly: false
    }

    const mutationCreateTagGroup = `
      fragment TagGroup on TagGroup {
        id name shortName description mode mandatory restrictToFactSheetTypes
      }
      mutation(
        $name:String!,
        $shortName:String,
        $description:String,
        $mode:TagGroupModeEnum!,
        $mandatory:Boolean,
        $restrictToFactSheetTypes:[FactSheetType!],
        $validateOnly:Boolean
      ) {
        op:createTagGroup(
          name:$name,
          shortName:$shortName,
          description:$description,
          mode:$mode,
          mandatory:$mandatory,
          restrictToFactSheetTypes:$restrictToFactSheetTypes,
          validateOnly:$validateOnly
        ){...TagGroup}}
    `

    const mutationCreateTag = `
      fragment Tag on Tag {id name description color status}
      mutation($name:String!,$description:String,$color:String,$tagGroupId:ID){
        op:createTag(name:$name,description:$description,color:$color,tagGroupId:$tagGroupId){...Tag}
      }
    `

    tagGroup = await this.lx.executeGraphQL(mutationCreateTagGroup, variables).then(res => res.op)
    tagGroup.tags = await Promise.all(tags.map(tag => this.lx.executeGraphQL(mutationCreateTag, { ...tag, tagGroupId: tagGroup.id }).then(res => res.op)))
      .then(tags => tags.reduce((accumulator, tag) => {
        accumulator[tag.name] = tag
        return accumulator
      }, {}))
    this.tagGroup = tagGroup
    return tagGroup
  }

  async createBusinessCapabilities (businessCapabilities = []) {
    const mutation = `
      fragment BaseFactSheet on BaseFactSheet {id name type}
      mutation($input:BaseFactSheetInput!,$patches:[Patch]){
        op:createFactSheet(input:$input,patches:$patches){factSheet{...BaseFactSheet}}
      }
    `
    businessCapabilities = await Promise.all(businessCapabilities
      .map(businessCapability => this.lx.executeGraphQL(mutation, { input: { name: businessCapability.name, type: 'BusinessCapability' } })
        .then(res => res.op.factSheet)))
    return businessCapabilities
  }

  async createDemoApplications (applications = []) {
    const fetchLevel1BusinessCapabilitiesQuery = `query($filter:FilterInput){op:allFactSheets(filter:$filter){edges{node{...on BusinessCapability{id name level}}}}}`
    const businessCapabilityIndex = await this.lx.executeGraphQL(fetchLevel1BusinessCapabilitiesQuery, {
      filter: {
        facetFilters: [
          {facetKey: 'FactSheetTypes', operator: 'OR', keys: ['BusinessCapability']},
          {facetKey: 'hierarchyLevel', operator: 'OR', keys: ['1']}
        ]
      }
    })
      .then(res => res.op.edges.map(edge => edge.node).reduce((accumulator, bc) => { return { ...accumulator, [bc.name]: bc } }, {}))

    const tagGroup = await this.fetchTransitionPhaseTagGroup({ name: 'Transition Phase' })
      .then(tagGroup => { return { ...tagGroup, tags: tagGroup.tags.reduce((accumulator, tag) => { return { ...accumulator, [tag.name]: tag } }, {}) } })
    const createApplicationMutation = `
      fragment BaseFactSheet on BaseFactSheet {id name type}
      mutation($input:BaseFactSheetInput!,$patches:[Patch]) {
        op:createFactSheet(input:$input,patches:$patches){factSheet{...BaseFactSheet}}
      }
    `

    const updateFactsheetMutation = `
      fragment Application on Application {
        id
        name
        type
        tags{id name color}
        relToSuccessor{edges{node{factSheet{id name}}}}
      }
      mutation($id:ID!,$patches:[Patch]!){
        op:updateFactSheet(id:$id,patches:$patches){
          factSheet {
            ...Application
          }
        }
      }
    `

    const applicationIndex = await Promise.all(applications.map(application => {
      const businessCapabilitiesPatches = (application.businessCapabilities || [])
        .map(bcName => businessCapabilityIndex[bcName].id)
        .map(factSheetId => { return { op: 'add', path: `/relApplicationToBusinessCapability/new_${factSheetId}`, value: JSON.stringify({ factSheetId }) } })

      const variables = {
        input: {name: application.name, type: 'Application'},
        patches: [
          { op: 'replace', path: '/tags', value: JSON.stringify(application.tags.map(tagName => { return { tagId: tagGroup.tags[tagName].id } })) },
          // ...businessCapabilitiesPatches
        ]
      }
      return this.lx.executeGraphQL(createApplicationMutation, variables).then(res => res.op.factSheet)
    }))
      .then(applications => applications.reduce((accumulator, application) => { return { ...accumulator, [application.name]: application } }, {}))

    // add relToSuccessor relations
    applications = await Promise.all(applications
      .map(application => {
        const id = applicationIndex.hasOwnProperty(application.name) ? applicationIndex[application.name].id : undefined
        if (id === undefined) {
          console.warn(`index not found for application ${application.name}`)
        }
        const patches = application.relToSuccessor
          .map(successor => applicationIndex[successor])
          .map(successor => {
            return { op: 'add', path: `/relToSuccessor/new_${successor.id}`, value: JSON.stringify({ factSheetId: successor.id }) }
          })
        return { id, patches }
      })
      .map(variables => this.lx.executeGraphQL(updateFactsheetMutation, variables)
        .catch(err => {
          console.error(err)
        }))
    )
      .catch(err => {
        console.error(err)
      })
    return applications
  }
}
