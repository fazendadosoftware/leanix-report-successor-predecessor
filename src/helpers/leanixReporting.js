// https://leanix.github.io/leanix-reporting/interfaces/lxr.reportconfiguration.html
export const getReportConfiguration = ({setup, facetFiltersChangedCallback} = {}) => {
  const config = {
    allowTableView: false,
    facets: [
      {
        key: 'applications',
        label: 'Applications',
        fixedFactSheetType: 'Application',
        attributes: ['id', 'displayName'],
        facetFiltersChangedCallback
      }
    ]
  }
  return config
}
