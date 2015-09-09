var React = require('react')
var Router = require('react-router')
var rest = require('rest')

var ArtworkImage = require('./artwork-image')
var Markdown = require('./markdown')
var ArtworkPreview = require('./artwork-preview')
var ArtworkDetails = require('./artwork-details')

var museumTileLayer = require('museum-tile-layer')
var L = window.L = museumTileLayer

var Sticky = require('react-sticky')

var Artwork = React.createClass({
  mixins: [Router.State],
  statics: {
    fetchData: (params) => {
      return rest('http://search.staging.artsmia.org/id/'+params.id).then((r) => JSON.parse(r.entity))
    }
  },

  render() {
    var art = this.state.art
    var id = this.props.id || this.state.id
    const highlights = this.props.highlights

    return (
      <div className='artwork'>
        <div className='info'>
          <ArtworkPreview art={art} showLink={false} />
          <a href="#" onClick={() => history.go(-1)}>&larr; back</a>
          <ArtworkDetails art={art} />
        </div>

        <Sticky
          stickyStyle={{position: 'fixed', height: '100%', width: '65%', top: 0}}
          onStickyStateChange={this.resizeMap}>
          <div ref='map' id='map'>
            {this.state.zoomLoaded || <div style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', WebkitTransform: 'translate(-50%, -50%)'}}>
              <img src={`http://api.artsmia.org/images/${id}/400/medium.jpg`} />
              {art.image_copyright && <p style={{fontSize: '0.8em'}}>{decodeURIComponent(art.image_copyright)}</p>}
            </div>}
            {this.imageStatus()}
          </div>
        </Sticky>
      </div>
    )
  },

  getInitialState() {
    var art = this.props.data.artwork
    art.id = this.props.id || art.id.replace('http://api.artsmia.org/objects/', '')
    return {
      art: art,
      id: art.id,
    }
  },

  componentDidMount() {
    var art = this.state.art
    if(art.restricted != 1) this.loadZoom()
  },

  loadZoom() {
    var art = this.state.art
    this.setState({zoomLoaded: false})

    this.map = L.map(this.refs.map.getDOMNode(), {
      crs: L.CRS.Simple,
      zoomControl: false,
    })
    this.map.attributionControl.setPrefix('')

    this.map.setView([art.image_width/2, art.image_height/2], 0)
    rest('//tilesaw.dx.artsmia.org/'+this.state.id)
      .then(response => JSON.parse(response.entity))
      .then((data) => {
        this.tiles = L.museumTileLayer('http://{s}.tiles.dx.artsmia.org/{id}/{z}/{x}/{y}.png', {
        attribution: art.image_copyright ? decodeURIComponent(art.image_copyright) : '',
        id: this.state.id,
        width: data.width,
        height: data.height,
      })
      this.tiles.addTo(this.map)
      // this.tiles.fillContainer()
      this.setState({zoomLoaded: true})
    })
  },

  resizeMap() {
    if(this.map && this.tiles) {
      this.map.invalidateSize()
      this.tiles.fitBoundsExactly()
    }
  },

  imageStatus() {
    var {art, zoomLoaded} = this.state
    var copyrightAndOnViewMessage = art.room[0] == 'G' ? " (You'll have to come see it in person.)" : ''

    return <span className="imageStatus">
      {zoomLoaded === false && "(—Is that the best image you've got!!? —Nope! We're loading a bigger one right now. It can take a few seconds.)"}
      {art.restricted === 1 && "Because of © restrictions we have to show you a small image of this artwork. Sorry!" + copyrightAndOnViewMessage}
    </span>
  },
})

module.exports = Artwork
