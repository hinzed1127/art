var React = require('react')

var Peek = require('./peek')
var Department = require('./department')
var Search = require('./search')

var Browse = React.createClass({
  statics: {
    searchResults: Department.fetchData.searchResults
  },

  render() {
    return <div>
      {this.searches.map((term) => {
        var [term, facet] = term.split(':').reverse()
        return <section>
          <Peek facet={facet} q={term} quiltProps={{maxRowHeight: 600}} />
          <hr style={{visibility: 'hidden'}} />
        </section>
      })}
    </div>
  },

  searches: [
    'arch',
    'bunny',
    'room:G321',
    'artist:Rembrandt Harmensz. van Rijn',
    'artist:Stuart D. Klipper',
    'artist:Richard Avedon',
  ],
})

module.exports = Browse
