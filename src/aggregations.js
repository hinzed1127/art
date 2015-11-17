var React = require('react')
var { Link } = require('react-router')

var Aggregations = React.createClass({
  getInitialState() {
    return {
      aggs: this.buildAndSortAggregationsArray(),
      showAdder: true,
    }
  },

  componentWillReceiveProps(nextProps) {
    this.setState({aggs: this.buildAndSortAggregationsArray(nextProps)})
  },

  render() {
    const search = this.props.search
    const {aggs, showAdder} = this.state
    const customFilters = this.customFilters
    const toggleAgg = (agg) => this.toggleAggregation.bind(this, agg)
    const toggleMoreAggs = this.toggleMoreAggs

    return (
      <div id="aggs" >
        <div style={{width: '100%', overflowX: 'scroll', whiteSpace: 'nowrap', paddingBottom: '10px', paddingLeft: '10px'}}>
        {aggs.map(function(agg) {
          const aggIsActive = search.filters && search.filters.match(new RegExp(agg.name, 'i'))
          const showAgg = agg.open || aggIsActive
          if(showAgg) return (<dl key={agg.name} id={agg.name} style={{display: 'inline-block', margin: '0', verticalAlign: 'top', opacity: showAgg ? 1 : 0.5}}>
            <dt style={{fontWeight: aggIsActive && 'bold'}} onClick={toggleAgg(agg)}>{agg.displayName}</dt>
            {(agg.open || aggIsActive) && agg.buckets.slice(0, 5).map(function(bucket) {
              const filterString = customFilters[agg.name] ? customFilters[agg.name][bucket.key] || bucket.key : agg.name.toLowerCase()+':"'+bucket.key+'"'
              const filterRegex = new RegExp(decodeURIComponent(filterString).replace(/([\[\]\?])/, '\\$1'), 'i')
              const bucketIsActive = search.filters && search.filters.match(filterRegex)
              const newFilters = bucketIsActive ?
                search.filters.replace(filterRegex, '').trim() :
                `${search.filters || ''} ${filterString}`.trim()
              const bucketText = `${bucket.key || '""'}`

              if(bucket.key) return (
                <dd key={agg.name+bucket.key} style={{margin: '0', fontWeight: bucketIsActive && 'bold', textDecoration: bucketIsActive && 'underline'}}><span className='objectTotal'>
                  {<Link to={newFilters == '' ? 'searchResults' : 'filteredSearchResults'} params={{terms: `${search.query}`, splat: newFilters}}>
                      {bucketText} <span className="numbers">{bucket.doc_count}</span>
                  </Link>}</span>
                </dd>
              )
            })}
          </dl>)
        })}</div>
        <div id="more-aggs">
            <dl>{aggs.slice(3).map(agg => {
              return <dd key={agg.name} onClick={toggleAgg(agg)} style={{ background: agg.open || agg.active ? 'rgb(35,35,35)' : 'white', color: agg.open || agg.active ? 'white' : 'rgb(35,35,35)'}}>{agg.displayName}</dd>
            })}</dl>

          </div>
      </div>
    )
  },

  toggleAggregation(agg) {
    var {aggs} = this.state
    var open = aggs[aggs.indexOf(agg)].open
    aggs[aggs.indexOf(agg)].open = !open
    this.setState({aggs: aggs})
  },

  toggleMoreAggs() {
    this.setState({showAdder: !this.state.showAdder})
  },

  // Aggregations come from ES as an object with named keys.
  //     {"On View": {…}, "Artist": {…}}
  // I want a `map`able array of the objects:
  //     [{name: "On View", …}, {name: "Artist", …}]
  // This does that transform and sorts the new array in the order they should
  // be displayed.
  buildAndSortAggregationsArray(props = this.props) {
    const {search} = props
    const aggs = props.search.aggregations
    const _aggs = []
    const order = ["On View", "Image", "Department", "Artist", "Country", "Room", "Rights", "Title", "Style"]

    for(var agg in aggs) {
      const open = order.slice(0, 3).indexOf(agg) > -1
      _aggs.push({
        ...aggs[agg],
        name: agg,
        open: open,
        displayName: agg.replace(/_/g, ' '),
        active: search.filters && search.filters.match(new RegExp(agg, 'i')),
      })
    }

    // Sort aggregations in this order, with any others sorted last
    return _aggs.sort((a, b) => {
      let [_a, _b] = [order.indexOf(a.name), order.indexOf(b.name)].map(index => index == -1 ? 100 : index)
      return _a - _b
    })
  },

  customFilters: {
    'On View': {
      'On View': 'room:G*',
      'Not on View': 'room:"Not on View"'
    },
    'Gist': {}
  },
})

module.exports = Aggregations
