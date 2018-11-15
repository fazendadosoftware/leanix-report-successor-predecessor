module.exports = {
  tagGroup: {
    name: 'Transition Phase',
    tags: [
      { name: '1. Baseline', color: '#f44336' },
      { name: '2. Transition', color: '#4caf50' },
      { name: '3. Target', color: '#2196f3' },
      { name: '4. Next Level', color: '#ba68c8' },
      { name: '5. Last Level', color: '#ffa726' }
    ]
  },
  businessCapabilities: [
    { name: 'BC A' },
    { name: 'BC B' },
    { name: 'BC C' },
    { name: 'BC D' }
  ],
  applications: [
    { name: 'Application A', businessCapabilities: ['BC A'], tags: ['1. Baseline', '2. Transition', '3. Target'], relToSuccessor: [] },
    { name: 'Application B', businessCapabilities: ['BC A'], tags: ['1. Baseline', '2. Transition'], relToSuccessor: ['Application A'] },
    { name: 'Application C', businessCapabilities: ['BC A'], tags: ['1. Baseline'], relToSuccessor: ['Application B'] }
  ]
}
